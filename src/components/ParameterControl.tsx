import { useEffect,useState } from 'react';
import { type Parameter, normalizeParameter } from '../state/store';
export function ParameterControl({ name, parameter, onChange }: { name: string; parameter: Parameter; onChange: (p: Parameter) => void }) {
  const [text,setText]=useState(String(parameter.value)),[editing,setEditing]=useState(false);
  useEffect(()=>{if(!editing)setText(String(parameter.value));},[parameter.value,editing]);
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState(parameter);
  const [error, setError] = useState('');
  return <section className="parameter">
    <div className="parameter-top"><label htmlFor={`slider-${name}`}><i>{name}</i> <span>=</span> <strong>{parameter.value}</strong></label><button className="text-button" onClick={() => { setDraft(parameter); setError(''); setSettings(!settings); }} aria-label={`Настройки параметра ${name}`}>Настроить</button></div>
    <input className="parameter-value" aria-label={`Значение параметра ${name}`} type="number" min={parameter.min} max={parameter.max} step={parameter.step} value={text} onFocus={()=>setEditing(true)} onBlur={()=>{setEditing(false);setText(String(parameter.value));}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onChange={e=>{setText(e.target.value);if(!e.target.value.trim())return;const normalized=normalizeParameter({...parameter,value:Number(e.target.value)});if(normalized)onChange(normalized);}}/>
    <input id={`slider-${name}`} aria-label={`Параметр ${name}`} type="range" min={parameter.min} max={parameter.max} step={parameter.step} value={parameter.value} onChange={e => onChange({ ...parameter, value: Number(e.target.value) })} />
    <div className="range-labels"><span>{parameter.min}</span><span>{parameter.max}</span></div>
    {settings && <form className="parameter-settings" onSubmit={e => { e.preventDefault(); const normalized = normalizeParameter(draft); if (!normalized) { setError('Минимум < максимум, 0 < шаг ≤ диапазон, значение внутри диапазона. Для положительного параметра минимум > 0; для целого значения границы и шаг должны быть целыми. Слишком мелкий шаг не поддерживается.'); return; } onChange(normalized); setSettings(false); }}>
      {(['value','min','max','step'] as const).map((key,i) => <label key={key}>{['Значение','Минимум','Максимум','Шаг'][i]}<input type="number" step="any" required value={Number.isNaN(draft[key]) ? '' : draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>)}
      <label className="parameter-constraint"><input type="checkbox" checked={!!draft.positive} onChange={e=>setDraft({...draft,positive:e.target.checked})}/> Только положительные</label>
      <label className="parameter-constraint"><input type="checkbox" checked={!!draft.integer} onChange={e=>setDraft({...draft,integer:e.target.checked})}/> Целые значения</label>
      {error && <p className="error" role="alert">{error}</p>}<button type="submit" className="small-button">Применить</button>
    </form>}
  </section>;
}
