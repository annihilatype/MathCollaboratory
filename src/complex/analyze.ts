import { complexParameters,type RealScope } from './parameters';
import type { Parameter } from '../state/store';
export function analyzeWithParameters<T>(latex:string,scope:RealScope,parse:(s:string,p:RealScope)=>T):{value:T|null;parameters:string[];error:string}{
  let parameters:string[]=[];
  try{
    parameters=complexParameters(latex);const missing=parameters.filter(p=>!Object.hasOwn(scope,p));
    if(missing.length)return {value:null,parameters,error:`Создайте параметры: ${missing.join(', ')}.`};
    return {value:parse(latex,scope),parameters,error:''};
  }catch(e){return {value:null,parameters,error:latex.trim()?(e as Error).message:''};}
}
export function suggestedParameter(name:string):Parameter{
  if(name==='n')return {value:2,min:1,max:16,step:1,integer:true,positive:true};
  if(['r','rho'].includes(name))return {value:1,min:.1,max:5,step:.1,positive:true};
  return {value:1,min:-5,max:5,step:.1};
}
