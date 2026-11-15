// node scripts/benchmark-region-images.mjs [baseline git ref]
// Median synchronous sampling time, same domains/view and CPU for both versions.
import {createServer} from 'vite';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
const root=process.cwd(),temp=await mkdtemp(join(root,'.benchmark-'));
const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try{
 const {parseComplexGeometry}=await server.ssrLoadModule('/src/complex/geometry.ts');
 const {parseMapping}=await server.ssrLoadModule('/src/mapping/expression.ts');
 const current=await server.ssrLoadModule('/src/regions/inverse.ts');
 const versions=[['current',current]];
 if(process.argv[2]){
  const text=execFileSync('git',['show',`${process.argv[2]}:src/regions/inverse.ts`],{encoding:'utf8'}).replaceAll("'./model'","'../src/regions/model'");
  await writeFile(join(temp,'baseline.ts'),text);versions.unshift(['baseline',await server.ssrLoadModule(join(temp,'baseline.ts'))]);
 }
 const scenes=[['half-strip','{z:0<Im(z)<pi/2,Re(z)>0}','exp(2*z)'],['annulus','1<|z|<2','exp(z)'],['sector','{z:|arg(z)|<pi/8,z notin [0,1]}','z^8']];
 const output=[];
 for(const [name,module] of versions)for(const [scene,source,formula] of scenes){
  const plan=module.inversePlan(parseComplexGeometry(source),parseMapping(formula).regionTransform),times=[];let sample;
  for(let i=0;i<12;i++){const start=performance.now();sample=module.tileRegionImage(plan,[-5,5,5,-5],60,4096,2);if(i>=2)times.push(performance.now()-start);}
  times.sort((a,b)=>a-b);output.push({version:name,scene,medianMs:+times[Math.floor(times.length/2)].toFixed(2),p90Ms:+times[8].toFixed(2),evaluations:sample.evaluations,insideCells:sample.inside.length,uncertainCells:sample.unresolved.length,maxUncertaintyPx:+sample.maxUncertaintyPx.toFixed(2)});
 }
 console.log(JSON.stringify({baseline:process.argv[2]??null,node:process.version,samples:10,view:[-5,5,5,-5],unit:60,budget:4096,results:output},null,2));
}finally{await server.close();await rm(temp,{recursive:true,force:true});}
