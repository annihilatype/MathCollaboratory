import {complex,multiply,divide,type Complex,type MathNode} from 'mathjs';
import {evaluateComplexNode,isEuler} from '../complex/math';
import type {RegionTransform} from './model';
import {MathDiagnostic} from '../math/diagnostics';
type N=MathNode&{content:MathNode;op:string;args:MathNode[];fn:MathNode;name:string};
const unwrap=(n:MathNode):N=>n.type==='ParenthesisNode'?unwrap((n as N).content):n as N;
const Z=(re=0,im=0)=>complex(re,im);
const mobius=(a=Z(1),b=Z(),c=Z(),d=Z(1)):RegionTransform=>({kind:'mobius',a,b,c,d,conjugate:false,excluded:[]});
export function inversePipeline(root:MathNode,scope:Readonly<Record<string,number>>,recognize:(n:MathNode)=>RegionTransform|undefined):RegionTransform{
  let visited=0;
  function constant(n:MathNode):Complex|null {try{return evaluateComplexNode(n,scope);}catch{return null;}}
  function visit(root:MathNode):RegionTransform[]{
    if(++visited>24)throw new MathDiagnostic('operation','composition-depth','Композиция слишком сложная: не более 12 обратных ступеней.');
    const n=unwrap(root),known=recognize(n);if(known)return [known];
    if(n.type==='FunctionNode'&&n.fn.type==='SymbolNode'&&n.args.length===1){
      if(['Re','Im','re','im','arg','Arg','abs'].includes(n.name))throw new MathDiagnostic('domain','lower-dimensional-image',`Образ ${n.name} лежит на вещественной оси. Двумерная обратная заливка для такого образа не применяется.`);
      const inner=visit(n.args[0]);
      if(n.name==='exp')return [...inner,{kind:'exponential'}];
      if(n.name==='sin'||n.name==='cos')return [...inner,{kind:'exponential',scale:Z(0,1),...(n.name==='sin'?{offset:Z(0,-Math.PI/2)}:{})},{kind:'joukowski'}];
      if(n.name==='tan')return [...inner,{kind:'exponential',scale:Z(0,2)},mobius(Z(0,-1),Z(0,1),Z(1),Z(1))];
      if(n.name==='conj')return [...inner,{...mobius(),conjugate:true} as RegionTransform];
      throw new MathDiagnostic('operation',`inverse-${n.name}`,`Для ${n.name} вычисление точек и кривых доступно, но полный набор допустимых обратных ветвей для заливки пока не реализован.`);
    }
    if(n.type==='OperatorNode'){
      if(n.op==='^'&&n.args.length===2){
        if(isEuler(n.args[0]))return [...visit(n.args[1]),{kind:'exponential'}];
        const exponent=constant(n.args[1]);if(exponent&&exponent.im===0&&Number.isInteger(exponent.re)&&Math.abs(exponent.re)>=1&&Math.abs(exponent.re)<=32){
          const inner=visit(n.args[0]);return exponent.re>0?[...inner,{kind:'power',exponent:exponent.re}]:[...inner,{kind:'power',exponent:-exponent.re},mobius(Z(),Z(1),Z(1),Z())];
        }
        throw new MathDiagnostic('operation','inverse-power','Для обратной заливки показатель должен быть постоянным целым: 1 ≤ |n| ≤ 32.');
      }
      if(n.args.length===1&&['+','-'].includes(n.op))return n.op==='+'?visit(n.args[0]):[...visit(n.args[0]),mobius(Z(-1))];
      if(n.args.length===2){
        const a=constant(n.args[0]),b=constant(n.args[1]);
        if(b&&['+','-','*','/'].includes(n.op)){
          let outer:RegionTransform;
          if(n.op==='+'||n.op==='-')outer=mobius(Z(1),n.op==='+'?b:multiply(Z(-1),b) as Complex);
          else {if(b.re===0&&b.im===0)throw new MathDiagnostic('operation','degenerate-map','Нулевой множитель или деление на ноль: двумерная обратная заливка не строится.');outer=mobius(n.op==='*'?b:divide(Z(1),b) as Complex);}
          return [...visit(n.args[0]),outer];
        }
        if(a&&['+','-','*','/'].includes(n.op)){
          if((n.op==='*'||n.op==='/')&&a.re===0&&a.im===0)throw new MathDiagnostic('operation','constant-image','Отображение вырождается в константу; заливка площади не применяется.');
          const outer=n.op==='+'?mobius(Z(1),a):n.op==='-'?mobius(Z(-1),a):n.op==='*'?mobius(a):mobius(Z(),a,Z(1),Z());
          return [...visit(n.args[1]),outer];
        }
        // Recognize rational functions of one shared inner expression, such as
        // (z²+1)/(z²-1), by structural substitution, without evaluation or sampling.
        const candidates:MathNode[]=[];n.traverse(node=>{if(node!==n&&['FunctionNode','OperatorNode'].includes(node.type))candidates.push(node);});
        for(const candidate of candidates){
          let hasZ=false;candidate.traverse(k=>{if(k.type==='SymbolNode'&&(k as N).name==='z')hasZ=true;});if(!hasZ)continue;
          const key=candidate.toString();let replacements=0;
          const outer=n.transform(node=>{if(node.toString()===key){replacements++;return recognizeSymbol();}return node;});
          if(replacements<2)continue;const family=recognize(outer);if(family)return [...visit(candidate),family];
        }
      }
    }
    throw new MathDiagnostic('operation','inverse-structure','Вычисление формулы доступно для точек и кривых. Для этой структуры не найдено полного обратного плана: используйте композицию поддерживаемых семейств или отдельные выражения.');
  }
  // The callback uses an actual SymbolNode supplied by the existing mathjs AST.
  function recognizeSymbol():MathNode {let symbol:MathNode|undefined;root.traverse(n=>{if(n.type==='SymbolNode'&&(n as N).name==='z')symbol=n;});if(!symbol)throw new Error('Нет переменной z.');return symbol;}
  const all=visit(root);
  const steps=all.filter(s=>all.length===1||s.kind!=='mobius'||s.conjugate||s.excluded.length||s.a.re!==1||s.a.im!==0||s.b.re!==0||s.b.im!==0||s.c.re!==0||s.c.im!==0||s.d.re!==1||s.d.im!==0);if(steps.length>12)throw new MathDiagnostic('operation','composition-depth','Композиция превышает 12 обратных ступеней.');
  return steps.length===1?steps[0]:{kind:'composition',steps};
}
