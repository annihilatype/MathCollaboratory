export {analyzeWithParameters} from '../core/analysis';
import type {Parameter} from '../state/store';
export function suggestedParameter(name:string):Parameter{
  if(name==='n')return {value:2,min:1,max:16,step:1,integer:true,positive:true};
  if(['r','rho'].includes(name))return {value:1,min:.1,max:5,step:.1,positive:true};
  return {value:1,min:-5,max:5,step:.1};
}
