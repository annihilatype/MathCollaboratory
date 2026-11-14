import type { ComplexCoordinate } from '../complex/geometry';
import type { Viewport } from '../state/view';
import { complex,sqrt,divide,subtract,add,multiply,conj,abs,type Complex } from 'mathjs';
import { boundary, contains, partsOf, type Region, type RegionTransform, type ExcludedSegment } from './model';
export type InverseTransform=RegionTransform;
export type Box=[number,number,number,number]; // xmin, xmax, ymin, ymax
export interface InversePlan { source:Region; transform:InverseTransform; bounds:Box; branches:number }
export interface RegionTiling { inside:Box[]; unresolved:Box[]; evaluations:number; truncated:boolean; maxUncertaintyPx:number }
const TAU=2*Math.PI;
// Floating-point guard, deliberately much larger than elementary-operation ULPs.
const guard=(...v:number[])=>1e-12*Math.max(1,...v.map(Math.abs));
export function boundsOf(region:Region):Box {
  if(region.union){const bs=partsOf(region).map(boundsOf);return [Math.min(...bs.map(b=>b[0])),Math.max(...bs.map(b=>b[1])),Math.min(...bs.map(b=>b[2])),Math.max(...bs.map(b=>b[3]))];}
  let x0=-Infinity,x1=Infinity,y0=-Infinity,y1=Infinity;
  for(const q of region.constraints){const b=boundary(q);
    if(b.kind==='circle'&&b.inside){x0=Math.max(x0,b.x-b.radius);x1=Math.min(x1,b.x+b.radius);y0=Math.max(y0,b.y-b.radius);y1=Math.min(y1,b.y+b.radius);}
    if(b.kind==='line'){
      if(b.c===0){const x=-b.d/b.b;if(b.b>0)x1=Math.min(x1,x);else x0=Math.max(x0,x);}
      if(b.b===0){const y=-b.d/b.c;if(b.c>0)y1=Math.min(y1,y);else y0=Math.max(y0,y);}
    }
  }
  const e=guard(...[x0,x1,y0,y1].filter(Number.isFinite));return [x0-e,x1+e,y0-e,y1+e];
}
export function inversePlan(source:Region,transform:InverseTransform):InversePlan|null {
  let bounds=boundsOf(source);
  if(transform.kind==='exponential'){
    const a=transform.scale??{re:1,im:0},b=transform.offset??{re:0,im:0};
    bounds=affineBox(bounds,a,b);
    const width=bounds[3]-bounds[2],branches=Math.ceil(width/TAU)+2;
    if(!Number.isFinite(width)||branches>32||branches<1)return null;
    return {source,transform,bounds,branches};
  }
  const branches=transform.kind==='power'?transform.exponent:transform.kind==='joukowski'?2:1;
  return branches>=1&&branches<=32?{source,transform,bounds,branches}:null;
}
function affineBox(b:Box,a:ComplexCoordinate,c:ComplexCoordinate):Box{
  const mul=(x:number,lo:number,hi:number):[number,number]=>x===0?[0,0]:x>0?[x*lo,x*hi]:[x*hi,x*lo];
  const rx=mul(a.re,b[0],b[1]),ry=mul(-a.im,b[2],b[3]),ix=mul(a.im,b[0],b[1]),iy=mul(a.re,b[2],b[3]);
  return [rx[0]+ry[0]+c.re,rx[1]+ry[1]+c.re,ix[0]+iy[0]+c.im,ix[1]+iy[1]+c.im];
}
function segmentHitsBox(s:ExcludedSegment,b:Box):boolean{
  let lo=0,hi=s.ray?Infinity:1;
  for(const [p,d,L,H] of [[s.start.re,s.end.re-s.start.re,b[0],b[1]],[s.start.im,s.end.im-s.start.im,b[2],b[3]]]){
    if(d===0){if(p<L||p>H)return false;continue;}
    const t0=(L-p)/d,t1=(H-p)/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return false;
  }return true;
}
// Returns -1 (certainly outside), +1 (certainly inside), 0 (unresolved).
export function classifySourceBox(region:Region,box:Box):-1|0|1 {
  if(region.union){const states=region.union.map(r=>classifySourceBox(r,box));return states.includes(1)?1:states.every(s=>s===-1)?-1:0;}
  const [x0,x1,y0,y1]=box;let inside=!region.equality;
  for(const q of region.constraints){
    function range(lo:number,hi:number,b:number):[number,number]{
      const f=(x:number)=>q.a*x*x+b*x,a=f(lo),c=f(hi),v=q.a===0?lo:-b/(2*q.a);
      const values=v>lo&&v<hi?[a,c,f(v)]:[a,c];return [Math.min(...values),Math.max(...values)];
    }
    const X=range(x0,x1,q.b),Y=range(y0,y1,q.c),lo=X[0]+Y[0]+q.d,hi=X[1]+Y[1]+q.d;
    const e=guard(...X,...Y,q.d,q.a*x0*x0,q.a*x1*x1,q.b*x0,q.b*x1,q.a*y0*y0,q.a*y1*y1,q.c*y0,q.c*y1);if(lo>e)return -1;if(hi>=-e)inside=false;
  }
  for(const p of region.excluded)if(p.re>=x0&&p.re<=x1&&p.im>=y0&&p.im<=y1)inside=false;
  if(region.excludedSegments?.some(s=>segmentHitsBox(s,box)))inside=false;
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
function multiplyBoxes(a:Box,b:Box):Box{const R=product(a[0],a[1],b[0],b[1]),I=product(a[2],a[3],b[2],b[3]),X=product(a[0],a[1],b[2],b[3]),Y=product(a[2],a[3],b[0],b[1]);return [R[0]-I[1],R[1]-I[0],X[0]+Y[0],X[1]+Y[1]];}
function reciprocalBox(b:Box):Box|null{
  const sq=(a:number,c:number)=>[a<=0&&c>=0?0:Math.min(a*a,c*c),Math.max(a*a,c*c)],x=sq(b[0],b[1]),y=sq(b[2],b[3]),lo=x[0]+y[0],hi=x[1]+y[1];
  if(lo<=guard(...b))return null;const X=product(b[0],b[1],1/hi,1/lo),Y=product(-b[3],-b[2],1/hi,1/lo);return [X[0],X[1],Y[0],Y[1]];
}
function padded(box:Box):Box {const e=guard(...box);return [box[0]-e,box[1]+e,box[2]-e,box[3]+e];}
export function inverseBoxes(plan:InversePlan,cell:Box):Box[]|null {
  const [x0,x1,y0,y1]=cell,cx=(x0+x1)/2,cy=(y0+y1)/2,r=Math.hypot(cx,cy),rho=Math.hypot(x1-x0,y1-y0)/2;
  const e=guard(r,rho),r0=Math.max(0,r-rho-e),r1=r+rho+e;
  const {transform:t}=plan,result:Box[]=[];
  if(t.kind==='joukowski'){
    const square=(lo:number,hi:number):[number,number]=>[lo<=0&&hi>=0?0:Math.min(lo*lo,hi*hi),Math.max(lo*lo,hi*hi)];
    const X=square(x0,x1),Y=square(y0,y1),I=product(x0,x1,y0,y1);
    const discriminant:Box=padded([X[0]-Y[1]-1,X[1]-Y[0]-1,2*I[0],2*I[1]]);
    const roots=inverseBoxes({...plan,transform:{kind:'power',exponent:2}},discriminant);if(!roots)return null;
    const candidates=roots.map(b=>padded([x0+b[0],x1+b[1],y0+b[2],y1+b[3]]));
    // z1*z2=1. Enclosing the small root by reciprocal of a uniformly large
    // root avoids catastrophic cancellation in w-sqrt(w²-1).
    for(const b of candidates){const dx=b[0]>0?b[0]:b[1]<0?-b[1]:0,dy=b[2]>0?b[2]:b[3]<0?-b[3]:0;if(Math.hypot(dx,dy)>1+guard(...b)){const reciprocal=reciprocalBox(b);if(reciprocal)return [b,padded(reciprocal)];}}
    return candidates;
  }
  if(t.kind==='mobius'){
    const p=t.d,q={re:-t.b.re,im:-t.b.im},r={re:-t.c.re,im:-t.c.im},d=t.a;
    const numerator=affineBox(cell,p,q),denominator=affineBox(cell,r,d);
    const reciprocal=reciprocalBox(denominator);if(!reciprocal)return null;
    const box=multiplyBoxes(numerator,reciprocal);return [t.conjugate?padded([box[0],box[1],-box[3],-box[2]]):padded(box)];
  }
  if(t.kind==='exponential'){
    if(r0===0){if(r1<Math.exp(plan.bounds[0]))return [];return null;}
    const angle=Math.atan2(cy,cx),delta=Math.asin(Math.min(1,(rho+e)/r))+e,lo=angle-delta,hi=angle+delta;
    const k0=Math.ceil((plan.bounds[2]-hi)/TAU),k1=Math.floor((plan.bounds[3]-lo)/TAU);
    if(k1-k0+1>32)return null;
    const a=t.scale??{re:1,im:0},b=t.offset??{re:0,im:0},norm=a.re*a.re+a.im*a.im;
    if(norm===0||!Number.isFinite(norm))return null;
    for(let k=k0;k<=k1;k++)result.push(padded(affineBox([Math.log(r0)-b.re,Math.log(r1)-b.re,lo+TAU*k-b.im,hi+TAU*k-b.im],{re:a.re/norm,im:-a.im/norm},{re:0,im:0})));
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
export function imageContains(plan:InversePlan,w0:ComplexCoordinate):boolean {
  const w=w0;
  const r=Math.hypot(w.re,w.im),theta=Math.atan2(w.im,w.re);
  if(!Number.isFinite(r))return false;
  if(plan.transform.kind==='joukowski'){
    const w=complex(w0.re,w0.im),D=sqrt(subtract(multiply(w,w) as Complex,complex(1,0))) as Complex,first=add(w,D) as Complex,second=subtract(w,D) as Complex;
    // Product of the roots is one; avoid cancellation for the small root.
    const large=(abs(first) as number)>(abs(second) as number)?first:second,small=divide(complex(1,0),large) as Complex;
    return [large,small].some(z=>contains(plan.source,{re:z.re,im:z.im}));
  }
  if(plan.transform.kind==='mobius'){
    const m=plan.transform,W=complex(w0.re,w0.im),den=subtract(multiply(complex(m.c.re,m.c.im),W),complex(m.a.re,m.a.im)) as Complex;
    if(den.re===0&&den.im===0)return false;
    let z=divide(subtract(complex(m.b.re,m.b.im),multiply(complex(m.d.re,m.d.im),W)),den) as Complex;if(m.conjugate)z=conj(z) as Complex;return contains(plan.source,{re:z.re,im:z.im});
  }
  if(plan.transform.kind==='exponential'){
    if(r===0)return false;const x=Math.log(r);
    const k0=Math.ceil((plan.bounds[2]-theta)/TAU),k1=Math.floor((plan.bounds[3]-theta)/TAU);
    const a=plan.transform.scale??{re:1,im:0},b=plan.transform.offset??{re:0,im:0};
    for(let k=k0;k<=k1;k++){const z=divide(complex(x-b.re,theta+TAU*k-b.im),complex(a.re,a.im)) as Complex;if(contains(plan.source,{re:z.re,im:z.im}))return true;}
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
