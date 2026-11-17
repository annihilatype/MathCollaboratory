import {MathDiagnostic} from '../diagnostics';
/** Endpoints bound finite real numbers; infinities denote unbounded limits. */
export interface Interval {lower:number;upper:number}
export const BACKEND='binary64-outward-v1';
export const PROOF_REFERENCE='docs/verified-numerics-v0.6.1.md#rounding-contract';
export class IntervalFailure extends MathDiagnostic {}
const bytes=new DataView(new ArrayBuffer(8));
export function nextUp(x:number):number {
 if(Number.isNaN(x)||x===Infinity)return x;if(x===0)return Number.MIN_VALUE;
 bytes.setFloat64(0,x);bytes.setBigUint64(0,bytes.getBigUint64(0)+(x>0?1n:-1n));return bytes.getFloat64(0);
}
export const nextDown=(x:number)=>-nextUp(-x);
export function interval(lower:number,upper=lower):Interval {
 if(typeof lower!=='number'||typeof upper!=='number'||Number.isNaN(lower)||Number.isNaN(upper)||lower>upper||lower===Infinity||upper===-Infinity)throw new IntervalFailure('syntax','invalid-interval','Интервал должен содержать конечные вещественные числа: lower ≤ upper.');
 return {lower:lower===0?0:lower,upper:upper===0?0:upper};
}
export const whole=():Interval=>interval(-Infinity,Infinity);
export const containsZero=(a:Interval)=>a.lower<=0&&a.upper>=0;
export const singleton=(a:Interval,x:number)=>a.lower===x&&a.upper===x;
export const negate=(a:Interval)=>interval(-a.upper,-a.lower);
export const includes=(a:Interval,b:Interval)=>a.lower<=b.lower&&a.upper>=b.upper;
export function intersection(a:Interval,b:Interval):Interval|null {const lo=Math.max(a.lower,b.lower),hi=Math.min(a.upper,b.upper);return lo>hi?null:interval(lo,hi);}
// IEEE-754 +, -, *, / are correctly rounded to nearest. One adjacent
// representable value on each side encloses the exact operation, including
// underflow and overflow. Infinity itself is not a scalar operand.
const down=(v:number)=>Number.isNaN(v)?-Infinity:nextDown(v);
const up=(v:number)=>Number.isNaN(v)?Infinity:nextUp(v);
export function add(a:Interval,b:Interval):Interval {
 if(singleton(a,0))return {...b};if(singleton(b,0))return {...a};
 return interval(a.lower===-Infinity||b.lower===-Infinity?-Infinity:Math.max(a.lower>=0&&b.lower>=0?0:-Infinity,down(a.lower+b.lower)),a.upper===Infinity||b.upper===Infinity?Infinity:Math.min(a.upper<=0&&b.upper<=0?0:Infinity,up(a.upper+b.upper)));
}
export const subtract=(a:Interval,b:Interval)=>add(a,negate(b));
function product(x:number,y:number){return x===0||y===0?0:x*y;}
export function multiply(a:Interval,b:Interval):Interval {
 if(singleton(a,0)||singleton(b,0))return interval(0);if(singleton(a,1))return {...b};if(singleton(b,1))return {...a};
 const v=[product(a.lower,b.lower),product(a.lower,b.upper),product(a.upper,b.lower),product(a.upper,b.upper)],lo=Math.min(...v),hi=Math.max(...v);
 return interval(lo===-Infinity?-Infinity:lo===0&&a.lower>=0&&b.lower>=0?0:down(lo),hi===Infinity?Infinity:hi===0&&a.upper<=0&&b.lower>=0?0:up(hi));
}
export function reciprocal(a:Interval):Interval {
 if(containsZero(a))throw new IntervalFailure('domain','interval-singularity','Знаменатель содержит ноль: отсутствие особенности не доказано.');
 if(singleton(a,1)||singleton(a,-1))return {...a};
 return interval(a.upper===Infinity?0:down(1/a.upper),a.lower===-Infinity?0:up(1/a.lower));
}
export const divide=(a:Interval,b:Interval)=>multiply(a,reciprocal(b));
function positivePower(x:number,n:number):Interval {
 if(x===Infinity)return interval(Number.MAX_VALUE,Infinity);
 let a=interval(x),r=interval(1);while(n){if(n%2)r=multiply(r,a);n=Math.floor(n/2);if(n)a=multiply(a,a);}return r;
}
export function integerPower(a:Interval,n:number):Interval {
 if(!Number.isSafeInteger(n)||Math.abs(n)>1024)throw new IntervalFailure('operation','interval-power-range','Интервальная степень должна быть целой, от −1024 до 1024.');
 if(n===0){if(containsZero(a))throw new IntervalFailure('domain','interval-zero-power','Интервал содержит неопределённую операцию 0^0.');return interval(1);}
 if(n<0)return reciprocal(integerPower(a,-n));
 const endpoint=(x:number)=>x<0&&n%2?negate(positivePower(-x,n)):positivePower(Math.abs(x),n);
 const l=endpoint(a.lower),r=endpoint(a.upper);
 return n%2?interval(a.lower===-Infinity?-Infinity:l.lower,a.upper===Infinity?Infinity:r.upper):interval(containsZero(a)?0:Math.max(0,Math.min(l.lower,r.lower)),a.lower===-Infinity||a.upper===Infinity?Infinity:Math.max(l.upper,r.upper));
}
export function absolute(a:Interval):Interval {return interval(containsZero(a)?0:Math.min(Math.abs(a.lower),Math.abs(a.upper)),Math.max(Math.abs(a.lower),Math.abs(a.upper)));}
/** Exact decomposition of a finite binary64 value, without floating arithmetic. */
export function dyadic(x:number):{n:bigint;e:number} {
 if(!Number.isFinite(x))throw new Error('Expected finite number');bytes.setFloat64(0,x);const b=bytes.getBigUint64(0),exp=Number((b>>52n)&2047n),fraction=b&((1n<<52n)-1n);
 return {n:(b>>63n?-1n:1n)*(exp?fraction+(1n<<52n):fraction),e:exp?exp-1075:-1074};
}
function compareDyadic(a:{n:bigint;e:number},b:{n:bigint;e:number}):number {const e=Math.min(a.e,b.e),x=a.n<<BigInt(a.e-e),y=b.n<<BigInt(b.e-e);return x<y?-1:x>y?1:0;}
function squareCompare(y:number,x:number):number {const d=dyadic(y);return compareDyadic({n:d.n*d.n,e:2*d.e},dyadic(x));}
function sqrtBound(x:number):Interval {
 if(x===0)return interval(0);if(x===Infinity)return interval(Number.MAX_VALUE,Infinity);
 // Math.sqrt is only a seed: exact BigInt comparisons validate BOTH bounds.
 const seed=Math.sqrt(x);
 if(Number.isFinite(seed)&&seed>0){const c=squareCompare(seed,x);if(c===0)return interval(seed);const lo=c<0?seed:nextDown(seed),hi=c>0?seed:nextUp(seed);if(squareCompare(lo,x)<=0&&squareCompare(hi,x)>=0)return interval(lo,hi);}
 let lo=0n,hi=0x7fefffffffffffffn;while(hi-lo>1n){const mid=(lo+hi)/2n;bytes.setBigUint64(0,mid);const y=bytes.getFloat64(0);if(squareCompare(y,x)<=0)lo=mid;else hi=mid;}
 bytes.setBigUint64(0,lo);const lower=bytes.getFloat64(0);return interval(lower,squareCompare(lower,x)===0?lower:nextUp(lower));
}
export function squareRoot(a:Interval):Interval {if(a.lower<0)throw new IntervalFailure('domain','interval-negative-sqrt','Вещественный корень: интервал содержит отрицательные значения.');return interval(sqrtBound(a.lower).lower,a.upper===Infinity?Infinity:sqrtBound(a.upper).upper);}
function compareRational(x:number,n:bigint,d:bigint):number {const a=dyadic(x);return compareDyadic({n:a.n*d,e:a.e},{n,e:0});}
/** Exact decimal input, including numbers that overflow/underflow binary64. */
export function decimal(text:string):Interval {
 if(text.startsWith('-'))return negate(decimal(text.slice(1)));if(text.startsWith('+'))return decimal(text.slice(1));
 const m=/^(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);if(!m||!(m[1]+(m[2]??'')).length)throw new IntervalFailure('syntax','interval-number','Некорректное число.');
 const exponent=Number(m[3]??0)-(m[2]?.length??0),digits=m[1]+(m[2]??'');if(Math.abs(exponent)>4096)throw new IntervalFailure('budget','interval-literal-budget','Порядок десятичного числа превышает интервал вычислительного бюджета.');
 const n=BigInt(digits||'0')*(exponent>0?10n**BigInt(exponent):1n),d=exponent<0?10n**BigInt(-exponent):1n;if(n===0n)return interval(0);
 if(compareRational(Number.MAX_VALUE,n,d)<0)return interval(Number.MAX_VALUE,Infinity);
 const seed=Number(text);if(Number.isFinite(seed)){const c=compareRational(seed,n,d);if(c===0)return interval(seed);const lo=c<0?seed:Math.max(0,nextDown(seed)),hi=c>0?seed:nextUp(seed);if(compareRational(lo,n,d)<=0&&compareRational(hi,n,d)>=0)return interval(lo,hi);}
 let lo=0n,hi=0x7fefffffffffffffn;while(hi-lo>1n){const mid=(lo+hi)/2n;bytes.setBigUint64(0,mid);if(compareRational(bytes.getFloat64(0),n,d)<=0)lo=mid;else hi=mid;}
 bytes.setBigUint64(0,lo);const lower=bytes.getFloat64(0);return interval(lower,compareRational(lower,n,d)===0?lower:nextUp(lower));
}
