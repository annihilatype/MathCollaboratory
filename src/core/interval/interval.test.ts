import {describe,it,expect,vi} from 'vitest';
import * as R from './real';
import * as C from './complex';
import {compileIntervalExpression,compileIntervalRegion,compileIntervalMobius,classifyIntervalImage,encloseExpression,classifyIntervalRegion,type IntervalProgram} from './program';
import {classifyCoefficientRegion} from './geometry';
import {prepareIntervalSubdivision,type IntervalSubdivisionRequest} from './subdivision';
import {valueOf,type Validation} from '../results';
import {analyzeSourceBox} from '../regions/inverse';
import {syntaxCacheStats} from '../syntax/ast';
// Independent exact oracle: parse JS's exact base-2 representation, rather
// than using the implementation's float-bit decomposition or rounded mathjs.
type Q={n:bigint;d:bigint};
function q(x:number):Q {const [a,b='']=Math.abs(x).toString(2).split('.');return {n:BigInt('0b'+a+b)*(x<0?-1n:1n),d:1n<<BigInt(b.length)};}
const add=(a:Q,b:Q):Q=>({n:a.n*b.d+b.n*a.d,d:a.d*b.d});
const mul=(a:Q,b:Q):Q=>({n:a.n*b.n,d:a.d*b.d});
const neg=(a:Q):Q=>({...a,n:-a.n});
const div=(a:Q,b:Q):Q=>({n:a.n*b.d*(b.n<0n?-1n:1n),d:a.d*(b.n<0n?-b.n:b.n)});
const compare=(a:Q,b:Q)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
function encloses(a:R.Interval,x:Q){expect(a.lower===-Infinity||compare(q(a.lower),x)<=0).toBe(true);expect(a.upper===Infinity||compare(q(a.upper),x)>=0).toBe(true);}
function ok<T>(v:Validation<T>):T {if(!v.ok)throw new Error(v.diagnostic.message);return v.value;}
function classified(s:string,re:R.Interval,im=R.interval(0)){return classifyIntervalRegion(ok(compileIntervalRegion(s)),C.rectangle(re,im));}
const p=(s:string)=>ok(compileIntervalExpression(s));
describe('outward binary64 arithmetic against exact rational arithmetic',()=>{
 it('steps between adjacent floats including signed zero, subnormals and infinities',()=>{
  expect(R.nextDown(Infinity)).toBe(Number.MAX_VALUE);expect(R.nextUp(-Infinity)).toBe(-Number.MAX_VALUE);expect(R.nextDown(0)).toBe(-Number.MIN_VALUE);expect(R.nextUp(-0)).toBe(Number.MIN_VALUE);
  for(const x of [1,-1,Number.MIN_VALUE,-Number.MIN_VALUE,1e-300,Number.MAX_VALUE]){expect(R.nextDown(R.nextUp(x))).toBe(x);expect(R.nextUp(R.nextDown(x))).toBe(x);}
 });
 it('encloses exact sums, differences, products and quotients across exponents',()=>{
  const values=[0,1,-1,0.1,-0.1,2**53,-(2**53),Number.MIN_VALUE,-Number.MIN_VALUE,1e-300,-1e-300,1e300,-1e300,Number.MAX_VALUE,-Number.MAX_VALUE];
  for(const x of values)for(const y of values){const a=R.interval(x),b=R.interval(y);encloses(R.add(a,b),add(q(x),q(y)));encloses(R.subtract(a,b),add(q(x),neg(q(y))));encloses(R.multiply(a,b),mul(q(x),q(y)));if(y)encloses(R.divide(a,b),div(q(x),q(y)));}
 });
 it('encloses all extrema of nondegenerate intervals and exact integer powers',()=>{
  for(const [lo,hi] of [[-3,-1],[-1,2],[0,Number.MIN_VALUE],[.1,.2],[1e150,1e151]])for(const [l,h] of [[-2,3],[1,4],[-4,-1]]){
   const a=R.interval(lo,hi),b=R.interval(l,h);for(const x of [lo,hi])for(const y of [l,h]){encloses(R.add(a,b),add(q(x),q(y)));encloses(R.multiply(a,b),mul(q(x),q(y)));if(!R.containsZero(b))encloses(R.divide(a,b),div(q(x),q(y)));}
   for(const n of [1,2,3,4,9])for(const x of [lo,(lo+hi)/2,hi]){let exact:Q={n:1n,d:1n};for(let i=0;i<n;i++)exact=mul(exact,q(x));encloses(R.integerPower(a,n),exact);}
  }
 });
 it('covers cancellation, overflow, underflow, unbounded sets and zero multiplication',()=>{
  encloses(R.add(R.interval(1e300),R.interval(-1e300)),q(0));expect(R.multiply(R.interval(Number.MAX_VALUE),R.interval(2))).toEqual({lower:Number.MAX_VALUE,upper:Infinity});
  expect(R.multiply(R.interval(0),R.whole())).toEqual(R.interval(0));expect(R.add(R.whole(),R.whole())).toEqual(R.whole());expect(R.integerPower(R.whole(),2).lower).toBe(0);expect(R.reciprocal(R.interval(1,Infinity)).lower).toBe(0);
  expect(()=>R.divide(R.interval(1),R.interval(-1,1))).toThrow(/ноль/);expect(()=>R.reciprocal(R.interval(0))).toThrow();expect(()=>R.integerPower(R.interval(0),0)).toThrow();expect(()=>R.interval(Infinity)).toThrow();
 });
 it('brackets exact square roots with rational square comparisons, even if Math.sqrt is inaccurate',()=>{
  for(const x of [0,Number.MIN_VALUE,1e-300,.1,1,2,3,4,1e300,Number.MAX_VALUE]){const s=R.squareRoot(R.interval(x));expect(compare(mul(q(s.lower),q(s.lower)),q(x))).toBeLessThanOrEqual(0);expect(compare(mul(q(s.upper),q(s.upper)),q(x))).toBeGreaterThanOrEqual(0);}
  const mocked=vi.spyOn(Math,'sqrt').mockReturnValue(1);try{const s=R.squareRoot(R.interval(2));expect(compare(mul(q(s.lower),q(s.lower)),q(2))).toBeLessThanOrEqual(0);expect(compare(mul(q(s.upper),q(s.upper)),q(2))).toBeGreaterThanOrEqual(0);}finally{mocked.mockRestore();}
  expect(()=>R.squareRoot(R.interval(-1,2))).toThrow();expect(R.squareRoot(R.interval(0,Infinity))).toEqual(R.interval(0,Infinity));
 });
 it('preserves exact decimal literals, rather than certifying their nearest float as exact',()=>{
  encloses(R.decimal('.1'),{n:1n,d:10n});expect(R.decimal('.1').lower).toBeLessThan(R.decimal('.1').upper);encloses(R.decimal('1e-400'),{n:1n,d:10n**400n});encloses(R.decimal('1e400'),{n:10n**400n,d:1n});expect(R.decimal('1.25')).toEqual(R.interval(1.25));
  expect(()=>R.decimal('1e99999')).toThrow(/бюджета/);expect(R.absolute(R.interval(-2,3))).toEqual(R.interval(0,3));
 });
});
describe('complex rectangles and controlled mathjs AST programs',()=>{
 it('encloses complex products, divisions and integer powers with exact rational components',()=>{
  for(const [a,b,c,d] of [[1,1,1,-1],[.1,.2,.3,-.4],[1e150,1e149,2,3],[-2,3,-4,-5]]){
   const A=C.point(a,b),B=C.point(c,d),v=C.multiply(A,B),den=add(mul(q(c),q(c)),mul(q(d),q(d))),w=C.divide(A,B);
   encloses(v.re,add(mul(q(a),q(c)),neg(mul(q(b),q(d)))));encloses(v.im,add(mul(q(a),q(d)),mul(q(b),q(c))));encloses(w.re,div(add(mul(q(a),q(c)),mul(q(b),q(d))),den));encloses(w.im,div(add(mul(q(b),q(c)),neg(mul(q(a),q(d)))),den));
  }
  const squared=C.integerPower(C.point(1,1),2);encloses(squared.re,q(0));encloses(squared.im,q(2));encloses(C.integerPower(C.point(0,1),2).re,q(-1));
 });
 it('encloses every sampled value of a rectangle and refuses a possible denominator zero',()=>{
  const a=C.rectangle(R.interval(-1,2),R.interval(2,3)),b=C.rectangle(R.interval(1,2),R.interval(-2,2));
  const v=C.divide(a,b);for(const x of [-1,0,2])for(const y of [2,2.5,3])for(const c of [1,1.5,2])for(const d of [-2,0,2]){const den=add(mul(q(c),q(c)),mul(q(d),q(d)));encloses(v.re,div(add(mul(q(x),q(c)),mul(q(y),q(d))),den));encloses(v.im,div(add(mul(q(y),q(c)),neg(mul(q(x),q(d)))),den));}
  expect(()=>C.divide(C.point(1),C.point(Number.MIN_VALUE))).toThrow(/Недостаточная точность/);
  expect(()=>C.divide(a,C.rectangle(R.interval(-1,1),R.interval(-1,1)))).toThrow(/ноль/);expect(C.includes(a,C.point(1,2))).toBe(true);expect(C.intersection(a,C.point(0,0))).toBeNull();
 });
 it('retains programs when binding parameters and leaves poles in unsimplified syntax',()=>{
  const source='a*z^2+0.1',compiled=p(source),parses=syntaxCacheStats().parses;for(let a=1;a<10;a++){expect(p(source)).toBe(compiled);const r=encloseExpression(compiled,C.point(1,1),{a});expect(r.kind).toBe('interval-confirmed');const v=valueOf(r)!;encloses(v.re,{n:1n,d:10n});encloses(v.im,q(2*a));}
  expect(syntaxCacheStats().parses).toBe(parses);expect(encloseExpression(p('1/(1/z)'),C.point(0))).toMatchObject({kind:'uncertain',reason:{code:'interval-singularity'}});
  const literal=p('0.1'),first=valueOf(encloseExpression(literal,C.point(0)))!;first.re.lower=900;expect(valueOf(encloseExpression(literal,C.point(0)))!.re.lower).toBeLessThan(.1);
 });
 it('never certifies unsupported transcendental functions or noninteger powers',()=>{
  for(const s of ['exp(z)','sin(z)','ln(z)','pi*z','e^z'])expect(compileIntervalExpression(s)).toMatchObject({ok:false,diagnostic:{kind:'operation',code:'unsupported-interval-operation'}});
  expect(encloseExpression(p('z^.5'),C.point(2))).toMatchObject({kind:'uncertain',reason:{kind:'operation'}});expect(encloseExpression(p('z'),{re:{lower:NaN,upper:1},im:R.interval(0)}).kind).not.toBe('interval-confirmed');
 });
});
describe('verified geometric predicates and adaptive tasks',()=>{
 it('distinguishes strict, closed and undecidable boundaries without epsilon',()=>{
  expect(classified('Re(z)<1',R.interval(0,.5))).toMatchObject({kind:'interval-confirmed',enclosure:'inside'});expect(classified('Re(z)<1',R.interval(1))).toMatchObject({kind:'interval-confirmed',enclosure:'outside'});expect(classified('Re(z)<=1',R.interval(1))).toMatchObject({kind:'interval-confirmed',enclosure:'inside'});
  for(const width of [1,.1,1e-10,Number.EPSILON])expect(classified('Re(z)<1',R.interval(1-width,1+width))).toMatchObject({kind:'uncertain',partial:'unknown'});
  expect(classified('|z|<1',R.interval(1))).toMatchObject({kind:'interval-confirmed',enclosure:'outside'});expect(classified('|z|<=1',R.interval(1))).toMatchObject({kind:'interval-confirmed',enclosure:'inside'});
  expect(classified('Re(z)<.1',R.interval(.1))).toMatchObject({kind:'interval-confirmed',enclosure:'outside'});expect(classified('Re(z)<=.1',R.interval(.1))).not.toMatchObject({kind:'interval-confirmed',enclosure:'inside'});
 });
 it('handles disks, intersections, unions, excluded points and segments',()=>{
  expect(classified('{z:|z-(1+i)|<2,Im(z)>0}',R.interval(.9,1.1),R.interval(.9,1.1))).toMatchObject({kind:'interval-confirmed',enclosure:'inside'});
  expect(classified('Re(z)<0 or Re(z)>1',R.interval(.1,.9))).toMatchObject({kind:'interval-confirmed',enclosure:'outside'});expect(classified('{z:|z|<2,z!=0}',R.interval(0))).toMatchObject({kind:'interval-confirmed',enclosure:'outside'});
  expect(classified('{z:|z|<2,z notin [0,1]}',R.interval(.2,.5),R.interval(.1,.2))).toMatchObject({kind:'interval-confirmed',enclosure:'inside'});expect(classified('{z:|z|<2,z notin [0,1]}',R.interval(.2,.5))).toMatchObject({kind:'uncertain'});
  expect(classifyCoefficientRegion({kind:'region',constraints:[],excluded:[],equality:{kind:'line',axis:'re',value:0}},[-1,1,-1,1])).toMatchObject({kind:'uncertain'});
  const model={kind:'region' as const,constraints:[{a:1,b:0,c:0,d:-1,strict:true}],excluded:[]};expect(analyzeSourceBox(model,[-2,2,-2,2],true)).toMatchObject({kind:'approximate',accuracy:{certified:false}});
  expect(classifyCoefficientRegion({kind:'region',constraints:[{a:1,b:0,c:0,d:-1,strict:true}],excluded:[]},[2,3,0,1])).toMatchObject({kind:'interval-confirmed',enclosure:'outside'});
 });
 const request=(patch:Partial<IntervalSubdivisionRequest>={}):IntervalSubdivisionRequest=>({schema:1,id:'proof-1',kind:'interval-classification',region:'|z|<1',parameters:{},box:[-2,2,-2,2],budget:256,maxDepth:8,minWidth:.02,...patch});
 function finish(input:IntervalSubdivisionRequest){const task=ok(prepareIntervalSubdivision(input));for(let i=0;i<13000;i++){const step=task.step(32);if(step.state!=='pending')return step.result;}throw new Error('Unbounded task');}
 it('certifies a polynomial/rational PREIMAGE, without claiming it is the image',()=>{
  for(const mapping of ['z^2','z^3','z^4','z^8','1/(z+3)','(z+1)/(z+3)']){const result=finish(request({mapping,box:[.1,.2,.1,.2]}));expect(result).toMatchObject({kind:'interval-confirmed',enclosure:{semantics:'preimage-region',unknown:[]}});expect(valueOf(result)!.inside).toHaveLength(1);}
  expect(finish(request({mapping:'1/z',box:[-.1,.1,-.1,.1],budget:16}))).toMatchObject({kind:'uncertain'});
 });
 it('certifies images through complete rational inverse branches, preserving missing values and original holes',()=>{
  const source=ok(compileIntervalRegion('{z:|z|<2,z!=1}')),identity=ok(compileIntervalMobius('z+1'));
  expect(classifyIntervalImage(source,identity,C.point(1))).toMatchObject({kind:'interval-confirmed',enclosure:'inside'});
  expect(classifyIntervalImage(source,identity,C.point(2))).toMatchObject({kind:'uncertain'});expect(classifyIntervalImage(source,identity,C.point(5))).toMatchObject({kind:'interval-confirmed',enclosure:'outside'});
  const inv=ok(compileIntervalMobius('1/z'));expect(classifyIntervalImage(source,inv,C.point(0))).toMatchObject({kind:'uncertain',reason:{code:'interval-singularity'}});
  expect(classifyIntervalImage(source,inv,C.point(2))).toMatchObject({kind:'interval-confirmed',enclosure:'inside'});
  expect(compileIntervalMobius('1/(1/z)')).toMatchObject({ok:false});expect(compileIntervalMobius('z^2')).toMatchObject({ok:false});
  const translated=finish(request({region:'Re(z)<1',mapping:'z+1',direction:'image',box:[.1,.2,.1,.2]}));expect(translated).toMatchObject({kind:'interval-confirmed',enclosure:{semantics:'image-region'}});
  expect(prepareIntervalSubdivision(request({mapping:'0*z+1',direction:'image'}))).toMatchObject({ok:false,diagnostic:{code:'interval-degenerate-map'}});
 });
 it('checks complete Möbius image membership and never promotes unsupported operations after refinement',()=>{
  const source=ok(compileIntervalRegion('Re(z)>0')),map=ok(compileIntervalMobius('(z+1)/(z-1)'));
  expect(classifyIntervalImage(source,map,C.point(2))).toMatchObject({kind:'interval-confirmed',enclosure:'inside'});expect(classifyIntervalImage(source,map,C.point(.5))).toMatchObject({kind:'interval-confirmed',enclosure:'outside'});expect(classifyIntervalImage(source,map,C.point(1))).toMatchObject({kind:'uncertain'});
  for(const width of [1,.01,1e-10]){const result=finish(request({mapping:'z^.5',box:[1,1+width,1,1+width]}));expect(result).toMatchObject({kind:'uncertain',reason:{kind:'operation'},budget:{used:1}});expect(valueOf(result)!.inside).toHaveLength(0);}
 });
 it('preserves proofs, bounds work, snapshots parameters and cancels obsolete work',()=>{
  const parameters={a:1},input=request({mapping:'a*z',parameters}),task=ok(prepareIntervalSubdivision(input));parameters.a=10;input.box[0]=100;expect(task.input.parameters.a).toBe(1);expect(task.input.box[0]).toBe(-2);
  expect(task.step(1)).toMatchObject({state:'pending',evaluations:1});task.cancel('obsolete');const stopped=task.step();expect(stopped).toMatchObject({state:'cancelled',result:{kind:'uncertain',reason:{kind:'cancelled'}}});expect(stopped).toBe(task.step());const emptyReason=ok(prepareIntervalSubdivision(request()));emptyReason.cancel('');expect(emptyReason.step()).toMatchObject({state:'cancelled'});
  const result=finish(request({budget:5}));expect(result).toMatchObject({kind:'uncertain',reason:{kind:'budget'},budget:{used:5,exhausted:true}});expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  const simple=finish(request({box:[0,.1,0,.1],budget:1}));expect(simple).toMatchObject({kind:'interval-confirmed',budget:{used:1}});
  expect(prepareIntervalSubdivision(request({direction:'preimage'})).ok).toBe(false);expect(prepareIntervalSubdivision({...request(),parameters:12} as unknown as IntervalSubdivisionRequest).ok).toBe(false);
  for(const bad of [0,12001,NaN])expect(prepareIntervalSubdivision(request({budget:bad})).ok).toBe(false);
 });
});
