import {parse,type MathNode} from 'mathjs';
// Bounded immutable syntax cache. Parameter values never participate in its key.
const cache=new Map<string,MathNode>();let parses=0;
export function parseAst(source:string):MathNode {
 if(source.length>8192)throw new Error('Выражение слишком сложное.');
 const cached=cache.get(source);if(cached){cache.delete(source);cache.set(source,cached);return cached;}
 const root=parse(source);let nodes=0;
 root.traverse(node=>{if(++nodes>150)throw new Error('Выражение слишком сложное.');for(const value of Object.values(node))if(Array.isArray(value))Object.freeze(value);Object.freeze(node);});
 parses++;cache.set(source,root);if(cache.size>256)cache.delete(cache.keys().next().value!);return root;
}
export function parseComplexAst(source:string):MathNode {
 let open=false;source=source.replace(/\|/g,()=>{open=!open;return open?'abs(':')';});
 if(open)throw new Error('Не закрыт знак модуля.');
 try{return parseAst(source);}catch(e){if((e as Error).message.includes('сложное'))throw e;throw new Error('Проверьте скобки и операторы комплексного выражения.');}
}
export function syntaxCacheStats(){return {parses,size:cache.size,capacity:256};}

export function isEuler(node:MathNode):boolean {if(node.type==='ParenthesisNode')return isEuler((node as MathNode&{content:MathNode}).content);return node.type==='SymbolNode'&&(node as MathNode&{name:string}).name==='e';}

/** mathjs traverse reports child-local paths; semantic references need full paths. */
export function walkAst(root:MathNode,visit:(node:MathNode,path:string)=>void):void {
 function walk(node:MathNode,path:string){visit(node,path);node.forEach((child,key)=>walk(child,path?path+'.'+key:key));}walk(root,'');
}
