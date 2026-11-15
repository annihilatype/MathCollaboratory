import {it,expect} from 'vitest';
import ts from 'typescript';
import * as kernel from './index';
const sources=import.meta.glob<string>(['/src/core/**/*.ts','!/src/core/**/*.test.ts'],{query:'?raw',import:'default',eager:true});
it('all core imports stay inside the kernel or the existing mathjs package',()=>{
 const faults:string[]=[];
 for(const [path,source] of Object.entries(sources)){
  const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
  function inspect(node:ts.Node){
   if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
    const module=node.moduleSpecifier.text;
    if(module.startsWith('.')){const base=path.split('/').slice(0,-1);for(const part of module.split('/'))if(part==='..')base.pop();else if(part!=='.')base.push(part);const target=base.join('/')+'.ts';if(!target.startsWith('/src/core/')||!(target in sources))faults.push(`${path} -> ${module}`);}
    else if(module!=='mathjs')faults.push(`${path} -> ${module}`);
   }
   ts.forEachChild(node,inspect);
  }inspect(ast);
  if(/\b(?:ast|node|root|math|mathjs)\.(?:compile|evaluate)\s*\(/.test(source))faults.push(path+' calls arbitrary mathjs evaluation');
 }
 expect(faults).toEqual([]);
});
it('loads the public API without a browser and exposes no placeholder future solver',()=>{
 expect(typeof globalThis).toBe('object');expect(kernel.availableAlgorithms().map(a=>a.category)).not.toContain('interval-arithmetic');expect(kernel.availableAlgorithms().map(a=>a.category)).not.toContain('ode');
 const compiled=kernel.compileReal('x^2+1');if(!compiled.ok)throw new Error(compiled.diagnostic.message);expect(kernel.evaluateReal(compiled.value,2)).toMatchObject({kind:'approximate',value:5});
});

it('keeps semantic object contracts independent of mathjs syntax objects',()=>{
 const source=sources['/src/core/semantics.ts'],ast=ts.createSourceFile('semantics.ts',source,ts.ScriptTarget.Latest,true),imports=ast.statements.filter(ts.isImportDeclaration).map(s=>(s.moduleSpecifier as ts.StringLiteral).text);expect(imports.some(s=>s==='mathjs'||s.includes('syntax'))).toBe(false);
});
