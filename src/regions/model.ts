import type { ComplexCoordinate } from '../complex/geometry';

// Every constraint is a generalized circle: a|z|² + b Re(z) + c Im(z) + d <(=) 0.
// Intersections remain exact under bijective Möbius/anti-Möbius maps.
export interface RegionConstraint { a:number; b:number; c:number; d:number; strict:boolean }
export interface Region { kind:'region'; constraints:RegionConstraint[]; excluded:ComplexCoordinate[] }
export type RegionTransform =
  | { kind:'mobius'; a:ComplexCoordinate; b:ComplexCoordinate; c:ComplexCoordinate; d:ComplexCoordinate; conjugate:boolean; excluded:ComplexCoordinate[] }
  | { kind:'power'; exponent:number }
  | { kind:'exponential' };
export function constraint(a:number,b:number,c:number,d:number,strict:boolean):RegionConstraint {
  const scale=Math.max(Math.abs(a),Math.abs(b),Math.abs(c),Math.abs(d));
  if(!Number.isFinite(scale))throw new Error('Границы области слишком велики для точного построения.');
  return scale===0?{a:0,b:0,c:0,d:0,strict}:{a:a/scale,b:b/scale,c:c/scale,d:d/scale,strict};
}
export function contains(region:Region,z:ComplexCoordinate):boolean {
  if(!Number.isFinite(z.re)||!Number.isFinite(z.im))return false;
  if(region.excluded.some(p=>p.re===z.re&&p.im===z.im))return false;
  return region.constraints.every(q=>{const v=q.a*(z.re*z.re+z.im*z.im)+q.b*z.re+q.c*z.im+q.d;return q.strict?v<0:v<=0;});
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
