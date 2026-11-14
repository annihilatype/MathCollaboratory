import type { ComplexCoordinate } from '../complex/geometry';
import type { Viewport } from '../state/view';
import { boundary, contains, type Region } from './model';
export type InverseTransform={kind:'exponential'}|{kind:'power';exponent:number};
export type Box=[number,number,number,number]; // xmin, xmax, ymin, ymax
export interface InversePlan { source:Region; transform:InverseTransform; bounds:Box; branches:number }
export interface RegionTiling { inside:Box[]; unresolved:Box[]; evaluations:number; truncated:boolean; maxUncertaintyPx:number }
const TAU=2*Math.PI;
// Floating-point guard, deliberately much larger than elementary-operation ULPs.
const guard=(...v:number[])=>1e-12*Math.max(1,...v.map(Math.abs));
function boundsOf(region:Region):Box|null {
  let x0=-Infinity,x1=Infinity,y0=-Infinity,y1=Infinity;
  for(const q of region.constraints){const b=boundary(q);
    if(b.kind==='circle'&&b.inside){x0=Math.max(x0,b.x-b.radius);x1=Math.min(x1,b.x+b.radius);y0=Math.max(y0,b.y-b.radius);y1=Math.min(y1,b.y+b.radius);}
    if(b.kind==='line'){
      if(b.c===0){const x=-b.d/b.b;if(b.b>0)x1=Math.min(x1,x);else x0=Math.max(x0,x);}
      if(b.b===0){const y=-b.d/b.c;if(b.c>0)y1=Math.min(y1,y);else y0=Math.max(y0,y);}
    }
  }
  if(![x0,x1,y0,y1].every(Number.isFinite)||x0>x1||y0>y1)return null;
  const e=guard(x0,x1,y0,y1);return [x0-e,x1+e,y0-e,y1+e];
}
export function inversePlan(source:Region,transform:InverseTransform):InversePlan|null {
  const bounds=boundsOf(source);if(!bounds)return null;
  // Restrict log branch enumeration and coordinate precision, rather than silently dropping branches.
  const branches=transform.kind==='exponential'?Math.ceil((bounds[3]-bounds[2])/TAU)+2:transform.exponent;
  if(branches>32||Math.max(...bounds.map(Math.abs))>1e6)return null;
  if(transform.kind==='exponential'&&(bounds[0]<-700||bounds[1]>700))return null;
  return {source,transform,bounds,branches};
}
// Returns -1 (certainly outside), +1 (certainly inside), 0 (unresolved).
export function classifySourceBox(region:Region,box:Box):-1|0|1 {
  const [x0,x1,y0,y1]=box;let inside=true;
  for(const q of region.constraints){
    function range(lo:number,hi:number,b:number):[number,number]{
      const f=(x:number)=>q.a*x*x+b*x,a=f(lo),c=f(hi),v=q.a===0?lo:-b/(2*q.a);
      const values=v>lo&&v<hi?[a,c,f(v)]:[a,c];return [Math.min(...values),Math.max(...values)];
    }
    const X=range(x0,x1,q.b),Y=range(y0,y1,q.c),lo=X[0]+Y[0]+q.d,hi=X[1]+Y[1]+q.d;
    const e=guard(...X,...Y,q.d,q.a*x0*x0,q.a*x1*x1,q.b*x0,q.b*x1,q.a*y0*y0,q.a*y1*y1,q.c*y0,q.c*y1);if(lo>e)return -1;if(hi>=-e)inside=false;
  }
  for(const p of region.excluded)if(p.re>=x0&&p.re<=x1&&p.im>=y0&&p.im<=y1)inside=false;
  return inside?1:0;
}
function trigRange(lo:number,hi:number,cosine:boolean):[number,number]{
  if(hi-lo>=TAU)return [-1,1];
  const f=cosine?Math.cos:Math.sin,values=[f(lo),f(hi)],offset=cosine?0:Math.PI/2;
  const k0=Math.ceil((lo-offset)/Math.PI),k1=Math.floor((hi-offset)/Math.PI);
  for(let k=k0;k<=k1;k++)values.push(k%2===0?1:-1);
  return [Math.min(...values),Math.max(...values)];
}
const product=(a:number,b:number,c:number,d:number):[number,number]=>[Math.min(a*c,a*d,b*c,b*d),Math.max(a*c,a*d,b*c,b*d)];
function padded(box:Box):Box {const e=guard(...box);return [box[0]-e,box[1]+e,box[2]-e,box[3]+e];}
export function inverseBoxes(plan:InversePlan,cell:Box):Box[]|null {
  const [x0,x1,y0,y1]=cell,cx=(x0+x1)/2,cy=(y0+y1)/2,r=Math.hypot(cx,cy),rho=Math.hypot(x1-x0,y1-y0)/2;
  const e=guard(r,rho),r0=Math.max(0,r-rho-e),r1=r+rho+e;
  const {transform:t}=plan,result:Box[]=[];
  if(t.kind==='exponential'){
    if(r0===0){if(r1<Math.exp(plan.bounds[0]))return [];return null;}
    const angle=Math.atan2(cy,cx),delta=Math.asin(Math.min(1,(rho+e)/r))+e,lo=angle-delta,hi=angle+delta;
    const k0=Math.ceil((plan.bounds[2]-hi)/TAU),k1=Math.floor((plan.bounds[3]-lo)/TAU);
    if(k1-k0+1>32)return null;
    for(let k=k0;k<=k1;k++)result.push(padded([Math.log(r0),Math.log(r1),lo+TAU*k,hi+TAU*k]));
  }else{
    const angle=Math.atan2(cy,cx),delta=r0===0?Math.PI:Math.asin(Math.min(1,(rho+e)/r))+e;
    const radius0=r0**(1/t.exponent),radius1=r1**(1/t.exponent);
    for(let k=0;k<t.exponent;k++){
      const lo=(angle-delta+TAU*k)/t.exponent,hi=(angle+delta+TAU*k)/t.exponent;
      const X=trigRange(lo,hi,true),Y=trigRange(lo,hi,false),x=product(radius0,radius1,...X),y=product(radius0,radius1,...Y);
      result.push(padded([x[0],x[1],y[0],y[1]]));
    }
  }
  return result;
}
export function classifyImageBox(plan:InversePlan,cell:Box):-1|0|1 {
  const boxes=inverseBoxes(plan,cell);if(!boxes)return 0;let unknown=false;
  for(const box of boxes){const s=classifySourceBox(plan.source,box);if(s===1)return 1;if(s===0)unknown=true;}
  return unknown?0:-1;
}
// Point membership is useful for independent numerical diagnostics/tests; filling
// uses enclosures of whole cells, never a vote of a few interior sample points.
export function imageContains(plan:InversePlan,w:ComplexCoordinate):boolean {
  const r=Math.hypot(w.re,w.im),theta=Math.atan2(w.im,w.re);
  if(!Number.isFinite(r))return false;
  if(plan.transform.kind==='exponential'){
    if(r===0)return false;const x=Math.log(r);
    const k0=Math.ceil((plan.bounds[2]-theta)/TAU),k1=Math.floor((plan.bounds[3]-theta)/TAU);
    for(let k=k0;k<=k1;k++)if(contains(plan.source,{re:x,im:theta+TAU*k}))return true;
  }else{
    const n=plan.transform.exponent,R=r**(1/n);
    for(let k=0;k<n;k++){
      const a=(theta+TAU*k)/n;
      // Exact axis roots must not acquire a tiny positive Im from sin(pi)
      // and accidentally enter a strict half-plane.
      const quarter=w.im===0?(w.re<0?2:0):w.re===0?(w.im<0?-1:1):NaN;
      const index=(quarter+4*k)/n,exact=Number.isInteger(index),j=((index%4)+4)%4;
      const re=exact?[1,0,-1,0][j]:Math.cos(a),im=exact?[0,1,0,-1][j]:Math.sin(a);
      if(contains(plan.source,{re:R*re,im:R*im}))return true;
    }
  }
  return false;
}
export function tileRegionImage(plan:InversePlan,view:Viewport,unit:number,budget=4096,pixelSize=2):RegionTiling {
  const limit=Math.max(1,Math.min(12000,Math.floor(budget))),queue:Box[]=[[view[0],view[2],view[3],view[1]]],inside:Box[]=[],unresolved:Box[]=[];
  let evaluations=0,head=0,maxUncertaintyPx=0;
  const size=(c:Box)=>Math.max(c[1]-c[0],c[3]-c[2])*unit;
  if(!Number.isFinite(unit)||unit<=0||!view.every(Number.isFinite))return {inside,unresolved,evaluations,truncated:true,maxUncertaintyPx:Infinity};
  while(head<queue.length&&evaluations<limit){
    const c=queue[head++],status=classifyImageBox(plan,c);evaluations++;
    if(status===1){inside.push(c);continue;}if(status===-1)continue;
    if(size(c)<=pixelSize||queue.length>limit*4){unresolved.push(c);continue;}
    const mx=(c[0]+c[1])/2,my=(c[2]+c[3])/2;
    if(mx===c[0]||mx===c[1]||my===c[2]||my===c[3]){unresolved.push(c);continue;}
    queue.push([c[0],mx,c[2],my],[mx,c[1],c[2],my],[c[0],mx,my,c[3]],[mx,c[1],my,c[3]]);
  }
  const truncated=head<queue.length;for(;head<queue.length;head++)unresolved.push(queue[head]);
  for(const c of unresolved)maxUncertaintyPx=Math.max(maxUncertaintyPx,size(c));
  return {inside,unresolved,evaluations,truncated,maxUncertaintyPx};
}
