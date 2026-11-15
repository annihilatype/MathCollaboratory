import {useMemo,useRef} from 'react';
import type {ComplexPlot,DrawablePlot} from '../complex/render';
import type {ComplexMapping} from '../core/mapping/types';
import {createImageCache} from '../core/mapping/prepare';
export function useImagePlots(objects:ComplexPlot[],mapping:ComplexMapping|null):DrawablePlot[]{
 const cache=useRef<ReturnType<typeof createImageCache>|null>(null);cache.current??=createImageCache();
 return useMemo(()=>{const colors=new Map(objects.map(p=>[p.id,p.color]));return cache.current!.prepare(objects,mapping).map(p=>({...p,color:colors.get(p.id)!}));},[objects,mapping]);
}
