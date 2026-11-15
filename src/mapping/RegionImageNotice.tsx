import {useEffect,useRef,useState} from 'react';
import type {RegionImage} from '../regions/transform';
import type {MathResult} from '../core/results';
export interface SamplingStatus {id:string;maxUncertaintyPx:number;truncated:boolean}
export const needsApproximationNotice=(result:MathResult<unknown>)=>result.kind==='approximate'||result.kind==='uncertain';
export function RegionImageNotice({results,hasLines,hasNumericalObjects,precision}:{results:({id:string}&RegionImage)[];hasLines:boolean;hasNumericalObjects:boolean;precision?:MathResult<unknown>}){
 const host=useRef<HTMLDivElement>(null),[stats,setStats]=useState<Record<string,SamplingStatus>>({});
 const ids=results.filter(r=>r.approximation).map(r=>r.id).join('\0');
 useEffect(()=>{
  const parent=host.current?.closest('.image-slot');if(!parent)return;
  const allowed=new Set(ids.split('\0'));
  const onStatus=(event:Event)=>{const s=(event as CustomEvent<SamplingStatus>).detail;if(allowed.has(s.id))setStats(previous=>({...previous,[s.id]:s}));};
  parent.addEventListener('region-approximation',onStatus);setStats({});return ()=>parent.removeEventListener('region-approximation',onStatus);
 },[ids]);
 const hasHoles=results.some(r=>r.region?.excluded.length),notices=[...new Set(results.map(r=>r.notice).filter(Boolean))],current=results.filter(r=>r.approximation).flatMap(r=>stats[r.id]?[stats[r.id]]:[]),uncertainty=Math.max(0,...current.map(s=>s.maxUncertaintyPx));
 // All existing rendered images use float64, including analytic coefficient
 // transformations. Certified SOURCE / PREIMAGE cells do not certify f(D).
 const approximate=precision?needsApproximationNotice(precision):hasNumericalObjects||results.some(r=>r.accuracy!=='unsupported');
 if(!approximate&&!notices.length)return null;
 return <div className="image-note" ref={host}>
  {approximate&&<span className="image-precision" role="status">Приближённое построение · возможны неточности у границ</span>}
  <details className="image-diagnostics"><summary>Численные подробности</summary><div className="image-diagnostics-content">
   <p>Неразрешённые участки кривых показаны разрывами.{hasLines?' Образы прямых строятся адаптивно.':''}{hasHoles?' Исключённые конечные точки отмечены полыми кружками.':''}</p>
   {notices.map(n=><p className="region-notice" role="status" data-diagnostic={results.find(r=>r.notice===n)?.diagnostic?.kind} key={n}>{n}</p>)}
   {current.length>0&&<p className="sampling-details">Максимальный размер непроверенной ячейки: {uncertainty.toFixed(1)} px.{current.some(s=>s.truncated)?' Достигнут вычислительный бюджет.':''}</p>}
  </div></details>
 </div>;
}
