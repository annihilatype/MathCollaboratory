import { describe,it,expect } from 'vitest';
import { parseComplexGeometry } from '../complex/geometry';
import { complexSource } from '../complex/math';
import { parseMapping } from '../mapping/expression';
import { contains, type Region } from './model';
import { decodeState,initialState } from '../state/store';
describe('MathLive real/imaginary part spellings',()=>{
  it.each(['Re','\\Re','\\real','\\operatorname{Re}','\\mathrm{Re}','\\operatorname{\\mathrm{Re}}','\\mathop{\\mathrm{Re}}'])('%s',name=>{
    expect(parseComplexGeometry(`${name}(z)<2`)).toEqual(parseComplexGeometry('Re(z)<2'));
    expect(parseComplexGeometry(`${name}(z)=1`)).toEqual({kind:'line',axis:'re',value:1});
  });
  it.each(['Im','\\Im','\\imag','\\operatorname{Im}','\\mathrm{Im}','\\operatorname{\\mathrm{Im}}'])('%s',name=>expect(parseComplexGeometry(`${name}(z)>=0`)).toEqual(parseComplexGeometry('Im(z)>=0')));
  it.each(['Re','\\operatorname{Re}','\\operatorname{\\mathrm{Re}}'])('evaluates parts in mappings: %s',re=>{
    for(const p of [{re:2,im:3},{re:-1,im:-2},{re:0,im:0}]){
      expect(parseMapping(`w=${re}(z)+i*\\operatorname{\\mathrm{Im}}(z)`).evaluate(p)).toEqual(p);
      expect(parseMapping(`${re}(z)^2+Im(z)^2`).evaluate(p)).toEqual({re:p.re*p.re+p.im*p.im,im:0});
    }
  });
  it.each(['\\unknown(z)','\\operatorname{import}(z)','\\mathrm{constructor}(z)','\\really(z)'])('names unsafe commands in diagnostics: %s',s=>expect(()=>complexSource(s)).toThrow(/Команда \\/));
});
describe('Set-builder delimiters remain separate from TeX groups',()=>{
  it.each([
    ['{z: |z|<2}','|z|<2'],['{z: 1<|z|<2}','1<|z|<2'],['{z: Re(z)<2, Im(z)>0}','Re(z)<2 and Im(z)>0'],
    ['\\{z:|z|<2\\}','|z|<2'],['\\left\\{z:1<|z|<2\\right\\}','1<|z|<2'],
    ['\\left\\lbrace z:\\operatorname{\\mathrm{Re}}(z)<2,\\operatorname{\\mathrm{Im}}(z)>0\\right\\rbrace','Re(z)<2 and Im(z)>0'],
    ['{z: |z-\\frac{1+i}{2}|<\\dfrac32}','|z-(1+i)/2|<1.5'],
    ['\\{z\\colon Re(z)<2 \\land Im(z)>0\\}','Re(z)<2 and Im(z)>0'],
  ])('%s',(s,expected)=>expect(parseComplexGeometry(s)).toEqual(parseComplexGeometry(expected)));
  it('does not treat ordinary groups or fraction braces as sets',()=>{
    expect(parseComplexGeometry('{1+i}')).toMatchObject({kind:'point',value:{re:1,im:1}});
    expect(parseMapping('\\frac{z+\\frac1z}{2}').evaluate({re:2,im:0})).toEqual({re:1.25,im:0});
    const r=parseComplexGeometry('{z:Re(z)<2,Im(z)>0}') as Region;expect(contains(r,{re:1,im:1})).toBe(true);expect(contains(r,{re:1,im:-1})).toBe(false);
  });
  it.each(['{z:|z|<2','\\{z:|z|<2}','\\{x:|z|<2\\}','{z:}','{z:Re(z)<2,}','{z:Re(z)<2,,Im(z)>0}','{z:|z|<2} + 1','{z:z=1}','{z:|z|<random()}','{z:Re(z)<(2,3),Im(z)>0}'])('rejects malformed/unsafe set %s',s=>expect(()=>parseComplexGeometry(s)).toThrow());
  it('preserves old and new text over repeated storage restoration',()=>{
    const s=initialState();s.complex.expressions[0].latex='\\left\\lbrace z:1<|z|<2\\right\\rbrace';s.mapping.latex='exp(z)';s.mode='complex';s.mapping.enabled=true;
    expect(decodeState(JSON.stringify(decodeState(JSON.stringify(s))))).toEqual(s);
  });
});
