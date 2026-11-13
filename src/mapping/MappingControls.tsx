import { useState } from 'react';
import { MathEditor } from '../components/MathEditor';
import type { MappingState } from '../state/store';
export function MappingControls({state,error,onChange,onToggle}:{state:MappingState;error:string;onChange:(update:Partial<MappingState>)=>void;onToggle:()=>void}){
  const [everOpened,setEverOpened]=useState(state.enabled);
  if(state.enabled&&!everOpened)setEverOpened(true);
  return <div className="mapping-controls">
    <button type="button" className="mode-switch" role="switch" aria-checked={state.enabled} onClick={onToggle}><span>Отображение</span><span className="switch-track" aria-hidden="true"><span className="switch-thumb"/></span></button>
    <div className={`mapping-editor-slot ${state.enabled?'open':''}`} inert={!state.enabled} aria-hidden={!state.enabled}><div className="mapping-editor-inner">
      <div className="formula-row"><span>w =</span>{(everOpened||state.enabled)&&<MathEditor complexMode value={state.latex} label="Формула отображения" onChange={latex=>onChange({latex})}/> }</div>
      {state.enabled&&error&&<p className="error" role="alert">{error}</p>}
      <p className="mapping-hint">z² · 1/z · conj(z) · abs(z) · exp(z)<br/>Отрезок: segment(-1, 1). Точки z можно перетаскивать.</p>
    </div></div>
  </div>;
}
