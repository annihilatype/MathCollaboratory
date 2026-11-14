import type JXG from 'jsxgraph';
import type { DrawablePlot } from '../complex/render';
import type { Viewport } from '../state/view';
import type { Box, InversePlan, RegionTiling } from './inverse';
export interface ImageRegion { kind:'region-image'; plan:InversePlan; sample:(view:Viewport,unit:number)=>RegionTiling }
const NS='http://www.w3.org/2000/svg';
// One path per object, even when the adaptive subdivision contains thousands of cells.
export function createApproximationLayer(board:JXG.Board){
  const renderer=board.renderer as typeof board.renderer&{layer:SVGGElement[]};
  const root=document.createElementNS(NS,'g');root.setAttribute('pointer-events','none');root.setAttribute('data-region-layer','approximate');renderer.layer[0].append(root);
  const entries=new Map<string,{key:string;path:SVGPathElement;title:SVGTitleElement;geometry:ImageRegion;cells:Box[]}>();
  let timer:ReturnType<typeof setTimeout>|undefined,disposed=false;
  function project(){
    const v=board.getBoundingBox(),X=(x:number)=>(x-v[0])*board.unitX,Y=(y:number)=>(v[1]-y)*board.unitY;
    for(const e of entries.values())e.path.setAttribute('d',e.cells.map(c=>`M${X(c[0])} ${Y(c[3])}H${X(c[1])}V${Y(c[2])}H${X(c[0])}Z`).join(''));
  }
  function sample(){
    timer=undefined;if(disposed)return;
    const view=board.getBoundingBox() as Viewport;
    for(const e of entries.values()){
      const data=e.geometry.sample(view,board.unitY);e.cells=data.inside;
      e.path.setAttribute('data-sample-view',JSON.stringify(view));
      e.path.setAttribute('data-evaluations',String(data.evaluations));e.path.setAttribute('data-truncated',String(data.truncated));
      e.path.setAttribute('data-uncertain-cells',String(data.unresolved.length));e.path.setAttribute('data-max-uncertainty-px',String(data.maxUncertaintyPx));
      board.containerObj.dispatchEvent(new CustomEvent('region-approximation',{bubbles:true,detail:{id:e.path.getAttribute('data-object-id'),maxUncertaintyPx:data.maxUncertaintyPx,truncated:data.truncated}}));
      e.title.textContent=`Численная аппроксимация. Непроверенных ячеек: ${data.unresolved.length}; максимальный размер ${data.maxUncertaintyPx.toFixed(1)} px. ${data.truncated?'Достигнут лимит вычислений.':''} Непроверенные ячейки не закрашены.`;
    }
    project();
  }
  function update(){
    // Previously certified world-space rectangles remain valid while moving.
    // Coalesce resize/pan bursts; do not leave a stale pixel-space fill in place.
    project();if(!timer&&entries.size)timer=setTimeout(sample,70);
  }
  board.on('update',update);
  return {
    update(plots:DrawablePlot[]){
      const regions=plots.filter(p=>p.geometry.kind==='region-image'),ids=new Set(regions.map(p=>p.id));
      for(const [id,e] of entries)if(!ids.has(id)){e.path.remove();entries.delete(id);}
      for(const p of regions){
        const g=p.geometry as ImageRegion,key=JSON.stringify(g.plan)+p.color,old=entries.get(p.id);
        if(old?.key===key){old.geometry=g;continue;}
        old?.path.remove();const path=document.createElementNS(NS,'path'),title=document.createElementNS(NS,'title');
        for(const [k,v] of Object.entries({'data-object-id':p.id,'data-geometry':'region-image','data-region-fill':p.id,fill:p.color,'fill-opacity':'.17','shape-rendering':'crispEdges'}))path.setAttribute(k,v);
        path.append(title);root.append(path);entries.set(p.id,{key,path,title,geometry:g,cells:[]});
      }
      update();
    },
    clear(){disposed=true;if(timer)clearTimeout(timer);board.off('update',update);entries.clear();root.remove();},
  };
}
