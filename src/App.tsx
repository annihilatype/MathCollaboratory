import { parseMapping } from './mapping/expression';
import { MappingControls } from './mapping/MappingControls';
import { ComplexWorkspace } from './mapping/ComplexWorkspace';
import { PointDetails } from './mapping/PointDetails';
import { pointFormula } from './mapping/parameterize';
import { parseComplexGeometry } from './complex/geometry';
import type { ComplexPlot } from './complex/render';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { ResetDialog } from './components/ResetDialog';
import { MathEditor } from './components/MathEditor';
import { Graph } from './components/Graph';
import { ParameterControl } from './components/ParameterControl';
import { parseExpression } from './math/expression';
import { COLORS, initialMapping, initialComplex, initialState, loadState, STORAGE_KEY, type Expression } from './state/store';

export function App() {
  const [state, setState] = useState(loadState);
  const [saveError, setSaveError] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { document.documentElement.dataset.theme=state.theme; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setSaveError(false); } catch { setSaveError(true); } }, [state]);
  const isComplex = state.mode === 'complex';
  const mapped = useMemo(()=>{try{return {value:parseMapping(state.mapping.latex),error:''};}catch(e){return {value:null,error:(e as Error).message};}},[state.mapping.latex]);
  const movePoint = useCallback((id:string,z:{re:number;im:number})=>setState(s=>({...s,complex:{...s.complex,expressions:s.complex.expressions.map(e=>e.id===id?{...e,latex:pointFormula(z)}:e)}})),[]);
  const expressions = isComplex ? state.complex.expressions : state.expressions;
  const complexAnalyzed = useMemo(() => state.complex.expressions.map(e => {
    try { return { ...e, geometry: parseComplexGeometry(e.latex), error: '' }; }
    catch (error) { return { ...e, geometry: null, error: e.latex.trim() ? (error as Error).message : '' }; }
  }), [state.complex.expressions]);
  const objects = useMemo<ComplexPlot[]>(() => complexAnalyzed.flatMap(e => e.visible && e.geometry ? [{id:e.id, color:e.color, geometry:e.geometry}] : []), [complexAnalyzed]);
  const analyzed = useMemo(() => state.expressions.map(expression => {
    try { return { ...expression, parsed: parseExpression(expression.latex), error: '' }; }
    catch (error) { return { ...expression, parsed: null, error: expression.latex.trim() ? (error as Error).message : '' }; }
  }), [state.expressions]);
  const names = useMemo(() => [...new Set(analyzed.flatMap(e => e.parsed?.parameters ?? []))].sort(), [analyzed]);
  const values = useMemo(() => Object.fromEntries(Object.entries(state.parameters).map(([k,p]) => [k,p.value])), [state.parameters]);
  const plots = useMemo(() => analyzed.flatMap(e => e.visible && e.parsed && e.parsed.parameters.every(p => Object.hasOwn(values,p)) ? [{ id:e.id, color:e.color, parsed:e.parsed }] : []), [analyzed, values]);
  const updateExpressions = (update: (items: Expression[]) => Expression[]) => setState(s => s.mode === 'complex' ? {...s, complex:{...s.complex, expressions:update(s.complex.expressions)}} : {...s, expressions:update(s.expressions)});
  const patch = (id: string, update: Partial<Expression>) => updateExpressions(items => items.map(e => e.id === id ? {...e,...update} : e));
  const add = (latex='') => updateExpressions(items => [...items, {id:crypto.randomUUID(), latex, color:COLORS[items.length%COLORS.length], visible:true}]);
  const rows = isComplex ? complexAnalyzed.map(e => ({...e, parsed:null})) : analyzed.map(e => ({...e, geometry:null}));
  return <div className="app-shell">
    <header className="app-header"><div className="brand"><span className="brand-mark">m<span>·</span></span><div><strong>MathCollaboratory</strong><span>Интерактивная математическая лаборатория</span></div></div><div className="header-actions"><span className="version">v0.4</span><button className="theme-button" aria-label={state.theme==='light'?'Тёмная тема':'Светлая тема'} title="Переключить тему" onClick={() => setState(s => ({...s,theme:s.theme==='light'?'dark':'light'}))}>{state.theme==='light'?'☾':'☀'}</button></div></header>
    <main><aside className="sidebar"><div className="module-heading"><span className="eyebrow">МАТЕМАТИЧЕСКИЕ ИНСТРУМЕНТЫ</span><h1>{isComplex ? 'Комплексная плоскость' : 'Графики функций'}<span>↗</span></h1></div>
      <button type="button" className="mode-switch" role="switch" aria-checked={isComplex} onClick={()=>setState(s=>({...s,mode:s.mode === 'complex' ? 'real' : 'complex'}))}><span>Комплексная плоскость</span><span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span></button>
      {isComplex&&<MappingControls onToggle={()=>setState(s=>({...s,mapping:{...s.mapping,enabled:!s.mapping.enabled}}))} state={state.mapping} error={mapped.error} onChange={update=>setState(s=>({...s,mapping:{...s.mapping,...update}}))}/>}
      <div className="section-heading"><h2>Выражения</h2><span>{expressions.length}</span></div>
      <div className="expressions">{rows.map((e,index) => <article className={`expression-card ${e.error?'has-error':''}`} key={e.id}>
        <div className="expression-meta"><span className="expression-number">{String(index+1).padStart(2,'0')}</span><label className="color-picker" title="Цвет графика" style={{background:e.color}}><input aria-label={`Цвет ${isComplex ? 'объекта' : 'функции'} ${index+1}`} type="color" value={e.color} onChange={event => patch(e.id,{color:event.target.value})} /></label><span className="function-label">{isComplex ? 'Объект' : 'Функция'}</span><button className="icon-button" aria-label={`${e.visible?'Скрыть':'Показать'} ${isComplex ? 'объект' : 'функцию'} ${index+1}`} aria-pressed={e.visible} title={e.visible?'Скрыть':'Показать'} onClick={() => patch(e.id,{visible:!e.visible})}>{e.visible?'◉':'○'}</button><button className="icon-button delete" aria-label={`Удалить ${isComplex ? 'объект' : 'функцию'} ${index+1}`} title="Удалить" onClick={() => updateExpressions(items=>items.filter(item=>item.id!==e.id))}>×</button></div>
        <div className="formula-row">{!isComplex && <span>y =</span>}<MathEditor complexMode={isComplex} label={`Выражение ${index+1}`} value={e.latex} onChange={latex=>patch(e.id,{latex})} /></div>
        {e.geometry&&<PointDetails geometry={e.geometry} mapping={isComplex&&state.mapping.enabled?mapped.value:undefined}/> }
        {e.error && <p className="error" role="alert">{e.error}</p>}
        {e.parsed?.parameters.filter(p=>!Object.hasOwn(state.parameters,p)).map(name=><button key={name} className="create-parameter" onClick={()=>setState(s=>({...s,parameters:{...s.parameters,[name]:{value:1,min:-5,max:5,step:0.1}}}))}>+ Создать ползунок {name}</button>)}
      </article>)}</div>
      <button className="add-expression" onClick={()=>add()} disabled={expressions.length>=50}><span>＋</span> Добавить выражение</button>
      {isComplex&&<button className="text-button add-segment" disabled={expressions.length>=50} onClick={()=>add('\\operatorname{segment}(-1,1)')}>Добавить отрезок</button>}
      {!isComplex && names.some(n=>Object.hasOwn(state.parameters,n)) && <div className="parameters"><div className="section-heading"><h2>Параметры</h2><span>↔</span></div>{names.filter(n=>Object.hasOwn(state.parameters,n)).map(name=><ParameterControl key={name} name={name} parameter={state.parameters[name]} onChange={p=>setState(s=>({...s,parameters:{...s.parameters,[name]:p}}))} />)}</div>}
      <div className="sidebar-footer"><div className="hint"><span>⌨</span><p>Введите функцию с клавиатуры или откройте математическую клавиатуру в поле ввода.<small>{isComplex ? <>z=2+3i · |z|&lt;2 · 1&lt;|z|&lt;3<br/>Пересечение: Re(z)&lt;2 and Im(z)&gt;=0<br/>conj, abs, arg · аргумент в радианах</> : <>sin, cos, tan, ln, log, exp, abs, π, e<br/>log — по основанию 10, ln — натуральный</>}</small></p></div><div className="save-row"><span className={saveError?'error':''}>{saveError?'Не удалось сохранить': '✓ Сохранено на устройстве'}</span><button onClick={()=>setConfirmReset(true)}>Сбросить</button></div></div>
    </aside>{isComplex?<ComplexWorkspace key={`complex-${resetKey}`} objects={objects} mapping={mapped.value} state={state.mapping} viewport={state.complex.viewport} theme={state.theme} onSourceView={view=>setState(s=>({...s,complex:{...s.complex,viewport:view}}))} onImageView={view=>setState(s=>({...s,mapping:{...s.mapping,viewport:view}}))} onPointMove={movePoint}/>:<Graph key={`real-${resetKey}`} plots={plots} parameters={values} theme={state.theme} viewport={state.realViewport} onViewportChange={view=>setState(s=>({...s,realViewport:view}))}/>}</main>
    {confirmReset && <ResetDialog onCancel={()=>setConfirmReset(false)} onConfirm={()=>{setState(s=>s.mode === 'complex' ? {...s,complex:initialComplex(),mapping:initialMapping()} : {...s,expressions:initialState().expressions,parameters:initialState().parameters,realViewport:initialState().realViewport});setResetKey(k=>k+1);setConfirmReset(false);}}/>}
  </div>;
}
