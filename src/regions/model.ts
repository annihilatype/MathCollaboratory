import type { ComplexCoordinate } from '../complex/geometry';

// Every constraint is a generalized circle: a|z|² + b Re(z) + c Im(z) + d <(=) 0.
// Intersections remain exact under bijective Möbius/anti-Möbius maps.
export interface RegionConstraint { a:number; b:number; c:number; d:number; strict:boolean; internal?:boolean }
export interface ExcludedSegment { start:ComplexCoordinate; end:ComplexCoordinate; ray?:boolean }
export type BoundaryCurve={kind:'circle';center:ComplexCoordinate;radius:number}|{kind:'line';axis:'re'|'im';value:number};
export interface Region { kind:'region'; constraints:RegionConstraint[]; excluded:ComplexCoordinate[]; union?:Region[]; excludedSegments?:ExcludedSegment[]; equality?:BoundaryCurve; angleConvention?:string }
export function onExcludedSegment(s:ExcludedSegment,z:ComplexCoordinate):boolean {
  const dx=s.end.re-s.start.re,dy=s.end.im-s.start.im,x=z.re-s.start.re,y=z.im-s.start.im,n=dx*dx+dy*dy;
  if(n===0)return x===0&&y===0;
  const cross=dx*y-dy*x,t=(x*dx+y*dy)/n;
  return Math.abs(cross)<=1e-12*Math.max(1,Math.hypot(dx,dy)*Math.hypot(x,y))&&t>=0&&(s.ray||t<=1);
}
export const partsOf=(r:Region):Region[]=>r.union??[r];
export function unionRegions(parts:Region[]):Region {
  const unique=[...new Map(parts.flatMap(partsOf).map(r=>[JSON.stringify(r),r])).values()];
  if(unique.length>16)throw new Error('Область слишком сложная: не более 16 компонент объединения.');
  return unique.length===1?unique[0]:{kind:'region',constraints:[],excluded:[],union:unique,...(unique.some(r=>r.angleConvention)?{angleConvention:unique.find(r=>r.angleConvention)!.angleConvention}:{})};
}
export function intersectRegions(a:Region,b:Region):Region {
  const result=partsOf(a).flatMap(x=>partsOf(b).map(y=>({kind:'region' as const,constraints:[...x.constraints,...y.constraints],excluded:[...x.excluded,...y.excluded],...(x.excludedSegments||y.excludedSegments?{excludedSegments:[...(x.excludedSegments??[]),...(y.excludedSegments??[])]}:{}),...(x.equality||y.equality?{equality:x.equality??y.equality}:{}),...(x.angleConvention||y.angleConvention?{angleConvention:x.angleConvention??y.angleConvention}:{})})));
  return unionRegions(result);
}
export type RegionTransform =
  | { kind:'mobius'; a:ComplexCoordinate; b:ComplexCoordinate; c:ComplexCoordinate; d:ComplexCoordinate; conjugate:boolean; excluded:ComplexCoordinate[] }
  | { kind:'power'; exponent:number }
  | { kind:'exponential'; scale?:ComplexCoordinate; offset?:ComplexCoordinate }
  | { kind:'joukowski' }
  | { kind:'composition';steps:RegionTransform[] };
export function constraint(a:number,b:number,c:number,d:number,strict:boolean):RegionConstraint {
  const scale=Math.max(Math.abs(a),Math.abs(b),Math.abs(c),Math.abs(d));
  if(!Number.isFinite(scale))throw new Error('Границы области слишком велики для точного построения.');
  return scale===0?{a:0,b:0,c:0,d:0,strict}:{a:a/scale,b:b/scale,c:c/scale,d:d/scale,strict};
}
export function contains(region:Region,z:ComplexCoordinate):boolean {
  if(!Number.isFinite(z.re)||!Number.isFinite(z.im))return false;
  if(region.union&&!region.union.some(r=>contains(r,z)))return false;
  if(region.excludedSegments?.some(s=>onExcludedSegment(s,z)))return false;
  if(region.excluded.some(p=>p.re===z.re&&p.im===z.im))return false;
  return region.constraints.every(q=>{const v=q.a*(z.re*z.re+z.im*z.im)+q.b*z.re+q.c*z.im+q.d;const scale=Math.abs(q.a)*(z.re*z.re+z.im*z.im)+Math.abs(q.b*z.re)+Math.abs(q.c*z.im)+Math.abs(q.d),eps=(region.equality?1e-12:32*Number.EPSILON)*scale;return q.strict?v< -eps:v<=eps;});
}
export type Boundary = {kind:'circle';x:number;y:number;radius:number;inside:boolean}|{kind:'line';b:number;c:number;d:number}|{kind:'constant';empty:boolean};
export function boundary(q:RegionConstraint):Boundary {
  if(q.a===0){
    if(q.b===0&&q.c===0)return {kind:'constant',empty:q.strict?q.d>=0:q.d>0};
    return {kind:'line',b:q.b,c:q.c,d:q.d};
  }
  const x=-q.b/(2*q.a),y=-q.c/(2*q.a),r2=x*x+y*y-q.d/q.a;
  // A negative radius squared is an everywhere true/false inequality.
  if(r2<0)return {kind:'constant',empty:q.a>0};
  return {kind:'circle',x,y,radius:Math.sqrt(r2),inside:q.a>0};
}
