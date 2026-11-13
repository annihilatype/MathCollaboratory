import type JXG from 'jsxgraph';
import type { DrawablePlot } from '../complex/render';
import { boundary, contains, type Region, type RegionConstraint } from './model';
import type { Viewport } from '../state/view';
const NS='http://www.w3.org/2000/svg';
let serial=0;
function node<K extends keyof SVGElementTagNameMap>(name:K,attrs:Record<string,string|number>={}){
  const e=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;
}
export function halfplanePolygon(q:RegionConstraint,view:Viewport):[number,number][]{
  const corners:[number,number][]=[[view[0],view[1]],[view[2],view[1]],[view[2],view[3]],[view[0],view[3]]],out:[number,number][]=[];
  const value=(p:number[])=>q.b*p[0]+q.c*p[1]+q.d;
  for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4],av=value(a),bv=value(b);
    if(av<=0)out.push(a);
    if((av<0&&bv>0)||(av>0&&bv<0)){const t=av/(av-bv);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
  }
  return out;
}
// Exact SVG circles and half-plane clipping, attached to JSXGraph's SVG layers.
// One fixed group per constraint; no sampled pixels/meshes or SVG node per grid cell.
export function createRegionLayer(board:JXG.Board){
  const renderer=board.renderer as typeof board.renderer&{layer:SVGGElement[];defs:SVGDefsElement};
  const fills=node('g',{'data-region-layer':'fill','pointer-events':'none'}),strokes=node('g',{'data-region-layer':'boundary','pointer-events':'none'});
  renderer.layer[0].append(fills);renderer.layer[4].append(strokes);
  const entries=new Map<string,{key:string;fill:SVGGElement;stroke:SVGGElement;defs:SVGDefsElement;draw:()=>void}>();
  function remove(id:string){const e=entries.get(id)!;e.fill.remove();e.stroke.remove();e.defs.remove();entries.delete(id);}
  function add(id:string,color:string,region:Region,key:string){
    const fill=node('g',{'data-object-id':id,'data-geometry':'region'}),stroke=node('g',{'data-region-id':id}),defs=node('defs');
    fills.append(fill);strokes.append(stroke);renderer.defs.append(defs);
    const clips=region.constraints.map(()=>{const id=`region-clip-${++serial}`,clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'}),path=node('path',{'clip-rule':'evenodd','fill-rule':'evenodd'});clip.append(path);defs.append(clip);return {id,path};});
    function clipped(parent:SVGGElement,except=-1){let p=parent;clips.forEach((c,i)=>{if(i!==except){const group=node('g',{'clip-path':`url(#${c.id})`});p.append(group);p=group;}});return p;}
    const rect=node('rect',{fill:color,'fill-opacity':.17,'data-region-fill':id});clipped(fill).append(rect);
    const boundaries=region.constraints.map((q,i)=>{const p=node('path',{fill:'none',stroke:color,'stroke-width':2,'stroke-dasharray':q.strict?'6 5':'none','data-region-boundary':q.strict?'strict':'inclusive'});clipped(stroke,i).append(p);return p;});
    const holes=region.excluded.map(()=>{const p=node('circle',{r:3,fill:'var(--bg)',stroke:color,'stroke-width':1.5,'data-region-exclusion':'true'});stroke.append(p);return p;});
    function draw(){
      const view=board.getBoundingBox() as Viewport,W=board.canvasWidth,H=board.canvasHeight;
      const X=(x:number)=>(x-view[0])*board.unitX,Y=(y:number)=>(view[1]-y)*board.unitY;
      const box=`M0 0H${W}V${H}H0Z`;
      rect.setAttribute('width',String(W));rect.setAttribute('height',String(H));
      region.constraints.forEach((q,i)=>{
        const b=boundary(q);let clip='',edge='';
        if(b.kind==='constant')clip=b.empty?'':box;
        else if(b.kind==='circle'){
          const x=X(b.x),y=Y(b.y),r=b.radius*board.unitY;
          edge=`M${x-r} ${y}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z`;
          clip=b.inside?edge:box+edge;
        }else{
          const poly=halfplanePolygon(q,view);clip=poly.length?'M'+poly.map(([x,y])=>`${X(x)} ${Y(y)}`).join('L')+'Z':'';
          // Only the mathematical boundary, never the viewport's rectangle edges.
          const hits=poly.filter(([x,y])=>Math.abs(q.b*x+q.c*y+q.d)<1e-8*Math.max(1,Math.abs(q.d),Math.abs(q.b*x),Math.abs(q.c*y)));
          if(hits.length>=2)edge=`M${X(hits[0][0])} ${Y(hits[0][1])}L${X(hits.at(-1)![0])} ${Y(hits.at(-1)![1])}`;
        }
        clips[i].path.setAttribute('d',clip);boundaries[i].setAttribute('d',edge);
      });
      region.excluded.forEach((p,i)=>{holes[i].setAttribute('cx',String(X(p.re)));holes[i].setAttribute('cy',String(Y(p.im)));holes[i].setAttribute('visibility',contains({...region,excluded:[]},p)?'visible':'hidden');});
    }
    entries.set(id,{key,fill,stroke,defs,draw});draw();
  }
  const draw=()=>{for(const e of entries.values())e.draw();};
  board.on('update',draw);
  return {
    update(plots:DrawablePlot[]){
      const regions=plots.filter(p=>p.geometry.kind==='region'),ids=new Set(regions.map(p=>p.id));
      for(const id of entries.keys())if(!ids.has(id))remove(id);
      for(const p of regions){const key=JSON.stringify(p.geometry)+p.color;if(entries.get(p.id)?.key===key)continue;if(entries.has(p.id))remove(p.id);add(p.id,p.color,p.geometry as Region,key);}
    },
    clear(){board.off('update',draw);for(const id of [...entries.keys()])remove(id);fills.remove();strokes.remove();},
  };
}
