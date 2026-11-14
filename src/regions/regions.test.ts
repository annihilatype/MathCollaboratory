import { describe, it, expect } from 'vitest';
import { parseComplexGeometry } from '../complex/geometry';
import { parseMapping } from '../mapping/expression';
import { contains, boundary, type Region } from './model';
import { mapRegion } from './transform';
import { halfplanePolygon } from './render';
import { initialState, decodeState } from '../state/store';
const region=(s:string)=>{const g=parseComplexGeometry(s);expect(g.kind).toBe('region');return g as Region;};
const image=(s:string,f:string)=>{const result=mapRegion(region(s),parseMapping(f));expect(result.notice).toBe('');expect(result.region).not.toBeNull();return result.region!;};
const has=(r:Region,re:number,im=0)=>contains(r,{re,im});
describe('Structured inequalities and intersections',()=>{
  it.each([
    ['Re(z)<2',[[1,0],[1,-10]],[[2,0],[3,1]]],
    ['Re(z)>=2',[[2,0],[3,-10]],[[1,0],[0,1]]],
    ['Im(z)>0',[[1,1],[-3,2]],[[0,0],[1,-1]]],
    ['Im(z)<=0',[[1,0],[-3,-2]],[[0,1],[1,2]]],
    ['|z|<2',[[0,0],[1,1]],[[2,0],[0,-2]]],
    ['|z|<=2',[[0,0],[2,0]],[[3,0],[0,-3]]],
    ['|z-(1+i)|<2',[[1,1],[2,2]],[[3,1],[1,-1]]],
    ['1<|z|<3',[[2,0],[0,-2]],[[0,0],[1,0],[3,0]]],
    ['Re(z)<2 and Im(z)>=0',[[1,0],[0,2]],[[2,1],[1,-1]]],
    ['1<=|z|<=3 and Re(z)>0',[[1,0],[3,0]],[[0,2],[-2,0],[0,0]]],
    ['\\operatorname{Re}(z)\\le 2 \\land \\operatorname{Im}(z)\\geq 0',[[2,0],[1,1]],[[3,1],[1,-1]]],
    ['2>Re(z)',[[1,0]],[[2,0]]],
    ['|z|<1 and |z-3|<1',[],[[0,0],[1.5,0],[3,0]]],
  ])('%s',(s,inside,outside)=>{
    const r=region(s as string);for(const [x,y] of inside as number[][])expect(has(r,x,y)).toBe(true);for(const [x,y] of outside as number[][])expect(has(r,x,y)).toBe(false);
  });
  it.each(['|z^2|<2','|2z|<2','Re(z+1)<2','Re(z)<i','|z|<-1','|z|<0','z<2','Re(z)<2=1','1<z<3','Re(z)<[2]','Re(z)<random()','Re(z)<2;3','Re(z)<2 and z=1'])('rejects unsupported/unsafe %s',s=>expect(()=>region(s)).toThrow());
  it.each(['|z|<1e-200','|z-1e100|<1','|z|<1e200'])('diagnoses unrepresentable geometry instead of changing its set: %s',s=>expect(()=>region(s)).toThrow(/точност|велики/));
  it('normalizes circles and clips a half-plane to a viewport',()=>{
    expect(boundary(region('|z-1-i|<2').constraints[0])).toEqual({kind:'circle',x:1,y:1,radius:2,inside:true});
    const poly=halfplanePolygon(region('Re(z)<1').constraints[0],[-5,5,5,-5]);expect(poly).toHaveLength(4);expect(Math.max(...poly.map(p=>p[0]))).toBe(1);
  });
});
describe('Exact region images',()=>{
  it.each(['<','<='])('radial disks and rings under z², strict %s',op=>{
    const disk=image(`|z|${op}2`,'z^2');expect(has(disk,3)).toBe(true);expect(has(disk,4)).toBe(op==='<=');expect(has(disk,4.1)).toBe(false);
    const ring=image(`1${op}|z|${op}3`,'z^2');expect(has(ring,2)).toBe(true);expect(has(ring,.9)).toBe(false);expect(has(ring,9)).toBe(op==='<=');
  });
  it.each(['<','<='])('inversion maps interior to exterior and retains boundary %s',op=>{
    const r=image(`|z|${op}2`,'1/z');expect(has(r,1)).toBe(true);expect(has(r,.25)).toBe(false);expect(has(r,.5)).toBe(op==='<=');expect(has(r,0)).toBe(false);
  });
  it('inversion maps exterior to a punctured disk, never filling zero',()=>{
    const r=image('|z|>=2','1/z');expect(has(r,.25)).toBe(true);expect(has(r,.5)).toBe(true);expect(has(r,1)).toBe(false);expect(has(r,0)).toBe(false);expect(r.excluded).toContainEqual({re:0,im:0});
  });
  it('inversion of shifted circles and half-planes includes poles only as exclusions',()=>{
    const circle=image('|z-1|<=1','1/z');expect(has(circle,.5)).toBe(true);expect(has(circle,2)).toBe(true);expect(has(circle,0)).toBe(false);expect(has(circle,.4)).toBe(false);
    const plane=image('Re(z)>=0','1/z');expect(has(plane,0,1)).toBe(true);expect(has(plane,1)).toBe(true);expect(has(plane,-1)).toBe(false);expect(has(plane,0)).toBe(false);
  });
  it('translation, rotation, conjugation and intersections are exact',()=>{
    const shifted=image('|z-1-i|<2','z+1');expect(has(shifted,2,1)).toBe(true);expect(has(shifted,4,1)).toBe(false);
    const conjugated=image('Im(z)>0 and |z|<=2','conj(z)');expect(has(conjugated,0,-1)).toBe(true);expect(has(conjugated,0,1)).toBe(false);expect(has(conjugated,0,-2)).toBe(true);
    const rotated=image('Re(z)>0','i*z');expect(has(rotated,0,1)).toBe(true);expect(has(rotated,0,-1)).toBe(false);
  });
  it.each(['z','z+1+i','2z-1','i*z','1/z','(z-1)/(z+1)','conj(z)','1/(conj(z)-1)','1/(1/z)','conj((z-1)/(z+1))'])('compares forward membership with analytic image: %s',f=>{
    const mapping=parseMapping(f),source=region('Re(z)<2 and |z-1-i|>=0.5'),target=mapRegion(source,mapping).region!;expect(target).not.toBeNull();
    for(let x=-3;x<=3;x+=.37)for(let y=-3;y<=3;y+=.41){const p={re:x,im:y},w=mapping.evaluate(p);if(w)expect(contains(target,w)).toBe(contains(source,p));}
  });
  it('maps the entire unbounded set, including sources outside the z viewport',()=>{
    const r=image('Re(z)>=10','1/z');expect(has(r,.05)).toBe(true);expect(has(r,.001)).toBe(true);expect(has(r,.2)).toBe(false);expect(has(r,0)).toBe(false);
  });
  it('retains domain holes through nested reciprocal cancellations',()=>{
    const r=image('|z|<2','1/(1/z)');expect(has(r,1)).toBe(true);expect(has(r,0)).toBe(false);
    const shifted=image('|z|<2','1/(1/z)+1');expect(has(shifted,1)).toBe(false);expect(has(shifted,2)).toBe(true);
  });
  it.each([['|z|<2','ln(z)'],['|z|<2','abs(z)'],['|z|<2','z-z'],['|z|<2','z/z']])('does not invent a fill for %s under %s',(s,f)=>{
    const result=mapRegion(region(s),parseMapping(f));expect(result.region).toBeNull();expect(result.notice).toMatch(/не закрашен/);
  });
});
it('round trips v0.4 regions and damaged editable records with the v0.3 storage format',()=>{
  const s=initialState();s.mode='complex';s.mapping.enabled=true;s.mapping.latex='\\frac12(z+\\frac1z)';s.complex.expressions[0].latex='1<|z|<3 and Im(z)>=0';s.complex.expressions[1].latex='|z|<';
  expect(decodeState(JSON.stringify(s))).toEqual(s);expect(decodeState(JSON.stringify(decodeState(JSON.stringify(s))))).toEqual(s);
});
