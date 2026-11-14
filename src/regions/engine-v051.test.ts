import {describe,it,expect} from 'vitest';
import {parseComplexGeometry} from '../complex/geometry';
import {parseMapping} from '../mapping/expression';
import {contains,type Region} from './model';
import {mapRegion} from './transform';
import {classifyImageBox,createRegionTilingTask,explainInversePlan,imageContains,imageMembership,tileRegionImage,type Box,type InversePlan} from './inverse';
const region=(s:string,p={})=>parseComplexGeometry(s,p) as Region;
const plan=(s:string,f:string,p={})=>{const image=mapRegion(region(s,p),parseMapping(f,p));expect(image.accuracy,image.notice).not.toBe('unsupported');return image.approximation!;};
const point=(p:InversePlan,x:number,y=0)=>imageContains(p,{re:x,im:y});
const tiny=(x:number,y:number):Box=>[x-.00001,x+.00001,y-.00001,y+.00001];
describe('Composable, complete inverse plans v0.5.1',()=>{
 it.each(['exp(2*z)','\\exp\\left(2\\cdot z\\right)','\\mathrm{e}^{2z}'])('entire unbounded half strip under %s',f=>{
   const p=plan('{z:0<Im(z)<pi/2,Re(z)>0}',f);
   for(const [x,y,expected] of [[2,2,true],[0,2,true],[100,100,true],[.5,.5,false],[2,-1,false],[2,0,false],[0,1,false],[0,0,false]] as const)expect(point(p,x,y),`${x},${y}`).toBe(expected);
   expect(classifyImageBox(p,tiny(2,2))).toBe(1);expect(classifyImageBox(p,tiny(.5,.5))).toBe(-1);
   const closed=plan('{z:0<=Im(z)<=pi/2,Re(z)>=0}',f);expect(point(closed,1,0)).toBe(true);expect(point(closed,-1,0)).toBe(true);
 });
 it.each([Math.PI/2,Math.PI,2*Math.PI,4*Math.PI])('exp on strips of half width %s',a=>{
   const p=plan(`|Im(z)|<${a}`,'exp(z)');expect(point(p,0)).toBe(false);expect(point(p,1)).toBe(true);expect(point(p,-1)).toBe(a>Math.PI);expect(point(p,1e6,1)).toBe(true);
 });
 it('uses oblique source constraints to bound logarithmic branches',()=>{
   // Im((1+i)z)=Re(z)+Im(z); this strip has an infinite x/y box.
   const source:Region={kind:'region',constraints:[{a:0,b:1,c:1,d:-1,strict:true},{a:0,b:-1,c:-1,d:-1,strict:true}],excluded:[]};
   const mapped=mapRegion(source,parseMapping('exp((1+i)*z)'));expect(mapped.approximation).toBeDefined();expect(point(mapped.approximation!,Math.E)).toBe(true);expect(point(mapped.approximation!,-1)).toBe(false);
 });
 it.each([2,3,4,8])('all %i roots and topology for powers',n=>{
   const p=plan('{z:0<arg(z)<pi/2}',`z^${n}`);
   expect(point(p,0)).toBe(false);expect(point(p,0,1)).toBe(true);expect(point(p,1)).toBe(n>4);expect(point(p,-1)).toBe(n>2);
   const disk=region('|z|<=2');const image=mapRegion(disk,parseMapping(`z^${n}`));expect(image.accuracy).toBe('exact');expect(contains(image.region!,{re:2**n,im:0})).toBe(true);expect(contains(image.region!,{re:2**n+1,im:0})).toBe(false);
 });
 it.each(['exp(z^2)','exp((z-1)^2)','1/(z^2+1)','(z^2+1)/(z^2-1)','sin(z)','cos(z)','tan(z)','conj(exp(z^2))','2*sin(z)+1'])('certifies witnesses for composed %s',f=>{
   const p=plan('|z|<.8',f),mapping=parseMapping(f);
   for(const z of [{re:.2,im:.3},{re:-.5,im:.1},{re:.6,im:-.2}]){const w=mapping.evaluate(z)!;expect(w).not.toBeNull();expect(imageMembership(p,w)).toBe('inside');}
   const tiles=tileRegionImage(p,[-3,3,3,-3],35,2500,3);
   expect(tiles.evaluations).toBeLessThanOrEqual(2500);expect(tiles.inside.length).toBeGreaterThan(0);
   for(const c of tiles.inside)for(const a of [.1,.5,.9])for(const b of [.1,.5,.9])expect(point(p,c[0]+a*(c[1]-c[0]),c[2]+b*(c[3]-c[2]))).toBe(true);
 });
 it('honours all valid preimages instead of removing an image of an excluded root',()=>{
   const square=plan('{z:|z|<2,z!=1}','z^2');expect(point(square,1)).toBe(true);
   const removed=plan('{z:|z|<2,z notin [-1,1]}','z^2');expect(point(removed,.25)).toBe(false);expect(point(removed,-.25)).toBe(true);expect(classifyImageBox(removed,[-.26,-.24,-.001,.001])).toBe(1);
   const cancelled=plan('{z:|z|<2,z notin [-1,1]}','1/(1/z)');expect(point(cancelled,0)).toBe(false);
   const hole=plan('|z|<2','exp(1/(1/z))');expect(point(hole,1)).toBe(false);expect(classifyImageBox(hole,[.999,1.001,-.001,.001])).not.toBe(1);
 });
 it.each(['|z|<1','|z|>2','{z:pi/4<arg(z)<3*pi/4}'])('Joukowski uses both roots on %s',s=>{
   const p=plan(s,'(z+1/z)/2'),m=parseMapping('(z+1/z)/2');expect(point(p,0,0)).toBe(s==='|z|<1'?false:s==='|z|>2'?false:true);
   for(const z of [{re:.3,im:.4},{re:3,im:2},{re:.1,im:2}])if(contains(p.source,z))expect(imageContains(p,m.evaluate(z)!)).toBe(true);
   expect(m.evaluate({re:0,im:0})).toBeNull();if(s.includes('arg'))expect(classifyImageBox(p,[-.001,.001,-.001,.001])).toBe(1);else expect(classifyImageBox(p,[-.001,.001,-.001,.001])).not.toBe(1);
 });
 it('keeps parameter edits mathematical rather than viewport-dependent',()=>{
   for(const a of [1,2,3]){const p=plan('{z:0<Im(z)<pi/2,Re(z)>0}','exp(a*z+b)',{a,b:1});expect(point(p,Math.E*2,Math.E*2)).toBe(true);expect(point(p,.5)).toBe(false);}
 });
 it('distinguishes a missing inverse, unbounded branches, branch budget and unknown cells',()=>{
   const missing=mapRegion(region('|z|<1'),parseMapping('exp(z)+z'));expect(missing.diagnostic?.kind).toBe('operation');expect(missing.notice).toContain('структур');
   const infinite=mapRegion(region('Re(z)>0'),parseMapping('exp(z)'));expect(infinite.diagnostic?.code).toBe('unbounded-log-branches');expect(infinite.notice).toContain('видимое окно');
   const budget=mapRegion(region('|z|<200'),parseMapping('sin(z)'));expect(budget.diagnostic?.kind).toBe('preimages');
   const branches=explainInversePlan(region('|z|<1'),{kind:'composition',steps:[{kind:'power',exponent:32},{kind:'power',exponent:32}]});expect(branches.diagnostic?.code).toBe('branch-budget');
   const p=plan('|z|<1','1/z^2');expect(classifyImageBox(p,[-.01,.01,-.01,.01])).toBe(0);expect(point(p,0)).toBe(false);
   expect(classifyImageBox(p,[NaN,1,0,1])).toBe(0);
 });
 it('resumes small batches to the same result and can abandon an obsolete task',()=>{
   const p=plan('|z|<1','sin(z)'),view=[-3,3,3,-3] as [number,number,number,number],task=createRegionTilingTask(p,view,40,1024),expected=tileRegionImage(p,view,40,1024);
   expect(task.step(1)).toBeNull();let result=null,steps=1;while(!result&&steps<2000){result=task.step(16);steps++;}expect(result).toEqual(expected);expect(task.step(1)).toBe(result);
   const abandoned=createRegionTilingTask(p,view,40,1024);expect(abandoned.step(2)).toBeNull();const next=createRegionTilingTask(p,[-1,1,1,-1],80,1024);expect(next.step(Infinity)).toEqual(tileRegionImage(p,[-1,1,1,-1],80,1024));
 });
 it('preserves numerical uncertainty on overflow and nearly excluded inverse points',()=>{
   const p=plan('|z|>2','(z+1/z)/2');expect(imageMembership(p,{re:1e200,im:0})).toBe('uncertain');
   const puncture=plan('{z:|z|<1,z!=.1}','z^2');expect(imageMembership(puncture,{re:.01,im:0})).toBe('inside'); // the negative root remains admissible
   const both=plan('{z:|z|<1,z!=.1,z!=-.1}','z^2');expect(imageMembership(both,{re:.01,im:0})).not.toBe('inside');
 });
 it('spends a bounded budget refining narrow verified pieces without certifying holes',()=>{
   const p=plan('{z:0<Im(z)<.005,Re(z)>0}','exp(z)'),t=tileRegionImage(p,[1,1,3,-1],180,4000,.8);
   expect(t.evaluations).toBeLessThanOrEqual(4000);expect(t.inside.length).toBeGreaterThan(0);for(const c of t.inside)expect(c[2]).toBeGreaterThan(0);
   const limited=tileRegionImage(p,[-5,5,5,-5],80,10);expect(limited.truncated).toBe(true);expect(limited.unresolved.length).toBeGreaterThan(0);
 });
});
