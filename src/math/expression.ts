import { parse, type MathNode } from 'mathjs';

const functions: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, ln: Math.log,
  log: Math.log10, exp: Math.exp, abs: Math.abs, sqrt: Math.sqrt,
};

/** Small, explicit LaTeX grammar. Unknown commands never reach the evaluator. */
export function latexToExpression(latex: string): string {
  if (latex.length > 500) throw new Error('Выражение слишком длинное (максимум 500 символов).');
  let source = latex.trim().replace(/^y\s*=/, '').replace(/\\(?:left|right)/g, '')
    .replace(/\\[,;! ]/g, '').replace(/\\(?:operatorname|mathrm)\{(sin|cos|tan|ln|log|exp|abs|e)\}/g, '$1');
  let i = 0;
  function group(): string {
    while (source[i] === ' ') i++;
    if (source[i] !== '{') throw new Error('Ожидаются фигурные скобки у дроби или корня.');
    i++;
    return '(' + read(true) + ')';
  }
  function fractionArgument(): string {
    while (/\s/.test(source[i] ?? '') && i < source.length) i++;
    if(source[i]==='{') { const value=group(); if(value==='()')throw new Error('У дроби пустой числитель или знаменатель.'); return value; }
    if(/[a-zA-Z0-9]/.test(source[i] ?? '') && i<source.length)return '('+source[i++]+')';
    const command=/^\\(frac|dfrac|tfrac)(?![a-zA-Z])/.exec(source.slice(i));
    if(command){i+=command[0].length;return '('+fractionArgument()+'/'+fractionArgument()+')';}
    throw new Error('У дроби нужны числитель и знаменатель: \\frac{1}{x}.');
  }
  function read(nested = false): string {
    let out = '';
    while (i < source.length) {
      const c = source[i++];
      if (c === '}') {
        if (!nested) throw new Error('Лишняя закрывающая скобка.');
        return out;
      }
      if (c === '{') { out += '(' + read(true) + ')'; continue; }
      if (c === '\\') {
        const command = /^[a-zA-Z]+/.exec(source.slice(i))?.[0];
        if (!command) throw new Error('Неизвестная математическая команда.');
        i += command.length;
        if (command === 'frac' || command === 'dfrac' || command === 'tfrac') out += '(' + fractionArgument() + '/' + fractionArgument() + ')';
        else if (command === 'sqrt') out += ' sqrt' + group();
        else if (command === 'exponentialE') out += ' e ';
        else if (command === 'pi') out += ' pi ';
        else if (command === 'cdot' || command === 'times') out += '*';
        else if (Object.hasOwn(functions, command)) out += ' ' + command;
        else throw new Error(`Команда \\${command} пока не поддерживается.`);
        continue;
      }
      if (c === 'π') out += ' pi ';
      else if (c === '−') out += '-';
      else if (c === '_') {
        const sub = source[i] === '{' ? group().slice(1, -1) : source[i++];
        if (!/^[a-zA-Z0-9]+$/.test(sub ?? '')) throw new Error('Индекс должен состоять из букв или цифр.');
        out += '_' + sub + ' ';
      } else out += c;
    }
    if (nested) throw new Error('Не закрыта фигурная скобка.');
    return out;
  }
  let result = read();
  let open = false;
  result = result.replace(/\|/g, () => { open = !open; return open ? 'abs(' : ')'; });
  if (open) throw new Error('Не закрыт знак модуля.');
  // Adjacent letters denote products (bx = b*x), except named functions/constants/indices.
  result = result.replace(/[a-zA-Z][a-zA-Z0-9_]*/g, name => {
    if (Object.hasOwn(functions, name) || name === 'pi' || name === 'e' || /^[a-zA-Z]_[a-zA-Z0-9]+$/.test(name)) return name;
    if (/^[a-zA-Z]{1,3}$/.test(name)) return name.split('').join('*');
    throw new Error(`Неизвестное имя «${name}». Используйте однобуквенные параметры.`);
  });
  if (!result.trim()) throw new Error('Введите функцию от x.');
  if (/[^a-zA-Z0-9_+\-*/^().\s]/.test(result)) throw new Error('Поддерживаются функции y = f(x), числа и арифметические операции.');
  result = normalizeFunctions(result);
  return result;
}

// Consume complete powers and balanced arguments, rather than rewriting with a
// regex that cannot distinguish sin(x²) from sin²(x) or nested parentheses.
function normalizeFunctions(source: string): string {
  const tokens = source.match(/[a-zA-Z][a-zA-Z0-9_]*|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[^\s]/g) ?? [];
  let i = 0;
  const ambiguous = () => new Error('Укажите аргумент функции в скобках, например sin(2x) или sin(x^2).');
  function atom(): string {
    const token = tokens[i++];
    if (!token) throw ambiguous();
    if (token === '(') {
      let content = '';
      while (i < tokens.length && tokens[i] !== ')') content += ' ' + next();
      if (tokens[i++] !== ')') throw ambiguous();
      return '(' + content + ')';
    }
    if (Object.hasOwn(functions, token)) {
      let exponent = '';
      if (tokens[i] === '^') { i++; exponent = power(); }
      const explicit = tokens[i] === '(';
      if (exponent && !explicit) throw ambiguous();
      if (!explicit && !/^(?:[a-zA-Z]|\d|\.)/.test(tokens[i] ?? '')) throw ambiguous();
      const argument = explicit ? atom() : power();
      if (!explicit && tokens[i] && !['+', '-', '*', '/', '^', ')'].includes(tokens[i])) throw ambiguous();
      const call = token + '(' + argument + ')';
      return exponent ? '(' + call + ')^(' + exponent + ')' : call;
    }
    return token;
  }
  function power(): string {
    let value = atom();
    if (tokens[i] === '^') { i++; value += '^' + power(); }
    return value;
  }
  function next(): string { return atom(); }
  let result = '';
  while (i < tokens.length) result += ' ' + next();
  return result;
}

export interface ParsedExpression { parameters: string[]; evaluate: (x: number, parameters: Record<string, number>) => number }
export function parseExpression(latex: string): ParsedExpression {
  let root: MathNode;
  try { root = parse(latexToExpression(latex)); }
  catch (error) { throw new Error(error instanceof Error && !/Unexpected|Value expected|Parenthesis|end of expression|Undefined/.test(error.message) ? error.message : 'Проверьте скобки и операторы в выражении.'); }
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
      if (!/^[a-wyzA-Z](?:_[a-zA-Z0-9]+)?$/.test(n.name)) throw new Error(`Неизвестный символ «${n.name}».`);
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
  return { parameters: [...parameters].sort(), evaluate: (x, p) => { try { const y = evaluate(x, p); return Number.isFinite(y) ? y : NaN; } catch { return NaN; } } };
}
