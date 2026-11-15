import { inversePipeline } from './pipeline';
import { diagnosis,type Diagnostic } from '../math/diagnostics';
import { complex, add, subtract, multiply, divide, conj, type Complex, type MathNode } from 'mathjs';
import { isJoukowski } from '../complex/laurent';
import { explainInversePlan, type InversePlan } from './inverse';
import { evaluateComplexNode,isEuler } from '../complex/math';
import type { ComplexCoordinate, ComplexMapping } from '../complex/geometry';
import { boundary, constraint, contains, partsOf,unionRegions, type Region, type RegionTransform } from './model';
const z=(re=0,im=0)=>complex(re,im),as=(v:ComplexCoordinate)=>z(v.re,v.im);
const plus=(a:ComplexCoordinate,b:ComplexCoordinate)=>add(as(a),as(b)) as Complex;
const minus=(a:ComplexCoordinate,b:ComplexCoordinate)=>subtract(as(a),as(b)) as Complex;
const times=(a:ComplexCoordinate,b:ComplexCoordinate)=>multiply(as(a),as(b)) as Complex;
const over=(a:ComplexCoordinate,b:ComplexCoordinate)=>divide(as(a),as(b)) as Complex;
const bar=(a:ComplexCoordinate)=>conj(as(a)) as Complex;
const zero=(a:ComplexCoordinate)=>a.re===0&&a.im===0;
type Mobius=Extract<RegionTransform,{kind:'mobius'}>;
type Node=MathNode&{content:MathNode;op:string;args:MathNode[];fn:MathNode;name:string};
const unwrap=(n:MathNode):Node=>n.type==='ParenthesisNode'?unwrap((n as Node).content):n as Node;
function constant(n:MathNode,parameters:Readonly<Record<string,number>>={}):Complex|null {try{return evaluateComplexNode(n,parameters);}catch{return null;}}
function normalized(m:Mobius):Mobius|null {
  const scale=Math.max(...[m.a,m.b,m.c,m.d].map(v=>Math.hypot(v.re,v.im)));
  if(!Number.isFinite(scale)||scale===0)return null;
  const [a,b,c,d]=[m.a,m.b,m.c,m.d].map(v=>({re:v.re/scale,im:v.im/scale}));
  if(zero(minus(times(a,d),times(b,c))))return null;
  return {...m,a,b,c,d};
}
// Structural recognition only: never infer an exact transformation by sampling.
export function recognizeTransform(root:MathNode,parameters:Readonly<Record<string,number>>={}):RegionTransform|undefined {
  function visit(root:MathNode):Mobius|null {
    const n=unwrap(root);
    if(n.type==='SymbolNode'&&n.name==='z')return {kind:'mobius',a:z(1),b:z(),c:z(),d:z(1),conjugate:false,excluded:[]};
    if(n.type==='FunctionNode'&&n.fn.type==='SymbolNode'&&n.name==='conj'&&n.args.length===1){
      const m=visit(n.args[0]);return m?{...m,a:bar(m.a),b:bar(m.b),c:bar(m.c),d:bar(m.d),conjugate:!m.conjugate}:null;
    }
    if(n.type!=='OperatorNode'||!['+','-','*','/'].includes(n.op))return null;
    if(n.args.length===1){const m=visit(n.args[0]);return m?(n.op==='-'?{...m,a:times(z(-1),m.a),b:times(z(-1),m.b)}:m):null;}
    if(n.args.length!==2)return null;
    const left=constant(n.args[0],parameters),right=constant(n.args[1],parameters);
    if(right){
      const m=visit(n.args[0]);if(!m)return null;
      if(n.op==='+'||n.op==='-'){const k=n.op==='-'?times(z(-1),right):right;return normalized({...m,a:plus(m.a,times(k,m.c)),b:plus(m.b,times(k,m.d))});}
      if(zero(right))return null;
      const k=n.op==='/'?over(z(1),right):right;return normalized({...m,a:times(k,m.a),b:times(k,m.b)});
    }
    if(left){
      const m=visit(n.args[1]);if(!m)return null;
      if(n.op==='/'){
        const holes=[...m.excluded];
        if(!zero(m.c)){const pole=over(times(z(-1),m.d),m.c);holes.push(m.conjugate?bar(pole):pole);}
        return zero(left)?null:normalized({...m,a:times(left,m.c),b:times(left,m.d),c:m.a,d:m.b,excluded:holes});
      }
      if(n.op==='*')return zero(left)?null:normalized({...m,a:times(left,m.a),b:times(left,m.b)});
      const sign=n.op==='-'?z(-1):z(1);
      return normalized({...m,a:plus(times(sign,m.a),times(left,m.c)),b:plus(times(sign,m.b),times(left,m.d))});
    }
    if(n.op==='/'){
      const a=visit(n.args[0]),b=visit(n.args[1]);
      if(a&&b&&zero(a.c)&&zero(b.c)&&a.conjugate===b.conjugate)return normalized({kind:'mobius',a:over(a.a,a.d),b:over(a.b,a.d),c:over(b.a,b.d),d:over(b.b,b.d),conjugate:a.conjugate,excluded:[...a.excluded,...b.excluded]});
    }
    return null;
  }
  const n=unwrap(root);
  if(isJoukowski(root,parameters))return {kind:'joukowski'};
  if((n.type==='FunctionNode'&&n.fn.type==='SymbolNode'&&n.name==='exp'&&n.args.length===1)||(n.type==='OperatorNode'&&n.op==='^'&&n.args.length===2&&isEuler(n.args[0]))){
    const affine=visit(n.args[n.type==='OperatorNode'?1:0]);
    if(affine&&zero(affine.c)&&!affine.conjugate&&affine.excluded.length===0){const scale=over(affine.a,affine.d),offset=over(affine.b,affine.d);return zero(minus(scale,z(1)))&&zero(offset)?{kind:'exponential'}:{kind:'exponential',scale,offset};}
  }
  if(n.type==='OperatorNode'&&n.op==='^'&&n.args.length===2&&unwrap(n.args[0]).type==='SymbolNode'&&unwrap(n.args[0]).name==='z'){
    const exponent=constant(n.args[1],parameters);if(exponent?.im===0&&Number.isInteger(exponent.re)&&exponent.re>=1&&exponent.re<=32)return {kind:'power',exponent:exponent.re};
  }
  return visit(n)??undefined;
}
export function regionTransform(root:MathNode,parameters:Readonly<Record<string,number>>={}):RegionTransform|undefined {
  try{return inversePipeline(root,parameters,n=>recognizeTransform(n,parameters));}catch{return undefined;}
}
export function describeRegionTransform(root:MathNode,parameters:Readonly<Record<string,number>>={}):{transform?:RegionTransform;diagnostic?:Diagnostic}{
  try{return {transform:inversePipeline(root,parameters,n=>recognizeTransform(n,parameters))};}
  catch(e){const error=e as Error&{kind?:Diagnostic['kind'];code?:string};return {diagnostic:diagnosis(error.kind??'operation',error.code??'inverse-plan',error.message)};}
}
export interface RegionImage { region:Region|null; notice:string; accuracy:'exact'|'approximate'|'unsupported'; approximation?:InversePlan; diagnostic?:Diagnostic }
export function mapRegion(region:Region,mapping:ComplexMapping):RegionImage {
  const m=mapping.regionTransform;
  const problem=mapping.regionDiagnostic??diagnosis('operation','inverse-operation','Для этой операции пока нет полного обратного плана заливки.');
  const unsupported:RegionImage={region:null,accuracy:'unsupported',notice:`Образ области не закрашен: ${problem.message}`,diagnostic:problem};
  if(!m)return unsupported;
  function approximate():RegionImage {
    if(!m)return unsupported;
    const result=explainInversePlan(region,m),approximation=result.plan;
    if(!approximation)return {...unsupported,diagnostic:result.diagnostic,notice:`Образ области не закрашен: ${result.diagnostic?.message}`};
    return {region:null,approximation,accuracy:'approximate',notice:'Приближённый образ: закрашены подтверждённые участки; штриховка обозначает численную неопределённость у границ или особенностей.',diagnostic:diagnosis('uncertain','interval-enclosure','Проверка принадлежности через все допустимые обратные ветви; пограничные ячейки требуют уточнения.')};
  }
  try{
    const boundaryParts=partsOf(region).filter(p=>p.equality);
    if(boundaryParts.length&&(!partsOf(region).every(p=>p.equality)||!boundaryParts.every(p=>JSON.stringify(p.equality)===JSON.stringify(boundaryParts[0].equality))))return {...unsupported,diagnostic:diagnosis('domain','mixed-dimensions','Объединение разных одномерных границ или границы с областью.'),notice:'Образы объединения разных одномерных границ или границы с областью пока не строятся совместно. Разбейте их на отдельные выражения.'};
    if(partsOf(region).every(p=>p.equality))return {region:null,accuracy:'approximate',notice:'Образ границы строится как параметрическая кривая, без закраски; неразрешённые участки пропускаются.'};
    if(region.union){
      const images=partsOf(region).map(r=>mapRegion(r,mapping));
      if(images.every(r=>r.region&&r.accuracy==='exact'))return {region:unionRegions(images.map(r=>r.region!)),accuracy:'exact',notice:''};
      return approximate();
    }
    if(region.equality)return {...unsupported,notice:'Образ границы строится как параметрическая кривая, без закраски.'};
    if(m.kind==='exponential'||m.kind==='joukowski'||m.kind==='composition')return approximate();
    if(region.excludedSegments?.length)return approximate();
    if(m.kind==='power'){
      if(region.excluded.some(p=>!zero(p)))return approximate();
      const constraints=[];
      for(const q of region.constraints){
        const b=boundary(q);if(b.kind!=='circle'||b.x!==0||b.y!==0)return approximate();
        const r=b.radius**m.exponent,sign=b.inside?1:-1;
        if(r===0)throw new Error('precision');
        if(!Number.isFinite(r)||r>1e9)return approximate();
        constraints.push(constraint(sign,0,0,-sign*r*r,q.strict));
      }
      return {region:{kind:'region',constraints,excluded:region.excluded.map(p=>({...p}))},notice:'',accuracy:'exact'};
    }
    const p=as(m.d),q=times(z(-1),m.b),r=times(z(-1),m.c),s=as(m.a);
    const norm=(v:ComplexCoordinate)=>v.re*v.re+v.im*v.im;
    const pq=times(p,bar(q)),rs=times(r,bar(s)),pr=times(p,bar(r)),ps=times(p,bar(s)),qr=times(q,bar(r)),qs=times(q,bar(s));
    const constraints=region.constraints.map(k=>{
      const C=m.conjugate?-k.c:k.c;
      const transformed=constraint(k.a*norm(p)+k.b*pr.re+C*pr.im+k.d*norm(r),
        k.a*2*pq.re+k.b*(ps.re+qr.re)+C*(ps.im+qr.im)+k.d*2*rs.re,
        -k.a*2*pq.im+k.b*(-ps.im+qr.im)+C*(ps.re-qr.re)-k.d*2*rs.im,
        k.a*norm(q)+k.b*qs.re+C*qs.im+k.d*norm(s),k.strict);
      return k.internal?{...transformed,internal:true}:transformed;
    });
    if(constraints.some(q=>{const b=boundary(q);return b.kind==='constant'||(b.kind==='circle'&&(!Number.isFinite(b.radius)||b.radius===0));}))throw new Error('precision');
    const excluded=[...region.excluded,...m.excluded].flatMap(p=>{
      const u=m.conjugate?bar(p):p,denominator=plus(times(m.c,u),m.d);
      if(zero(denominator))return [];
      return [over(plus(times(m.a,u),m.b),denominator)];
    });
    if(!zero(m.c))excluded.push(over(m.a,m.c)); // No finite source maps to the image of infinity.
    if(excluded.some(p=>!Number.isFinite(p.re)||!Number.isFinite(p.im)))return unsupported;
    const punctures=excluded.filter(p=>contains({kind:'region',constraints,excluded:[]},p));
    return {region:{kind:'region',constraints,excluded:punctures},notice:'',accuracy:'exact'};
  }catch{return {region:null,accuracy:'unsupported',notice:'Образ области не закрашен: границы выходят за доступную числовую точность.'};}
}
