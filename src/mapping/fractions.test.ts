import { it, expect, describe } from 'vitest';
import { parseMapping } from './expression';
import { parseComplexGeometry } from '../complex/geometry';
describe('MathLive fractions, including legal single-token TeX arguments',()=>{
  it.each([
    ['(z+1/z)/2',1.25,0],['1/2 (z+1/z)',1.25,0],['1/2 (1+1/z)',.75,0],
    ['w=\\frac{z+\\frac{1}{z}}{2}',1.25,0],
    ['\\frac{1}{2}\\left(z+\\frac{1}{z}\\right)',1.25,0],
    ['\\dfrac{z+\\frac{1}{z}}{2}',1.25,0],['\\tfrac{1}{2}(1+\\frac{1}{z})',.75,0],
    ['\\frac12(z+\\frac1z)',1.25,0],['\\dfrac12(1+\\tfrac1z)',.75,0],
    ['\\frac{1}{\\frac{z+1}{2}}',2/3,0],['\\frac1{\\frac{z+1}{2}}',2/3,0],
  ])('%s',(s,re,im)=>{const w=parseMapping(s).evaluate({re:2,im:0})!;expect(w.re).toBeCloseTo(re,12);expect(w.im).toBeCloseTo(im,12);});
  it.each(['(z+1/z)/2','\\frac12(z+\\frac1z)','\\dfrac{z+\\frac{1}{z}}{2}'])('Joukowski formula and pole: %s',s=>{
    const f=parseMapping(s);for(const z of [{re:1,im:1},{re:-2,im:0},{re:0,im:2}]){
      const w=f.evaluate(z)!;const norm=z.re*z.re+z.im*z.im;expect(w.re).toBeCloseTo((z.re+z.re/norm)/2,12);expect(w.im).toBeCloseTo((z.im-z.im/norm)/2,12);
    }expect(f.evaluate({re:0,im:0})).toBeNull();
  });
  it.each(['\\frac','\\frac{1}','\\frac{}{z}','\\dfrac{1}{}','\\frac{1}{z','\\frac1-','\\frac{1}{\\unknown{z}}','\\frac{1}{z[0]}'])('diagnoses missing/unsafe fraction arguments: %s',s=>expect(()=>parseMapping(s)).toThrow());
  it('fractions also work in source complex coordinates',()=>expect(parseComplexGeometry('z=\\dfrac{1+i}{2}')).toMatchObject({value:{re:.5,im:.5}}));
});
