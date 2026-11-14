import { describeRegionTransform } from '../regions/transform';
import { complex, type MathNode }  from 'mathjs';
import { complexSource, parseComplexAst, buildComplexEvaluator, evaluateComplexNode, isEuler } from '../complex/math';
import type { ComplexMapping } from '../complex/geometry';
export function parseMapping(latex:string,parameters:Readonly<Record<string,number>>={}):ComplexMapping {
  const source=complexSource(latex).trim().replace(/^w\s*=\s*/, '');
  if(!source)throw new Error('Введите функцию от z, например z^2 или 1/z.');
  const root=parseComplexAst(source),evaluate=buildComplexEvaluator(root,true,parameters);
  root.traverse(node=>{const n=node as MathNode&{op:string;args:MathNode[]};if(node.type==='OperatorNode'&&n.op==='^'&&!isEuler(n.args[0])){let variable=false;n.args[1].traverse(a=>{if(a.type==='SymbolNode'&&(a as MathNode&{name:string}).name==='z')variable=true;});if(!variable){const v=evaluateComplexNode(n.args[1],parameters);if(v.im!==0||!Number.isInteger(v.re)||Math.abs(v.re)>1000)throw new Error('Показатель степени должен быть целым от −1000 до 1000. Для образов z^n поддерживается 1 ≤ n ≤ 32.');}}});
  let cost=0;root.traverse(()=>cost++);
  const region=describeRegionTransform(root,parameters);
  return {cost,regionTransform:region.transform,regionDiagnostic:region.diagnostic,evaluate:z=>{
    try {
      if(!Number.isFinite(z.re)||!Number.isFinite(z.im))return null;
      const w=evaluate(complex(z.re,z.im));
      return Number.isFinite(w.re)&&Number.isFinite(w.im)?{re:w.re,im:w.im}:null;
    }catch{return null;}
  }};
}
