import { validPersistedComplexParameter } from '../complex/parameters';
import { REAL_VIEW, COMPLEX_VIEW, validViewport, type Viewport } from './view';
export interface Expression { id: string; latex: string; color: string; visible: boolean }
export interface Parameter { value: number; min: number; max: number; step: number; positive?:boolean; integer?:boolean }
export interface MappingState { enabled:boolean; latex:string; viewport:Viewport }
export const initialMapping=():MappingState=>({enabled:false,latex:"z^2",viewport:[...COMPLEX_VIEW]});
export interface AppState { version: 1; expressions: Expression[]; parameters: Record<string, Parameter>; theme: 'light' | 'dark'; mode: 'real' | 'complex'; mapping:MappingState; realViewport: Viewport; complex: { expressions: Expression[]; viewport: Viewport } }
export const COLORS = ['#7561d9', '#e18a37', '#239f91', '#d75478', '#3983ce', '#ae6ab9'];
export const STORAGE_KEY = 'mathcollaboratory.v1';
export const initialComplex = () => ({ expressions: [{ id: 'complex-point', latex: 'z=2+3i', color: COLORS[0], visible: true }, { id: 'complex-circle', latex: '|z|=2', color: COLORS[1], visible: true }], viewport: [...COMPLEX_VIEW] as Viewport });
export const initialState = (): AppState => ({ version: 1, theme: 'light', mode: 'real', mapping:initialMapping(), realViewport: [...REAL_VIEW], complex: initialComplex(), parameters: { a: { value: 2, min: -5, max: 5, step: 0.1 } }, expressions: [
  { id: 'quadratic', latex: '\\frac{x^2}{4}-2', color: COLORS[0], visible: true },
  { id: 'sine', latex: 'a\\sin(x)', color: COLORS[1], visible: true },
] });
export function validParameter(p: Parameter): boolean { return [p.value,p.min,p.max,p.step].every(Number.isFinite) && p.min < p.max && p.step > 0 && p.step <= p.max-p.min && p.value >= p.min && p.value <= p.max; }
// Snap only to values the native range input can represent (relative to min).
export function normalizeParameter(p: Parameter): Parameter | null {
  if (!validParameter(p)) return null;
  if(p.positive!==undefined&&typeof p.positive!=='boolean'||p.integer!==undefined&&typeof p.integer!=='boolean')return null;
  if(p.positive&&(p.min<=0||p.value<=0))return null;
  if(p.integer&&![p.value,p.min,p.max,p.step].every(Number.isInteger))return null;
  const span = p.max - p.min;
  if (!Number.isFinite(span) || p.min + p.step <= p.min || p.max - p.step >= p.max) return null;
  const count = span / p.step;
  if (!Number.isFinite(count) || count > Number.MAX_SAFE_INTEGER) return null;
  const last = Math.floor(count + Number.EPSILON * Math.max(1, count) * 4);
  const index = Math.min(last, Math.max(0, Math.round((p.value - p.min) / p.step)));
  const rawValue = p.min + index * p.step;
  const rounded = Number(rawValue.toPrecision(15));
  const value = Math.abs(rawValue - rounded) <= p.step * 1e-8 ? rounded : rawValue;
  return { ...p, value: Math.min(p.max, Math.max(p.min, value)) };
}
function recoverExpressions(items: Expression[]): Expression[] {
    const ids = new Set<string>();
    const expressions: Expression[] = [];
    for (const e of items.slice(0, 50)) {
      if (!e || typeof e.id !== 'string' || ids.has(e.id) || typeof e.latex !== 'string') continue;
      ids.add(e.id);
      expressions.push({ id: e.id, latex: e.latex,
        color: typeof e.color === 'string' && /^#[a-f\d]{6}$/i.test(e.color) ? e.color : COLORS[expressions.length % COLORS.length],
        visible: typeof e.visible === 'boolean' ? e.visible : true });
    }
    return expressions;
}
export function decodeState(raw: string | null): AppState {
  try {
    const s = JSON.parse(raw ?? '') as AppState;
    if (!s || s.version !== 1) throw 0;
    const expressions = Array.isArray(s.expressions) ? recoverExpressions(s.expressions) : initialState().expressions;
    const parameters: Record<string, Parameter> = {};
    if (s.parameters && typeof s.parameters === 'object') {
      for (const [name, p] of Object.entries(s.parameters)) {
        if ((!/^[a-wyzA-Z](?:_[a-zA-Z0-9]+)?$/.test(name)&&!validPersistedComplexParameter(name)) || ['e','pi','constructor','prototype'].includes(name) || !p) continue;
        const normalized = normalizeParameter(p);
        if (normalized) parameters[name] = normalized;
      }
    }
    // Version 1 is extended additively: old saves keep their real expressions.
    // Recover the second list through the same independent record validation.
    const complexDefaults = initialComplex();
    const complexExpressions = s.complex && Array.isArray(s.complex.expressions)
      ? recoverExpressions(s.complex.expressions) : complexDefaults.expressions;
    return { version: 1, theme: s.theme === 'dark' ? 'dark' : 'light', expressions, parameters,
      mode: s.mode === 'complex' ? 'complex' : 'real',
      mapping:{enabled:s.mapping?.enabled===true,latex:typeof s.mapping?.latex==='string'?s.mapping.latex:initialMapping().latex,viewport:validViewport(s.mapping?.viewport)?s.mapping.viewport:initialMapping().viewport},
      realViewport: validViewport(s.realViewport) ? s.realViewport : [...REAL_VIEW],
      complex: { expressions: complexExpressions, viewport: validViewport(s.complex?.viewport) ? s.complex.viewport : complexDefaults.viewport } };

  } catch { return initialState(); }
}
export function loadState(): AppState { try { return decodeState(localStorage.getItem(STORAGE_KEY)); } catch { return initialState(); } }
