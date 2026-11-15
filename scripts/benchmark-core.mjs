// node scripts/benchmark-core.mjs [baseline git ref]
import {createServer} from 'vite';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
const root=process.cwd(),baseline=process.argv[2]??'3bf4a65',temp=await mkdtemp(join(root,'.benchmark-core-'));
const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try{
 execFileSync('tar',['-x','-C',temp],{input:execFileSync('git',['archive','--format=tar',baseline,'src'])});
 const oldReal=await server.ssrLoadModule(join(temp,'src/math/expression.ts'));
 const oldMapping=await server.ssrLoadModule(join(temp,'src/mapping/expression.ts'));
 const oldGeometry=await server.ssrLoadModule(join(temp,'src/complex/geometry.ts'));
 const core=await server.ssrLoadModule('/src/core/compile.ts');
 const {syntaxCacheStats}=await server.ssrLoadModule('/src/core/syntax/ast.ts');
 const must=r=>{if(!r.ok)throw new Error(r.diagnostic.message);return r.value;};
 const real='a*sin(x)^2+cos(x)^2+b*x',mapping='exp(a*z+b)',geometry='{z:|z-a|<r,Im(z)>0}',scope={a:.7,b:.1,r:2};
 const R0=oldReal.parseExpression(real),R=must(core.compileReal(real)),M0=oldMapping.parseMapping(mapping,scope),compiled=must(core.compileMapping(mapping)),M=must(core.bindMapping(compiled,scope)),G=must(core.compileGeometry(geometry));
 const cases=[
  ['real-samples',50000,()=>{let sum=0;for(let i=0;i<50000;i++)sum+=R0.evaluate((i%1000)/100,scope);return sum;},()=>{let sum=0;for(let i=0;i<50000;i++)sum+=R.fast.evaluate((i%1000)/100,scope);return sum;}],
  ['complex-samples',10000,()=>{let sum=0;for(let i=0;i<10000;i++)sum+=M0.evaluate({re:(i%100)/100,im:.4}).re;return sum;},()=>{let sum=0;for(let i=0;i<10000;i++)sum+=M.evaluate({re:(i%100)/100,im:.4}).re;return sum;}],
  ['mapping-parameter-edits',400,()=>{let sum=0;for(let i=0;i<400;i++)sum+=oldMapping.parseMapping(mapping,{a:i/400,b:.1}).evaluate({re:.5,im:.2}).re;return sum;},()=>{let sum=0;for(let i=0;i<400;i++)sum+=must(core.bindMapping(compiled,{a:i/400,b:.1})).evaluate({re:.5,im:.2}).re;return sum;}],
  ['geometry-parameter-edits',400,()=>{let sum=0;for(let i=0;i<400;i++){const q=oldGeometry.parseComplexGeometry(geometry,{a:i/400,r:2}).constraints[0];sum+=q.a+q.b+q.c+q.d;}return sum;},()=>{let sum=0;for(let i=0;i<400;i++){const q=must(core.bindGeometry(G,{a:i/400,r:2})).constraints[0];sum+=q.a+q.b+q.c+q.d;}return sum;}],
 ];
 const results=[];
 for(const [name,operations,old,current] of cases){const sums=[];for(const [version,fn] of [['baseline',old],['current',current]]){const times=[];let checksum;for(let k=0;k<9;k++){const start=performance.now();checksum=fn();if(k>1)times.push(performance.now()-start);}times.sort((a,b)=>a-b);sums.push(checksum);results.push({name,version,operations,medianMs:+times[3].toFixed(3),checksum});}if(Math.abs(sums[0]-sums[1])>1e-8*Math.max(1,Math.abs(sums[0])))throw new Error('Semantic benchmark mismatch: '+name);}
 const before=syntaxCacheStats().parses;for(let i=0;i<100;i++)must(core.bindMapping(compiled,{a:i,b:0}));
 console.log(JSON.stringify({baseline,node:process.version,samples:7,parameterEditsExtraParses:syntaxCacheStats().parses-before,results},null,2));
}finally{await server.close();await rm(temp,{recursive:true,force:true});}
