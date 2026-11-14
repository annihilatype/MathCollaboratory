import {it,expect,describe} from 'vitest';
import {parseComplexGeometry} from '../complex/geometry';
import {parseMapping} from '../mapping/expression';
import {complexParameters} from '../complex/parameters';
import {analyzeWithParameters,suggestedParameter} from '../complex/analyze';
import {contains,type Region} from './model';
import {inversePlan,imageContains,tileRegionImage,classifyImageBox} from './inverse';
import {mapRegion} from './transform';
import {parameterize} from '../mapping/parameterize';
import {sampleImage} from '../mapping/sample';
import {initialState,decodeState,normalizeParameter} from '../state/store';
const R=(s:string,p:Record<string,number>={})=>parseComplexGeometry(s,p) as Region;
function image(s:string,f:string,p:Record<string,number>={}){
  const r=R(s,p),m=parseMapping(f,p);expect(m.regionTransform).toBeDefined();const plan=inversePlan(r,m.regionTransform!)!;expect(plan).not.toBeNull();return (x:number,y=0)=>imageContains(plan,{re:x,im:y});
}
describe('Twelve university scenarios — membership, boundaries, topology',()=>{
  it.each([2,3,4])('1: open quadrant under z^%s',n=>{
    const has=image('{z:0<arg(z)<pi/2}',`z^${n}`);expect(has(0)).toBe(false);expect(has(0,1)).toBe(true);expect(has(1)).toBe(false);expect(has(-1)).toBe(n!==2);expect(has(0,-1)).toBe(n===4);
  });
  it('2: upper half plane squared omits the nonnegative real ray',()=>{
    const has=image('{z:Im(z)>0}','z^2');expect(has(1)).toBe(false);expect(has(-1)).toBe(true);expect(has(0,1)).toBe(true);expect(has(0)).toBe(false);
  });
  it('3: lifted 225–270 degree window has the intended second-quadrant image',()=>{
    const r=R('{z:|z|<1,5*pi/4<arg(z)<3*pi/2}');expect(r.angleConvention).toContain('2π');expect(contains(r,{re:-.5,im:-.6})).toBe(true);
    const has=image('{z:|z|<1,5*pi/4<arg(z)<3*pi/2}','z^2');expect(has(-.2,.2)).toBe(true);expect(has(.2,.2)).toBe(false);expect(has(-1)).toBe(false);
  });
  it('4: eighth power preserves excluded [0,1] and the angular slit',()=>{
    const has=image('{z:|arg(z)|<pi/8,z notin [0,1]}','z^8');expect(has(2)).toBe(true);expect(has(.5)).toBe(false);expect(has(1)).toBe(false);expect(has(-2)).toBe(false);expect(has(0,1)).toBe(true);
  });
  it('5–6: infinite horizontal strips under exp give right half-plane / slit plane',()=>{
    const right=image('{z:|Im(z)|<pi/2}','exp(z)'),slit=image('{z:|Im(z)|<pi}','exp(z)');
    for(const v of [.001,1,1e5]){expect(right(v)).toBe(true);expect(slit(v)).toBe(true);}
    expect(right(0,1)).toBe(false);expect(right(-1)).toBe(false);expect(slit(0,1)).toBe(true);expect(slit(-1)).toBe(false);expect(slit(0)).toBe(false);
  });
  it('7: exp(2z) maps an unbounded half-strip to upper exterior half-disk',()=>{
    const has=image('{z:0<Im(z)<pi/2,Re(z)>0}','exp(2*z)');expect(has(0,2)).toBe(true);expect(has(0,.5)).toBe(false);expect(has(2)).toBe(false);expect(has(0,-2)).toBe(false);
  });
  it('8: Joukowski of the first-quadrant unit quarter-disk',()=>{
    const has=image('{z:|z|<1,0<arg(z)<pi/2}','(z+1/z)/2');expect(has(.75,-.25)).toBe(true);expect(has(.75,.25)).toBe(false);expect(has(0)).toBe(false);expect(has(2)).toBe(false);
  });
  it('9: Joukowski exterior of radius 2 is the exterior of the ellipse (1.25,.75)',()=>{
    const has=image('{z:|z|>2}','(z+1/z)/2');expect(has(2)).toBe(true);expect(has(0,1)).toBe(true);expect(has(0)).toBe(false);expect(has(1)).toBe(false);expect(has(1.25)).toBe(false);
  });
  it('Joukowski boundary circle becomes an ellipse with strict exterior preserved',()=>{const has=image('|z|>2','(z+1/z)/2'),f=parseMapping('(z+1/z)/2');for(let k=0;k<32;k++){const a=k*Math.PI/16,w=f.evaluate({re:2*Math.cos(a),im:2*Math.sin(a)})!;expect((w.re/1.25)**2+(w.im/.75)**2).toBeCloseTo(1,12);expect(has(w.re,w.im)).toBe(false);expect(has(w.re*1.01,w.im*1.01)).toBe(true);}});
  it('10: Joukowski on an unbounded upper sector includes both imaginary directions',()=>{
    const has=image('{z:pi/4<arg(z)<3*pi/4}','(z+1/z)/2');expect(has(0,1)).toBe(true);expect(has(0,-1)).toBe(true);expect(has(0)).toBe(true);expect(has(2)).toBe(false);expect(has(1)).toBe(false);
  });
  it('11: parameterized vertical line maps to a parabola',()=>{
    const f=parameterize(parseComplexGeometry('Re(z)=a',{a:2}))!,m=parseMapping('z^2');
    expect(m.evaluate(f(.5))).toEqual({re:4,im:0});const w=m.evaluate(f(.75))!;expect(w.re).toBeCloseTo(3,10);expect(w.im).toBeCloseTo(4,10);
    const sample=sampleImage(f,m,[-5,6,8,-6],50);expect(sample.evaluations).toBeLessThanOrEqual(2048);expect(sample.xs.some(Number.isFinite)).toBe(true);
  });
  it('12: restricted circle is a one-dimensional arc, never an area',()=>{
    const r=R('{z:|z|=rho,|arg(z)|<pi/4}',{rho:2}),has=image('{z:|z|=rho,|arg(z)|<pi/4}','z^2',{rho:2});
    expect(has(4)).toBe(true);expect(has(0,4)).toBe(false);expect(has(1)).toBe(false);expect(parameterize(r)).not.toBeNull();
    const path=sampleImage(parameterize(r)!,parseMapping('z^2'),[-5,5,5,-5],50);expect(path.xs.some(Number.isFinite)).toBe(true);path.xs.forEach((x,i)=>{if(Number.isFinite(x))expect(Math.hypot(x,path.ys[i])).toBeCloseTo(4,9);});
  });
});
describe('General domain algebra and exclusions',()=>{
  it.each([
    ['arg(z)<pi/2',[-1,-1],[0,0]],['|Re(z)|<a',[.5,10],[2,0]],['z != 0',[1,0],[0,0]],
    ['(Re(z)<0 or Im(z)>1) and |z|<3',[-1,0],[1,0]],['z notin [0,1]',[.5,.001],[.5,0]],
    ['{z:Re(z)<2,Im(z)>0,|z|<3,z!=i}',[1,1],[0,1]],['{z:|Im(z)|<pi/2}',[5,1],[0,2]],
  ])('%s',(s,inside,outside)=>{const r=R(s as string,{a:1});expect(contains(r,{re:inside[0] as number,im:inside[1] as number})).toBe(true);expect(contains(r,{re:outside[0] as number,im:outside[1] as number})).toBe(false);});
  it('rejects a closed zero-width window explicitly instead of drawing an empty ray',()=>expect(()=>R('0<=arg(z)<=0')).toThrow(/луч/));
  it.each([['|arg(z)|>0',false],['|arg(z)|>=0',true],['|arg(z)|<0',false],['|arg(z)|<=pi',true]])('handles zero/full absolute argument windows %s',(s,expected)=>expect(contains(R(s as string),{re:1,im:0})).toBe(expected));
  it('a closed zero-width strip is a curve, not an empty area',()=>{const r=R('|Im(z)|<=0');expect(r.equality?.kind).toBe('line');expect(parameterize(r)).not.toBeNull();});
  it('Arg has a principal value in (-pi,pi] and is undefined at zero',()=>{
    expect(parseMapping('arg(z)').evaluate({re:-1,im:-0})).toEqual({re:Math.PI,im:0});expect(parseMapping('arg(z)').evaluate({re:0,im:0})).toBeNull();
    expect(contains(R('arg(z)<=pi'),{re:-1,im:0})).toBe(true);expect(contains(R('arg(z)<pi'),{re:-1,im:0})).toBe(false);
  });
  it('accepts MathLive thin spaces and bracket commands without splitting segment endpoints',()=>{const r=R('\\left\\lbrace z:z\\,\\notin\\,\\left\\lbrack0,1\\right\\rbrack\\right\\rbrace');expect(contains(r,{re:.5,im:0})).toBe(false);expect(contains(r,{re:.5,im:1})).toBe(true);});
  it('complementary closed half-planes and a full angular window cover the whole plane except the argument origin',()=>{for(const p of [{re:0,im:0},{re:0,im:1},{re:-1,im:0},{re:1,im:0}])expect(contains(R('Re(z)<=0 or Re(z)>=0'),p)).toBe(true);expect(R('arg(z)<=pi').constraints).toHaveLength(0);expect(contains(R('arg(z)<=pi'),{re:0,im:0})).toBe(false);});
  it('supports arbitrary complex endpoints of excluded segments',()=>{
    const r=R('z notin [1+i,2+2i]');expect(contains(r,{re:1.5,im:1.5})).toBe(false);expect(contains(r,{re:1.5,im:1.6})).toBe(true);
  });
  it.each(['{z:|z|<random()}','{z:z notin [0,import(1)]}','z notin [0,1,2]','{z:Re(z)<2=1}'])('rejects unsafe or ambiguous %s',s=>expect(()=>R(s)).toThrow());
});
describe('Parameters, constants and storage',()=>{
  it.each([['Re(z)=a',['a']],['Im(z)>a',['a']],['|z|=\\rho',['rho']],['|z-a|<r',['a','r']],['|z-a_{1}|<r',['a_1','r']],['w=a*z+b',['a','b']],['w=exp(a*z)',['a']],['w=z^n',['n']]])('%s dependencies',(s,names)=>expect(complexParameters(s as string)).toEqual(names));
  it('shares scope in geometry/mapping and rebinds on changes',()=>{
    for(const a of [-2,0,2]){expect(parseComplexGeometry('Re(z)=a',{a})).toMatchObject({value:a});expect(parseMapping('a*z+b',{a,b:1}).evaluate({re:1,im:2})).toEqual({re:a+1,im:2*a});}
    expect(complexParameters('z+pi+e+i')).toEqual([]);expect(parseMapping('pi+e+i',{pi:0,e:0,i:0}).evaluate({re:0,im:0})).toEqual({re:Math.PI+Math.E,im:1});
    expect(analyzeWithParameters('|z|<rho',{},parseComplexGeometry).parameters).toEqual(['rho']);expect(analyzeWithParameters('|z|<rho',{},parseComplexGeometry).error).toContain('Создайте');
  });
  it('positive/integer controls validate and migrate without changing old records',()=>{
    expect(normalizeParameter({...suggestedParameter('n'),value:2.5})).toBeNull();expect(normalizeParameter({...suggestedParameter('rho'),min:-1})).toBeNull();
    const s=initialState();s.parameters.rho=suggestedParameter('rho');s.parameters.n=suggestedParameter('n');expect(decodeState(JSON.stringify(s))).toEqual(s);
    expect(decodeState(JSON.stringify({...s,parameters:{...s.parameters,rho:{value:'bad'},n:s.parameters.n}})).parameters.n).toEqual(s.parameters.n);
  });
  it.each(['constructor(z)','w=z+import(1)','w=z[0]','w=z+prototype'])('does not discover dangerous names as ordinary parameters: %s',s=>expect(()=>complexParameters(s)).toThrow());
});
describe('Generalized inverse families and bounded work',()=>{
  it.each(['(z+1/z)/2','1/2*(z+1/z)','(z^2+1)/(2*z)'])('recognizes Joukowski structurally: %s',s=>expect(parseMapping(s).regionTransform?.kind).toBe('joukowski'));
  it.each([4,8,16])('positive integer power %s supports unbounded sectors',n=>{const r=R('|arg(z)|<pi/16'),m=parseMapping('z^n',{n});expect(mapRegion(r,m).accuracy).toBe('approximate');});
  it('affine exp and Möbius respect runtime parameters',()=>{
    const exp=image('|Im(z)|<pi/4','exp(a*z+b)',{a:2,b:1});expect(exp(2)).toBe(true);expect(exp(-2)).toBe(false);
    const r=R('|z|<1'),m=parseMapping('(a*z+b)/(c*z+d)',{a:2,b:1,c:1,d:2}),mapped=mapRegion(r,m);expect(mapped.accuracy).toBe('exact');expect(contains(mapped.region!,{re:.5,im:0})).toBe(true);
  });
  it.each([['{z:|z|<1,0<arg(z)<pi/2}','(z+1/z)/2'],['{z:|arg(z)|<pi/8,z notin [0,1]}','z^8'],['{z:|Im(z)|<pi/2}','exp(z)']])('every filled cell has inverse witnesses: %s',(s,f)=>{
    const m=parseMapping(f),p=inversePlan(R(s),m.regionTransform!)!;const t=tileRegionImage(p,[-4,4,4,-4],35,1500);expect(t.evaluations).toBeLessThanOrEqual(1500);expect(t.inside.length).toBeGreaterThan(0);
    for(const c of t.inside)for(const a of [.01,.5,.99])for(const b of [.01,.5,.99])expect(imageContains(p,{re:c[0]+a*(c[1]-c[0]),im:c[2]+b*(c[3]-c[2])})).toBe(true);
  });
  it('exclusions cannot be crossed by a certified filled cell',()=>{const p=inversePlan(R('|arg(z)|<pi/8 and z notin [0,1]'),{kind:'power',exponent:8})!;expect(classifyImageBox(p,[.49,.51,-.001,.001])).not.toBe(1);});
});
