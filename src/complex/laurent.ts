import type { MathNode } from 'mathjs';
import { evaluateComplexNode } from './math';
// Small structural recognizer for the Joukowski family. Only monomial divisors
// are accepted, so it cannot erase a hidden pole away from z=0.
export function isJoukowski(root:MathNode,parameters:Readonly<Record<string,number>>):boolean{
  type N=MathNode&{content:MathNode;name:string;op:string;args:MathNode[]};
  type P=Map<number,number>;
  const finite=(p:P)=>[...p].every(([k,v])=>Math.abs(k)<=2&&Number.isFinite(v));
  function visit(node:MathNode):P|null{
    const n=node as N;if(n.type==='ParenthesisNode')return visit(n.content);
    if(n.type==='SymbolNode'&&n.name==='z')return new Map([[1,1]]);
    try{const c=evaluateComplexNode(n,parameters);if(c.im===0)return new Map([[0,c.re]]);}catch{/* variable subtree */}
    if(n.type!=='OperatorNode')return null;
    if(n.op==='^'&&n.args.length===2&&(n.args[0] as N).name==='z'){
      try{const c=evaluateComplexNode(n.args[1],parameters);return c.im===0&&Number.isInteger(c.re)&&Math.abs(c.re)<=2?new Map([[c.re,1]]):null;}catch{return null;}
    }
    const a=visit(n.args[0]);if(!a)return null;
    if(n.args.length===1)return n.op==='-'?new Map([...a].map(([k,v])=>[k,-v])):n.op==='+'?a:null;
    if(n.args.length!==2)return null;const b=visit(n.args[1]);if(!b)return null;const p=new Map<number,number>();
    if(n.op==='+'||n.op==='-'){for(const [k,v] of a)p.set(k,v);for(const [k,v] of b)p.set(k,(p.get(k)??0)+(n.op==='+'?v:-v));}
    else if(n.op==='*'){for(const [i,x] of a)for(const [j,y] of b)p.set(i+j,(p.get(i+j)??0)+x*y);}
    else if(n.op==='/'){const terms=[...b].filter(([,v])=>v!==0);if(terms.length!==1)return null;const [j,y]=terms[0];for(const [i,x] of a)p.set(i-j,x/y);}
    else return null;
    return finite(p)?p:null;
  }
  const p=visit(root);return !!p&&p.get(-1)===.5&&p.get(1)===.5&&[...p].every(([k,v])=>k===-1||k===1||v===0);
}
