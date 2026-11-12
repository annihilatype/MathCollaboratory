import { parse, complex, add, subtract, multiply, divide, pow, conj, abs, arg, type Complex, type MathNode } from 'mathjs';

// Deliberately interpret only allowlisted AST nodes; never use mathjs evaluate/compile.
export function complexSource(latex: string): string {
  if (latex.length > 500) throw new Error('Выражение слишком длинное (максимум 500 символов).');
  let s = latex.replace(/\\(?:left|right)/g, '').replace(/\\[,;! ]/g, '')
    .replace(/\\(?:operatorname|mathrm)\{(conj|abs|arg|Re|Im|re|im|i)\}/g, '$1')
    .replace(/\\(?:Re|real)/g, 'Re').replace(/\\(?:Im|imag)/g, 'Im')
    .replace(/\\(?:cdot|times)/g, '*').replace(/−/g, '-').replace(/\\imaginaryI/g, 'i');
  // Balanced groups support nested fractions and conjugates.
  let i = 0;
  function group(): string {
    while (s[i] === ' ') i++;
    if (s[i++] !== '{') throw new Error('Ожидаются фигурные скобки.');
    return '(' + read(true) + ')';
  }
  function read(nested = false): string {
    let out = '';
    while (i < s.length) {
      if (s[i] === '}') { i++; if (!nested) throw new Error('Лишняя скобка.'); return out; }
      if (s[i] === '{') { i++; out += '(' + read(true) + ')'; }
      else if (s.startsWith('\\frac', i)) { i += 5; out += '(' + group() + '/' + group() + ')'; }
      else if (s.startsWith('\\overline', i)) { i += 9; out += 'conj' + group(); }
      else out += s[i++];
    }
    if (nested) throw new Error('Не закрыта скобка.');
    return out;
  }
  const result = read();
  if (result.includes('\\')) throw new Error('Команда пока не поддерживается. Используйте i, conj, abs, arg, Re, Im.');
  return result;
}
export function evaluateComplex(source: string): Complex {
  let open = false;
  source = source.replace(/\|/g, () => { open = !open; return open ? 'abs(' : ')'; });
  if (open) throw new Error('Не закрыт знак модуля.');
  let root: MathNode;
  try { root = parse(source); } catch { throw new Error('Проверьте скобки и операторы комплексного выражения.'); }
  let count = 0;
  const finite = (z: Complex): Complex => {
    if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) throw new Error('Результат не определён или слишком велик.');
    return z;
  };
  function visit(node: MathNode): Complex {
    if (++count > 150) throw new Error('Выражение слишком сложное.');
    const n = node as MathNode & { value: number; name: string; content: MathNode; args: MathNode[]; op: string; fn: MathNode };
    if (node.type === 'ConstantNode' && typeof n.value === 'number') return finite(complex(n.value, 0));
    if (node.type === 'SymbolNode' && n.name === 'i') return complex(0, 1);
    if (node.type === 'ParenthesisNode') return visit(n.content);
    if (node.type === 'OperatorNode' && ['+', '-', '*', '/', '^'].includes(n.op) && n.args.length <= 2) {
      const a = visit(n.args[0]);
      if (n.args.length === 1 && ['+', '-'].includes(n.op)) return n.op === '-' ? complex(-a.re, -a.im) : a;
      if (n.args.length !== 2) throw new Error('Оператор не поддерживается.');
      const b = visit(n.args[1]);
      if (n.op === '/' && b.re === 0 && b.im === 0) throw new Error('Деление на ноль.');
      if (n.op === '^') {
        if (b.im !== 0 || !Number.isInteger(b.re) || Math.abs(b.re) > 1000) throw new Error('Поддерживаются целочисленные степени от −1000 до 1000.');
        if (a.re === 0 && a.im === 0 && b.re <= 0) throw new Error('Степень нуля не определена.');
        return finite(pow(a, b.re) as Complex);
      }
      return finite((n.op === '+' ? add(a,b) : n.op === '-' ? subtract(a,b) : n.op === '*' ? multiply(a,b) : divide(a,b)) as Complex);
    }
    if (node.type === 'FunctionNode' && n.fn.type === 'SymbolNode' && n.args.length === 1) {
      const a = visit(n.args[0]);
      if (n.name === 'conj') return conj(a) as Complex;
      if (['abs', 'arg', 'Re', 'Im', 're', 'im'].includes(n.name)) {
        if (n.name === 'arg' && a.re === 0 && a.im === 0) throw new Error('Аргумент нуля не определён.');
        return finite(complex(n.name === 'abs' ? abs(a) as number : n.name === 'arg' ? arg(a) : ['Re','re'].includes(n.name) ? a.re : a.im, 0));
      }
    }
    throw new Error('Недопустимое выражение. Разрешены числа, i, +, −, *, /, целые степени, conj, abs, arg, Re, Im.');
  }
  return finite(visit(root));
}
