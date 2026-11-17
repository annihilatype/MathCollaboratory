import {it,expect} from 'vitest';
import {prepareRegionImageTask,isSerializable,type RegionImageRequest,type ComputationTask,type RegionImageData} from './tasks';
import {compileMapping,bindMapping,compileGeometry,bindGeometry} from './compile';
import {availableAlgorithms,mapRegionImage,checkImageMembership,checkRegionMembership,defineAlgorithm} from './algorithms';
import {valueOf,type Validation} from './results';
import {parseComplexGeometry} from './geometry/parse';
import {createImageCache} from './mapping/prepare';
import {tileRegionImage} from './regions/inverse';
import type {Region} from './regions/model';
const ok=<T>(v:Validation<T>):T=>{if(!v.ok)throw new Error(v.diagnostic.message);return v.value;};
function request(source='{z:0<Im(z)<pi/2,Re(z)>0}',formula='exp(2*z)'):RegionImageRequest{return {schema:1,id:'image-1',kind:'region-image',region:parseComplexGeometry(source) as Region,mapping:{source:{text:formula,notation:'latex',role:'mapping'},parameters:{}},view:[-4,4,4,-4],unit:60,budget:2048,pixelSize:2};}
function finish(task:ComputationTask<RegionImageData>){for(let i=0;i<13000;i++){const step=task.step(32);if(step.state!=='pending')return step;}throw new Error('Task did not finish within its budget.');}
it('JSON round trips a job, its mathematical partial result and diagnostics',()=>{
 const input=request(),task=ok(prepareRegionImageTask(JSON.parse(JSON.stringify(input)))),step=finish(task);expect(step.state).toBe('completed');expect(isSerializable(step)).toBe(true);expect(JSON.parse(JSON.stringify(step))).toEqual(step);
 const data=valueOf(step.result)!;expect(data.kind).toBe('sampled-region');if(data.kind!=='sampled-region')throw new Error();expect(data.tiling.evaluations).toBeLessThanOrEqual(input.budget);expect(data.tiling.inside.length).toBeGreaterThan(0);expect(step.result.kind).toBe('uncertain');expect(step.result.kind).not.toBe('interval-confirmed');expect(task.step()).toBe(step);
});
it('cancels pending work without publishing a stale approximation',()=>{
 const task=ok(prepareRegionImageTask(request()));expect(task.step(1)).toMatchObject({id:'image-1',state:'pending',evaluations:1});task.cancel('Новая формула');const step=task.step(100);expect(step).toMatchObject({id:'image-1',state:'cancelled',result:{kind:'uncertain',reason:{kind:'cancelled'}}});if(step.state==='pending')throw new Error('Cancelled task remained pending.');expect(valueOf(step.result)).toBeUndefined();expect(task.step()).toBe(step);
});
it('captures input data independently of later caller mutation',()=>{
 const input=request(),task=ok(prepareRegionImageTask(input));input.mapping.source.text='z';input.view[0]=-100;input.region.constraints.length=0;input.budget=1;
 expect(task.input.mapping.source.text).toBe('exp(2*z)');expect(task.input.view[0]).toBe(-4);expect(task.input.region.constraints.length).toBeGreaterThan(0);const step=finish(task);expect(step.result.kind).toBe('uncertain');
});
it.each([0,1,8,32,256])('enforces budgets %s and handles completion conservatively',budget=>{
 const input={...request(),budget};const prepared=prepareRegionImageTask(input);if(budget===0){expect(prepared.ok).toBe(false);return;}const step=finish(ok(prepared));expect(isSerializable(step)).toBe(true);if(step.result.kind==='uncertain')expect(step.result.budget!.used).toBeLessThanOrEqual(budget);
});
it('returns analytic region structure with floating coefficients, never a verified interval',()=>{
 const step=finish(ok(prepareRegionImageTask(request('|z|>2','1/z'))));expect(step.result).toMatchObject({kind:'approximate',accuracy:{certified:false,arithmetic:'float64'},derivation:{kind:'analytic-formula'},value:{kind:'analytic-region'}});expect(isSerializable(step)).toBe(true);
 const punctured=finish(ok(prepareRegionImageTask(request('{z:|z|<2,z!=0}','z+1'))));expect(isSerializable(punctured)).toBe(true);
});
it('exposes only implemented algorithms and preserves preimage existence',()=>{
 const list=availableAlgorithms();expect(list.map(a=>a.category)).not.toContain('ode');expect(list.map(a=>a.category)).toContain('interval-arithmetic');
 const mapping=ok(bindMapping(ok(compileMapping('z^2')))),region=ok(bindGeometry(ok(compileGeometry('{z:|z|<2,z!=1}')))) as Region,image=valueOf(mapRegionImage({region,mapping}))!;
 expect(image.approximation).toBeDefined();expect(checkImageMembership({plan:image.approximation!,point:{re:1,im:0}})).toMatchObject({kind:'approximate',value:true,accuracy:{certified:false}});
 const custom=defineAlgorithm<{x:number},number>({id:'double-test',category:'geometry',description:'test',execute:({x})=>2*x});expect(custom.execute({x:3})).toBe(6);expect(Object.isFrozen(custom)).toBe(true);
});
it('keeps strict and closed region boundaries approximate, not interval-verified',()=>{
 for(const [source,inside] of [['|z|<2',false],['|z|<=2',true]] as const){const region=ok(bindGeometry(ok(compileGeometry(source)))) as Region;expect(checkRegionMembership({region,point:{re:2,im:0}})).toMatchObject({kind:'approximate',value:inside,accuracy:{certified:false}});}
});
it('pure image cache reuses samples and its resumable UI adapter agrees with legacy sampling',()=>{
 const region=parseComplexGeometry('1<|z|<2'),mapping=ok(bindMapping(ok(compileMapping('exp(z)')))),cache=createImageCache(),objects=[{id:'r',geometry:region}];
 const first=cache.prepare(objects,mapping)[0],again=cache.prepare(objects,mapping)[0];expect(again).toBe(first);if(first.geometry.kind!=='region-image')throw new Error();const g=first.geometry,t=g.begin([-4,4,4,-4],60,'settled');
 let result=null;for(let i=0;i<12000&&!result;i++)result=t.step(32);expect(result).toBeDefined();expect(result).toEqual(g.sample([-4,4,4,-4],60));expect(result).toEqual(tileRegionImage(g.plan,[-4,4,4,-4],60,6144));
});
it('rejects malformed, cyclic, non-finite and executable job data',()=>{
 const input=request();const cycle:Record<string,unknown>={};cycle.self=cycle;expect(isSerializable(cycle)).toBe(false);expect(isSerializable({fn:()=>1})).toBe(false);expect(isSerializable({number:Infinity})).toBe(false);
 for(const patch of [{budget:12001},{unit:NaN},{view:[0,0,0,0]},{region:{kind:'region',constraints:'x',excluded:[]}},{region:{kind:'region',constraints:[],excluded:[],union:false}},{mapping:{source:input.mapping.source}},{mapping:{...input.mapping,parameters:{a:()=>2}}}])expect(prepareRegionImageTask({...input,...patch} as RegionImageRequest).ok).toBe(false);
});
