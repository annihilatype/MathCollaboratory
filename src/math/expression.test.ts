import { describe, expect, it } from 'vitest';
import { latexToExpression, parseExpression } from './expression';
import { sampleFunction } from './sample';
import { decodeState, initialState, validParameter } from '../state/store';
const value = (s: string, x=0, p: Record<string,number>={}) => parseExpression(s).evaluate(x,p);
describe('Математический ввод и вычисления', () => {
  it.each([['x^2',3,9], ['\\sin(x)',Math.PI/2,1], ['1/x',2,.5], ['\\sqrt{x}',9,3], ['\\frac{1}{\\frac{2}{3}}',0,1.5], ['y=\\frac{x^{2}}{4}-2',4,2], ['\\ln(e)',0,1], ['\\log(100)',0,2], ['\\exp(0)',0,1], ['\\cos(0)',0,1], ['\\tan(0)',0,0], ['|x|',-4,4], ['\\left|x\\right|',-3,3], ['\\sin x',Math.PI/2,1], ['\\sin^{2}(x)',Math.PI/2,1], ['2\\pi',0,2*Math.PI], ['\\ln(\\exponentialE)',0,1]])('%s', (s,x,y) => { expect(value(s as string,x as number)).toBeCloseTo(y as number); });
  it('распознаёт параметры и не считает константы параметрами', () => { const f=parseExpression('a\\sin(bx)+e+\\pi'); expect(f.parameters).toEqual(['a','b']); expect(f.evaluate(Math.PI/4,{a:2,b:2})).toBeCloseTo(2+Math.E+Math.PI); });
  it('поддерживает индексы параметров', () => { expect(value('a_{1}x',3,{a_1:2})).toBe(6); });
  it.each(['1/x','\\sqrt{x}','\\ln(x)'])('неопределённые значения: %s', s=>expect(Number.isNaN(value(s,s==='1/x'?0:-1))).toBe(true));
  it.each(['x=2','import("x")','x[1]','[1,2]','foo(x)','random()','2;3','\\unknown{x}','\\frac{x}','x+','sqrt(-1);2','constructor(x)','x!','x<2','\\sqrt[3]{x}'])('отклоняет %s', s=>expect(()=>parseExpression(s)).toThrow());
  it('ограничивает длину',()=>expect(()=>latexToExpression('x'.repeat(501))).toThrow());
  it('отсутствующий параметр даёт разрыв',()=>expect(value('ax',2)).toBeNaN());
});
describe('Разрывы и адаптивная выборка',()=>{
  it.each([(x:number)=>1/x,(x:number)=>1/(x-.123),(x:number)=>Math.tan(x)])('не соединяет асимптоты',fn=>{
    const {xs,ys}=sampleFunction(fn,-3,3,800,70);
    expect(ys.some(Number.isNaN)).toBe(true);
    for(let i=1;i<ys.length;i++) if(Number.isFinite(ys[i])&&Number.isFinite(ys[i-1])) expect(Math.abs(ys[i]-ys[i-1])*70).toBeLessThan(101);
    expect(xs.length).toBe(ys.length);
  });
  it('сохраняет непрерывность параболы',()=>{ expect(sampleFunction(x=>x*x,-3,3,800,70).ys.every(Number.isFinite)).toBe(true); });
  it('не рисует отрицательную область корня',()=>{const {xs,ys}=sampleFunction(Math.sqrt,-3,3,800,70);xs.forEach((x,i)=>{if(x<0)expect(Number.isFinite(ys[i])).toBe(false);});});
});
describe('Сохранение',()=>{
  it('восстанавливает все поля',()=>{const s=initialState();s.theme='dark';s.expressions[0].visible=false;s.parameters.a.value=3;expect(decodeState(JSON.stringify(s))).toEqual(s);});
  it.each([null,'{','{}','{"version":9}'])('безопасно восстанавливает повреждённое состояние',raw=>expect(decodeState(raw)).toEqual(initialState()));
  it('не допускает повторяющиеся id и опасные имена',()=>{const s=initialState();s.expressions.push(s.expressions[0]);expect(decodeState(JSON.stringify(s))).toEqual(initialState());});
  it('проверяет диапазоны',()=>{expect(validParameter({value:1,min:2,max:0,step:0})).toBe(false);expect(validParameter({value:0,min:-1,max:1,step:.1})).toBe(true);});
});
