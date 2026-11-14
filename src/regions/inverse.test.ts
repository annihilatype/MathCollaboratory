import { describe,it,expect } from 'vitest';
import { parseComplexGeometry } from '../complex/geometry';
import { parseMapping } from '../mapping/expression';
import { contains, type Region } from './model';
import { inversePlan, imageContains, classifyImageBox, tileRegionImage, type Box, type InversePlan } from './inverse';
import { mapRegion } from './transform';
const source=(s:string)=>parseComplexGeometry(s) as Region;
const plan=(s:string,kind:'exponential'|'power'='exponential',exponent=2)=>inversePlan(source(s),kind==='power'?{kind,exponent}:{kind})!;
const pt=(p:InversePlan,x:number,y=0)=>imageContains(p,{re:x,im:y});
const covered=(cells:Box[],x:number,y:number)=>cells.some(c=>x>c[0]&&x<c[1]&&y>c[2]&&y<c[3]);
describe('All inverse branches and trustworthy interior cells',()=>{
  it('maps 1<|z|<2 under exp without filling its hole or negative axis',()=>{
    const p=plan('1<|z|<2');expect(pt(p,Math.exp(1.5))).toBe(true);expect(pt(p,1)).toBe(false);expect(pt(p,-1)).toBe(false);expect(pt(p,0)).toBe(false);
    expect(pt(p,Math.cos(1.5),Math.sin(1.5))).toBe(true);expect(pt(p,Math.exp(2.1))).toBe(false);
    const t=tileRegionImage(p,[-1,4,8,-4],60,6144);
    expect(t.inside.length).toBeGreaterThan(10);expect(covered(t.inside,4.3,.13)).toBe(true);expect(covered(t.inside,1,0)).toBe(false);expect(t.evaluations).toBeLessThanOrEqual(6144);
  });
  it('does not rely on the principal logarithm for periodic/non-injective domains',()=>{
    const p=plan('|z-6.283185307179586i|<1');expect(pt(p,1)).toBe(true);expect(pt(p,10)).toBe(false);
    const ring=plan('5<|z|<7');expect(pt(ring,1)).toBe(true);expect(classifyImageBox(ring,[.99,1.01,-.01,.01])).toBe(1);
  });
  it.each([2,3])('enumerates all %s roots for shifted disks and clipped disks',n=>{
    const p=plan('|z-1|<1.5','power',n),f=parseMapping(`z^${n}`);
    for(let x=-.4;x<2.4;x+=.17)for(let y=-1.4;y<1.4;y+=.23){const z={re:x,im:y};if(contains(p.source,z)){const w=f.evaluate(z)!;expect(imageContains(p,w)).toBe(true);}}
    const clipped=plan('|z|<2 and Im(z)>0','power',n);expect(pt(clipped,1,0)).toBe(n===3); // cubic root in the upper half disk, square roots only real
  });
  it('keeps strict/closed source membership distinct',()=>{
    const open=plan('|z|<2'),closed=plan('|z|<=2');expect(pt(open,Math.exp(2))).toBe(false);expect(pt(closed,Math.exp(2))).toBe(true);
  });
  it('treats cell enclosures conservatively around zero and across the logarithm cut',()=>{
    const p=plan('|z|<4');expect(classifyImageBox(p,[.99,1.01,-.01,.01])).toBe(1);
    expect(classifyImageBox(plan('1<|z|<2'),[-1.1,-.9,-.02,.02])).toBe(-1);
    expect(classifyImageBox(plan('|z|<2'),[-.01,.01,-.01,.01])).not.toBe(1);
  });
  it.each([['1<|z|<2','exp(z)'],['|z-1|<1.5','z^2'],['|z-1-i|<=1','z^3']])('every filled cell has valid inverse witnesses: %s / %s',(s,f)=>{
    const p=mapRegion(source(s),parseMapping(f)).approximation!;expect(p).toBeDefined();
    const t=tileRegionImage(p,[-4,4,6,-4],40,4096);expect(t.inside.length).toBeGreaterThan(0);
    for(const c of t.inside)for(const u of [.01,.5,.99])for(const v of [.01,.5,.99])expect(pt(p,c[0]+u*(c[1]-c[0]),c[2]+v*(c[3]-c[2]))).toBe(true);
    let overlap=false;for(let i=0;i<t.inside.length;i++)for(let j=i+1;j<t.inside.length;j++){const a=t.inside[i],b=t.inside[j];if(Math.min(a[1],b[1])>Math.max(a[0],b[0])&&Math.min(a[3],b[3])>Math.max(a[2],b[2]))overlap=true;}expect(overlap).toBe(false);
  });
  it('bounds work and exposes unresolved cells rather than inventing a fill',()=>{
    const p=plan('1<|z|<2'),t=tileRegionImage(p,[-5,5,5,-5],80,20);expect(t.evaluations).toBeLessThanOrEqual(20);expect(t.truncated).toBe(true);expect(t.unresolved.length).toBeGreaterThan(0);expect(t.maxUncertaintyPx).toBeGreaterThan(2);
    const next=tileRegionImage(p,[0,2,4,-2],120,1024);expect(next.evaluations).toBeLessThanOrEqual(1024);
  });
  it('preserves exact radial and Möbius paths, and refuses unsupported/unbounded domains',()=>{
    for(const [s,f] of [['|z|<2','z^2'],['|z|<=2','1/z'],['Im(z)>=0','conj(z)']])expect(mapRegion(source(s),parseMapping(f)).accuracy).toBe('exact');
    for(const [s,f] of [['Re(z)<2','exp(z)'],['|z|<200','exp(z)'],['|z|<2','sin(z)']]){const m=mapRegion(source(s),parseMapping(f));expect(m.accuracy).toBe('unsupported');expect(m.approximation).toBeUndefined();}
  });
});
