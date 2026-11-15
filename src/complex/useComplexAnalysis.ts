import {useMemo,useRef} from 'react';
import type {Expression} from '../state/store';
import type {RealScope} from '../core/types';
import {createComplexAnalysis} from '../core/analysis';
export function useComplexAnalysis(expressions:Expression[],latex:string,scope:RealScope){
 const cache=useRef<ReturnType<typeof createComplexAnalysis>|null>(null);cache.current??=createComplexAnalysis();
 const analyzed=useMemo(()=>{cache.current!.retain(expressions.map(e=>e.id));return expressions.map(e=>{const a=cache.current!.geometry(e.id,e.latex,scope);return {...e,geometry:a.value,error:a.error,parameters:a.parameters};});},[expressions,scope]);
 const mapped=useMemo(()=>cache.current!.mapping(latex,scope),[latex,scope]);return {analyzed,mapped};
}
