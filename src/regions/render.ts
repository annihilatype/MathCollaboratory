import type JXG from 'jsxgraph';
import type { DrawablePlot } from '../complex/render';
import { boundary, contains,partsOf, type Region, type RegionConstraint } from './model';
import type { Viewport } from '../state/view';
const NS='http://www.w3.org/2000/svg';let serial=0;
function node<K extends keyof SVGElementTagNameMap>(name:K,attrs:Record<string,string|number>={}){const e=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;}
export function halfplanePolygon(q:RegionConstraint,view:Viewport):[number,number][]{
  const corners:[number,number][]=[[view[0],view[1]],[view[2],view[1]],[view[2],view[3]],[view[0],view[3]]],out:[number,number][]=[];
  const value=(p:number[])=>q.b*p[0]+q.c*p[1]+q.d;
  for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],av=value(a),bv=value(b);if(av<=0)out.push(a);if((av<0&&bv>0)||(av>0&&bv<0)){const t=av/(av-bv);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;
}
export function createRegionLayer(board:JXG.Board){
  const renderer=board.renderer as typeof board.renderer&{layer:SVGGElement[];defs:SVGDefsElement};
  const fills=node('g',{'data-region-layer':'fill','pointer-events':'none'}),strokes=node('g',{'data-region-layer':'boundary','pointer-events':'none'});renderer.layer[0].append(fills);renderer.layer[4].append(strokes);
  const entries=new Map<string,{key:string;fill:SVGGElement;stroke:SVGGElement;defs:SVGDefsElement;draw:()=>void}>();
  function remove(id:string){const e=entries.get(id)!;e.fill.remove();e.stroke.remove();e.defs.remove();entries.delete(id);}
  function add(id:string,color:string,region:Region,key:string){
    const fill=node('g',{'data-object-id':id,'data-geometry':'region'}),stroke=node('g',{'data-region-id':id}),defs=node('defs'),parts=partsOf(region),rects:SVGRectElement[]=[],masks:SVGMaskElement[]=[],seams:{path:SVGPathElement;source:SVGPathElement}[]=[];
    if(parts.length>1)fill.setAttribute('opacity','.17');fills.append(fill);strokes.append(stroke);renderer.defs.append(defs);
    const data=parts.map(part=>{
      const clips=part.constraints.map(()=>{const id=`region-clip-${++serial}`,clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'}),path=node('path',{'clip-rule':'evenodd','fill-rule':'evenodd'});clip.append(path);defs.append(clip);return {id,path};});
      const clipped=(parent:SVGElement,except=-1)=>{let p=parent;clips.forEach((c,i)=>{if(i!==except){const g=node('g',{'clip-path':`url(#${c.id})`});p.append(g);p=g;}});return p;};
      const rect=node('rect',{fill:color,'fill-opacity':parts.length>1?1:.17,'data-region-fill':id});rects.push(rect);clipped(fill).append(rect);
      const group=node('g');stroke.append(group);
      const paths=part.constraints.map((q,i)=>{const p=node('path',{fill:'none',stroke:color,'stroke-width':2,'stroke-dasharray':q.strict?'6 5':'none','data-region-boundary':q.strict?'strict':'inclusive'});clipped(group,i).append(p);return p;});
      const holes=part.excluded.map(()=>{const p=node('circle',{r:3,fill:'var(--bg)',stroke:color,'stroke-width':1.5,'data-region-exclusion':'true'});group.append(p);return p;});
      const segments=(part.excludedSegments??[]).map(()=>{const p=node('path',{fill:'none',stroke:color,'stroke-width':3,'stroke-dasharray':'4 4','data-excluded-segment':'true'});clipped(group).append(p);const ends=[node('circle',{r:3,fill:'var(--bg)',stroke:color,'stroke-width':1.5,'data-excluded-endpoint':'true'}),node('circle',{r:3,fill:'var(--bg)',stroke:color,'stroke-width':1.5,'data-excluded-endpoint':'true'})];group.append(...ends);return {path:p,ends};});
      return {part,clips,clipped,paths,holes,segments,group};
    });
    // Remove boundaries interior to another union component. Group opacity
    // combines the union before transparency, so overlaps never darken.
    if(parts.length>1)data.forEach((d,i)=>{
      const id=`region-mask-${++serial}`,mask=node('mask',{id,maskUnits:'userSpaceOnUse',x:0,y:0});masks.push(mask);const white=node('rect',{fill:'white'});rects.push(white);mask.append(white);
      data.forEach((other,j)=>{if(i===j)return;const black=node('rect',{fill:'black'});rects.push(black);other.clipped(mask).append(black);
        d.part.constraints.forEach((q,k)=>other.part.constraints.forEach((o,l)=>{if(q.a===-o.a&&q.b===-o.b&&q.c===-o.c&&q.d===-o.d&&(!q.strict||!o.strict)){const line=node('path',{fill:'none',stroke:'black','stroke-width':6,'data-union-seam':'true'});other.clipped(mask,l).append(line);seams.push({path:line,source:d.paths[k]});}}));
      });defs.append(mask);d.group.setAttribute('mask',`url(#${id})`);
    });
    const points=parts.flatMap(p=>p.excluded).filter((p,i,a)=>a.findIndex(q=>q.re===p.re&&q.im===p.im)===i),unionHoles=parts.length>1?points.map(()=>{const circle=node('circle',{r:3,fill:'var(--bg)',stroke:color,'stroke-width':1.5});stroke.append(circle);return circle;}):[];
    function draw(){
      const view=board.getBoundingBox() as Viewport,W=board.canvasWidth,H=board.canvasHeight,X=(x:number)=>(x-view[0])*board.unitX,Y=(y:number)=>(view[1]-y)*board.unitY,box=`M0 0H${W}V${H}H0Z`;
      for(const rect of [...rects,...masks]){rect.setAttribute('width',String(W));rect.setAttribute('height',String(H));}
      data.forEach(({part,clips,paths,holes,segments})=>{
        part.constraints.forEach((q,i)=>{const b=boundary(q);let clip='',edge='';
          if(b.kind==='constant')clip=b.empty?'':box;
          else if(b.kind==='circle'){const x=X(b.x),y=Y(b.y),r=b.radius*board.unitY;edge=`M${x-r} ${y}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z`;clip=b.inside?edge:box+edge;}
          else {const poly=halfplanePolygon(q,view);clip=poly.length?'M'+poly.map(([x,y])=>`${X(x)} ${Y(y)}`).join('L')+'Z':'';const hits=poly.filter(([x,y])=>Math.abs(q.b*x+q.c*y+q.d)<1e-8*Math.max(1,Math.abs(q.d),Math.abs(q.b*x),Math.abs(q.c*y)));if(hits.length>=2)edge=`M${X(hits[0][0])} ${Y(hits[0][1])}L${X(hits.at(-1)![0])} ${Y(hits.at(-1)![1])}`;}
          clips[i].path.setAttribute('d',clip);paths[i].setAttribute('d',q.internal?'':edge);
        });
        part.excluded.forEach((p,i)=>{holes[i].setAttribute('cx',String(X(p.re)));holes[i].setAttribute('cy',String(Y(p.im)));holes[i].setAttribute('visibility',contains({...part,excluded:[]},p)?'visible':'hidden');});
        part.excludedSegments?.forEach((s,i)=>{const end=s.ray?{re:s.start.re+(s.end.re-s.start.re)*1e8,im:s.start.im+(s.end.im-s.start.im)*1e8}:s.end;segments[i].path.setAttribute('d',`M${X(s.start.re)} ${Y(s.start.im)}L${X(end.re)} ${Y(end.im)}`);[s.start,s.end].forEach((p,j)=>{segments[i].ends[j].setAttribute('cx',String(X(p.re)));segments[i].ends[j].setAttribute('cy',String(Y(p.im)));segments[i].ends[j].setAttribute('visibility',s.ray&&j===1?'hidden':'visible');});});
      });
      for(const s of seams)s.path.setAttribute('d',s.source.getAttribute('d')??'');
      unionHoles.forEach((c,i)=>{const p=points[i],base={...region,union:parts.map(r=>({...r,excluded:[]}))};c.setAttribute('cx',String(X(p.re)));c.setAttribute('cy',String(Y(p.im)));c.setAttribute('visibility',!contains(region,p)&&contains(base,p)?'visible':'hidden');});
    }
    entries.set(id,{key,fill,stroke,defs,draw});draw();
  }
  const draw=()=>{for(const e of entries.values())e.draw();};board.on('update',draw);
  return {update(plots:DrawablePlot[]){const regions=plots.filter(p=>p.geometry.kind==='region'),ids=new Set(regions.map(p=>p.id));for(const id of entries.keys())if(!ids.has(id))remove(id);for(const p of regions){const key=JSON.stringify(p.geometry)+p.color;if(entries.get(p.id)?.key===key)continue;if(entries.has(p.id))remove(p.id);add(p.id,p.color,p.geometry as Region,key);}},clear(){board.off('update',draw);for(const id of [...entries.keys()])remove(id);fills.remove();strokes.remove();}};
}
