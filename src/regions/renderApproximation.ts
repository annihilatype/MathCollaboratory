import type JXG from 'jsxgraph';
import type { DrawablePlot } from '../complex/render';
import type { Viewport } from '../state/view';
import type { Box, InversePlan, RegionTiling } from './inverse';
export type SamplingQuality='interactive'|'settled';
export interface ImageRegion { kind:'region-image'; plan:InversePlan; sample:(view:Viewport,unit:number,quality?:SamplingQuality)=>RegionTiling }
const NS='http://www.w3.org/2000/svg';
// One path per region. Generation cancellation and one object per frame keep
// changes responsive without workers or stale geometry appearing after edits.
export function createApproximationLayer(board:JXG.Board){
  const renderer=board.renderer as typeof board.renderer&{layer:SVGGElement[]},root=document.createElementNS(NS,'g');root.setAttribute('pointer-events','none');root.setAttribute('data-region-layer','approximate');renderer.layer[0].append(root);
  const entries=new Map<string,{key:string;path:SVGPathElement;title:SVGTitleElement;geometry:ImageRegion;cells:Box[]}>();
  let timer:ReturnType<typeof setTimeout>|undefined,refine:ReturnType<typeof setTimeout>|undefined,frame:number|undefined,disposed=false,generation=0,viewKey='';
  function project(){const v=board.getBoundingBox(),X=(x:number)=>(x-v[0])*board.unitX,Y=(y:number)=>(v[1]-y)*board.unitY;for(const e of entries.values())e.path.setAttribute('d',e.cells.map(c=>`M${X(c[0])} ${Y(c[3])}H${X(c[1])}V${Y(c[2])}H${X(c[0])}Z`).join(''));}
  function run(quality:SamplingQuality){
    if(disposed)return;if(frame!==undefined)cancelAnimationFrame(frame);const token=generation,queue=[...entries.values()],view=board.getBoundingBox() as Viewport,unit=board.unitY;let index=0;
    function next(){
      frame=undefined;if(disposed||token!==generation||index>=queue.length)return;
      const e=queue[index++],data=e.geometry.sample(view,unit,quality);e.cells=data.inside;
      for(const [k,v] of Object.entries({'data-sample-view':JSON.stringify(view),'data-evaluations':String(data.evaluations),'data-truncated':String(data.truncated),'data-uncertain-cells':String(data.unresolved.length),'data-max-uncertainty-px':String(data.maxUncertaintyPx),'data-quality':quality,'data-generation':String(token)}))e.path.setAttribute(k,v);
      e.title.textContent=`Численная аппроксимация. Непроверенных ячеек: ${data.unresolved.length}; размер ${data.maxUncertaintyPx.toFixed(1)} px. ${data.truncated?'Лимит детализации.':''}`;
      project();board.containerObj.dispatchEvent(new CustomEvent('region-approximation',{bubbles:true,detail:{id:e.path.getAttribute('data-object-id'),maxUncertaintyPx:data.maxUncertaintyPx,truncated:data.truncated}}));
      if(index<queue.length)frame=requestAnimationFrame(next);
    }frame=requestAnimationFrame(next);
  }
  function update(force=false){
    project();const key=JSON.stringify(board.getBoundingBox())+board.unitY;if(!force&&key===viewKey)return;viewKey=key;generation++;
    if(frame!==undefined)cancelAnimationFrame(frame);if(refine)clearTimeout(refine);
    if(!timer&&entries.size)timer=setTimeout(()=>{timer=undefined;run('interactive');},32);
    if(entries.size)refine=setTimeout(()=>run('settled'),180);
  }
  const onUpdate=()=>update();board.on('update',onUpdate);
  return {
    update(plots:DrawablePlot[]){
      const regions=plots.filter(p=>p.geometry.kind==='region-image'),ids=new Set(regions.map(p=>p.id));let dirty=false;
      for(const [id,e] of entries)if(!ids.has(id)){e.path.remove();entries.delete(id);dirty=true;}
      for(const p of regions){const g=p.geometry as ImageRegion,key=JSON.stringify(g.plan)+p.color,old=entries.get(p.id);if(old?.key===key){old.geometry=g;continue;}
        dirty=true;old?.path.remove();const path=document.createElementNS(NS,'path'),title=document.createElementNS(NS,'title');for(const [k,v] of Object.entries({'data-object-id':p.id,'data-geometry':'region-image','data-region-fill':p.id,fill:p.color,'fill-opacity':'.17','shape-rendering':'crispEdges'}))path.setAttribute(k,v);
        path.append(title);root.append(path);entries.set(p.id,{key,path,title,geometry:g,cells:[]});
      }update(dirty);
    },
    clear(){disposed=true;generation++;if(timer)clearTimeout(timer);if(refine)clearTimeout(refine);if(frame!==undefined)cancelAnimationFrame(frame);board.off('update',onUpdate);entries.clear();root.remove();},
  };
}
