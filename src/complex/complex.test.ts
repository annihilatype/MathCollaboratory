import { describe, it, expect } from 'vitest';
import { evaluateComplex, complexSource } from './math';
import { parseComplexGeometry } from './geometry';
import { decodeState, initialState } from '../state/store';
import { validViewport } from '../state/view';

describe('Controlled complex arithmetic', () => {
  it.each([
    ['i^2',-1,0], ['(1+i)(1-i)',2,0], ['|3+4i|',5,0], ['(2+3i)+(1-i)',3,2],
    ['(2+3i)-(1-i)',1,4], ['(1+i)/(1-i)',0,1], ['i^{-1}',0,-1],
    ['conj(2+3i)',2,-3], ['arg(i)',Math.PI/2,0], ['Re(1+2i)',1,0], ['Im(1+2i)',2,0],
    ['\\frac{1+i}{1-i}',0,1], ['\\overline{1+i}',1,-1], ['\\operatorname{abs}(3+4i)',5,0],
  ])('%s', (input,re,im) => {
    const z = evaluateComplex(complexSource(input as string));
    expect(z.re).toBeCloseTo(re as number,12); expect(z.im).toBeCloseTo(im as number,12);
  });
  it.each(['1/0','1/(i-i)','0^-1','arg(0)','i^0.5','x','z','a=1','import("x")','random()','[1,2]','i[0]','2;3','constructor(i)','i^1001','\\unknown{1}'])('rejects %s', s => expect(()=>parseComplexGeometry(s)).toThrow());
});
describe('Complex geometry', () => {
  it.each([['z=2+3i',2,3],['z=-1-i',-1,-1],['z=3',3,0],['z=2i',0,2]])('%s', (s,re,im) => {
    const g = parseComplexGeometry(s as string); expect(g.kind).toBe('point');
    if(g.kind==='point') { expect(g.value).toEqual({re,im}); expect(g.modulus).toBeCloseTo(Math.hypot(re as number,im as number)); }
  });
  it('does not invent an argument for zero',()=>expect(parseComplexGeometry('z=0')).toMatchObject({argument:null}));
  it('parses origin and shifted circles',()=>{
    expect(parseComplexGeometry('|z|=2')).toEqual({kind:'circle',center:{re:0,im:0},radius:2});
    expect(parseComplexGeometry('\\left|z-(1+i)\\right|=2')).toEqual({kind:'circle',center:{re:1,im:1},radius:2});
  });
  it('parses coordinate lines',()=>{
    expect(parseComplexGeometry('Re(z)=1')).toEqual({kind:'line',axis:'re',value:1});
    expect(parseComplexGeometry('\\operatorname{Im}(z)=-2')).toEqual({kind:'line',axis:'im',value:-2});
  });
  it.each(['|z|=-1','|z|=i','z^2=1','Re(z)=i','z=1=2','z=z+1'])('rejects ambiguous/unsupported geometry %s',s=>expect(()=>parseComplexGeometry(s)).toThrow());
});
describe('Additive state migration and isolation',()=>{
  it('loads a genuine v0.1.1 save without losing real data',()=>{
    const s = initialState(); const legacy = {version:1, theme:'dark', expressions:s.expressions, parameters:s.parameters};
    const loaded=decodeState(JSON.stringify(legacy)); expect(loaded.expressions).toEqual(s.expressions); expect(loaded.parameters).toEqual(s.parameters);
    expect(loaded.mode).toBe('real'); expect(loaded.complex.expressions).toHaveLength(2);
  });
  it('round trips both lists and independent views',()=>{
    const s=initialState();s.mode='complex';s.realViewport=[-2,2,2,-2];s.complex.viewport=[-7,3,7,-3];s.complex.expressions[0].latex='z=1/0';
    expect(decodeState(JSON.stringify(s))).toEqual(s);
  });
  it('recovers damaged complex records and view without touching real data',()=>{
    const s=initialState();const raw={...s,complex:{expressions:[null,...s.complex.expressions,s.complex.expressions[0]],viewport:[0,0,0,0]}};
    const loaded=decodeState(JSON.stringify(raw));expect(loaded.expressions).toEqual(s.expressions); expect(loaded.complex).toEqual(s.complex);
    expect(decodeState(JSON.stringify(loaded))).toEqual(loaded);
  });
  it('isolates a damaged real list from the complex mode',()=>{
    const s=initialState();s.complex.expressions[0].latex='z=9i';s.mode='complex';
    const recovered=decodeState(JSON.stringify({...s,expressions:null}));expect(recovered.complex).toEqual(s.complex);expect(recovered.mode).toBe('complex');
  });
  it('retains empty lists and independent modes',()=>{
    const s=initialState();s.complex.expressions=[];s.mode='complex';expect(decodeState(JSON.stringify(s))).toEqual(s);
  });
  it('rejects invalid viewports',()=>{for(const v of [[0,0,0,0],[NaN,1,2,0],[0,1,Infinity,0],['0',1,2,0]]) expect(validViewport(v)).toBe(false);});
});
