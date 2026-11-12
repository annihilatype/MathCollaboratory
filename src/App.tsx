import { useEffect, useMemo, useState } from 'react';
import { ResetDialog } from './components/ResetDialog';
import { MathEditor } from './components/MathEditor';
import { Graph } from './components/Graph';
import { ParameterControl } from './components/ParameterControl';
import { parseExpression } from './math/expression';
import { COLORS, initialState, loadState, STORAGE_KEY, type Expression } from './state/store';

export function App() {
  const [state, setState] = useState(loadState);
  const [saveError, setSaveError] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { document.documentElement.dataset.theme=state.theme; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setSaveError(false); } catch { setSaveError(true); } }, [state]);
  const analyzed = useMemo(() => state.expressions.map(expression => {
    try { return { ...expression, parsed: parseExpression(expression.latex), error: '' }; }
    catch (error) { return { ...expression, parsed: null, error: expression.latex.trim() ? (error as Error).message : '' }; }
  }), [state.expressions]);
  const names = useMemo(() => [...new Set(analyzed.flatMap(e => e.parsed?.parameters ?? []))].sort(), [analyzed]);
  const values = useMemo(() => Object.fromEntries(Object.entries(state.parameters).map(([k,p]) => [k,p.value])), [state.parameters]);
  const plots = useMemo(() => analyzed.flatMap(e => e.visible && e.parsed && e.parsed.parameters.every(p => Object.hasOwn(values,p)) ? [{ id:e.id, color:e.color, parsed:e.parsed }] : []), [analyzed, values]);
  const patch = (id: string, update: Partial<Expression>) => setState(s => ({ ...s, expressions:s.expressions.map(e => e.id===id ? {...e,...update} : e) }));
  const add = () => setState(s => ({ ...s, expressions:[...s.expressions, { id:crypto.randomUUID(), latex:'', color:COLORS[s.expressions.length%COLORS.length], visible:true }] }));
  return <div className="app-shell">
    <header className="app-header"><div className="brand"><span className="brand-mark">m<span>·</span></span><div><strong>MathCollaboratory</strong><span>Интерактивная математическая лаборатория</span></div></div><div className="header-actions"><span className="version">v0.1.1</span><button className="theme-button" aria-label={state.theme==='light'?'Тёмная тема':'Светлая тема'} title="Переключить тему" onClick={() => setState(s => ({...s,theme:s.theme==='light'?'dark':'light'}))}>{state.theme==='light'?'☾':'☀'}</button></div></header>
    <main><aside className="sidebar"><div className="module-heading"><span className="eyebrow">МАТЕМАТИЧЕСКИЕ ИНСТРУМЕНТЫ</span><h1>Графики функций<span>↗</span></h1><p>Исследуйте математику в движении</p></div>
      <div className="section-heading"><h2>Выражения</h2><span>{state.expressions.length}</span></div>
      <div className="expressions">{analyzed.map((e,index) => <article className={`expression-card ${e.error?'has-error':''}`} key={e.id}>
        <div className="expression-meta"><span className="expression-number">{String(index+1).padStart(2,'0')}</span><label className="color-picker" title="Цвет графика" style={{background:e.color}}><input aria-label={`Цвет функции ${index+1}`} type="color" value={e.color} onChange={event => patch(e.id,{color:event.target.value})} /></label><span className="function-label">Функция</span><button className="icon-button" aria-label={`${e.visible?'Скрыть':'Показать'} функцию ${index+1}`} aria-pressed={e.visible} title={e.visible?'Скрыть':'Показать'} onClick={() => patch(e.id,{visible:!e.visible})}>{e.visible?'◉':'○'}</button><button className="icon-button delete" aria-label={`Удалить функцию ${index+1}`} title="Удалить" onClick={() => setState(s=>({...s,expressions:s.expressions.filter(item=>item.id!==e.id)}))}>×</button></div>
        <div className="formula-row"><span>y =</span><MathEditor label={`Выражение ${index+1}`} value={e.latex} onChange={latex=>patch(e.id,{latex})} /></div>
        {e.error && <p className="error" role="alert">{e.error}</p>}
        {e.parsed?.parameters.filter(p=>!Object.hasOwn(state.parameters,p)).map(name=><button key={name} className="create-parameter" onClick={()=>setState(s=>({...s,parameters:{...s.parameters,[name]:{value:1,min:-5,max:5,step:0.1}}}))}>+ Создать ползунок {name}</button>)}
      </article>)}</div>
      <button className="add-expression" onClick={add} disabled={state.expressions.length>=50}><span>＋</span> Добавить выражение</button>
      {names.some(n=>Object.hasOwn(state.parameters,n)) && <div className="parameters"><div className="section-heading"><h2>Параметры</h2><span>↔</span></div>{names.filter(n=>Object.hasOwn(state.parameters,n)).map(name=><ParameterControl key={name} name={name} parameter={state.parameters[name]} onChange={p=>setState(s=>({...s,parameters:{...s.parameters,[name]:p}}))} />)}</div>}
      <div className="sidebar-footer"><div className="hint"><span>⌨</span><p>Введите функцию с клавиатуры или откройте математическую клавиатуру в поле ввода.<small>sin, cos, tan, ln, log, exp, abs, π, e<br/>log — по основанию 10, ln — натуральный</small></p></div><div className="save-row"><span className={saveError?'error':''}>{saveError?'Не удалось сохранить': '✓ Сохранено на устройстве'}</span><button onClick={()=>setConfirmReset(true)}>Сбросить</button></div></div>
    </aside><Graph plots={plots} parameters={values} theme={state.theme} resetKey={resetKey}/></main>
    {confirmReset && <ResetDialog onCancel={()=>setConfirmReset(false)} onConfirm={()=>{setState(initialState());setResetKey(k=>k+1);setConfirmReset(false);}}/>}
  </div>;
}
