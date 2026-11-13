import type { Viewport } from '../state/view';
export const MIN_SPAN = 1e-4;
export const MAX_SPAN = 1e7;
const MAX_CENTER = 1e9;
const clamp = (x:number, min:number, max:number) => Math.max(min, Math.min(max,x));
export function constrainViewport(view: Viewport): Viewport {
  const height=view[1]-view[3], width=view[2]-view[0];
  const cx=(view[0]+view[2])/2, cy=(view[1]+view[3])/2;
  // At large coordinates a tiny span loses precision when bounds are
  // subtracted. Accept a few ULPs rather than repeatedly clamping forever.
  const tolerance=16*Number.EPSILON*Math.max(1,Math.abs(cx),Math.abs(cy),height);
  if (height>=MIN_SPAN-tolerance && height<=MAX_SPAN+tolerance && Math.abs(cx)<=MAX_CENTER+tolerance && Math.abs(cy)<=MAX_CENTER+tolerance) return view;
  const h=clamp(height,MIN_SPAN,MAX_SPAN), w=width*(h/height);
  const x=clamp(cx,-MAX_CENTER,MAX_CENTER), y=clamp(cy,-MAX_CENTER,MAX_CENTER);
  return [x-w/2,y+h/2,x+w/2,y-h/2];
}
export function wheelPixels(event: Pick<WheelEvent,'deltaX'|'deltaY'|'deltaMode'|'shiftKey'>, width:number, height:number) {
  const scaleX=event.deltaMode===1?16:event.deltaMode===2?width:1;
  const scaleY=event.deltaMode===1?16:event.deltaMode===2?height:1;
  let x=Number.isFinite(event.deltaX)?clamp(event.deltaX*scaleX,-120,120):0;
  let y=Number.isFinite(event.deltaY)?clamp(event.deltaY*scaleY,-120,120):0;
  if(event.shiftKey && x===0){x=y;y=0;}
  return {x,y};
}
export function navigateViewport(view:Viewport, width:number, height:number, dx:number, dy:number, logScale:number, anchor:[number,number]):Viewport {
  if(width<=0 || height<=0)return view;
  const w=view[2]-view[0],h=view[1]-view[3];
  const factor=clamp(Math.exp(clamp(logScale,-Math.log(1.25),Math.log(1.25))),MIN_SPAN/h,MAX_SPAN/h);
  const x=view[0]+clamp(dx,-240,240)*w/width, y=view[1]-clamp(dy,-240,240)*h/height;
  const ax=clamp(anchor[0],0,1),ay=clamp(anchor[1],0,1);
  return constrainViewport([x+ax*w*(1-factor),y-ay*h*(1-factor),x+ax*w*(1-factor)+w*factor,y-ay*h*(1-factor)-h*factor]);
}
