import {OPERATION_NAMES} from '../math/operations';
import type { MathNode } from 'mathjs';
import { complexSource,parseComplexAst } from './math';
import { setConditions } from '../regions/setNotation';
export type RealScope=Readonly<Record<string,number>>;
export const CONSTANTS:Readonly<Record<string,number>>=Object.freeze({pi:Math.PI,e:Math.E});
const reserved=new Set(['z','w','x','i','pi','e','Re','Im','re','im','arg','Arg','abs','conj','exp','sin','cos','segment','and','or','excludeSegment','constructor','prototype','__proto__','import','evaluate','compile']);
// Preserve parameter values from v0.5 even when a newly registered function
// reserves their name. Parsing reports the conflict; restoring never drops data.
export const validPersistedComplexParameter=(name:string)=>/^[a-zA-Z][a-zA-Z0-9_]{0,15}$/.test(name)&&!reserved.has(name);
export const validComplexParameter=(name:string)=>validPersistedComplexParameter(name)&&!OPERATION_NAMES.has(name);
// Lexical sugar only; the resulting function is handled by the region grammar,
// never by the numeric evaluator. Endpoints may be complex constant ASTs.
export function geometrySource(latex:string):{source:string;set:boolean}{
  const set=setConditions(latex),s=complexSource(set??latex);
  const source=s.replace(/\bz\s+notin\s*\[([^\[\]]*)\]/g,'excludeSegment(z,$1)').replace(/(?<![<>=!])=(?!=)/g,'==');
  return {source,set:set!==null};
}
export function complexParameters(latex:string):string[]{
  const {source}=geometrySource(latex);if(!source.trim())return [];
  const root=parseComplexAst(source.replace(/^w\s*==\s*/,'')),names=new Set<string>();
  const functions=new Set([...OPERATION_NAMES,'excludeSegment']);
  root.traverse((node,_path,parent)=>{
    if(!['SymbolNode','ConstantNode','ParenthesisNode','OperatorNode','RelationalNode','FunctionNode'].includes(node.type))throw new Error('Присваивания, индексы, массивы и блоки не поддерживаются.');
    if(node.type==='FunctionNode'){const f=node as MathNode&{name:string;fn:MathNode};if(f.fn.type!=='SymbolNode'||!functions.has(f.name))throw new Error(`Функция ${f.name} не поддерживается.`);}
    if(node.type==='ConstantNode'&&typeof (node as MathNode&{value:unknown}).value!=='number')throw new Error('Разрешены только числовые константы.');
    const n=node as MathNode&{name:string},p=parent as MathNode&{fn:MathNode};
    if(n.type!=='SymbolNode'||(p?.type==='FunctionNode'&&p.fn===node))return;
    if(['z','i',...Object.keys(CONSTANTS)].includes(n.name))return;
    if(!validComplexParameter(n.name))throw new Error(`Имя «${n.name}» зарезервировано или недопустимо для параметра.`);
    names.add(n.name);
  });return [...names].sort();
}
