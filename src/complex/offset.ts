import { complex, add, subtract, type MathNode, type Complex } from 'mathjs';
import { evaluateComplexNode } from './math';
// Accept exactly one +z plus a constant: do not sample at a few points, which
// would misclassify nonlinear expressions or conceal unsupported operations.
export function circleOffset(root: MathNode,parameters:Readonly<Record<string,number>>={}): Complex {
  function hasZ(node: MathNode) { let found=false; node.traverse(n=>{if(n.type === 'SymbolNode' && (n as MathNode & {name:string}).name === 'z')found=true;}); return found; }
  function visit(node: MathNode): {coefficient:number; occurrences:number; constant:Complex} {
    const n=node as MathNode & {name:string;content:MathNode;op:string;args:MathNode[]};
    if(!hasZ(node))return {coefficient:0,occurrences:0,constant:evaluateComplexNode(node,parameters)};
    if(node.type === 'SymbolNode' && n.name === 'z')return {coefficient:1,occurrences:1,constant:complex(0,0)};
    if(node.type === 'ParenthesisNode')return visit(n.content);
    if(node.type === 'OperatorNode' && ['+','-'].includes(n.op) && n.args.length<=2){
      const a=visit(n.args[0]);
      if(n.args.length===1)return n.op === '+' ? a : {coefficient:-a.coefficient,occurrences:a.occurrences,constant:complex(-a.constant.re,-a.constant.im)};
      const b=visit(n.args[1]),sign=n.op==='+'?1:-1;
      return {coefficient:a.coefficient+sign*b.coefficient,occurrences:a.occurrences+b.occurrences,constant:(sign===1?add(a.constant,b.constant):subtract(a.constant,b.constant)) as Complex};
    }
    throw new Error('Для окружности поддерживается только |z + постоянная| = радиус; нелинейные выражения с z недопустимы.');
  }
  const result=visit(root);
  if(result.coefficient!==1 || result.occurrences!==1)throw new Error('В окружности z должен встречаться один раз с коэффициентом +1.');
  if(!Number.isFinite(result.constant.re)||!Number.isFinite(result.constant.im))throw new Error('Центр окружности не определён или слишком велик.');
  return result.constant;
}
