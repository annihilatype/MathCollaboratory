import { parse, complex, add, subtract, multiply, divide, conj, abs, arg, exp, sin, cos, type Complex, type MathNode } from 'mathjs';

// Deliberately interpret only allowlisted AST nodes; never use mathjs evaluate/compile.
export function complexSource(latex: string): string {
  if (latex.length > 500) throw new Error('Выражение слишком длинное (максимум 500 символов).');
  if(/\\placeholder\b/.test(latex))throw new Error('Заполните пустое поле выражения.');
  let names=latex;
  // MathLive's physical Re/Im shortcuts nest wrappers, e.g. operatorname{mathrm{Re}}.
  // Unwrap known names only; never strip arbitrary commands or their payloads.
  for(let depth=0;depth<16;depth++){
    const next=names.replace(/\\(?:operatorname|mathrm|mathop)\s*\{\s*(conj|abs|arg|Arg|Re|Im|re|im|i|pi|e|exp|sin|cos|segment)\s*\}/g,'$1');
    if(next===names)break;names=next;
  }
  names=names.replace(/\\lbrack(?![a-zA-Z])/g,'[').replace(/\\rbrack(?![a-zA-Z])/g,']');
  let s = names.replace(/\\(?:left|right)/g, '').replace(/\\[,;! ]/g, ' ')
    .replace(/\\(?:operatorname|mathrm)\{(conj|abs|arg|Arg|Re|Im|re|im|i|pi|e|exp|sin|cos|segment)\}/g, '$1')
    .replace(/\\pi(?![a-zA-Z])/g, 'pi').replace(/π/g,'pi').replace(/\\rho(?![a-zA-Z])/g,'rho').replace(/\\exponentialE(?![a-zA-Z])/g,'e').replace(/\\(?:arg|Arg)(?![a-zA-Z])/g,'arg').replace(/\\(?:notin)(?![a-zA-Z])/g,' notin ').replace(/\\(?:neq|ne)(?![a-zA-Z])/g,'!=').replace(/≠/g,'!=').replace(/∉/g,' notin ').replace(/\\(?:lor|vee|cup)(?![a-zA-Z])/g,' or ').replace(/\\cap(?![a-zA-Z])/g,' and ').replace(/\\imaginaryI/g, 'i').replace(/\\(exp|sin|cos)(?![a-zA-Z])/g, '$1').replace(/\\(?:Re|real)(?![a-zA-Z])/g, 'Re').replace(/\\(?:Im|imag)(?![a-zA-Z])/g, 'Im')
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
export function parseComplexAst(source: string): MathNode {
  let open = false;
  source = source.replace(/\|/g, () => { open = !open; return open ? 'abs(' : ')'; });
  if (open) throw new Error('Не закрыт знак модуля.');
  let root: MathNode;
  try { root = parse(source); } catch { throw new Error('Проверьте скобки и операторы комплексного выражения.'); }
  let nodes = 0;
  root.traverse(() => { if (++nodes > 150) throw new Error('Выражение слишком сложное.'); });
  return root;
}
export function evaluateComplex(source: string,parameters:Readonly<Record<string,number>>={}): Complex { return evaluateComplexNode(parseComplexAst(source),parameters); }
export function evaluateComplexNode(root: MathNode,parameters:Readonly<Record<string,number>>={}): Complex { return buildComplexEvaluator(root,false,parameters)(); }

// Build only our allowlisted closures from the mathjs AST. This is not
// MathNode.compile/evaluate: no dynamic code, scopes, assignments or accessors.
export function buildComplexEvaluator(root: MathNode, mapping = false, parameters:Readonly<Record<string,number>>={}): (z?: Complex) => Complex {
  let count = 0;
  type Evaluate = (z?: Complex) => Complex;
  const finite = (z: Complex): Complex => {
    if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) throw new Error('Результат не определён или слишком велик.');
    return z;
  };
  function build(node: MathNode): Evaluate {
    if (++count > (mapping ? 80 : 150)) throw new Error('Выражение слишком сложное.');
    const n = node as MathNode & { value: number; name: string; content: MathNode; args: MathNode[]; op: string; fn: MathNode };
    if (node.type === 'ConstantNode' && typeof n.value === 'number') { const value=finite(complex(n.value,0)); return ()=>value; }
    if (node.type === 'SymbolNode') {
      if(n.name==='pi')return ()=>complex(Math.PI,0);
      if(n.name==='e')return ()=>complex(Math.E,0);
      if(n.name==='i')return ()=>complex(0,1);
      if(mapping&&n.name==='z')return z=>{if(!z)throw new Error('Не задано z.');return z;};
      if(!['z','w','i','pi','e'].includes(n.name)&&Object.hasOwn(parameters,n.name)){const value=parameters[n.name];if(!Number.isFinite(value))throw new Error(`Параметр ${n.name} должен быть конечным вещественным числом.`);return ()=>complex(value,0);}
      if(n.name==='i')return ()=>complex(0,1);
      if(mapping && n.name==='z')return z=>{if(!z)throw new Error('Не задано z.');return z;};
    }
    if (node.type === 'ParenthesisNode') return build(n.content);
    if (node.type === 'OperatorNode' && ['+', '-', '*', '/', '^'].includes(n.op) && n.args.length <= 2) {
      const a = build(n.args[0]);
      if (n.args.length === 1 && ['+', '-'].includes(n.op)) return z=>{const v=a(z);return n.op==='-'?complex(-v.re,-v.im):v;};
      if (n.args.length !== 2) throw new Error('Оператор не поддерживается.');
      const b = build(n.args[1]);
      return z=>{
        const u=a(z),v=b(z);
        if(n.op==='/' && v.re===0 && v.im===0)throw new Error('Деление на ноль.');
        if(n.op==='^'){
          if(v.im!==0 || !Number.isInteger(v.re) || Math.abs(v.re)>1000)throw new Error('Поддерживаются целочисленные степени от −1000 до 1000.');
          if(u.re===0 && u.im===0 && v.re<=0)throw new Error('Степень нуля не определена.');
          // Integer powers avoid polar-form roundoff such as (1+i)^2
          // acquiring a spurious real part. All arithmetic stays in mathjs.
          let n=Math.abs(v.re),base=v.re<0?finite(divide(complex(1,0),u) as Complex):u,result=complex(1,0);
          while(n>0){if(n%2)result=finite(multiply(result,base) as Complex);n=Math.floor(n/2);if(n)base=finite(multiply(base,base) as Complex);}
          return result;
        }
        return finite((n.op==='+'?add(u,v):n.op==='-'?subtract(u,v):n.op==='*'?multiply(u,v):divide(u,v)) as Complex);
      };
    }
    if (node.type === 'FunctionNode' && n.fn.type === 'SymbolNode' && n.args.length === 1) {
      const allowed=['conj','abs','arg','Arg','Re','Im','re','im',...(mapping?['exp','sin','cos']:[])];
      if(!allowed.includes(n.name))throw new Error('Эта функция пока не поддерживается.');
      const a=build(n.args[0]);
      return z=>{
        const v=a(z);
        if(n.name==='conj')return conj(v) as Complex;
        if(mapping && ['exp','sin','cos'].includes(n.name))return finite((n.name==='exp'?exp(v):n.name==='sin'?sin(v):cos(v)) as Complex);
        if(['arg','Arg'].includes(n.name) && v.re===0 && v.im===0)throw new Error('Аргумент нуля не определён.');
        return finite(complex(n.name==='abs'?abs(v) as number:['arg','Arg'].includes(n.name)?(Math.atan2(v.im,v.re)===-Math.PI?Math.PI:Math.atan2(v.im,v.re)):['Re','re'].includes(n.name)?v.re:v.im,0));
      };
    }
    throw new Error('Недопустимое выражение. Разрешены числа, i, +, −, *, /, целые степени, conj, abs, arg, Re, Im.');
  }
  return build(root);
}
