import type JXG from 'jsxgraph';
import { navigateViewport, wheelPixels } from './planeNavigation';
// Local, non-passive wheel listener only. Pointer/touch pan and pinch stay in JSXGraph.
export function attachWheelNavigation(host:HTMLElement, board:JXG.Board) {
  let frame=0,dx=0,dy=0,logScale=0;
  let anchor:[number,number]=[.5,.5];
  const flush=()=>{
    frame=0;
    const view=navigateViewport(board.getBoundingBox(),board.canvasWidth,board.canvasHeight,dx,dy,logScale,anchor);
    dx=dy=logScale=0;
    board.setBoundingBox(view,true,'update');
  };
  const wheel=(event:WheelEvent)=>{
    if(!event.cancelable)return;
    const rect=host.getBoundingClientRect();
    const pixels=wheelPixels(event,rect.width,rect.height);
    if(pixels.x===0 && pixels.y===0)return;
    event.preventDefault();
    if(event.ctrlKey){
      logScale+=Math.max(-60,Math.min(60,pixels.y))*.0025;
      anchor=[(event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height];
    } else { dx+=pixels.x;dy+=pixels.y; }
    if(!frame)frame=requestAnimationFrame(flush);
  };
  host.addEventListener('wheel',wheel,{passive:false});
  return ()=>{host.removeEventListener('wheel',wheel);if(frame)cancelAnimationFrame(frame);};
}
