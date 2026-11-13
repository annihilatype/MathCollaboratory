import { complex } from 'mathjs';
import { complexSource, parseComplexAst, buildComplexEvaluator } from '../complex/math';
import type { ComplexMapping } from '../complex/geometry';
export function parseMapping(latex:string):ComplexMapping {
  const source=complexSource(latex).trim().replace(/^w\s*=\s*/, '');
  if(!source)throw new Error('Введите функцию от z, например z^2 или 1/z.');
  const root=parseComplexAst(source),evaluate=buildComplexEvaluator(root,true);
  let cost=0;root.traverse(()=>cost++);
  return {cost,evaluate:z=>{
    try {
      if(!Number.isFinite(z.re)||!Number.isFinite(z.im))return null;
      const w=evaluate(complex(z.re,z.im));
      return Number.isFinite(w.re)&&Number.isFinite(w.im)?{re:w.re,im:w.im}:null;
    }catch{return null;}
  }};
}
