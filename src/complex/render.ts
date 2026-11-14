import JXG from 'jsxgraph';
import { createRegionLayer } from '../regions/render';
import type { ComplexGeometry, ComplexCoordinate } from './geometry';
import type { ImagePath } from '../mapping/sample';
import type { Viewport } from '../state/view';
export interface ComplexPlot { id:string; color:string; geometry:ComplexGeometry }
export interface ImageCurve { kind:'image'; sample:(view:Viewport,unit:number)=>ImagePath }
export interface DrawablePlot { id:string; color:string; geometry:ComplexGeometry|ImageCurve }
export type PointMove = (id:string,z:ComplexCoordinate)=>void;
export function createObjectLayer(board:JXG.Board,onMove:()=>PointMove|undefined){
  const regions=createRegionLayer(board);
  const entries=new Map<string,{kind:string;signature:string;object:JXG.GeometryElement;aux:JXG.GeometryElement[]}>();
  const remove=(id:string)=>{const e=entries.get(id)!;board.removeObject(e.object);e.aux.forEach(p=>board.removeObject(p));entries.delete(id);};
  return {
    update(plots:DrawablePlot[]){
      regions.update(plots);
      plots=plots.filter(p=>p.geometry.kind!=='region');
      const ids=new Set(plots.map(p=>p.id));for(const id of entries.keys())if(!ids.has(id))remove(id);
      board.suspendUpdate();
      for(const {id,color,geometry:g} of plots){
        const signature=JSON.stringify(g)+color,old=entries.get(id),style={strokeColor:color,fillColor:color,fillOpacity:g.kind==='point'?1:0,highlight:false,fixed:true,lineCap:'round' as const};
        if(old?.kind===g.kind && g.kind==='point'){
          const p=old.object as JXG.Point;
          if(p.X()!==g.value.re||p.Y()!==g.value.im)p.setPosition(JXG.COORDS_BY_USER,[g.value.re,g.value.im]);
          p.setAttribute({...style,fixed:!onMove()});old.signature=signature;continue;
        }
        if(old?.kind===g.kind && g.kind==='image'){
          const c=old.object as JXG.Curve;c.setAttribute(style);
          c.updateDataArray=function(){const data=g.sample(board.getBoundingBox(),board.unitY);this.dataX=data.xs;this.dataY=data.ys;this.rendNode.setAttribute('data-evaluations',String(data.evaluations));this.rendNode.setAttribute('data-truncated',String(data.truncated));};
          continue;
        }
        if(old && old.signature===signature)continue;
        if(old)remove(id);
        let object:JXG.GeometryElement;const aux:JXG.GeometryElement[]=[];
        if(g.kind==='region')continue;
        if(g.kind==='point'){
          const point=board.create('point',[g.value.re,g.value.im],{...style,fixed:!onMove(),name:'',size:4,withLabel:false});
          point.on('drag',()=>onMove()?.(id,{re:point.X(),im:point.Y()}));object=point;
        } else if(g.kind==='circle'){
          const center=board.create('point',[g.center.re,g.center.im],{visible:false,fixed:true,name:''});aux.push(center);
          object=board.create('circle',[center,g.radius],{...style,strokeWidth:2.5,fillOpacity:0});
        } else if(g.kind==='line')object=board.create('line',g.axis==='re'?[-g.value,1,0]:[-g.value,0,1],{...style,strokeWidth:2.5});
        else if(g.kind==='segment')object=board.create('curve',[[g.start.re,g.end.re],[g.start.im,g.end.im]],{...style,strokeWidth:2.5});
        else {
          const curve=board.create('curve',[[],[]],{...style,strokeWidth:2.5});
          curve.updateDataArray=function(){const data=g.sample(board.getBoundingBox(),board.unitY);this.dataX=data.xs;this.dataY=data.ys;this.rendNode.setAttribute('data-evaluations',String(data.evaluations));this.rendNode.setAttribute('data-truncated',String(data.truncated));};object=curve;
        }
        object.rendNode.setAttribute('data-object-id',id);object.rendNode.setAttribute('data-geometry',g.kind);
        entries.set(id,{kind:g.kind,signature,object,aux});
      }
      board.unsuspendUpdate();
    },
    clear(){regions.clear();for(const id of [...entries.keys()])remove(id);},
  };
}
