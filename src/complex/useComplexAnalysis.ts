import {useMemo,useRef} from 'react';
import type {Expression} from '../state/store';
import {parseComplexGeometry} from './geometry';
import {parseMapping} from '../mapping/expression';
import {analyzeWithParameters} from './analyze';
import type {RealScope} from './parameters';
type Analysis<T>=ReturnType<typeof analyzeWithParameters<T>>;
function cached<T>(cache:Map<string,{latex:string;key:string;analysis:Analysis<T>}>,id:string,latex:string,scope:RealScope,parse:(s:string,p:RealScope)=>T):Analysis<T>{
  const old=cache.get(id),key=old?JSON.stringify(old.analysis.parameters.map(n=>scope[n])):'';
  if(old?.latex===latex&&old.key===key)return old.analysis;
  const analysis=analyzeWithParameters(latex,scope,parse);cache.set(id,{latex,key:JSON.stringify(analysis.parameters.map(n=>scope[n])),analysis});return analysis;
}
export function useComplexAnalysis(expressions:Expression[],latex:string,scope:RealScope){
  const geometries=useRef(new Map<string,{latex:string;key:string;analysis:Analysis<ReturnType<typeof parseComplexGeometry>>}>()),mapping=useRef(new Map<string,{latex:string;key:string;analysis:Analysis<ReturnType<typeof parseMapping>>}>());
  const analyzed=useMemo(()=>{
    const ids=new Set(expressions.map(e=>e.id));for(const id of geometries.current.keys())if(!ids.has(id))geometries.current.delete(id);
    return expressions.map(e=>{const a=cached(geometries.current,e.id,e.latex,scope,parseComplexGeometry);return {...e,geometry:a.value,error:a.error,parameters:a.parameters};});
  },[expressions,scope]);
  const mapped=useMemo(()=>cached(mapping.current,'mapping',latex,scope,parseMapping),[latex,scope]);return {analyzed,mapped};
}
