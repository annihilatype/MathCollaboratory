import {MathDiagnostic} from '../diagnostics';
import {COMPLEX_FUNCTIONS, canonicalName} from '../operations';
import { complex, add, subtract, multiply, divide, exp, type Complex, type MathNode } from 'mathjs';

import {complexSource} from '../syntax/complexLatex';
import {parseComplexAst,isEuler} from '../syntax/ast';
import type {RealScope} from '../types';
export {complexSource} from '../syntax/complexLatex';
export {parseComplexAst} from '../syntax/ast';
export function evaluateComplex(source: string,parameters:Readonly<Record<string,number>>={}): Complex { return evaluateComplexNode(parseComplexAst(source),parameters); }
export function evaluateComplexNode(root: MathNode,parameters:Readonly<Record<string,number>>={}): Complex { return buildComplexEvaluator(root,false,parameters)(); }

// Build only our allowlisted closures from the mathjs AST. This is not
// MathNode.compile/evaluate: no dynamic code, scopes, assignments or accessors.
export type ComplexProgram=(z:Complex|undefined,parameters:RealScope)=>Complex;
const parameterValues=new WeakMap<RealScope,Map<string,{number:number;value:Complex}>>();
function parameterValue(p:RealScope,name:string):Complex {
 if(!Object.hasOwn(p,name))throw new Error(`Не задан параметр ${name}.`);const number=p[name];if(!Number.isFinite(number))throw new Error(`Параметр ${name} должен быть конечным вещественным числом.`);
 const values=parameterValues.get(p)??new Map<string,{number:number;value:Complex}>(),old=values.get(name);if(old?.number===number)return old.value;
 const value=Object.freeze(complex(number,0));values.set(name,{number,value});parameterValues.set(p,values);return value;
}
const programs=new WeakMap<MathNode,Map<boolean,ComplexProgram>>();
export function buildComplexEvaluator(root:MathNode,mapping=false,parameters:RealScope={}):(z?:Complex)=>Complex {
  const run=buildComplexProgram(root,mapping);
  // Keep the legacy eager missing-parameter error; public compile/bind is separate.
  root.traverse((node,_path,parent)=>{const n=node as MathNode&{name:string},p=parent as MathNode&{fn:MathNode};
    if(node.type!=='SymbolNode'||(p?.type==='FunctionNode'&&p.fn===node)||['pi','e','i',...(mapping?['z']:[])].includes(n.name))return;
    if(!Object.hasOwn(parameters,n.name))throw new Error('Недопустимое выражение. Не задан параметр '+n.name+'.');
    if(!Number.isFinite(parameters[n.name]))throw new Error(`Параметр ${n.name} должен быть конечным вещественным числом.`);
  });
  // Internal cached constants are immutable; preserve mutable legacy return values.
  return z=>{const value=run(z,parameters);return Object.isFrozen(value)?complex(value.re,value.im):value;};
}
export function buildComplexProgram(root:MathNode,mapping=false):ComplexProgram {
  const cached=programs.get(root)?.get(mapping);if(cached)return cached;
  let count = 0;
  type Evaluate = ComplexProgram;
  const finite = (z: Complex): Complex => {
    if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) throw new Error('Результат не определён или слишком велик.');
    return z;
  };
  function build(node: MathNode): Evaluate {
    if (++count > (mapping ? 80 : 150)) throw new Error('Выражение слишком сложное.');
    const n = node as MathNode & { value: number; name: string; content: MathNode; args: MathNode[]; op: string; fn: MathNode };
    if (node.type === 'ConstantNode' && typeof n.value === 'number') { const value=Object.freeze(finite(complex(n.value,0))); return ()=>value; }
    if (node.type === 'SymbolNode') {
      if(n.name==='pi')return ()=>complex(Math.PI,0);
      if(n.name==='e')return ()=>complex(Math.E,0);
      if(n.name==='i')return ()=>complex(0,1);
      if(mapping&&n.name==='z')return (z,p)=>{if(!z)throw new Error('Не задано z.');return z;};
      if(!['z','w','i','pi','e'].includes(n.name))return (_z,p)=>parameterValue(p,n.name);
    }
    if (node.type === 'ParenthesisNode') return build(n.content);
    if (node.type === 'OperatorNode' && ['+', '-', '*', '/', '^'].includes(n.op) && n.args.length <= 2) {
      const a = build(n.args[0]);
      if (n.args.length === 1 && ['+', '-'].includes(n.op)) return (z,p)=>{const v=a(z,p);return n.op==='-'?complex(-v.re,-v.im):v;};
      if (n.args.length !== 2) throw new Error('Оператор не поддерживается.');
      const b = build(n.args[1]);
      return (z,p)=>{
        const u=a(z,p),v=b(z,p);
        if(n.op==='/' && v.re===0 && v.im===0)throw new Error('Деление на ноль.');
        if(n.op==='^'){
          if(isEuler(n.args[0]))return finite(exp(v) as Complex);
          if(v.im!==0 || !Number.isInteger(v.re) || Math.abs(v.re)>1000)throw new MathDiagnostic('operation','integer-power','Поддерживаются целочисленные степени от −1000 до 1000.');
          if(u.re===0 && u.im===0 && v.re<=0)throw new Error('Степень нуля не определена.');
          // Integer powers avoid polar-form roundoff such as (1+i)^2
          // acquiring a spurious real part. All arithmetic stays in mathjs.
          let power=Math.abs(v.re),base=v.re<0?finite(divide(complex(1,0),u) as Complex):u,result=complex(1,0);
          while(power>0){if(power%2)result=finite(multiply(result,base) as Complex);power=Math.floor(power/2);if(power)base=finite(multiply(base,base) as Complex);}
          return result;
        }
        return finite((n.op==='+'?add(u,v):n.op==='-'?subtract(u,v):n.op==='*'?multiply(u,v):divide(u,v)) as Complex);
      };
    }
    if (node.type === 'FunctionNode' && n.fn.type === 'SymbolNode' && n.args.length === 1) {
      const name=canonicalName(n.name),fn=COMPLEX_FUNCTIONS[name];
      if(!fn)throw new Error(`Операция ${name} не поддерживается для комплексных чисел.`);
      const a=build(n.args[0]);return (z,p)=>{const u=a(z,p),v=fn(complex(u.re===0?0:u.re,u.im===0?0:u.im));return finite(typeof v==='number'?complex(v,0):v);};
    }
    throw new Error('Недопустимое выражение. Разрешены числа, i, +, −, *, /, целые степени, conj, abs, arg, Re, Im.');
  }
  const run=build(root),modes=programs.get(root)??new Map<boolean,ComplexProgram>();modes.set(mapping,run);programs.set(root,modes);return run;
}

export {isEuler} from '../syntax/ast';
