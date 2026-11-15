import {REAL_FUNCTIONS} from '../operations';
import {normalizeOperationLatex} from './operationLatex';
const functions=REAL_FUNCTIONS;
/** Small, explicit LaTeX grammar. Unknown commands never reach the evaluator. */
export function latexToExpression(latex: string): string {
  if (latex.length > 500) throw new Error('Выражение слишком длинное (максимум 500 символов).');
  let source = normalizeOperationLatex(latex).trim().replace(/^y\s*=/, '').replace(/\\(?:left|right)/g, '')
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
