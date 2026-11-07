/** Adaptive screen-space subdivision. Unresolved jumps become gaps, never bridges. */
export function sampleFunction(fn: (x: number) => number, left: number, right: number, pixels: number, unitY: number) {
  const xs: number[] = [], ys: number[] = [];
  const push = (x: number, y: number) => { xs.push(x); ys.push(y); };
  const gap = () => { if (!Number.isNaN(ys.at(-1))) push(NaN, NaN); };
  function segment(a: number, ya: number, b: number, yb: number, depth: number) {
    const m = (a+b)/2, ym = fn(m);
    const finite = Number.isFinite(ya) && Number.isFinite(yb) && Number.isFinite(ym);
    const error = Math.abs(ym - (ya+yb)/2) * unitY;
    if (finite && error < 0.65 && Math.abs(yb-ya)*unitY < 100) { push(b, yb); return; }
    if (depth === 0) { gap(); if (Number.isFinite(yb)) push(b, yb); return; }
    if (!Number.isFinite(ya) && !Number.isFinite(yb) && !Number.isFinite(ym)) { gap(); return; }
    segment(a, ya, m, ym, depth-1); segment(m, ym, b, yb, depth-1);
  }
  const steps = Math.min(1500, Math.max(200, Math.ceil(pixels / 3)));
  let a = left, ya = fn(a); push(a, ya);
  for (let i=1; i<=steps; i++) { const b = left+(right-left)*i/steps, yb=fn(b); segment(a, ya, b, yb, 8); a=b; ya=yb; }
  return { xs, ys };
}
