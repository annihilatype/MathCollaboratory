// node scripts/benchmark-interval.mjs — new strict tasks, no old verified baseline.
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try{
 const {prepareIntervalSubdivision}=await server.ssrLoadModule('/src/core/interval/subdivision.ts');
 const scenes=[['disk','|z|<2',undefined,undefined],['polynomial-preimage','|z|<2','z^4','preimage'],['rational-image','Re(z)>0','(z+1)/(z-1)','image']];
 const results=[];
 for(const [scene,region,mapping,direction] of scenes){const times=[];let last,largestStep=0;
  for(let i=0;i<9;i++){
   const start=performance.now(),prepared=prepareIntervalSubdivision({schema:1,id:'benchmark',kind:'interval-classification',region,mapping,direction,parameters:{},box:[-4,4,-4,4],budget:2048,maxDepth:12,minWidth:.03});if(!prepared.ok)throw new Error(prepared.diagnostic.message);
   while(true){const begin=performance.now(),step=prepared.value.step(32);if(i>1)largestStep=Math.max(largestStep,performance.now()-begin);if(step.state!=='pending'){last=step.result;break;}}
   if(i>1)times.push(performance.now()-start);
  }
  times.sort((a,b)=>a-b);const data=last.kind==='interval-confirmed'?last.enclosure:last.partial;
  results.push({scene,medianMs:+times[3].toFixed(2),largestObservedStep32Ms:+largestStep.toFixed(2),status:last.kind,evaluations:last.budget.used,inside:data.inside.length,outside:data.outside.length,unknown:data.unknown.length});
 }
 console.log(JSON.stringify({node:process.version,samples:7,budget:2048,stepCells:32,results},null,2));
}finally{await server.close();}
