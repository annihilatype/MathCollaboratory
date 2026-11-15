import {complexParameters} from './parameters';
import {compileReal,compileGeometry,compileMapping,bindGeometry,bindMapping,type CompiledGeometry,type CompiledMapping} from './compile';
import type {ComplexGeometry} from './geometry/types';
import type {ComplexMapping} from './mapping/types';
import type {RealScope} from './types';
import type {Validation} from './results';
export interface BoundAnalysis<T>{value:T|null;parameters:string[];error:string}
export function parseRealForGraph(latex:string){const program=compileReal(latex);if(!program.ok)throw new Error(program.diagnostic.message);return program.value.fast;}
// Per-workspace cache of compiled structure and parameter-bound geometry. No React,
// DOM or scheduling. Values of unrelated parameters do not invalidate a binding.
export function createComplexAnalysis(){
 type Entry={text:string;compiled:Validation<CompiledGeometry|CompiledMapping>;key:string;analysis:BoundAnalysis<ComplexGeometry|ComplexMapping>};
 const geometries=new Map<string,Entry>(),mappings=new Map<string,Entry>();
 function analyze<T extends ComplexGeometry|ComplexMapping>(id:string,text:string,scope:RealScope,mapping:boolean):BoundAnalysis<T>{
  const entries=mapping?mappings:geometries,old=entries.get(id),compiled=old?.text===text?old.compiled:mapping?compileMapping(text):compileGeometry(text);
  const parameters=compiled.ok?[...compiled.value.document.parameters]:[],key=JSON.stringify(parameters.map(n=>Object.hasOwn(scope,n)?['value',scope[n]]:['missing']));
  if(old?.text===text&&old.key===key)return old.analysis as BoundAnalysis<T>;
  let analysis:BoundAnalysis<ComplexGeometry|ComplexMapping>;
  if(!compiled.ok)analysis={value:null,parameters,error:text.trim()?compiled.diagnostic.message:''};
  else{const result=compiled.value.kind==='mapping'?bindMapping(compiled.value,scope):bindGeometry(compiled.value,scope);analysis=result.ok?{value:result.value,parameters,error:''}:{value:null,parameters,error:text.trim()?result.diagnostic.message:''};}
  entries.set(id,{text,compiled,key,analysis});return analysis as BoundAnalysis<T>;
 }
 return {geometry:(id:string,text:string,p:RealScope)=>analyze<ComplexGeometry>(id,text,p,false),mapping:(text:string,p:RealScope)=>analyze<ComplexMapping>('\0mapping',text,p,true),retain:(ids:Iterable<string>)=>{const keep=new Set(ids);for(const id of geometries.keys())if(!keep.has(id))geometries.delete(id);}};
}

export function analyzeWithParameters<T>(latex:string,scope:RealScope,parse:(s:string,p:RealScope)=>T):{value:T|null;parameters:string[];error:string}{
  let parameters:string[]=[];
  try{
    parameters=complexParameters(latex);const missing=parameters.filter(p=>!Object.hasOwn(scope,p));
    if(missing.length)return {value:null,parameters,error:`Создайте параметры: ${missing.join(', ')}.`};
    return {value:parse(latex,scope),parameters,error:''};
  }catch(e){return {value:null,parameters,error:latex.trim()?(e as Error).message:''};}
}
