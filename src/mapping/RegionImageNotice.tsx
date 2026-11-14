import { useEffect, useRef, useState } from 'react';
import type { RegionImage } from '../regions/transform';
export interface SamplingStatus { id:string; maxUncertaintyPx:number; truncated:boolean }
export function RegionImageNotice({results,hasLines}:{results:({id:string}&RegionImage)[];hasLines:boolean}){
  const host=useRef<HTMLDivElement>(null),[stats,setStats]=useState<Record<string,SamplingStatus>>({});
  const ids=results.filter(r=>r.approximation).map(r=>r.id).join('\0');
  useEffect(()=>{
    const parent=host.current?.parentElement;if(!parent)return;
    const allowed=new Set(ids.split('\0'));
    const onStatus=(event:Event)=>{const s=(event as CustomEvent<SamplingStatus>).detail;if(allowed.has(s.id))setStats(previous=>({...previous,[s.id]:s}));};
    parent.addEventListener('region-approximation',onStatus);setStats({});
    return ()=>parent.removeEventListener('region-approximation',onStatus);
  },[ids]);
  const notices=[...new Set(results.map(r=>r.notice).filter(Boolean))],hasHoles=results.some(r=>r.region?.excluded.length);
  const current=results.filter(r=>r.approximation).flatMap(r=>stats[r.id]?[stats[r.id]]:[]),uncertainty=Math.max(0,...current.map(s=>s.maxUncertaintyPx));
  return <div className="image-note" ref={host}>
    Неразрешённые участки кривых показаны разрывами. {hasLines?'Образы прямых — адаптивные параметрические кривые; неразрешённые участки пропускаются.':''}{hasHoles?' Исключённые конечные точки отмечены полыми кружками.':''}
    {notices.map(n=><span className="region-notice" key={n} role="status">{n}</span>)}
    {current.length>0&&<span className="sampling-details" role="status">Максимальный размер непроверенной ячейки: {uncertainty.toFixed(1)} px.{current.some(s=>s.truncated)?' Достигнут лимит детализации.':''}</span>}
  </div>;
}
