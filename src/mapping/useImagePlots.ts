import { useMemo, useRef } from 'react';
import type { ComplexPlot, DrawablePlot } from '../complex/render';
import type { ComplexMapping } from '../complex/geometry';
import { parameterize } from './parameterize';
import { sampleImage, type ImagePath } from './sample';
// One cached sample per curve/viewport, reused while unrelated points are dragged.
export function useImagePlots(objects:ComplexPlot[],mapping:ComplexMapping|null):DrawablePlot[]{
  const cache=useRef(new Map<string,{key:string;mapping:ComplexMapping;plot:DrawablePlot}>());
  return useMemo(()=>{
    if(!mapping)return [];
    const result:DrawablePlot[]=[],curves=objects.filter(p=>parameterize(p.geometry)).length;
    const budget=Math.max(8,Math.min(2048,Math.floor(12000/(Math.max(1,curves)*Math.max(1,Math.ceil(mapping.cost/8))))));
    const ids=new Set(objects.map(p=>p.id));for(const id of cache.current.keys())if(!ids.has(id))cache.current.delete(id);
    for(const p of objects){
      const g=p.geometry;
      if(g.kind==='point'){
        const w=mapping.evaluate(g.value);
        if(w&&Math.max(Math.abs(w.re),Math.abs(w.im))<=1e9)result.push({...p,geometry:{kind:'point',value:w,modulus:Math.hypot(w.re,w.im),argument:w.re===0&&w.im===0?null:Math.atan2(w.im,w.re)}});
      }else{
        const curve=parameterize(g);if(!curve)continue;
        const key=JSON.stringify(g)+p.color+budget,old=cache.current.get(p.id);
        if(old?.key===key && old.mapping===mapping){result.push(old.plot);continue;}
        let previousKey='',previous:ImagePath;
        const plot:DrawablePlot={id:p.id,color:p.color,geometry:{kind:'image',sample:(view,unit)=>{
          const k=JSON.stringify(view)+unit;if(k===previousKey)return previous;
          previous=sampleImage(curve,mapping,view,unit,budget);previousKey=k;return previous;
        }}};
        cache.current.set(p.id,{key,mapping,plot});result.push(plot);
      }
    }
    return result;
  },[objects,mapping]);
}
