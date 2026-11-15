import {COMPLEX_FUNCTIONS,canonicalName} from '../operations';
import {normalizeOperationLatex} from './operationLatex';
// Deliberately interpret only allowlisted AST nodes; never use mathjs evaluate/compile.
export function complexSource(latex: string): string {
  if (latex.length > 500) throw new Error('Выражение слишком длинное (максимум 500 символов).');
  if(/\\placeholder\b/.test(latex))throw new Error('Заполните пустое поле выражения.');
  let names=latex;
  // MathLive's physical Re/Im shortcuts nest wrappers, e.g. operatorname{mathrm{Re}}.
  // Unwrap known names only; never strip arbitrary commands or their payloads.
  for(let depth=0;depth<16;depth++){
    const next=normalizeOperationLatex(names);
    if(next===names)break;names=next;
  }
  names=names.replace(/\\lbrack(?![a-zA-Z])/g,'[').replace(/\\rbrack(?![a-zA-Z])/g,']');
  let s = names.replace(/\\(?:left|right)/g, '').replace(/\\[,;! ]/g, ' ')
    .replace(/\\(?:operatorname|mathrm)\{(conj|abs|arg|Arg|Re|Im|re|im|i|pi|e|exp|sin|cos|segment)\}/g, '$1')
    .replace(/\\pi(?![a-zA-Z])/g, 'pi').replace(/π/g,'pi').replace(/\\rho(?![a-zA-Z])/g,'rho').replace(/\\exponentialE(?![a-zA-Z])/g,'e').replace(/\\(?:arg|Arg)(?![a-zA-Z])/g,'arg').replace(/\\(?:notin)(?![a-zA-Z])/g,' notin ').replace(/\\(?:neq|ne)(?![a-zA-Z])/g,'!=').replace(/≠/g,'!=').replace(/∉/g,' notin ').replace(/\\(?:lor|vee|cup)(?![a-zA-Z])/g,' or ').replace(/\\cap(?![a-zA-Z])/g,' and ').replace(/\\imaginaryI/g, 'i').replace(/\\([a-zA-Z]+)(?![a-zA-Z])/g,(whole,name:string)=>name!=='sqrt'&&Object.hasOwn(COMPLEX_FUNCTIONS,canonicalName(name))?canonicalName(name):whole).replace(/\\(?:Re|real)(?![a-zA-Z])/g, 'Re').replace(/\\(?:Im|imag)(?![a-zA-Z])/g, 'Im')
    .replace(/\\(?:leq|le)(?![a-zA-Z])/g, '<=').replace(/\\(?:geq|ge)(?![a-zA-Z])/g, '>=').replace(/\\(?:lt|gt)(?![a-zA-Z])/g, m=>m==='\\lt'?'<':'>').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/\\(?:land|wedge)(?![a-zA-Z])/g, ' and ')
    .replace(/\\(?:cdot|times)/g, '*').replace(/−/g, '-').replace(/\\imaginaryI/g, 'i');
  // Balanced groups support nested fractions and conjugates.
  let i = 0;
  function group(): string {
    while (s[i] === ' ') i++;
    if (s[i++] !== '{') throw new Error('Ожидаются фигурные скобки.');
    return '(' + read(true) + ')';
  }
  function fractionArgument(): string {
    while (/\s/.test(s[i] ?? '') && i < s.length) i++;
    if(s[i]==='{') { const value=group(); if(value==='()')throw new Error('У дроби пустой числитель или знаменатель.'); return value; }
    // TeX accepts a single unbraced token (\\frac12, \\frac1z).
    if(/[a-zA-Z0-9]/.test(s[i] ?? '') && i<s.length)return '('+s[i++]+')';
    const command=/^\\(frac|dfrac|tfrac)(?![a-zA-Z])/.exec(s.slice(i));
    if(command){i+=command[0].length;return '('+fractionArgument()+'/'+fractionArgument()+')';}
    throw new Error('У дроби нужны числитель и знаменатель: \\frac{1}{z}.');
  }
  function read(nested = false): string {
    let out = '';
    while (i < s.length) {
      if (s[i] === '}') { i++; if (!nested) throw new Error('Лишняя скобка.'); return out; }
      if (s[i] === '{') { i++; out += '(' + read(true) + ')'; }
      else if (/^\\(?:frac|dfrac|tfrac)(?![a-zA-Z])/.test(s.slice(i))) { i += /^\\[a-z]+/.exec(s.slice(i))![0].length; out += '(' + fractionArgument() + '/' + fractionArgument() + ')'; }
      else if(/^\\sqrt(?![a-zA-Z])/.test(s.slice(i))){i+=5;out+='sqrt'+group();}
      else if(s[i]==='_'){i++;const sub=s[i]==='{'?group().slice(1,-1):s[i++];if(!/^[a-zA-Z0-9]+$/.test(sub??''))throw new Error('Индекс параметра должен состоять из букв и цифр.');out+='_'+sub+' ';}
      else if (s.startsWith('\\overline', i)) { i += 9; out += 'conj' + group(); }
      else out += s[i++];
    }
    if (nested) throw new Error('Не закрыта скобка.');
    return out;
  }
  const result = read();
  const unknown=/\\([a-zA-Z]+|.)/.exec(result);
  if (unknown) throw new Error(`Команда \\${unknown[1]} не поддерживается. Для вещественной и мнимой частей используйте Re(z), Im(z).`);
  return result;
}
