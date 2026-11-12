export type Viewport = [number, number, number, number];
export const REAL_VIEW: Viewport = [-8,5,8,-5];
export const COMPLEX_VIEW: Viewport = [-5,5,5,-5];
export function validViewport(v: unknown): v is Viewport {
  return Array.isArray(v) && v.length === 4 && v.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 1e12) && v[2]-v[0] > 1e-9 && v[1]-v[3] > 1e-9;
}
