import { it, expect, describe } from 'vitest';
import { parseMapping } from './expression';
import { parseComplexGeometry } from '../complex/geometry';
import { parameterize, pointFormula } from './parameterize';
import { sampleImage } from './sample';
import { formatComplex } from './PointDetails';
import { initialState, decodeState } from '../state/store';
const view:[number,number,number,number]=[-5,5,5,-5];
describe('Controlled complex mappings',()=>{
  it.each([
    ['z',1,1,1,1],['w=z^2',1,1,0,2],['z^3',1,1,-2,2],['1/z',2,0,.5,0],
    ['z+1+i',-2,1,-1,2],['(z-1)/(z+1)',0,0,-1,0],['conj(z)',1,1,1,-1],['abs(z)',3,4,5,0],
    ['exp(z)',0,Math.PI,-1,0],['sin(z)',0,1,0,Math.sinh(1)],['cos(z)',0,1,Math.cosh(1),0],
    ['\\exp(z)',0,0,1,0],['\\sin(z)',Math.PI/2,0,1,0],['\\frac{1}{z}',2,0,.5,0],
  ])('%s at %s + %si',(s,re,im,wr,wi)=>{
    const result=parseMapping(s as string).evaluate({re:re as number,im:im as number});expect(result).not.toBeNull();
    expect(result!.re).toBeCloseTo(wr as number,11);expect(result!.im).toBeCloseTo(wi as number,11);
  });
  it.each(['1/z','(z-1)/(z+1)','exp(z)','0^0'])('returns a gap for poles and overflow: %s',s=>{
    const z=s==='1/z'?{re:0,im:0}:s.includes('z+1')?{re:-1,im:0}:{re:1000,im:0};expect(parseMapping(s).evaluate(z)).toBeNull();
  });
  it.each(['import("x")','z=1','w=z=1','z[0]','[z]','foo(z)','x+z','2;3','z!','z<1'])('rejects %s before evaluation',s=>expect(()=>parseMapping(s)).toThrow());
  it('enforces length and AST budgets',()=>{
    expect(()=>parseMapping('z'.repeat(501))).toThrow(/длинное/);
    expect(()=>parseMapping(Array(50).fill('z').join('+'))).toThrow(/сложное/);
  });
});
describe('Parametric curves and adaptive images',()=>{
  it('uses the entire segment and supports complex endpoints',()=>{
    const f=parameterize(parseComplexGeometry('segment(-1-i,1+i)'))!;
    expect(f(0)).toEqual({re:-1,im:-1});expect(f(.5)).toEqual({re:0,im:0});expect(f(1)).toEqual({re:1,im:1});
  });
  it('maps the unit circle twice under z², preserving its set',()=>{
    const curve=parameterize(parseComplexGeometry('|z|=1'))!,mapping=parseMapping('z^2');
    let winding=0,last=mapping.evaluate(curve(0))!;
    for(let i=1;i<=128;i++){const w=mapping.evaluate(curve(i/128))!;expect(Math.hypot(w.re,w.im)).toBeCloseTo(1,11);winding+=Math.atan2(last.re*w.im-last.im*w.re,last.re*w.re+last.im*w.im);last=w;}
    expect(winding).toBeCloseTo(4*Math.PI,10);
    const path=sampleImage(curve,mapping,view,60);expect(path.truncated).toBe(false);expect(path.xs.length).toBeGreaterThan(64);
    path.xs.forEach((x,i)=>expect(Math.hypot(x,path.ys[i])).toBeCloseTo(1,10));
  });
  it.each(['1/z','1/(z-0.123)'])('never joins opposite branches across a segment pole: %s',source=>{
    const curve=parameterize(parseComplexGeometry('segment(-1,1)'))!;
    const path=sampleImage(curve,parseMapping(source),view,60,2048);
    expect(path.xs.some(Number.isNaN)).toBe(true);expect(path.xs.some(x=>x<0)).toBe(true);expect(path.xs.some(x=>x>0)).toBe(true);
    for(let i=1;i<path.xs.length;i++)if(Number.isFinite(path.xs[i])&&Number.isFinite(path.xs[i-1]))expect(path.xs[i]*path.xs[i-1]).toBeGreaterThan(0);
    expect(path.evaluations).toBeLessThanOrEqual(2048);
  });
  it('drops unresolved intervals when the evaluation budget is exhausted',()=>{
    const path=sampleImage(parameterize(parseComplexGeometry('|z|=2'))!,parseMapping('exp(100z)'),view,100,40);
    expect(path.evaluations).toBeLessThanOrEqual(40);expect(path.truncated).toBe(true);expect(path.xs.some(Number.isNaN)||path.xs.length===0).toBe(true);
  });
  it('serializes a dragged point to a safe editable formula',()=>expect(parseComplexGeometry(pointFormula({re:-1.25,im:2.5}))).toMatchObject({kind:'point',value:{re:-1.25,im:2.5}}));
});
describe('Migration of mapping settings',()=>{
  it('preserves old objects and viewports while adding mapping defaults',()=>{
    const s=initialState();const {mapping,...old}=s;const restored=decodeState(JSON.stringify(old));
    expect(restored).toEqual(s);expect(restored.mapping.enabled).toBe(false);
  });
  it('round trips enabled state, invalid editable formulas and independent viewports',()=>{
    const s=initialState();s.mapping={enabled:true,latex:'z+',viewport:[-2,2,2,-2]};s.complex.viewport=[-8,4,8,-4];
    expect(decodeState(JSON.stringify(s))).toEqual(s);
  });
  it('isolates malformed mapping settings from healthy geometry',()=>{
    const s=initialState(),restored=decodeState(JSON.stringify({...s,mapping:{enabled:'yes',latex:null,viewport:[0,0,0,0]}}));
    expect(restored).toEqual(s);
  });
});

it('integer powers do not invent noise, and formatting retains genuinely small components',()=>{
  expect(parseMapping('z^2').evaluate({re:1,im:1})).toEqual({re:0,im:2});
  expect(formatComplex({re:1e-20,im:0})).toContain('1e-20');
  expect(formatComplex({re:1e20,im:100})).toContain('100i');
});

it('rejects undefined source coordinates even for a constant map',()=>{
  expect(parseMapping('1').evaluate({re:Infinity,im:0})).toBeNull();
  expect(parameterize({kind:'segment',start:{re:1e308,im:0},end:{re:-1e308,im:0}})!(.5)).toEqual({re:0,im:0});
});
it('breaks a circle image at a pole lying on the circle',()=>{
  const path=sampleImage(parameterize(parseComplexGeometry('|z-1|=1'))!,parseMapping('1/z'),[-5,5,5,-5],60);
  expect(path.xs.some(Number.isNaN)).toBe(true);
  path.xs.forEach((x,i)=>{if(Number.isFinite(x)&&Math.abs(path.ys[i])<20)expect(x).toBeCloseTo(.5,7);});
});

it('separates a finite mathematical result from the rendering cutoff',()=>{
  expect(parseMapping('z').evaluate({re:1e12,im:0})).toEqual({re:1e12,im:0});
  const path=sampleImage(parameterize(parseComplexGeometry('segment(1e12,2e12)'))!,parseMapping('z'),view,60);
  expect(path.xs.filter(Number.isFinite)).toHaveLength(0);
});

it('represents a collapsed curve image as a single finite point set',()=>{
  const path=sampleImage(parameterize(parseComplexGeometry('|z|=1'))!,parseMapping('abs(z)'),view,60);
  expect(path.truncated).toBe(false);expect(path.xs.length).toBeGreaterThan(0);
  path.xs.forEach((x,i)=>{expect(x).toBeCloseTo(1,12);expect(path.ys[i]).toBe(0);});
});
