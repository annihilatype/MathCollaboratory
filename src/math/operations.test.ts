import {decodeState,initialState} from '../state/store';
import {it,expect} from 'vitest';
import {OPERATIONS,COMPLEX_FUNCTIONS,REAL_FUNCTIONS} from './operations';
import {parseExpression} from './expression';
import {complexSource,evaluateComplex} from '../complex/math';
import {parseMapping} from '../mapping/expression';
it('every advertised real function uses the controlled real evaluator and its insertion syntax',()=>{
 for(const o of OPERATIONS.filter(o=>o.real)){const latex=o.latex.replace('#0','.3');expect(parseExpression(latex).evaluate(1,{}),o.name).toBeCloseTo(o.real!(.3),12);}
});
it('every advertised complex function uses a finite fixed operation and insertion syntax',()=>{
 for(const o of OPERATIONS.filter(o=>o.complex)){const latex=o.latex.replace('#0','1+i');const point=evaluateComplex(complexSource(latex));expect(Number.isFinite(point.re)&&Number.isFinite(point.im),o.name).toBe(true);const image=parseMapping(o.latex.replace('#0','z')).evaluate({re:1,im:1})!;expect(image.re,o.name).toBeCloseTo(point.re,12);expect(image.im,o.name).toBeCloseTo(point.im,12);}
});
it.each(['constructor','toString','__proto__','valueOf','import','evaluate','compile','random'])('never calls non-registry operation %s',name=>{
 expect(Object.hasOwn(COMPLEX_FUNCTIONS,name)).toBe(false);expect(Object.hasOwn(REAL_FUNCTIONS,name)).toBe(false);expect(()=>evaluateComplex(`${name}(i)`)).toThrow();expect(()=>parseMapping(`${name}(z)`)).toThrow();expect(()=>parseExpression(`${name}(x)`)).toThrow();
});
it.each([['sin(i)',0,Math.sinh(1)],['cos(i)',Math.cosh(1),0],['sqrt(-1)',0,1],['ln(-1)',0,Math.PI],['log(100)',2,0],['e^(2*i)',Math.cos(2),Math.sin(2)]])('numeric correctness %s',(s,re,im)=>{const z=evaluateComplex(s as string);expect(z.re).toBeCloseTo(re as number,12);expect(z.im).toBeCloseTo(im as number,12);});
it.each(['\\operatorname{\\mathrm{Re}}(z)','\\mathrm{Re}(z)','\\Re(z)'])('keeps MathLive operator wrappers %s',s=>{expect(parseMapping(s).evaluate({re:2,im:3})).toEqual({re:2,im:0});});
it('distinguishes invalid syntax, unsafe commands and numerical undefined values',()=>{
 expect(()=>parseMapping('exp((z)')).toThrow(/скобки/);expect(()=>parseMapping('\\unknown{z}')).toThrow(/unknown/);expect(parseMapping('ln(z)').evaluate({re:0,im:0})).toBeNull();expect(parseMapping('exp(z)').evaluate({re:1000,im:0})).toBeNull();expect(parseMapping('1/(z^2+1)').evaluate({re:0,im:1})).toBeNull();
});

it('retains legacy values whose names are now functions without losing expressions or views',()=>{
 const state=initialState();state.parameters.asin={value:.7,min:0,max:1,step:.1};state.parameters.ln={value:2,min:0,max:5,step:1};state.complex.expressions[0].latex='z=asin+i*ln';const recovered=decodeState(JSON.stringify(state));expect(recovered.parameters.asin).toEqual(state.parameters.asin);expect(recovered.parameters.ln).toEqual(state.parameters.ln);expect(recovered.complex.expressions).toEqual(state.complex.expressions);expect(recovered.realViewport).toEqual(state.realViewport);expect(recovered.mapping).toEqual(state.mapping);
});
