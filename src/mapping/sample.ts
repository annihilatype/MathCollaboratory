import type { ComplexCoordinate, ComplexMapping } from '../complex/geometry';
import type { Viewport } from '../state/view';
import type { ParametricCurve } from './parameterize';
export interface ImagePath { xs:number[]; ys:number[]; evaluations:number; truncated:boolean }
// A finite sampler cannot discover all singularities. Unresolved intervals are
// gaps: never draw an unverified chord when depth/evaluation limits are hit.
export function sampleImage(curve:ParametricCurve,map:ComplexMapping,view:Viewport,unit:number,budget=2048):ImagePath {
  const xs:number[]=[],ys:number[]=[];let evaluations=0,truncated=false;
  const cache=new Map<number,ComplexCoordinate|null>();
  function at(t:number):ComplexCoordinate|null {
    if(cache.has(t))return cache.get(t)!;
    if(evaluations>=budget){truncated=true;return null;}
    evaluations++;const value=map.evaluate(curve(t));
    const w=value&&Math.max(Math.abs(value.re),Math.abs(value.im))<=1e9?value:null;cache.set(t,w);return w;
  }
  const push=(p:ComplexCoordinate)=>{xs.push(p.re);ys.push(p.im);};
  const gap=()=>{if(xs.length && !Number.isNaN(xs.at(-1))) {xs.push(NaN);ys.push(NaN);}};
  const distance=(a:ComplexCoordinate,b:ComplexCoordinate)=>Math.hypot(a.re-b.re,a.im-b.im)*unit;
  function segment(a:number,b:number,pa:ComplexCoordinate|null,pb:ComplexCoordinate|null,depth:number){
    const m=(a+b)/2,pm=at(m),q=a+(b-a)*.38196601125,pq=at(q);
    if(pa&&pb&&pm&&pq){
      // Cull only when all probes lie on the same far side of the viewport.
      const margin=(view[1]-view[3])*2;
      if([['re',view[0]-margin,-1],['re',view[2]+margin,1],['im',view[3]-margin,-1],['im',view[1]+margin,1]].some(([key,edge,sign])=>[pa,pb,pm,pq].every(p=>Number(sign)*(p![key as 're'|'im']-Number(edge))>0))){gap();return;}
      const linear=(t:number)=>({re:pa.re+(pb.re-pa.re)*t,im:pa.im+(pb.im-pa.im)*t});
      if(distance(pm,linear(.5))<.7 && distance(pq,linear(.38196601125))<.7 && distance(pa,pb)<100){push(pa);push(pb);return;}
    }
    if(depth===0 || evaluations>=budget){truncated ||= evaluations>=budget;gap();return;}
    if(!pa&&!pb&&!pm&&!pq){gap();return;}
    segment(a,m,pa,pm,depth-1);segment(m,b,pm,pb,depth-1);
  }
  for(let i=0;i<32;i++){
    const a=i/32,b=(i+1)/32;
    segment(a,b,at(a),at(b),12);
    if(evaluations>=budget){truncated=true;gap();break;}
  }
  return {xs,ys,evaluations,truncated};
}
