import { it, expect } from 'vitest';
import { wheelPixels, navigateViewport, constrainViewport, MIN_SPAN, MAX_SPAN } from './planeNavigation';
const view:[number,number,number,number]=[-8,5,8,-5];
it('normalizes pixels, lines, pages, Shift and pathological deltas',()=>{
  expect(wheelPixels({deltaX:2,deltaY:3,deltaMode:0,shiftKey:false},800,500)).toEqual({x:2,y:3});
  expect(wheelPixels({deltaX:2,deltaY:3,deltaMode:1,shiftKey:false},800,500)).toEqual({x:32,y:48});
  expect(wheelPixels({deltaX:0,deltaY:1,deltaMode:2,shiftKey:false},800,500)).toEqual({x:0,y:120});
  expect(wheelPixels({deltaX:0,deltaY:2,deltaMode:0,shiftKey:true},800,500)).toEqual({x:2,y:0});
  expect(wheelPixels({deltaX:Infinity,deltaY:NaN,deltaMode:0,shiftKey:false},800,500)).toEqual({x:0,y:0});
});
it('pans both axes without changing the span',()=>expect(navigateViewport(view,800,500,40,50,0,[.5,.5])).toEqual([-7.2,4,8.8,-6]));
it('preserves the cursor anchor and equal units during smooth zoom',()=>{
  const result=navigateViewport(view,800,500,0,0,-.01,[.25,.75]);
  expect((result[2]-result[0])/(view[2]-view[0])).toBeCloseTo(Math.exp(-.01));
  expect(result[0]+.25*(result[2]-result[0])).toBeCloseTo(-4);
  expect(result[1]-.75*(result[1]-result[3])).toBeCloseTo(-2.5);
  expect(800/(result[2]-result[0])).toBeCloseTo(500/(result[1]-result[3]));
});
it('limits per-frame jumps and total scale in both directions',()=>{
  let result=navigateViewport(view,800,500,0,0,1e6,[.5,.5]);expect(result[1]-result[3]).toBeCloseTo(12.5);
  for(let i=0;i<200;i++)result=navigateViewport(result,800,500,0,0,1,[.5,.5]);
  expect(result[1]-result[3]).toBeCloseTo(MAX_SPAN);
  for(let i=0;i<200;i++)result=navigateViewport(result,800,500,0,0,-1,[.5,.5]);
  expect(result[1]-result[3]).toBeCloseTo(MIN_SPAN,10);
});
it('constrains native zoom and handles hidden canvases',()=>{
  expect(constrainViewport([-1e8,1e8,1e8,-1e8])).toEqual([-5e6,5e6,5e6,-5e6]);
  expect(navigateViewport(view,0,0,1,1,1,[.5,.5])).toBe(view);
});

it('clamping stays idempotent near large coordinates and tiny spans',()=>{
  const bounded=constrainViewport([1e9-1e-6,1e9+1e-6,1e9+1e-6,1e9-1e-6]);
  expect(bounded.every(Number.isFinite)).toBe(true);
  expect(constrainViewport(bounded)).toBe(bounded);
  expect(bounded[1]-bounded[3]).toBeCloseTo(MIN_SPAN,5);
});
