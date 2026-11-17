import type {IntervalEvidence} from '../results';
import * as R from './real';
export interface ComplexInterval {re:R.Interval;im:R.Interval}
export const rectangle=(re:R.Interval,im:R.Interval=R.interval(0)):ComplexInterval=>({re,im});
export const point=(re:number,im=0)=>rectangle(R.interval(re),R.interval(im));
export const add=(a:ComplexInterval,b:ComplexInterval)=>rectangle(R.add(a.re,b.re),R.add(a.im,b.im));
export const negate=(a:ComplexInterval)=>rectangle(R.negate(a.re),R.negate(a.im));
export const subtract=(a:ComplexInterval,b:ComplexInterval)=>add(a,negate(b));
export const conjugate=(a:ComplexInterval)=>rectangle({...a.re},R.negate(a.im));
export const multiply=(a:ComplexInterval,b:ComplexInterval)=>rectangle(R.subtract(R.multiply(a.re,b.re),R.multiply(a.im,b.im)),R.add(R.multiply(a.re,b.im),R.multiply(a.im,b.re)));
export const containsZero=(a:ComplexInterval)=>R.containsZero(a.re)&&R.containsZero(a.im);
export function divide(a:ComplexInterval,b:ComplexInterval):ComplexInterval {
 if(containsZero(b))throw new R.IntervalFailure('domain','interval-singularity','Комплексный знаменатель может содержать ноль.');
 const denominator=R.add(R.integerPower(b.re,2),R.integerPower(b.im,2));
 if(R.containsZero(denominator))throw new R.IntervalFailure('numeric','interval-precision','Недостаточная точность: квадрат модуля знаменателя округлился до интервала с нулём.');
 return rectangle(R.divide(R.add(R.multiply(a.re,b.re),R.multiply(a.im,b.im)),denominator),R.divide(R.subtract(R.multiply(a.im,b.re),R.multiply(a.re,b.im)),denominator));
}
export function integerPower(a:ComplexInterval,n:number):ComplexInterval {
 if(!Number.isSafeInteger(n)||Math.abs(n)>1024)throw new R.IntervalFailure('operation','interval-power-range','Поддерживаются целые интервальные степени −1024…1024.');
 if(n===0){if(containsZero(a))throw new R.IntervalFailure('domain','interval-zero-power','Неопределённая операция 0^0.');return point(1);}
 if(n<0)return divide(point(1),integerPower(a,-n));let r=point(1),b=a;
 while(n){if(n%2)r=multiply(r,b);n=Math.floor(n/2);if(n)b=multiply(b,b);}return r;
}
export const modulus=(a:ComplexInterval)=>R.squareRoot(R.add(R.integerPower(a.re,2),R.integerPower(a.im,2)));
export const includes=(a:ComplexInterval,b:ComplexInterval)=>R.includes(a.re,b.re)&&R.includes(a.im,b.im);
export function intersection(a:ComplexInterval,b:ComplexInterval):ComplexInterval|null {const re=R.intersection(a.re,b.re),im=R.intersection(a.im,b.im);return re&&im?rectangle(re,im):null;}
/** Capability contract for future validated transcendental implementations. */
export interface ComplexIntervalBackend {readonly evidence:IntervalEvidence;exp?:(z:ComplexInterval)=>ComplexInterval;log?:(z:ComplexInterval)=>ComplexInterval;sin?:(z:ComplexInterval)=>ComplexInterval;cos?:(z:ComplexInterval)=>ComplexInterval}
