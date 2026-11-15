import {describe,it,expect} from 'vitest';
import {compileReal,compileComplex,compileMapping,compileGeometry,evaluateReal,evaluateComplex,evaluateMapping,bindGeometry,bindMapping} from './compile';
import {analyzeDomain,checkDomain} from './domain';
import {syntaxCacheStats} from './syntax/ast';
import {createComplexAnalysis} from './analysis';
import {parseExpression} from '../math/expression';
import {parseMapping} from '../mapping/expression';
import {parseComplexGeometry} from '../complex/geometry';
import {valueOf,type Validation} from './results';
const ok=<T>(v:Validation<T>):T=>{expect(v.ok,JSON.stringify(v)).toBe(true);if(!v.ok)throw new Error(v.diagnostic.message);return v.value;};
describe('Math core: syntax, semantics and parameter binding',()=>{
 it.each([
  ['sin x^2','sin(x^2)'],['\\sin^{2}(x+\\cos(x))','sin(x+cos(x))^2'],['\\dfrac{1}{2}(x+\\frac{1}{x})','(x+1/x)/2'],['(x+1)(x-1)','x^2-1'],
 ])('preserves real interpretation of %s / %s',(a,b)=>{
  const A=ok(compileReal(a)),B=ok(compileReal(b));for(const x of [-2,-.7,0,.3,1.7]){const u=valueOf(evaluateReal(A,x)),v=valueOf(evaluateReal(B,x));if(u===undefined||v===undefined)expect(u).toBe(v);else expect(u).toBeCloseTo(v,12);}
 });
 it.each([['exp(2*z)','\\mathrm{e}^{2z}'],['(z+1/z)/2','\\frac12(z+\\dfrac1z)'],['conj(z)','\\overline{z}']])('equivalent complex forms %s / %s',(a,b)=>{
  const A=ok(compileMapping(a)),B=ok(compileMapping(b));for(const z of [{re:0,im:0},{re:1,im:1},{re:-.5,im:.2}]){const u=valueOf(evaluateMapping(A,z)),v=valueOf(evaluateMapping(B,z));if(!u||!v)expect(u).toBe(v);else{expect(u.re).toBeCloseTo(v.re,12);expect(u.im).toBeCloseTo(v.im,12);}}
 });
 it('retains document, immutable AST and executable program across parameter changes',()=>{
  const source='exp(a*z+b)',A=ok(compileMapping(source)),before=syntaxCacheStats().parses;
  const first=ok(bindMapping(A,{a:2,b:1})),second=ok(bindMapping(A,{a:3,b:-1}));
  for(let i=0;i<40;i++){const B=ok(compileMapping(source));expect(B).toBe(A);expect(B.document.ast).toBe(A.document.ast);expect(B.fast).toBe(A.fast);const z={re:.1*i,im:.2};expect(first.evaluate(z)!.re).toBeCloseTo(Math.exp(2*z.re+1)*Math.cos(.4),8);expect(second.evaluate(z)!.re).toBeCloseTo(Math.exp(3*z.re-1)*Math.cos(.6),8);}
  expect(syntaxCacheStats().parses).toBe(before);expect(Object.isFrozen(A.document.ast)).toBe(true);expect(()=>{(A.document.ast as unknown as {args:unknown[]}).args.push(0);}).toThrow();
 });
 it('geometry binding reuses its parsed structure and agrees with old entry points',()=>{
  for(const source of ['z=a+i','|z-a|=r','{z:|z-a|<r,Im(z)>0}','segment(a,a+i)']){
   const program=ok(compileGeometry(source));ok(bindGeometry(program,{a:1,r:2}));const before=syntaxCacheStats().parses;
   for(const a of [-2,0,.4,2])expect(ok(bindGeometry(program,{a,r:2}))).toEqual(parseComplexGeometry(source,{a,r:2}));
   expect(syntaxCacheStats().parses).toBe(before);expect(ok(compileGeometry(source))).toBe(program);
  }
 });
 it('round trips canonical region syntax without changing exclusions or angular conventions',()=>{
  for(const text of ['{z:z notin [0,1]}','{z:1<|z|<2,Im(z)>0}','{z:5*pi/4<arg(z)<3*pi/2}','|z-(a+i)|=r']){const a=ok(compileGeometry(text)),b=ok(compileGeometry({text:a.document.normalized,role:'geometry',notation:'expression'}));expect(ok(bindGeometry(a,{a:1,r:2}))).toEqual(ok(bindGeometry(b,{a:1,r:2})));}
 });
 it('workspace cache ignores unrelated parameters and keeps failed bindings recoverable',()=>{
  const session=createComplexAnalysis(),m=session.mapping('a*z',{a:2}),g=session.geometry('p','|z|=r',{r:2});
  expect(session.mapping('a*z',{a:2,unrelated:99})).toBe(m);expect(session.geometry('p','|z|=r',{r:2,a:77})).toBe(g);
  expect(session.mapping('a*z',{}).error).toContain('Создайте параметры: a');expect(session.mapping('a*z',{a:3}).value!.evaluate({re:1,im:0})).toEqual({re:3,im:0});
 });
 it('separates mapping cache identity from arbitrary saved expression identifiers',()=>{
  const session=createComplexAnalysis(),m=session.mapping('a*z',{a:2});session.geometry('\0mapping','z=3+i',{});expect(session.mapping('a*z',{a:2})).toBe(m);session.retain(['\0mapping']);expect(session.geometry('\0mapping','z=3+i',{}).value?.kind).toBe('point');
  expect(session.mapping('b*z',{}).error).toContain('Создайте параметры');expect(session.mapping('b*z',{b:NaN}).error).toContain('конечными');
 });
 it('has a semantic relation/set layer without replacing scalar mathjs ASTs',()=>{
  const p=ok(compileGeometry('{z:1<|z|<2,z notin [0,1]}'));
  expect(p.semantics).toMatchObject({kind:'geometry',definition:{kind:'intersection',operands:[{kind:'comparison-chain',convention:'region-language-v051'},{kind:'excluded-segment'}]}});
  const union=ok(compileGeometry('Re(z)<0 or Im(z)>1'));expect(union.semantics).toMatchObject({definition:{kind:'union'}});
  const p2=ok(compileMapping('1/(1/(z-1))')),d=analyzeDomain(p2);
  for(const condition of d.conditions)for(const operand of condition.operands){let node:unknown=p2.document.ast;for(const key of operand.path.split(/[.\[\]]/).filter(Boolean))node=(node as Record<string,unknown>)[key];expect((node as {toString:()=>string}).toString()).toBe(operand.expression);}
 });
 it('preserves complex arithmetic and existing scalar/graph conventions',()=>{
  for(const [s,re,im] of [['i^2',-1,0],['(1+i)(1-i)',2,0],['abs(3+4i)',5,0],['sqrt(-1)',0,1]] as const){const v=valueOf(evaluateComplex(ok(compileComplex(s))))!;expect(v.re).toBeCloseTo(re,12);expect(v.im).toBeCloseTo(im,12);}
  const R=ok(compileReal('a*sin(x)+1/(x-1)')),M=ok(compileMapping('a*z^2+1/z'));
  for(const a of [-2,0,2])for(const x of [-1,0,.3,1,2]){const y=valueOf(evaluateReal(R,x,{a})),old=parseExpression('a*sin(x)+1/(x-1)').evaluate(x,{a});if(Number.isFinite(old))expect(y).toBeCloseTo(old,12);else expect(y).toBeUndefined();expect(valueOf(evaluateMapping(M,{re:x,im:0},{a}))??null).toEqual(parseMapping('a*z^2+1/z',{a}).evaluate({re:x,im:0}));}
 });
});
describe('Evaluation domains and result guarantees',()=>{
 it('keeps holes of cancelled expressions and potential singularities',()=>{
  const p=ok(compileMapping('1/(1/z)')),domain=analyzeDomain(p);expect(domain.conditions.filter(c=>c.rule==='nonzero')).toHaveLength(2);expect(domain.features.some(f=>f.kind==='pole-candidate')).toBe(true);
  expect(valueOf(checkDomain(p,{re:0,im:0}))!.membership).toBe('outside');expect(valueOf(checkDomain(p,{re:2,im:0}))!.membership).toBe('inside');expect(evaluateMapping(p,{re:0,im:0}).kind).toBe('uncertain');
 });
 it('distinguishes real log/sqrt domains and complex branch information',()=>{
  expect(valueOf(checkDomain(ok(compileReal('ln(x)')),-1))!.membership).toBe('outside');expect(valueOf(checkDomain(ok(compileReal('sqrt(x)')),0))!.membership).toBe('inside');
  const p=ok(compileMapping('ln(z)'));expect(analyzeDomain(p).features.some(f=>f.kind==='branch-cut')).toBe(true);expect(valueOf(checkDomain(p,{re:-1,im:0}))!.membership).toBe('inside');expect(valueOf(evaluateMapping(p,{re:-1,im:0}))!.im).toBeCloseTo(Math.PI,12);
 });
 it('distinguishes mathematical domain from overflow and near-pole uncertainty',()=>{
  const p=ok(compileMapping('exp(z)'));expect(valueOf(checkDomain(p,{re:1000,im:0}))!.membership).toBe('inside');expect(evaluateMapping(p,{re:1000,im:0}).kind).toBe('uncertain');
  expect(checkDomain(ok(compileReal('tan(x)')),Math.PI/2).kind).toBe('uncertain');
 });
 it('never labels ordinary arithmetic as exact or verified',()=>{
  const result=evaluateReal(ok(compileReal('1+1')),0);expect(result).toMatchObject({kind:'approximate',value:2,accuracy:{arithmetic:'float64',certified:false,absoluteErrorBound:null}});
  expect(evaluateComplex(ok(compileComplex('i^.5'))).kind).toBe('unsupported');expect(evaluateMapping(ok(compileMapping('a*z')),{re:1,im:0},{}).kind).toBe('input-error');
  for(const s of ['z=1','import(z)','z[0]','[1,2]','z;z','constructor(z)'])expect(compileMapping(s).ok,s).toBe(false);
 });
 it('does not turn Euler powers into integer-power restrictions',()=>{
  const p=ok(compileMapping('e^(2*z)'));expect(analyzeDomain(p).conditions.filter(c=>c.rule==='defined-power')).toHaveLength(0);expect(valueOf(checkDomain(p,{re:0,im:1}))!.membership).toBe('inside');
 });
});
