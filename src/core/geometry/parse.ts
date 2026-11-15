import type {Diagnostic} from '../diagnostics';
import { geometrySource } from '../parameters';
import { type MathNode } from 'mathjs';
import { circleOffset } from './offset';
import { setConditions } from '../regions/setNotation';
import { parseRegion } from '../regions/parse';
import type { Region, RegionTransform } from '../regions/model';
import { complexSource, evaluateComplex, evaluateComplexNode, parseComplexAst } from '../evaluation/complex';
export type {ComplexCoordinate} from '../types';
export type {ComplexGeometry} from './types';
export type {ComplexMapping} from '../mapping/types';
import type {ComplexGeometry} from './types';
export type GeometryProgram=(parameters:Readonly<Record<string,number>>)=>ComplexGeometry;
const programs=new Map<string,GeometryProgram>();
export function parseComplexGeometry(latex:string,parameters:Readonly<Record<string,number>>={}):ComplexGeometry{return prepareGeometry(latex)(parameters);}
export function prepareGeometry(latex:string):GeometryProgram {
 const cached=programs.get(latex);if(cached){programs.delete(latex);programs.set(latex,cached);return cached;}
 const program=buildGeometry(latex);programs.set(latex,program);if(programs.size>128)programs.delete(programs.keys().next().value!);return program;
}
function buildGeometry(latex:string):GeometryProgram {
 const conditions=setConditions(latex),source=complexSource(conditions??latex).trim();
 if(!source)throw new Error('Введите комплексное число или уравнение объекта.');
 if(conditions!==null||/[<>!]/.test(source)||/\b(?:and|or|notin)\b/.test(source)){const root=parseComplexAst(geometrySource(latex).source);return p=>parseRegion(root,p);}
 const parts=source.split('=');if(parts.length>2)throw new Error('Ожидается одно равенство.');const left=parts[0].trim();
 if(parts.length===2&&left!=='z'){
  const rhs=parseComplexAst(parts[1]),line=/^(Re|Im|re|im)\s*\(\s*z\s*\)$/.exec(left);
  const real=(p:Readonly<Record<string,number>>)=>{const r=evaluateComplexNode(rhs,p);if(r.im!==0)throw new Error('Правая часть геометрического уравнения должна быть вещественной.');return r.re;};
  if(line)return p=>({kind:'line',axis:line[1].toLowerCase() as 're'|'im',value:real(p)});
  const node=parseComplexAst(left) as MathNode&{name:string;args:MathNode[];fn:MathNode};
  if(node.type==='FunctionNode'&&node.fn.type==='SymbolNode'&&node.name==='abs'&&node.args.length===1)return p=>{const radius=real(p);if(radius<0)throw new Error('Радиус должен быть неотрицательным.');const offset=circleOffset(node.args[0],p);return {kind:'circle',center:{re:offset.re===0?0:-offset.re,im:offset.im===0?0:-offset.im},radius};};
  throw new Error('Поддерживаются z = число, |z − (центр)| = радиус, Re(z) = число и Im(z) = число.');
 }
 const node=parseComplexAst(parts.length===2?parts[1]:source) as MathNode&{name:string;fn:MathNode;args:MathNode[]};
 if(parts.length===1&&node.type==='FunctionNode'&&node.fn.type==='SymbolNode'&&node.name==='segment'&&node.args.length===2)return p=>{const start=evaluateComplexNode(node.args[0],p),end=evaluateComplexNode(node.args[1],p);return {kind:'segment',start:{re:start.re,im:start.im},end:{re:end.re,im:end.im}};};
 return p=>{const value=evaluateComplexNode(node,p);return {kind:'point',value:{re:value.re,im:value.im},modulus:Math.hypot(value.re,value.im),argument:value.re===0&&value.im===0?null:Math.atan2(value.im,value.re)};};
}
