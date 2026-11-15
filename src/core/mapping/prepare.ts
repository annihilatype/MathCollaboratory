import { partsOf } from '../regions/model';
import { tileRegionImage,createRegionTilingTask, type RegionTiling } from '../regions/inverse';
import { mapRegion } from '../regions/transform';
import type {ComplexGeometry} from '../geometry/types';
import type {ComplexCoordinate,Viewport} from '../types';
import type {InversePlan,RegionTilingTask} from '../regions/inverse';
import {createBoundRegionTask} from '../tasks';
import {valueOf} from '../results';
import type {ComplexMapping} from './types';
import { parameterize } from '../geometry/parameterize';
import { sampleImage, type ImagePath } from './sample';
export type SamplingQuality='interactive'|'settled';
export interface ImageRegion {kind:'region-image';plan:InversePlan;sample:(view:Viewport,unit:number,quality?:SamplingQuality)=>RegionTiling;begin:(view:Viewport,unit:number,quality:SamplingQuality)=>RegionTilingTask}
export interface ImageCurve {kind:'image';sample:(view:Viewport,unit:number)=>ImagePath}
export interface GeometryPlot {id:string;geometry:ComplexGeometry}
export interface PreparedPlot {id:string;geometry:ComplexGeometry|ImageRegion|ImageCurve}
// One cached sample per curve/viewport, reused while unrelated points are dragged.
export function createImageCache(){
  let taskSerial=0;
  const cache=new Map<string,{key:string;mapping:ComplexMapping;plot:PreparedPlot}>();
  return {prepare(objects:readonly GeometryPlot[],mapping:ComplexMapping|null):PreparedPlot[]{
    if(!mapping)return [];
    const result:PreparedPlot[]=[],curves=objects.filter(p=>parameterize(p.geometry)).length;
    const regionCount=Math.max(1,objects.filter(p=>p.geometry.kind==='region').length);
    const budget=Math.max(8,Math.min(2048,Math.floor(12000/(Math.max(1,curves)*Math.max(1,Math.ceil(mapping.cost/8))))));
    const ids=new Set(objects.map(p=>p.id));for(const id of cache.keys())if(!ids.has(id))cache.delete(id);
    for(const p of objects){
      const g=p.geometry;
      if(g.kind==='point'){
        const w=mapping.evaluate(g.value);
        if(w&&Math.max(Math.abs(w.re),Math.abs(w.im))<=1e9)result.push({...p,geometry:{kind:'point',value:w,modulus:Math.hypot(w.re,w.im),argument:w.re===0&&w.im===0?null:Math.atan2(w.im,w.re)}});
      }else if(g.kind==='region'&&!parameterize(g)){
        const image=mapRegion(g,mapping),plan=image.approximation;
        const key='region:'+JSON.stringify(g)+regionCount,old=cache.get(p.id);
        if(old?.key===key&&old.mapping===mapping){result.push(old.plot);continue;}
        let plot:PreparedPlot|undefined;
        if(image.region)plot={...p,geometry:image.region};
        else if(plan){
          const domainCost=Math.max(1,Math.ceil(partsOf(g).reduce((n,r)=>n+r.constraints.length+r.excluded.length+(r.excludedSegments?.length??0),0)/8));
          const cellBudget=Math.max(8,Math.min(6144,Math.floor(24000/(regionCount*plan.branches*domainCost))));
          let previousKey='',previous:RegionTiling;
          plot={...p,geometry:{kind:'region-image',plan,begin:(view,unit,quality)=>{
            const k=JSON.stringify(view)+unit+quality;if(k===previousKey)return {step:()=>previous};
            const limit=quality==='interactive'?Math.min(512,cellBudget):cellBudget,pixelSize=quality==='interactive'?6:2;
            const job=mapping.definition?createBoundRegionTask({schema:1,id:`region-${++taskSerial}`,kind:'region-image',region:g,mapping:mapping.definition,view,unit,budget:limit,pixelSize},plan):null;
            const task:RegionTilingTask=job?{cancel:reason=>job.cancel(reason),step:n=>{const step=job.step(n);if(step.state==='pending')return null;const result=valueOf(step.result);return result?.kind==='sampled-region'?result.tiling:null;}}:createRegionTilingTask(plan,view,unit,limit,pixelSize);
            return {cancel:reason=>task.cancel?.(reason),step:n=>{const result=task.step(n);if(result){previous=result;previousKey=k;}return result;}};
          },sample:(view,unit,quality='settled')=>{
            const k=JSON.stringify(view)+unit+quality;if(k===previousKey)return previous;
            previous=tileRegionImage(plan,view,unit,quality==='interactive'?Math.min(512,cellBudget):cellBudget,quality==='interactive'?6:2);previousKey=k;return previous;
          }}};
        }
        if(plot){cache.set(p.id,{key,mapping,plot});result.push(plot);}else cache.delete(p.id);
      }else{
        const curve=parameterize(g);if(!curve)continue;
        const key=JSON.stringify(g)+budget,old=cache.get(p.id);
        if(old?.key===key && old.mapping===mapping){result.push(old.plot);continue;}
        let previousKey='',previous:ImagePath;
        const plot:PreparedPlot={id:p.id,geometry:{kind:'image',sample:(view,unit)=>{
          const k=JSON.stringify(view)+unit;if(k===previousKey)return previous;
          previous=sampleImage(curve,mapping,view,unit,budget);previousKey=k;return previous;
        }}};
        cache.set(p.id,{key,mapping,plot});result.push(plot);
      }
    }
    return result;
  }};
}
