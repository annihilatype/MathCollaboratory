import { useState } from 'react';
import { type Parameter, validParameter } from '../state/store';
export function ParameterControl({ name, parameter, onChange }: { name: string; parameter: Parameter; onChange: (p: Parameter) => void }) {
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState(parameter);
  const [error, setError] = useState('');
  return <section className="parameter">
    <div className="parameter-top"><label htmlFor={`slider-${name}`}><i>{name}</i> <span>=</span> <strong>{Number(parameter.value.toFixed(8))}</strong></label><button className="text-button" onClick={() => { setDraft(parameter); setError(''); setSettings(!settings); }} aria-label={`Настройки параметра ${name}`}>Настроить</button></div>
    <input id={`slider-${name}`} aria-label={`Параметр ${name}`} type="range" min={parameter.min} max={parameter.max} step={parameter.step} value={parameter.value} onChange={e => onChange({ ...parameter, value: Number(e.target.value) })} />
    <div className="range-labels"><span>{parameter.min}</span><span>{parameter.max}</span></div>
    {settings && <form className="parameter-settings" onSubmit={e => { e.preventDefault(); if (!validParameter(draft)) { setError('Минимум < максимум, шаг > 0, значение внутри диапазона.'); return; } onChange({ ...draft, value: Math.min(draft.max, Math.max(draft.min, Number((draft.min + Math.round((draft.value-draft.min)/draft.step)*draft.step).toPrecision(12)))) }); setSettings(false); }}>
      {(['value','min','max','step'] as const).map((key,i) => <label key={key}>{['Значение','Минимум','Максимум','Шаг'][i]}<input type="number" step="any" required value={Number.isNaN(draft[key]) ? '' : draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>)}
      {error && <p className="error" role="alert">{error}</p>}<button type="submit" className="small-button">Применить</button>
    </form>}
  </section>;
}
