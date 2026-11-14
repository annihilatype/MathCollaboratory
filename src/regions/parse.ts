import type { MathNode } from 'mathjs';
import { evaluateComplexNode } from '../complex/math';
import { circleOffset } from '../complex/offset';
import { boundary, constraint,intersectRegions,unionRegions, type Region } from './model';
type Node=MathNode&{content:MathNode;op:string;args:MathNode[];conditionals:string[];params:MathNode[];fn:MathNode;name:string};
const comparisons:Record<string,string>={smaller:'<',smallerEq:'<=',larger:'>',largerEq:'>=',equal:'==',unequal:'!='};
const all=():Region=>({kind:'region',constraints:[],excluded:[]});
const empty=():Region=>({kind:'region',constraints:[constraint(0,0,0,1,false)],excluded:[]});
const unwrap=(n:MathNode):Node=>n.type==='ParenthesisNode'?unwrap((n as Node).content):n as Node;
function trig(a:number){const q=a/(Math.PI/2),i=Math.round(q);return a===i*(Math.PI/2)?{s:[0,1,0,-1][((i%4)+4)%4],c:[1,0,-1,0][((i%4)+4)%4]}:{s:Math.sin(a),c:Math.cos(a)};}
// Angular windows use a cyclic lift; numerical arg/Arg retain (-pi,pi].
function sector(lo:number,hi:number,lowerStrict:boolean,upperStrict:boolean):Region{
  if(hi<lo)return empty();
  const width=hi-lo;if(width>2*Math.PI||(width===2*Math.PI&&(!lowerStrict||!upperStrict)))return {...all(),excluded:[{re:0,im:0}]};
  if(width===0){if(!lowerStrict&&!upperStrict)throw new Error('Вырожденное замкнутое угловое окно задаёт отдельный луч; его образ пока не поддерживается. Задайте интервал ненулевой ширины.');return empty();}
  const result:Region[]=[];const count=Math.ceil(width/Math.PI);
  for(let i=0;i<count;i++){
    const a=lo+width*i/count,b=lo+width*(i+1)/count,A=trig(a),B=trig(b);
    const qs=[{...constraint(0,A.s,-A.c,0,i===0?lowerStrict:false),...(i>0?{internal:true}:{})},{...constraint(0,-B.s,B.c,0,i===count-1?upperStrict:false),...(i<count-1?{internal:true}:{})}];
    result.push({kind:'region',constraints:qs,excluded:[{re:0,im:0}],...(lo< -Math.PI||hi>Math.PI?{angleConvention:'Угловое окно трактуется по модулю 2π; числовой Arg ∈ (−π,π].'}:{})});
  }
  return unionRegions(result);
}
export function parseRegion(root:MathNode,parameters:Readonly<Record<string,number>>={}):Region {
  let clauses=0,conditions=0;
  const number=(node:MathNode)=>{const v=evaluateComplexNode(node,parameters);if(v.im!==0)throw new Error('Граница должна быть вещественной.');return v.re;};
  const hasZ=(node:MathNode)=>{let found=false;node.traverse(n=>{if(n.type==='SymbolNode'&&(n as Node).name==='z')found=true;});return found;};
  function metric(root:MathNode):{kind:'re'|'im'|'radius'|'arg'|'absRe'|'absIm'|'absArg';x?:number;y?:number}|null{
    const n=unwrap(root);if(n.type!=='FunctionNode'||n.fn.type!=='SymbolNode'||n.args.length!==1)return null;
    const a=unwrap(n.args[0]);
    if(['Re','Im','re','im','arg','Arg'].includes(n.name)){
      if(a.type!=='SymbolNode'||a.name!=='z')throw new Error('В Re/Im/arg области разрешено только z.');
      return {kind:['arg','Arg'].includes(n.name)?'arg':n.name.toLowerCase() as 're'|'im'};
    }
    if(n.name==='abs'){
      const inner=metric(n.args[0]);if(inner?.kind==='re')return {kind:'absRe'};if(inner?.kind==='im')return {kind:'absIm'};if(inner?.kind==='arg')return {kind:'absArg'};
      const c=circleOffset(n.args[0],parameters);return {kind:'radius',x:-c.re,y:-c.im};
    }return null;
  }
  function compare(left:MathNode,right:MathNode,op:string):Region{
    if(++conditions>24)throw new Error('Не более 24 условий области.');
    if(!hasZ(left)&&!hasZ(right)){
      const a=number(left),b=number(right),yes=op==='<'?a<b:op==='<='?a<=b:op==='>'?a>b:op==='>='?a>=b:op==='=='?a===b:a!==b;return yes?all():empty();
    }
    const L=unwrap(left);
    if(L.type==='SymbolNode'&&L.name==='z'&&op==='!='){const v=evaluateComplexNode(right,parameters);return {...all(),excluded:[{re:v.re,im:v.im}]};}
    let m=metric(left),valueNode=right;
    if(!m){m=metric(right);valueNode=left;op=({'<':'>','>':'<','<=':'>=','>=':'<=','==':'==','!=':'!='} as Record<string,string>)[op];}
    if(!m)throw new Error('Допустимы сравнения Re, Im, |z-c|, arg(z), z != точка; исключение отрезка: z notin [a,b].');
    const v=number(valueNode),strict=!op.includes('='),less=op.startsWith('<');
    if(m.kind==='arg'){
      if(op==='=='||op==='!=')throw new Error('Для аргумента задайте угловой интервал.');
      if(less)return sector(-Math.PI,Math.min(v,Math.PI),true,op==='<'||v< -Math.PI);
      return sector(Math.max(v,-Math.PI),Math.PI,op==='>'||v>Math.PI,false);
    }
    if(m.kind==='absArg'){
      if(v>Math.PI)return less?{...all(),excluded:[{re:0,im:0}]}:empty();
      if(op==='=='||op==='!=')throw new Error('Равенство модуля аргумента задаёт отдельные лучи; используйте угловое окно ненулевой ширины.');
      if(v<0)return less?empty():{...all(),excluded:[{re:0,im:0}]};
      if(v===0){if(op==='<')return empty();if(op==='<=')throw new Error('Нулевое замкнутое окно задаёт луч; задайте интервал ненулевой ширины.');if(op==='>=')return {...all(),excluded:[{re:0,im:0}]};return unionRegions([sector(-Math.PI,0,true,true),sector(0,Math.PI,true,false)]);}
      if(less)return sector(Math.max(-v,-Math.PI),Math.min(v,Math.PI),strict,strict);
      return unionRegions([sector(-Math.PI,-v,true,strict),sector(v,Math.PI,strict,false)]);
    }
    if(m.kind==='absRe'||m.kind==='absIm'){
      if(v<0)throw new Error('Ширина полосы должна быть неотрицательной.');
      const axis=m.kind==='absRe'?'re':'im',upper:Region={...all(),constraints:[constraint(0,axis==='re'?1:0,axis==='im'?1:0,-v,strict)]},lower:Region={...all(),constraints:[constraint(0,axis==='re'?-1:0,axis==='im'?-1:0,-v,strict)]};
      if(op==='=='||op==='!=')throw new Error('Для полосы используйте <, <=, > или >=.');
      if(less){const result=intersectRegions(upper,lower);return v===0&&op==='<='?{...result,equality:{kind:'line',axis,value:0}}:result;}
      return unionRegions([upper,lower].map(r=>({...r,constraints:r.constraints.map(q=>constraint(-q.a,-q.b,-q.c,-q.d,q.strict))})));
    }
    const sign=less?1:-1;
    let q;
    if(m.kind==='radius'){
      if(v<=0)throw new Error('Радиус области должен быть положительным.');
      const x=m.x!,y=m.y!;q=constraint(sign,-2*sign*x,-2*sign*y,sign*(x*x+y*y-v*v),strict);
      const shape=boundary(q);if(shape.kind!=='circle'||!Number.isFinite(shape.radius)||Math.abs(shape.radius-v)>v*1e-7)throw new Error('Радиус и центр нельзя надёжно представить с доступной числовой точностью.');
    }else q=constraint(0,m.kind==='re'?sign:0,m.kind==='im'?sign:0,-sign*v,strict);
    if(op==='=='||op==='!='){
      if(op==='!=')throw new Error('Исключать можно точки и отрезки; для окружности используйте объединение внутренности и внешности.');
      const equality=m.kind==='radius'?{kind:'circle' as const,center:{re:m.x!,im:m.y!},radius:v}:{kind:'line' as const,axis:m.kind as 're'|'im',value:v};
      return {...all(),constraints:[{...q,strict:false},constraint(-q.a,-q.b,-q.c,-q.d,false)],equality};
    }
    return {...all(),constraints:[q]};
  }
  function visit(root:MathNode):Region{
    const n=unwrap(root);if(++clauses>48)throw new Error('Область слишком сложная: не более 24 условий.');
    if(n.type==='OperatorNode'&&['and','or'].includes(n.op)&&n.args.length===2){const a=visit(n.args[0]),b=visit(n.args[1]);return n.op==='and'?intersectRegions(a,b):unionRegions([a,b]);}
    if(n.type==='FunctionNode'&&n.fn.type==='SymbolNode'&&n.name==='excludeSegment'&&n.args.length===3){
      if(unwrap(n.args[0]).name!=='z')throw new Error('Исключение отрезка задаётся для z.');const a=evaluateComplexNode(n.args[1],parameters),b=evaluateComplexNode(n.args[2],parameters);
      return {...all(),excludedSegments:[{start:{re:a.re,im:a.im},end:{re:b.re,im:b.im}}]};
    }
    if(n.type==='RelationalNode'&&n.params.length>=3&&n.conditionals.every(c=>['smaller','smallerEq','larger','largerEq'].includes(c))){
      if(n.params.length===3&&metric(n.params[1])?.kind==='arg'&&['smaller','smallerEq'].includes(n.conditionals[0])&&['smaller','smallerEq'].includes(n.conditionals[1]))return sector(number(n.params[0]),number(n.params[2]),n.conditionals[0]==='smaller',n.conditionals[1]==='smaller');
      let result=all();for(let i=0;i<n.conditionals.length;i++)result=intersectRegions(result,compare(n.params[i],n.params[i+1],comparisons[n.conditionals[i]]));return result;
    }
    if(n.type==='OperatorNode'&&['<','<=','>','>=','==','!='].includes(n.op)&&n.args.length===2)return compare(n.args[0],n.args[1],n.op);
    throw new Error('Укажите условие области; объединение — or, пересечение — and или запятая в {z:…}.');
  }
  return visit(root);
}
