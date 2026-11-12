import { useState } from 'react';
import { type Parameter, normalizeParameter } from '../state/store';
export function ParameterControl({ name, parameter, onChange }: { name: string; parameter: Parameter; onChange: (p: Parameter) => void }) {
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState(parameter);
  const [error, setError] = useState('');
  return <section className="parameter">
    <div className="parameter-top"><label htmlFor={`slider-${name}`}><i>{name}</i> <span>=</span> <strong>{parameter.value}</strong></label><button className="text-button" onClick={() => { setDraft(parameter); setError(''); setSettings(!settings); }} aria-label={`Настройки параметра ${name}`}>Настроить</button></div>
    <input id={`slider-${name}`} aria-label={`Параметр ${name}`} type="range" min={parameter.min} max={parameter.max} step={parameter.step} value={parameter.value} onChange={e => onChange({ ...parameter, value: Number(e.target.value) })} />
    <div className="range-labels"><span>{parameter.min}</span><span>{parameter.max}</span></div>
    {settings && <form className="parameter-settings" onSubmit={e => { e.preventDefault(); const normalized = normalizeParameter(draft); if (!normalized) { setError('Минимум < максимум, 0 < шаг ≤ диапазон, значение внутри диапазона. Слишком мелкий шаг не поддерживается.'); return; } onChange(normalized); setSettings(false); }}>
      {(['value','min','max','step'] as const).map((key,i) => <label key={key}>{['Значение','Минимум','Максимум','Шаг'][i]}<input type="number" step="any" required value={Number.isNaN(draft[key]) ? '' : draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>)}
      {error && <p className="error" role="alert">{error}</p>}<button type="submit" className="small-button">Применить</button>
    </form>}
  </section>;
}
