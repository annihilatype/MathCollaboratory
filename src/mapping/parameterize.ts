import type { ComplexCoordinate, ComplexGeometry } from '../complex/geometry';
export type ParametricCurve = (t:number)=>ComplexCoordinate;
export function parameterize(g:ComplexGeometry):ParametricCurve|null {
  if(g.kind==='circle')return t=>({re:g.center.re+g.radius*Math.cos(t*2*Math.PI),im:g.center.im+g.radius*Math.sin(t*2*Math.PI)});
  if(g.kind==='segment')return t=>({re:(1-t)*g.start.re+t*g.end.re,im:(1-t)*g.start.im+t*g.end.im});
  return null;
}
export function pointFormula(z:ComplexCoordinate):string {
  const re=Number(z.re.toFixed(9)),im=Number(z.im.toFixed(9));
  return `z=${re}${im<0?'-':'+'}${Math.abs(im)}i`;
}
