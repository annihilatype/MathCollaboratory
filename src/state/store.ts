export interface Expression { id: string; latex: string; color: string; visible: boolean }
export interface Parameter { value: number; min: number; max: number; step: number }
export interface AppState { version: 1; expressions: Expression[]; parameters: Record<string, Parameter>; theme: 'light' | 'dark' }
export const COLORS = ['#7561d9', '#e18a37', '#239f91', '#d75478', '#3983ce', '#ae6ab9'];
export const STORAGE_KEY = 'mathcollaboratory.v1';
export const initialState = (): AppState => ({ version: 1, theme: 'light', parameters: { a: { value: 2, min: -5, max: 5, step: 0.1 } }, expressions: [
  { id: 'quadratic', latex: '\\frac{x^2}{4}-2', color: COLORS[0], visible: true },
  { id: 'sine', latex: 'a\\sin(x)', color: COLORS[1], visible: true },
] });
export function validParameter(p: Parameter): boolean { return [p.value,p.min,p.max,p.step].every(Number.isFinite) && p.min < p.max && p.step > 0 && p.step <= p.max-p.min && p.value >= p.min && p.value <= p.max; }
export function decodeState(raw: string | null): AppState {
  try {
    const s = JSON.parse(raw ?? '') as AppState;
    if (s.version !== 1 || !['light','dark'].includes(s.theme) || !Array.isArray(s.expressions) || s.expressions.length > 50 || !s.parameters || typeof s.parameters !== 'object') throw 0;
    const ids = new Set<string>();
    for (const e of s.expressions) { if (!e || typeof e.id !== 'string' || ids.has(e.id) || typeof e.latex !== 'string' || e.latex.length > 500 || !/^#[a-f\d]{6}$/i.test(e.color) || typeof e.visible !== 'boolean') throw 0; ids.add(e.id); }
    for (const [name,p] of Object.entries(s.parameters)) if (!/^[a-wyzA-Z](?:_[a-zA-Z0-9]+)?$/.test(name) || name === 'e' || !p || !validParameter(p)) throw 0;
    return s;
  } catch { return initialState(); }
}
export function loadState(): AppState { try { return decodeState(localStorage.getItem(STORAGE_KEY)); } catch { return initialState(); } }
