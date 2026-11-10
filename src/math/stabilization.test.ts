import { describe, expect, it } from 'vitest';
import { parseExpression } from './expression';
import { decodeState, initialState, normalizeParameter } from '../state/store';
const value = (s: string, x = 2) => parseExpression(s).evaluate(x, {});
describe('v0.1.1 regressions', () => {
  it('keeps the power in an unparenthesized function argument', () => {
    expect(value('\\sin x^{2}')).toBeCloseTo(Math.sin(4));
    expect(value('\\cos x^2')).toBeCloseTo(Math.cos(4));
    expect(value('\\sin^{2}(x)')).toBeCloseTo(Math.sin(2) ** 2);
  });
  it.each(['\\sin 2x', '\\sin^2 x', '\\sin x \\cos x'])('asks for parentheses for %s', s => {
    expect(() => value(s)).toThrow(/скобках/);
  });
  it('handles nested powered trigonometric functions', () => {
    expect(value('\\sin^{2}(x+\\cos(x))')).toBeCloseTo(Math.sin(2 + Math.cos(2)) ** 2);
    expect(value('\\cos^{2}(\\sin^{2}(x))')).toBeCloseTo(Math.cos(Math.sin(2) ** 2) ** 2);
  });
  it('recovers healthy records, settings and parameters independently', () => {
    const s = initialState(); s.theme = 'dark'; s.parameters.a.value = 3;
    s.expressions.push({ ...s.expressions[0], id: 'long', latex: 'x'.repeat(501) });
    const raw = { ...s, expressions: [...s.expressions, null, s.expressions[0]], parameters: { ...s.parameters, b: { value: 1, min: 5, max: 0, step: -1 } } };
    const recovered = decodeState(JSON.stringify(raw));
    expect(recovered.theme).toBe('dark'); expect(recovered.parameters).toEqual(s.parameters);
    expect(recovered.expressions.slice(0, 2)).toEqual(s.expressions.slice(0, 2));
    expect(recovered.expressions[2].latex).toHaveLength(501);
    expect(recovered.expressions).toHaveLength(3);
    expect(() => parseExpression(recovered.expressions[2].latex)).toThrow(/слишком длинное/);
  });
  it('preserves invalid mathematical input for editing without losing other records', () => {
    const s = initialState(); s.expressions[0].latex = 'x+';
    expect(decodeState(JSON.stringify(s))).toEqual(s);
  });
  it('snaps to reachable native range values instead of clamping to an unreachable max', () => {
    expect(normalizeParameter({ value: .9, min: 0, max: 1, step: .6 })?.value).toBe(.6);
    expect(normalizeParameter({ value: 1, min: 0, max: 1, step: .6 })?.value).toBe(.6);
    expect(normalizeParameter({ value: .3, min: -.1, max: .3, step: .1 })?.value).toBe(.3);
  });
  it('preserves representable small steps at large offsets', () => {
    expect(normalizeParameter({ value: 1e15 + .5, min: 1e15, max: 1e15 + 2, step: .5 })?.value).toBe(1e15 + .5);
    expect(normalizeParameter({ value: 1e15, min: 1e15, max: 1e15 + 2, step: .01 })).toBeNull();
  });
  it.each([0, -1, 2, 1e-20])('rejects incompatible step %s', step => {
    expect(normalizeParameter({ value: .5, min: 0, max: 1, step })).toBeNull();
  });
});
