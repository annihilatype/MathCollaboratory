import {complex,exp,sin,cos,tan,sinh,cosh,tanh,asin,acos,atan,sqrt,log,conj,abs,divide,type Complex} from 'mathjs';
export type OperationCategory='Основная'|'Комплексная'|'Расширенная';
export interface Operation { name:string; label:string; category:OperationCategory; description:string; example:string; latex:string; aliases?:string[]; real?: (x:number)=>number; complex?: (z:Complex)=>Complex|number; region:string }
const c=(name:string,label:string,category:OperationCategory,description:string,example:string,latex:string,region:string,real?:Operation['real'],fn?:Operation['complex'],aliases?:string[]):Operation=>({name,label,category,description,example,latex,region,...(real?{real}:{}),...(fn?{complex:fn}:{}),...(aliases?{aliases}: {})});
export const OPERATIONS:readonly Operation[]=[
 c('sin','sin','Основная','Синус; аргумент в радианах.','sin(x), sin(z)','\\sin(#0)','Обратный метод при конечном диапазоне Re источника.',Math.sin,z=>sin(z) as Complex),
 c('cos','cos','Основная','Косинус; аргумент в радианах.','cos(x), cos(z)','\\cos(#0)','Обратный метод при конечном диапазоне Re источника.',Math.cos,z=>cos(z) as Complex),
 c('tan','tan','Основная','Тангенс; у функции есть полюса.','tan(x), tan(z)','\\tan(#0)','Обратный метод при конечном диапазоне Re источника.',Math.tan,z=>tan(z) as Complex),
 c('ln','ln','Основная','Натуральный логарифм. Для комплексных чисел — главная ветвь.','ln(x), ln(1+i)','\\ln(#0)','Главная ветвь: обратная заливка пока не реализована.',Math.log,z=>log(z) as Complex),
 c('log','log₁₀','Основная','Десятичный логарифм; комплексная главная ветвь.','log(100)','\\log(#0)','Обратная заливка пока не реализована.',Math.log10,z=>divide(log(z) as Complex,complex(Math.LN10,0)) as Complex),
 c('exp','exp','Основная','Экспонента; exp(u)=e^u.','exp(2*z)','\\exp(#0)','До 32 логарифмических ветвей на ступень; нужен конечный диапазон Im аргумента.',Math.exp,z=>exp(z) as Complex),
 c('sqrt','√','Основная','Квадратный корень; для комплексных значений — главный корень.','sqrt(x), sqrt(-1)','\\sqrt{#0}','Главная ветвь: обратная заливка пока не реализована.',Math.sqrt,z=>sqrt(z) as Complex),
 c('abs','|·|','Комплексная','Модуль комплексного числа, абсолютное значение вещественного.','abs(z), |z|<2','\\operatorname{abs}(#0)','В условиях областей поддерживается. Образ может быть одномерным; заливка abs не строится.',Math.abs,z=>abs(z) as number),
 c('conj','conj','Комплексная','Комплексное сопряжение.','conj(z)','\\operatorname{conj}(#0)','Точное преобразование или ступень обратной композиции.',undefined,z=>conj(z) as Complex),
 c('Re','Re','Комплексная','Вещественная часть.','Re(z)<2','\\operatorname{Re}(#0)','В условиях поддерживается; отдельный образ Re — не площадь.',undefined,z=>z.re,['re']),
 c('Im','Im','Комплексная','Мнимая часть.','Im(z)>0','\\operatorname{Im}(#0)','В условиях поддерживается; отдельный образ Im — не площадь.',undefined,z=>z.im,['im']),
 c('arg','arg','Комплексная','Главный аргумент в (−π,π], не определён в нуле.','arg(z), 0<arg(z)<pi/2','\\operatorname{arg}(#0)','Угловые окна поддерживаются; заливка arg не строится.',undefined,z=>{if(z.re===0&&z.im===0)throw new Error('Аргумент нуля не определён.');const a=Math.atan2(z.im,z.re);return a===-Math.PI?Math.PI:a;},['Arg']),
 ...[['asin','arcsin','Арксинус, главная ветвь.',Math.asin,asin],['acos','arccos','Арккосинус, главная ветвь.',Math.acos,acos],['atan','arctan','Арктангенс, главная ветвь.',Math.atan,atan],['sinh','sinh','Гиперболический синус.',Math.sinh,sinh],['cosh','cosh','Гиперболический косинус.',Math.cosh,cosh],['tanh','tanh','Гиперболический тангенс.',Math.tanh,tanh]].map(([name,label,description,real,fn])=>c(name as string,label as string,'Расширенная',description as string,`${name}(x), ${name}(z)`,`\\operatorname{${name}}(#0)`,'Обратная заливка этого семейства пока не реализована.',real as (x:number)=>number,z=>(fn as (z:Complex)=>Complex)(z),name!==label?[label as string]:undefined)),
 c('floor','floor','Расширенная','Округление вниз; только вещественные графики.','floor(x)','\\operatorname{floor}(#0)','Комплексная функция не поддерживается.',Math.floor),
 c('ceil','ceil','Расширенная','Округление вверх; только вещественные графики.','ceil(x)','\\operatorname{ceil}(#0)','Комплексная функция не поддерживается.',Math.ceil),
 c('round','round','Расширенная','Округление к ближайшему целому; только вещественные графики.','round(x)','\\operatorname{round}(#0)','Комплексная функция не поддерживается.',Math.round),
];
export const REAL_FUNCTIONS=Object.assign(Object.create(null),Object.fromEntries(OPERATIONS.filter(o=>o.real).map(o=>[o.name,o.real!]))) as Record<string,(x:number)=>number>;
export const COMPLEX_FUNCTIONS=Object.assign(Object.create(null),Object.fromEntries(OPERATIONS.filter(o=>o.complex).map(o=>[o.name,o.complex!]))) as Record<string,(z:Complex)=>Complex|number>;
export const OPERATION_NAMES=new Set([...OPERATIONS.flatMap(o=>[o.name,...(o.aliases??[])]),'segment']);
export function canonicalName(name:string):string{return OPERATIONS.find(o=>o.name===name||o.aliases?.includes(name))?.name??name;}
export function normalizeOperationLatex(source:string):string{
  for(let depth=0;depth<16;depth++){
    const next=source.replace(/\\(?:operatorname|mathrm|mathop)\s*\{\s*([a-zA-Z]+)\s*\}/g,(whole,name:string)=>OPERATION_NAMES.has(name)||['e','i','pi'].includes(name)?canonicalName(name):whole);
    if(next===source)break;source=next;
  }
  return source.replace(/\\(arcsin|arccos|arctan)(?![a-zA-Z])/g,(_m,name:string)=>`\\${canonicalName(name)}`);
}
