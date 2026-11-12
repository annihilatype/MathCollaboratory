import { describe, expect, it } from 'vitest';
import { parseExpression } from './expression';
import { decodeState, initialState, normalizeParameter } from '../state/store';
const cases: [string, (x: number) => number][] = [
  ['sin x^{2}', x => Math.sin(x*x)], ['sin^{2}(x)', x => Math.sin(x)**2],
  ['sin^{2}(x+cos(x))', x => Math.sin(x+Math.cos(x))**2],
  ['sin(x+1)^2', x => Math.sin(x+1)**2], ['sin^{2}(x^{2}+1)', x => Math.sin(x*x+1)**2],
  ['sin(-x)', x => Math.sin(-x)], ['-sin(x)', x => -Math.sin(x)],
  ['cos(x)^2+sin(x)^2', () => 1], ['sin(cos(x^{2}))', x => Math.sin(Math.cos(x*x))],
  ['sin(2x)', x => Math.sin(2*x)], ['2sin(x)', x => 2*Math.sin(x)],
  ['(x+1)(x-1)', x => (x+1)*(x-1)], ['-x^2', x => -(x*x)], ['(-x)^2', x => x*x],
  ['2^3^2', () => 512], ['1/2*x', x => .5*x], ['1/(2*x)', x => 1/(2*x)],
  ['sin(x)^2', x => Math.sin(x)**2], ['sin(x^2)', x => Math.sin(x*x)],
  ['(((x+1)*(x-1))+sin(cos((x^2))))', x => (x+1)*(x-1)+Math.sin(Math.cos(x*x))],
  ['x^{-2}', x => x**-2], ['x^{0.5}', Math.sqrt], ['x^{\\frac{1}{2}}', Math.sqrt],
  ['sin^{-2}(x+1)', x => Math.sin(x+1)**-2], ['sqrt(x)', Math.sqrt], ['ln(x)', Math.log],
  ['1/(x-1)', x => 1/(x-1)], ['1/0', () => NaN], ['0/0', () => NaN],
];
describe('Numerical audit of precedence and nested functions', () => {
  it.each(cases)('%s matches independent expected values', (source, expected) => {
    const f = parseExpression(source);
    expect(f.parameters).toEqual([]);
    for (const x of [-3, -1, -.25, 0, .25, 1, 2, 3]) {
      const actual = f.evaluate(x, {}), target = expected(x);
      if (!Number.isFinite(target)) expect(actual, `${source}, x=${x}`).toBeNaN();
      else expect(actual, `${source}, x=${x}`).toBeCloseTo(target, 11);
    }
  });
  it('rejects bare negative arguments with actionable guidance', () => {
    expect(() => parseExpression('sin -x')).toThrow(/скобках/);
  });
});
describe('Partial recovery and repeated serialization', () => {
  it.each(['formula', 'long', 'duplicate', 'parameter', 'theme', 'color', 'object-color', 'empty'])('recovers %s independently and remains stable', issue => {
    const s = initialState(); s.theme = 'dark'; s.parameters.a.value = 3;
    if (issue === 'formula') s.expressions.push({ ...s.expressions[0], id: 'bad', latex: 'x+' });
    if (issue === 'long') s.expressions.push({ ...s.expressions[0], id: 'long', latex: 'x'.repeat(501) });
    if (issue === 'duplicate') s.expressions.push(s.expressions[0]);
    if (issue === 'parameter') s.parameters.b = { value: 2, min: 3, max: 0, step: 0 };
    if (issue === 'theme') (s as unknown as { theme: string }).theme = 'broken';
    if (issue === 'color') s.expressions[0].color = 'broken';
    if (issue === 'object-color') (s.expressions[0] as unknown as { color: unknown }).color = { toString: null };
    if (issue === 'empty') s.expressions = [];
    const recovered = decodeState(JSON.stringify(s));
    expect(recovered.parameters).toEqual({ a: { value: 3, min: -5, max: 5, step: .1 } });
    expect(recovered.theme).toBe(issue === 'theme' ? 'light' : 'dark');
    if (issue !== 'empty') expect(recovered.expressions[1]).toEqual(s.expressions[1]);
    else expect(recovered.expressions).toEqual([]);
    expect(decodeState(JSON.stringify(recovered))).toEqual(recovered);
  });
});
describe('Parameter grids', () => {
  it.each([
    {value: .9, min: 0, max: 1, step: .6}, {value: -.7, min: -2, max: 1, step: .4},
    {value: .125, min: -.25, max: .5, step: .05}, {value: 3e-10, min: 0, max: 1e-8, step: 1e-10},
  ])('snaps and survives repeated restoration: %j', p => {
    const normalized = normalizeParameter(p)!;
    expect(normalized).not.toBeNull();
    expect((normalized.value-p.min)/p.step).toBeCloseTo(Math.round((normalized.value-p.min)/p.step), 8);
    const s = initialState(); s.parameters.a = normalized;
    expect(decodeState(JSON.stringify(decodeState(JSON.stringify(s))))).toEqual(s);
    expect(parseExpression('ax').evaluate(-2, { a: normalized.value })).toBe(normalized.value*-2);
  });
});
