import type {MathNode} from 'mathjs';
import {parseComplexAst} from '../syntax/ast';
import {readDocument,type MathDocument,type ExpressionSource} from '../syntax/document';
import {diagnosis,type Diagnostic} from '../diagnostics';
import {diagnosticOf,type MathResult,type Validation,type IntervalEvidence} from '../results';
import type {RealScope} from '../types';
import * as R from './real';
import * as C from './complex';
export const INTERVAL_EVIDENCE:IntervalEvidence=Object.freeze({backend:R.BACKEND,method:'outward-rounded-intervals',proofReference:R.PROOF_REFERENCE});
export type CellClassification='inside'|'outside'|'unknown';
type Node=MathNode&{content:MathNode;name:string;op:string;fn:MathNode;args:MathNode[];params:MathNode[];conditionals:string[]};
type Numeric=(z:C.ComplexInterval,p:RealScope)=>C.ComplexInterval;
type Predicate=(z:C.ComplexInterval,p:RealScope)=>CellClassification;
export interface IntervalProgram {readonly document:MathDocument;readonly evaluate:Numeric}
export interface IntervalMobiusProgram {readonly document:MathDocument;readonly bindInverse:(parameters?:RealScope)=>(w:C.ComplexInterval)=>C.ComplexInterval}
export interface IntervalRegionProgram {readonly document:MathDocument;readonly classify:Predicate}
const inverses=new WeakMap<MathDocument,IntervalMobiusProgram>();
const numbers=new WeakMap<MathDocument,IntervalProgram>(),regions=new WeakMap<MathDocument,IntervalRegionProgram>();
const unwrap=(n:MathNode):Node=>n.type==='ParenthesisNode'?unwrap((n as Node).content):n as Node;
const unsupported=(message:string)=>new R.IntervalFailure('operation','unsupported-interval-operation',message);
// Only a numeric lexer: mathjs remains responsible for expression structure.
// Preserve decimal tokens BEFORE mathjs turns them into rounded Number values.
function exactAst(document:MathDocument):{root:MathNode;literals:Map<string,R.Interval>} {
 const literals=new Map<string,R.Interval>();let source='',i=0;
 while(i<document.normalized.length){const rest=document.normalized.slice(i),identifier=/^[A-Za-z_][A-Za-z_0-9]*/.exec(rest),number=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
  if(identifier){if(identifier[0].startsWith('__interval_literal_'))throw unsupported('Зарезервированное имя интервального литерала.');source+=identifier[0];i+=identifier[0].length;}
  else if(number){const key='__interval_literal_'+literals.size;literals.set(key,R.decimal(number[0]));source+='('+key+')';i+=number[0].length;}
  else source+=document.normalized[i++];
 }return {root:parseComplexAst(source),literals};
}
function builders(document:MathDocument){
 const {root,literals}=exactAst(document);
 function numeric(root:MathNode):Numeric {
  const n=unwrap(root);
  if(n.type==='SymbolNode'){
   if(literals.has(n.name)){const value=literals.get(n.name)!;return ()=>C.rectangle({...value});}
   if(n.name==='z')return z=>z;if(n.name==='i')return ()=>C.point(0,1);
   if(['pi','e'].includes(n.name))throw unsupported(`Для константы ${n.name} пока нет верифицированного интервального ограждения.`);
   if(!document.parameters.includes(n.name))throw unsupported(`Интервальная переменная ${n.name} не поддерживается.`);
   return (_z,p)=>{if(!Object.hasOwn(p,n.name)||!Number.isFinite(p[n.name]))throw new R.IntervalFailure('syntax','interval-parameter',`Задайте конечный параметр ${n.name}.`);return C.point(p[n.name]);};
  }
  if(n.type==='OperatorNode'){
   if(n.args.length===1&&['+','-'].includes(n.op)){const a=numeric(n.args[0]);return (z,p)=>n.op==='-'?C.negate(a(z,p)):a(z,p);}
   if(n.op==='^'&&n.args.length===2){
    // Exponents may depend on parameters, but must evaluate to a proven integer.
    const a=numeric(n.args[0]),exponent=numeric(n.args[1]);return (z,p)=>{const b=exponent(z,p);if(!R.singleton(b.im,0)||b.re.lower!==b.re.upper||!Number.isSafeInteger(b.re.lower))throw unsupported('Для проверки нужна точно заданная целая степень.');return C.integerPower(a(z,p),b.re.lower);};
   }
   if(n.args.length===2&&['+','-','*','/'].includes(n.op)){const a=numeric(n.args[0]),b=numeric(n.args[1]),operation=n.op==='+'?C.add:n.op==='-'?C.subtract:n.op==='*'?C.multiply:C.divide;return (z,p)=>operation(a(z,p),b(z,p));}
  }
  if(n.type==='FunctionNode'&&n.fn.type==='SymbolNode'&&n.args.length===1){const a=numeric(n.args[0]);
   if(['Re','re','Im','im'].includes(n.name))return (z,p)=>C.rectangle(a(z,p)[n.name.toLowerCase() as 're'|'im']);
   if(n.name==='conj')return (z,p)=>C.conjugate(a(z,p));if(n.name==='abs')return (z,p)=>C.rectangle(C.modulus(a(z,p)));
   if(n.name==='sqrt')return (z,p)=>{const v=a(z,p);if(!R.singleton(v.im,0))throw unsupported('Верифицированный комплексный корень пока не реализован.');return C.rectangle(R.squareRoot(v.re));};
   throw unsupported(`Операция ${n.name} не имеет верифицированной интервальной реализации.`);
  }
  throw unsupported(`Интервальный вычислитель не поддерживает узел ${n.type}.`);
 }
 const real=(v:C.ComplexInterval)=>{if(!R.singleton(v.im,0))throw unsupported('Неравенство требует доказанно вещественного выражения.');return v.re;};
 function comparison(a:Numeric,b:Numeric,op:string):Predicate {return (z,p)=>{
  const A=a(z,p),B=b(z,p);
  if(['==','!='].includes(op)){
   const disjoint=!C.intersection(A,B),equal=A.re.lower===A.re.upper&&A.im.lower===A.im.upper&&C.includes(A,B)&&C.includes(B,A);
   return op==='!='?(disjoint?'inside':equal?'outside':'unknown'):(equal?'inside':disjoint?'outside':'unknown');
  }
  const x=real(A),y=real(B);
  if(op==='<'||op==='<='){const strict=op==='<';return (strict?x.upper<y.lower:x.upper<=y.lower)?'inside':(strict?x.lower>=y.upper:x.lower>y.upper)?'outside':'unknown';}
  if(op==='>'||op==='>=')return comparison(b,a,op==='>'?'<':'<=')(z,p);
  throw unsupported('Неподдерживаемое интервальное сравнение.');
 };}
 function predicate(root:MathNode):Predicate {
  const n=unwrap(root);
  if(n.type==='OperatorNode'&&['and','or'].includes(n.op)&&n.args.length===2){const a=predicate(n.args[0]),b=predicate(n.args[1]);return (z,p)=>{const A=a(z,p);if(n.op==='and'&&A==='outside'||n.op==='or'&&A==='inside')return A;const B=b(z,p);return n.op==='and'?(B==='outside'?'outside':A==='inside'&&B==='inside'?'inside':'unknown'):(B==='inside'?'inside':A==='outside'&&B==='outside'?'outside':'unknown');};}
  if(n.type==='OperatorNode'&&['<','<=','>','>=','==','!='].includes(n.op)&&n.args.length===2)return comparison(numeric(n.args[0]),numeric(n.args[1]),n.op);
  if(n.type==='RelationalNode'){
   // Cyclic angular lifts need a separate validated trigonometric backend.
   const ops:Record<string,string>={smaller:'<',smallerEq:'<=',larger:'>',largerEq:'>='};const clauses=n.conditionals.map((op,i)=>comparison(numeric(n.params[i]),numeric(n.params[i+1]),ops[op]));
   return (z,p)=>{let unknown=false;for(const clause of clauses){const s=clause(z,p);if(s==='outside')return s;unknown||=s==='unknown';}return unknown?'unknown':'inside';};
  }
  if(n.type==='FunctionNode'&&n.name==='excludeSegment'&&n.args.length===3&&unwrap(n.args[0]).name==='z'){
   const start=numeric(n.args[1]),end=numeric(n.args[2]);return (z,p)=>{
    const a=start(z,p),b=end(z,p),x=R.interval(Math.min(a.re.lower,b.re.lower),Math.max(a.re.upper,b.re.upper)),y=R.interval(Math.min(a.im.lower,b.im.lower),Math.max(a.im.upper,b.im.upper));
    if(!R.intersection(z.re,x)||!R.intersection(z.im,y))return 'inside';
    const d=C.subtract(b,a),v=C.subtract(z,a),cross=R.subtract(R.multiply(d.re,v.im),R.multiply(d.im,v.re));
    if(!R.containsZero(cross))return 'inside';
    // Overlap remains unknown rather than trusting a float64 collinearity test.
    return 'unknown';
   };
  }
  throw unsupported('Для этого условия области нет верифицированного интервального классификатора.');
 }
 function mobius():(parameters?:RealScope)=>(w:C.ComplexInterval)=>C.ComplexInterval {
  const hasZ=(root:MathNode)=>{let found=false;root.traverse(n=>{if(n.type==='SymbolNode'&&(n as Node).name==='z')found=true;});return found;};
  type Affine=(p:RealScope)=>{a:C.ComplexInterval;b:C.ComplexInterval};
  function affine(root:MathNode):Affine {
   const n=unwrap(root);
   if(!hasZ(n)){const constant=numeric(n);return p=>({a:C.point(0),b:constant(C.point(0),p)});}
   if(n.type==='SymbolNode'&&n.name==='z')return ()=>({a:C.point(1),b:C.point(0)});
   if(n.type==='OperatorNode'&&['+','-'].includes(n.op)){
    const a=affine(n.args[0]);if(n.args.length===1)return p=>{const A=a(p);return n.op==='-'?{a:C.negate(A.a),b:C.negate(A.b)}:A;};
    const b=affine(n.args[1]),op=n.op==='+'?C.add:C.subtract;return p=>{const A=a(p),B=b(p);return {a:op(A.a,B.a),b:op(A.b,B.b)};};
   }
   if(n.type==='OperatorNode'&&n.op==='*'&&n.args.length===2){const first=!hasZ(n.args[0]),second=!hasZ(n.args[1]);if(first||second){const k=numeric(n.args[first?0:1]),a=affine(n.args[first?1:0]);return p=>{const A=a(p),K=k(C.point(0),p);return {a:C.multiply(A.a,K),b:C.multiply(A.b,K)};};}}
   if(n.type==='OperatorNode'&&n.op==='/'&&n.args.length===2&&!hasZ(n.args[1])){const a=affine(n.args[0]),k=numeric(n.args[1]);return p=>{const A=a(p),K=k(C.point(0),p);return {a:C.divide(A.a,K),b:C.divide(A.b,K)};};}
   throw unsupported('Полный верифицированный обратный план пока реализован для невырожденных (a*z+b)/(c*z+d). Полиномиальные ограждения доступны в прямом направлении.');
  }
  const n=unwrap(root),quotient=n.type==='OperatorNode'&&n.op==='/'&&n.args.length===2;
  const numerator=affine(quotient?n.args[0]:n),denominator=quotient?affine(n.args[1]):()=>({a:C.point(0),b:C.point(1)});
  return (parameters={})=>{const snapshot={...parameters},A=numerator(snapshot),B=denominator(snapshot),det=C.subtract(C.multiply(A.a,B.b),C.multiply(A.b,B.a));
   if(C.containsZero(det))throw new R.IntervalFailure('uncertain','interval-degenerate-map','Не доказана невырожденность отображения Мёбиуса: интервал определителя содержит ноль.');
   return w=>C.divide(C.subtract(C.multiply(B.b,w),A.b),C.subtract(A.a,C.multiply(B.a,w)));
  };
 }
 return {root,numeric,predicate,mobius};
}
function compile<T>(input:string|ExpressionSource,region:boolean):Validation<T>{
 const read=readDocument(typeof input==='string'?{text:input,notation:'latex',role:region?'geometry':'mapping'}:input);if(!read.ok)return read;
 const document=read.value;
 try{const previous=region?regions.get(document):numbers.get(document);if(previous)return {ok:true,value:previous as T};const b=builders(document);
  const result=region?{document,classify:b.predicate(b.root)}:{document,evaluate:b.numeric(b.root)};Object.freeze(result);if(region)regions.set(document,result as IntervalRegionProgram);else numbers.set(document,result as IntervalProgram);return {ok:true,value:result as T};
 }catch(e){return {ok:false,diagnostic:diagnosticOf(e,'operation')};}
}
export const compileIntervalExpression=(input:string|ExpressionSource)=>compile<IntervalProgram>(input,false);
export const compileIntervalRegion=(input:string|ExpressionSource)=>compile<IntervalRegionProgram>(input,true);
function intervalConfirmed<T>(enclosure:T):MathResult<T>{return {kind:'interval-confirmed',enclosure,verification:INTERVAL_EVIDENCE,diagnostics:[]};}
export function failedInterval<T>(error:unknown):MathResult<T>{const reason=diagnosticOf(error,'numeric');return {kind:'uncertain',reason,diagnostics:[reason]};}
export function encloseExpression(program:IntervalProgram,z:C.ComplexInterval,parameters:RealScope={}):MathResult<C.ComplexInterval>{try{validateRectangle(z);return intervalConfirmed(program.evaluate(z,parameters));}catch(e){return failedInterval(e);}}
export function classifyIntervalRegion(program:IntervalRegionProgram,z:C.ComplexInterval,parameters:RealScope={}):MathResult<CellClassification>{try{validateRectangle(z);const status=program.classify(z,parameters);return classificationResult(status);}catch(e){return failedInterval(e);}}
export function classificationResult(status:CellClassification):MathResult<CellClassification> {if(status!=='unknown')return intervalConfirmed(status);const reason:Diagnostic=diagnosis('uncertain','interval-boundary','Интервальное ограждение пересекает границу: принадлежность ячейки не установлена.');return {kind:'uncertain',partial:'unknown',reason,diagnostics:[reason]};}

function validateRectangle(z:C.ComplexInterval){R.interval(z.re.lower,z.re.upper);R.interval(z.im.lower,z.im.upper);}

/** Complete finite preimage for structurally affine / Möbius syntax only. */
export function compileIntervalMobius(input:string|ExpressionSource):Validation<IntervalMobiusProgram>{
 const read=readDocument(typeof input==='string'?{text:input,notation:'latex',role:'mapping'}:input);if(!read.ok)return read;
 const document=read.value,old=inverses.get(document);if(old)return {ok:true,value:old};
 try{const b=builders(document),program=Object.freeze({document,bindInverse:b.mobius()});inverses.set(document,program);return {ok:true,value:program};}catch(e){return {ok:false,diagnostic:diagnosticOf(e,'operation')};}
}
export function classifyIntervalImage(region:IntervalRegionProgram,mapping:IntervalMobiusProgram,cell:C.ComplexInterval,parameters:RealScope={}):MathResult<CellClassification>{
 try{validateRectangle(cell);return classificationResult(region.classify(mapping.bindInverse(parameters)(cell),parameters));}catch(e){return failedInterval(e);}
}
