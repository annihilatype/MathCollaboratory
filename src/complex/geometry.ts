import { complex, add, subtract, type MathNode, type Complex } from 'mathjs';
import { complexSource, evaluateComplex, evaluateComplexNode, parseComplexAst } from './math';
export interface ComplexCoordinate { re: number; im: number }
export type ComplexGeometry =
  | { kind: 'point'; value: ComplexCoordinate; modulus: number; argument: number | null }
  | { kind: 'circle'; center: ComplexCoordinate; radius: number }
  | { kind: 'segment'; start: ComplexCoordinate; end: ComplexCoordinate }
  | { kind: 'line'; axis: 're' | 'im'; value: number };
// Future mappings can consume/return coordinates without depending on JSXGraph or React.
export interface ComplexMapping { evaluate: (z: ComplexCoordinate) => ComplexCoordinate | null; cost: number }
export function parseComplexGeometry(latex: string): ComplexGeometry {
  const source = complexSource(latex).trim();
  if (!source) throw new Error('Введите комплексное число или уравнение объекта.');
  const parts = source.split('=');
  if (parts.length > 2) throw new Error('Ожидается одно равенство.');
  const left = parts[0].trim();
  if (parts.length === 2 && left !== 'z') {
    const rhs = evaluateComplex(parts[1]);
    if (rhs.im !== 0) throw new Error('Правая часть геометрического уравнения должна быть вещественной.');
    const line = /^(Re|Im|re|im)\s*\(\s*z\s*\)$/.exec(left);
    if (line) return { kind: 'line', axis: line[1].toLowerCase() as 're'|'im', value: rhs.re };
    const node = parseComplexAst(left) as MathNode & { name: string; args: MathNode[]; fn: MathNode };
    if (node.type === 'FunctionNode' && node.fn.type === 'SymbolNode' && node.name === 'abs' && node.args.length === 1) {
      if (rhs.re < 0) throw new Error('Радиус должен быть неотрицательным.');
      const offset = circleOffset(node.args[0]);
      return { kind: 'circle', center: { re: offset.re === 0 ? 0 : -offset.re, im: offset.im === 0 ? 0 : -offset.im }, radius: rhs.re };
    }
    throw new Error('Поддерживаются z = число, |z − (центр)| = радиус, Re(z) = число и Im(z) = число.');
  }
  if(parts.length===1){
    const node=parseComplexAst(source) as MathNode & {name:string;fn:MathNode;args:MathNode[]};
    if(node.type==='FunctionNode' && node.fn.type==='SymbolNode' && node.name==='segment' && node.args.length===2){
      const start=evaluateComplexNode(node.args[0]),end=evaluateComplexNode(node.args[1]);
      return {kind:'segment',start:{re:start.re,im:start.im},end:{re:end.re,im:end.im}};
    }
  }
  const value = evaluateComplex(parts.length === 2 ? parts[1] : source);
  return { kind: 'point', value: { re: value.re, im: value.im }, modulus: Math.hypot(value.re, value.im), argument: value.re === 0 && value.im === 0 ? null : Math.atan2(value.im, value.re) };
}

// Accept exactly one +z plus a constant: do not sample at a few points, which
// would misclassify nonlinear expressions or conceal unsupported operations.
function circleOffset(root: MathNode): Complex {
  function hasZ(node: MathNode) { let found=false; node.traverse(n=>{if(n.type === 'SymbolNode' && (n as MathNode & {name:string}).name === 'z')found=true;}); return found; }
  function visit(node: MathNode): {coefficient:number; occurrences:number; constant:Complex} {
    const n=node as MathNode & {name:string;content:MathNode;op:string;args:MathNode[]};
    if(!hasZ(node))return {coefficient:0,occurrences:0,constant:evaluateComplexNode(node)};
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
