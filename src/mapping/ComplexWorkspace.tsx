import { useState } from 'react';
import { Graph } from '../components/Graph';
import type { ComplexPlot, PointMove } from '../complex/render';
import type { ComplexMapping } from '../complex/geometry';
import type { MappingState } from '../state/store';
import type { Viewport } from '../state/view';
import { useImagePlots } from './useImagePlots';
const EMPTY:never[]=[],PARAMETERS={};
function PlaneHeading({image,visible}:{image?:boolean;visible:boolean}){
  return <header className={`plane-heading ${image?'image-heading':'source-heading'}`} aria-hidden={!visible}>
    <span className="plane-badge" aria-hidden="true">{image?'w':'z'}</span>
    <div><h2>{image?'Плоскость образов':'Исходная плоскость'}</h2><span className="plane-subtitle">{image?'w = f(z)':'z · исходные объекты'}</span></div>
  </header>;
}
export function ComplexWorkspace({objects,mapping,state,viewport,theme,onSourceView,onImageView,onPointMove}:{objects:ComplexPlot[];mapping:ComplexMapping|null;state:MappingState;viewport:Viewport;theme:'light'|'dark';onSourceView:(v:Viewport)=>void;onImageView:(v:Viewport)=>void;onPointMove:PointMove}){
  const [everOpened,setEverOpened]=useState(state.enabled);
  if(state.enabled&&!everOpened)setEverOpened(true);
  const images=useImagePlots(objects,state.enabled?mapping:null);
  return <div className={`complex-workspace ${state.enabled?'has-mapping':''}`} data-mapping={state.enabled}>
    <div className="plane-slot source-slot"><PlaneHeading visible={state.enabled}/><Graph mode="complex" label={state.enabled?'Исходная плоскость z':undefined} plots={EMPTY} parameters={PARAMETERS} objects={objects} viewport={viewport} theme={theme} onViewportChange={onSourceView} onPointMove={state.enabled?onPointMove:undefined}/></div>
    <div className="plane-slot image-slot" aria-hidden={!state.enabled} inert={!state.enabled}>
      <PlaneHeading image visible={state.enabled}/>
      {(everOpened||state.enabled)&&<Graph mode="complex" axisSymbol="w" label="Плоскость образов w" plots={EMPTY} parameters={PARAMETERS} objects={images} viewport={state.viewport} theme={theme} onViewportChange={onImageView}/>}
      {state.enabled&&<p className="image-note">Неразрешённые участки показаны разрывами. {objects.some(p=>p.geometry.kind==='line')?'Образы бесконечных прямых пока не строятся.':''}</p>}
    </div>
  </div>;
}
