import type { MathNode } from 'mathjs';
import { evaluateComplexNode } from '../complex/math';
import { circleOffset } from '../complex/offset';
import { boundary, constraint, type Region, type RegionConstraint } from './model';
type Node=MathNode&{content:MathNode;op:string;args:MathNode[];conditionals:string[];params:MathNode[];fn:MathNode;name:string};
const comparisons:Record<string,string>={smaller:'<',smallerEq:'<=',larger:'>',largerEq:'>='};
const diagnostic=()=>new Error('Область: Re(z)<2, |z-1-i|<=2, 1<|z|<3. Пересечение: Re(z)<2 and Im(z)>=0.');
const unwrap=(n:MathNode):Node=>n.type==='ParenthesisNode'?unwrap((n as Node).content):n as Node;
function metric(n:MathNode):{axis:'re'|'im'|'abs';x:number;y:number}|null{
  const node=unwrap(n);
  if(node.type!=='FunctionNode'||node.fn.type!=='SymbolNode'||node.args.length!==1)return null;
  if(['Re','Im','re','im'].includes(node.name)){
    const arg=unwrap(node.args[0]);if(arg.type!=='SymbolNode'||arg.name!=='z')throw new Error('В Re и Im области разрешено только z.');
    return {axis:node.name.toLowerCase() as 're'|'im',x:0,y:0};
  }
  if(node.name==='abs'){const c=circleOffset(node.args[0]);return {axis:'abs',x:-c.re,y:-c.im};}
  return null;
}
export function parseRegion(root:MathNode):Region {
  const result:RegionConstraint[]=[];
  function compare(left:MathNode,right:MathNode,op:string){
    let m=metric(left),valueNode=right;
    if(!m){m=metric(right);valueNode=left;op=({'<':'>','>':'<','<=':'>=','>=':'<='} as Record<string,string>)[op];}
    if(!m||!op)throw diagnostic();
    const v=evaluateComplexNode(valueNode);if(v.im!==0)throw new Error('Граница области должна быть вещественной.');
    const sign=op.startsWith('<')?1:-1,strict=!op.endsWith('=');
    if(m.axis==='abs'){
      if(v.re<=0)throw new Error('Радиус области должен быть положительным.');
      const q=constraint(sign,-2*sign*m.x,-2*sign*m.y,sign*(m.x*m.x+m.y*m.y-v.re*v.re),strict),shape=boundary(q);
      if(shape.kind!=='circle'||!Number.isFinite(shape.radius)||Math.abs(shape.radius-v.re)>v.re*1e-7)throw new Error('Радиус и центр нельзя надёжно представить с доступной числовой точностью.');
      result.push(q);
    }else result.push(constraint(0,m.axis==='re'?sign:0,m.axis==='im'?sign:0,-sign*v.re,strict));
  }
  const node=unwrap(root);
  // Explicitly at most two clauses; each can be a two-sided radial inequality.
  const clauses=node.type==='OperatorNode'&&node.op==='and'?node.args:[node];
  if(clauses.length>2)throw diagnostic();
  for(const clause of clauses){
    const n=unwrap(clause);
    if(n.type==='RelationalNode'&&n.params.length===3&&n.conditionals.every(c=>comparisons[c])){
      if(metric(n.params[1])?.axis!=='abs')throw diagnostic();
      n.conditionals.forEach((op,i)=>compare(n.params[i],n.params[i+1],comparisons[op]));
    }else if(n.type==='OperatorNode'&&['<','<=','>','>='].includes(n.op)&&n.args.length===2)compare(n.args[0],n.args[1],n.op);
    else throw diagnostic();
  }
  if(result.length===0||result.length>4)throw diagnostic();
  return {kind:'region',constraints:result,excluded:[]};
}
