import {MathDiagnostic,diagnosis,type Diagnostic} from '../math/diagnostics';
import type { ComplexCoordinate } from '../complex/geometry';
import type { Viewport } from '../state/view';
import { complex,sqrt,divide,subtract,add,multiply,conj,abs,type Complex } from 'mathjs';
import { boundary, contains, partsOf, type Region, type RegionTransform, type ExcludedSegment } from './model';
export type InverseTransform=RegionTransform;
export type Box=[number,number,number,number]; // xmin, xmax, ymin, ymax
export interface InversePlan { source:Region; transform:InverseTransform; bounds:Box; branches:number; stages?:InversePlan[] }
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
// Bounds of a linear functional, including oblique half-planes. Unlike an
// axis-aligned bounding box, this keeps a rotated strip's finite width.
export function linearBounds(source:Region,x:number,y:number,offset=0):[number,number]{
  if(source.union){const values=source.union.map(r=>linearBounds(r,x,y,offset));return [Math.min(...values.map(v=>v[0])),Math.max(...values.map(v=>v[1]))];}
  let lo=-Infinity,hi=Infinity;const norm=Math.hypot(x,y);
  if(norm===0)return [offset,offset];
  for(const q of source.constraints){const b=boundary(q);
    if(b.kind==='circle'&&b.inside){const center=x*b.x+y*b.y;lo=Math.max(lo,center-norm*b.radius);hi=Math.min(hi,center+norm*b.radius);}
    if(b.kind==='line'){
      const n=b.b*b.b+b.c*b.c,k=(x*b.b+y*b.c)/n;
      // Unbounded directions forbid a 'nearly parallel' tolerance: even a
      // tiny transverse coefficient makes this functional unbounded.
      if(Number.isFinite(k)&&x===k*b.b&&y===k*b.c){if(k>0)hi=Math.min(hi,-k*b.d);else lo=Math.max(lo,-k*b.d);}
    }
  }
  // Also combine independent x/y bounds where they are available.
  const box=affineBox(boundsOf(source),{re:x,im:-y},{re:0,im:0});
  if(!Number.isNaN(box[0]))lo=Math.max(lo,box[0]);if(!Number.isNaN(box[1]))hi=Math.min(hi,box[1]);
  const e=guard(...[lo,hi,offset].filter(Number.isFinite));return [lo+offset-e,hi+offset+e];
}
const MAX_BRANCHES=128;
export function prepareInversePlan(source:Region,transform:InverseTransform):InversePlan {
  let bounds=boundsOf(source);
  if(transform.kind==='composition'){
    let domain=source,branches=1;const stages:InversePlan[]=[];
    for(const step of transform.steps){
      const stage=prepareInversePlan(domain,step);stages.push(stage);branches*=stage.branches;
      if(branches>MAX_BRANCHES)throw new MathDiagnostic('preimages','branch-budget',`Композиция требует более ${MAX_BRANCHES} обратных ветвей. Сократите степень или диапазон области.`);
      domain=envelopeRegion(forwardBounds(stage));
    }
    return {source,transform,bounds,branches,stages};
  }
  if(transform.kind==='exponential'){
    const a=transform.scale??{re:1,im:0},b=transform.offset??{re:0,im:0};
    if(a.re===0&&a.im===0)throw new MathDiagnostic('operation','constant-image','Экспонента постоянна; двумерная заливка не применяется.');
    const X=linearBounds(source,a.re,-a.im,b.re),Y=linearBounds(source,a.im,a.re,b.im);bounds=[...X,...Y];
    const width=bounds[3]-bounds[2],branches=Math.ceil(width/TAU)+2;
    if(!Number.isFinite(width))throw new MathDiagnostic('preimages','unbounded-log-branches','Нельзя определить полный набор логарифмических прообразов: диапазон Im аргумента exp не ограничен. Ограничьте его полосой; видимое окно z не считается границей области.');
    if(branches>32||branches<1)throw new MathDiagnostic('preimages','log-branch-budget','Диапазон Im аргумента exp требует более 32 логарифмических ветвей. Сузьте полосу.');
    return {source,transform,bounds,branches};
  }
  const branches=transform.kind==='power'?transform.exponent:transform.kind==='joukowski'?2:1;
  if(branches<1||branches>32)throw new MathDiagnostic('operation','power-range','Обратная ступень поддерживает целые степени 1…32.');
  return {source,transform,bounds,branches};
}
export function explainInversePlan(source:Region,transform:InverseTransform):{plan?:InversePlan;diagnostic?:Diagnostic}{
  try{return {plan:prepareInversePlan(source,transform)};}catch(e){const error=e as Error&{kind?:Diagnostic['kind'];code?:string};return {diagnostic:diagnosis(error.kind??'numeric',error.code??'inverse-bounds',error.message)};}
}
export function inversePlan(source:Region,transform:InverseTransform):InversePlan|null {return explainInversePlan(source,transform).plan??null;}
function envelopeRegion(b:Box):Region {
  const constraints=[];
  if(Number.isFinite(b[0]))constraints.push({a:0,b:-1,c:0,d:b[0],strict:false});
  if(Number.isFinite(b[1]))constraints.push({a:0,b:1,c:0,d:-b[1],strict:false});
  if(Number.isFinite(b[2]))constraints.push({a:0,b:0,c:-1,d:b[2],strict:false});
  if(Number.isFinite(b[3]))constraints.push({a:0,b:0,c:1,d:-b[3],strict:false});
  return {kind:'region',constraints,excluded:[]};
}
const unbounded=():Box=>[-Infinity,Infinity,-Infinity,Infinity];
function forwardBounds(plan:InversePlan):Box {
  const t=plan.transform,b=plan.bounds;
  if(t.kind==='composition')return plan.stages?.length?forwardBounds(plan.stages.at(-1)!):b;
  if(t.kind==='mobius'){
    const input=t.conjugate?[b[0],b[1],-b[3],-b[2]] as Box:b;
    if(t.c.re===0&&t.c.im===0){const d=complex(t.d.re,t.d.im),a=divide(complex(t.a.re,t.a.im),d) as Complex,c=divide(complex(t.b.re,t.b.im),d) as Complex;return affineBox(input,a,c);}
    if(!input.every(Number.isFinite))return unbounded();
    const reciprocal=reciprocalBox(affineBox(input,t.c,t.d));return reciprocal?padded(multiplyBoxes(affineBox(input,t.a,t.b),reciprocal)):unbounded();
  }
  if(t.kind==='exponential'){
    const R=Math.exp(b[1]);if(!Number.isFinite(R))return unbounded();
    const X=trigRange(b[2],b[3],true),Y=trigRange(b[2],b[3],false),r=Math.exp(b[0]);return padded([...product(r,R,...X),...product(r,R,...Y)]);
  }
  if(!b.every(Number.isFinite))return unbounded();
  if(t.kind==='power'){const R=Math.hypot(Math.max(Math.abs(b[0]),Math.abs(b[1])),Math.max(Math.abs(b[2]),Math.abs(b[3])))**t.exponent;return Number.isFinite(R)?padded([-R,R,-R,R]):unbounded();}
  const inv=reciprocalBox(b);return inv?padded([(b[0]+inv[0])/2,(b[1]+inv[1])/2,(b[2]-inv[3])/2,(b[3]-inv[2])/2]):unbounded();
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
  if(!box.every(Number.isFinite))return 0;
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
function atomicInverseBoxes(plan:InversePlan,cell:Box):Box[]|null {
  if(!cell.every(Number.isFinite))return null;
  const [x0,x1,y0,y1]=cell,cx=(x0+x1)/2,cy=(y0+y1)/2,r=Math.hypot(cx,cy),rho=Math.hypot(x1-x0,y1-y0)/2;
  const e=guard(r,rho),r0=Math.max(0,r-rho-e),r1=r+rho+e;
  const {transform:t}=plan,result:Box[]=[];
  if(t.kind==='joukowski'){
    const square=(lo:number,hi:number):[number,number]=>[lo<=0&&hi>=0?0:Math.min(lo*lo,hi*hi),Math.max(lo*lo,hi*hi)];
    const X=square(x0,x1),Y=square(y0,y1),I=product(x0,x1,y0,y1);
    const discriminant:Box=padded([X[0]-Y[1]-1,X[1]-Y[0]-1,2*I[0],2*I[1]]);
    const roots=atomicInverseBoxes({...plan,transform:{kind:'power',exponent:2}},discriminant);if(!roots)return null;
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
  }else if(t.kind==='power'){
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
interface Pullback { boxes:{box:Box;certain:boolean}[]; complete:boolean }
function pullback(plan:InversePlan,cell:Box):Pullback {
  if(plan.stages){
    let boxes=[{box:cell,certain:true}],complete=true;
    for(const stage of [...plan.stages].reverse()){
      const next:Pullback['boxes']=[];
      for(const candidate of boxes){const result=pullback(stage,candidate.box);complete&&=result.complete;
        for(const branch of result.boxes){if(next.length>=MAX_BRANCHES){complete=false;break;}next.push({box:branch.box,certain:candidate.certain&&branch.certain});}}
      boxes=next;
    }
    return {boxes,complete};
  }
  const boxes=atomicInverseBoxes(plan,cell);if(!boxes)return {boxes:[],complete:false};
  return {complete:true,boxes:boxes.map(box=>({box,certain:plan.transform.kind!=='mobius'||!plan.transform.excluded.some(p=>p.re>=box[0]&&p.re<=box[1]&&p.im>=box[2]&&p.im<=box[3])}))};
}
export function inverseBoxes(plan:InversePlan,cell:Box):Box[]|null {const result=pullback(plan,cell);return result.complete?result.boxes.map(b=>b.box):null;}
export function classifyImageBox(plan:InversePlan,cell:Box):-1|0|1 {
  const result=pullback(plan,cell);let unknown=!result.complete;
  for(const {box,certain} of result.boxes){const s=classifySourceBox(plan.source,box);if(s===1&&certain)return 1;if(s!==-1)unknown=true;}
  return unknown?0:-1;
}
// Membership is existential across all inverse branches. Tests and diagnostics
// use points; filling uses enclosures of whole cells, never sampled boundary votes.
function atomicInversePoints(plan:InversePlan,w0:ComplexCoordinate):ComplexCoordinate[]|null {
  const r=Math.hypot(w0.re,w0.im),theta=Math.atan2(w0.im,w0.re),t=plan.transform;
  if(!Number.isFinite(r))return null;
  if(t.kind==='joukowski'){
    const w=complex(w0.re,w0.im),D=sqrt(subtract(multiply(w,w) as Complex,complex(1,0))) as Complex,first=add(w,D) as Complex,second=subtract(w,D) as Complex;
    const large=(abs(first) as number)>(abs(second) as number)?first:second,small=divide(complex(1,0),large) as Complex;
    return [large,small].every(z=>Number.isFinite(z.re)&&Number.isFinite(z.im))?[large,small]:null;
  }
  if(t.kind==='mobius'){
    const W=complex(w0.re,w0.im),den=subtract(multiply(complex(t.c.re,t.c.im),W),complex(t.a.re,t.a.im)) as Complex;
    if(den.re===0&&den.im===0)return [];
    let z=divide(subtract(complex(t.b.re,t.b.im),multiply(complex(t.d.re,t.d.im),W)),den) as Complex;if(t.conjugate)z=conj(z) as Complex;
    if(!Number.isFinite(z.re)||!Number.isFinite(z.im))return null;
    if(t.excluded.some(p=>p.re===z.re&&p.im===z.im))return [];
    if(t.excluded.some(p=>Math.hypot(p.re-z.re,p.im-z.im)<=guard(p.re,p.im,z.re,z.im)))return null;
    return [z];
  }
  const result:ComplexCoordinate[]=[];
  if(t.kind==='exponential'){
    if(r===0)return [];const x=Math.log(r),k0=Math.ceil((plan.bounds[2]-theta)/TAU),k1=Math.floor((plan.bounds[3]-theta)/TAU);
    if(k1-k0+1>32||!Number.isFinite(k0+k1))return null;
    const a=t.scale??{re:1,im:0},b=t.offset??{re:0,im:0};
    for(let k=k0;k<=k1;k++)result.push(divide(complex(x-b.re,theta+TAU*k-b.im),complex(a.re,a.im)) as Complex);
  }else if(t.kind==='power'){
    const n=t.exponent,R=r**(1/n);
    for(let k=0;k<n;k++){
      const a=(theta+TAU*k)/n,quarter=w0.im===0?(w0.re<0?2:0):w0.re===0?(w0.im<0?-1:1):NaN;
      const index=(quarter+4*k)/n,exact=Number.isInteger(index),j=((index%4)+4)%4;
      result.push({re:R*(exact?[1,0,-1,0][j]:Math.cos(a)),im:R*(exact?[0,1,0,-1][j]:Math.sin(a))});
    }
  }else return null;
  return result.every(z=>Number.isFinite(z.re)&&Number.isFinite(z.im))?result:null;
}
function inversePoints(plan:InversePlan,w:ComplexCoordinate):{points:ComplexCoordinate[];complete:boolean}{
  if(!plan.stages){const points=atomicInversePoints(plan,w);return {points:points??[],complete:points!==null};}
  let points=[w],complete=true;
  for(const stage of [...plan.stages].reverse()){
    const next:ComplexCoordinate[]=[];
    for(const p of points){const result=inversePoints(stage,p);complete&&=result.complete;for(const q of result.points){if(next.length>=MAX_BRANCHES){complete=false;break;}next.push(q);}}
    points=next;
  }
  return {points,complete};
}
export function imageMembership(plan:InversePlan,w:ComplexCoordinate):'inside'|'outside'|'uncertain'{
  const result=inversePoints(plan,w);
  let uncertain=!result.complete;
  for(const z of result.points){
    if(!contains(plan.source,z))continue;
    const witness=(r:Region):boolean=>contains(r,z)&&!r.excluded.some(p=>Math.hypot(p.re-z.re,p.im-z.im)<=guard(p.re,p.im,z.re,z.im))&&(!r.union||r.union.some(witness));
    if(!witness(plan.source)){uncertain=true;continue;}
    return 'inside';
  }
  return uncertain?'uncertain':'outside';
}
export function imageContains(plan:InversePlan,w:ComplexCoordinate):boolean{return imageMembership(plan,w)==='inside';}
export interface RegionTilingTask {step:(maxEvaluations:number)=>RegionTiling|null}
export function createRegionTilingTask(plan:InversePlan,view:Viewport,unit:number,budget=4096,pixelSize=2):RegionTilingTask {
  const limit=Math.max(1,Math.min(12000,Math.floor(budget))),queue:Box[]=[[view[0],view[2],view[3],view[1]]],inside:Box[]=[],unresolved:Box[]=[];
  let evaluations=0,head=0,maxUncertaintyPx=0;
  const size=(c:Box)=>Math.max(c[1]-c[0],c[3]-c[2])*unit;
  if(!Number.isFinite(unit)||unit<=0||!view.every(Number.isFinite))return {step:()=>({inside,unresolved,evaluations,truncated:true,maxUncertaintyPx:Infinity})};
  let completed:RegionTiling|null=null;
  return {step(maxEvaluations){
  if(completed)return completed;
  const stop=Math.min(limit,evaluations+Math.max(1,maxEvaluations));
  while(head<queue.length&&evaluations<stop){
    const c=queue[head++],status=classifyImageBox(plan,c);evaluations++;
    if(status===1){inside.push(c);continue;}if(status===-1)continue;
    if(size(c)<=pixelSize){const center={re:(c[0]+c[1])/2,im:(c[2]+c[3])/2};
      if(size(c)<=Math.min(pixelSize,0.4)||!imageContains(plan,center)){unresolved.push(c);continue;}
    }
    if(queue.length>limit*4){unresolved.push(c);continue;}
    const mx=(c[0]+c[1])/2,my=(c[2]+c[3])/2;
    if(mx===c[0]||mx===c[1]||my===c[2]||my===c[3]){unresolved.push(c);continue;}
    queue.push([c[0],mx,c[2],my],[mx,c[1],c[2],my],[c[0],mx,my,c[3]],[mx,c[1],my,c[3]]);
  }
  if(head<queue.length&&evaluations<limit)return null;
  const truncated=head<queue.length;for(;head<queue.length;head++)unresolved.push(queue[head]);
  for(const c of unresolved)maxUncertaintyPx=Math.max(maxUncertaintyPx,size(c));
  completed={inside,unresolved,evaluations,truncated,maxUncertaintyPx};return completed;
  }};
}
export function tileRegionImage(plan:InversePlan,view:Viewport,unit:number,budget=4096,pixelSize=2):RegionTiling {
  return createRegionTilingTask(plan,view,unit,budget,pixelSize).step(Infinity)!;
}
