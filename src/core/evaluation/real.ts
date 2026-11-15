import {validRealParameter} from '../parameters';
import {latexToExpression} from '../syntax/realLatex';
export {latexToExpression} from '../syntax/realLatex';
import {parseAst} from '../syntax/ast';
import { REAL_FUNCTIONS } from '../operations';
import { type MathNode } from 'mathjs';

const functions=REAL_FUNCTIONS;

export interface ParsedExpression { parameters: string[]; evaluate: (x: number, parameters: Record<string, number>) => number }
export function parseExpression(latex: string): ParsedExpression {
  let root: MathNode;
  try { root = parseAst(latexToExpression(latex)); }
  catch (error) { throw new Error(error instanceof Error && !/Unexpected|Value expected|Parenthesis|end of expression|Undefined/.test(error.message) ? error.message : 'Проверьте скобки и операторы в выражении.'); }
  return buildRealEvaluator(root);
}
const programs=new WeakMap<MathNode,ParsedExpression>();
export function buildRealEvaluator(root:MathNode):ParsedExpression {
  const cached=programs.get(root);if(cached)return cached;
  const parameters = new Set<string>();
  let count = 0;
  type Evaluator = (x: number, p: Record<string, number>) => number;
  function build(node: MathNode): Evaluator {
    if (++count > 150) throw new Error('Выражение слишком сложное.');
    const n = node as MathNode & { value: number; name: string; content: MathNode; args: MathNode[]; op: string; fn: MathNode };
    if (node.type === 'ConstantNode' && typeof n.value === 'number' && Number.isFinite(n.value)) return () => n.value;
    if (node.type === 'ParenthesisNode') return build(n.content);
    if (node.type === 'SymbolNode') {
      if (n.name === 'x') return x => x;
      if (n.name === 'pi') return () => Math.PI;
      if (n.name === 'e') return () => Math.E;
      if (!validRealParameter(n.name)) throw new Error(`Неизвестный символ «${n.name}».`);
      parameters.add(n.name);
      return (_x, p) => Object.hasOwn(p, n.name) ? p[n.name] : NaN;
    }
    if (node.type === 'FunctionNode' && n.fn.type === 'SymbolNode' && Object.hasOwn(functions, n.name) && n.args.length === 1) {
      const arg = build(n.args[0]); return (x, p) => functions[n.name](arg(x, p));
    }
    if (node.type === 'OperatorNode' && ['+', '-', '*', '/', '^'].includes(n.op) && n.args.length <= 2) {
      const a = build(n.args[0]), b = n.args[1] ? build(n.args[1]) : null;
      if (!b) { if (!['+', '-'].includes(n.op)) throw new Error('Оператор не поддерживается.'); return (x, p) => n.op === '-' ? -a(x, p) : a(x, p); }
      return (x, p) => { const u = a(x, p), v = b(x, p); switch(n.op) { case '+': return u+v; case '-': return u-v; case '*': return u*v; case '/': return u/v; default: return u**v; } };
    }
    throw new Error('Эта конструкция не поддерживается. Используйте вещественную функцию от x.');
  }
  const evaluate = build(root);
  const program:ParsedExpression={ parameters: [...parameters].sort(), evaluate: (x, p) => { try { const y = evaluate(x, p); return Number.isFinite(y) ? y : NaN; } catch { return NaN; } } };
  Object.freeze(program.parameters);Object.freeze(program);programs.set(root,program);return program;
}
