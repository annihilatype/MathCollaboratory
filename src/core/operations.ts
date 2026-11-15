import {complex,exp,sin,cos,tan,sinh,cosh,tanh,asin,acos,atan,sqrt,log,conj,abs,divide,type Complex} from 'mathjs';
export interface MathOperation {name:string;aliases?:string[];real?:(x:number)=>number;complex?:(z:Complex)=>Complex|number}
// Fixed mathjs functions only. Presentation and MathLive templates live outside the core.
export const MATH_OPERATIONS:readonly MathOperation[]=[
 {name:'sin',real:Math.sin,complex:z=>sin(z) as Complex},
 {name:'cos',real:Math.cos,complex:z=>cos(z) as Complex},
 {name:'tan',real:Math.tan,complex:z=>tan(z) as Complex},
 {name:'ln',real:Math.log,complex:z=>log(z) as Complex},
 {name:'log',real:Math.log10,complex:z=>divide(log(z) as Complex,complex(Math.LN10,0)) as Complex},
 {name:'exp',real:Math.exp,complex:z=>exp(z) as Complex},
 {name:'sqrt',real:Math.sqrt,complex:z=>sqrt(z) as Complex},
 {name:'abs',real:Math.abs,complex:z=>abs(z) as number},
 {name:'conj',complex:z=>conj(z) as Complex},
 {name:'Re',aliases:['re'],complex:z=>z.re},
 {name:'Im',aliases:['im'],complex:z=>z.im},
 {name:'arg',aliases:['Arg'],complex:z=>{if(z.re===0&&z.im===0)throw new Error('Аргумент нуля не определён.');const a=Math.atan2(z.im,z.re);return a===-Math.PI?Math.PI:a;}},
 {name:'asin',aliases:['arcsin'],real:Math.asin,complex:z=>asin(z) as Complex},
 {name:'acos',aliases:['arccos'],real:Math.acos,complex:z=>acos(z) as Complex},
 {name:'atan',aliases:['arctan'],real:Math.atan,complex:z=>atan(z) as Complex},
 {name:'sinh',real:Math.sinh,complex:z=>sinh(z) as Complex},
 {name:'cosh',real:Math.cosh,complex:z=>cosh(z) as Complex},
 {name:'tanh',real:Math.tanh,complex:z=>tanh(z) as Complex},
 {name:'floor',real:Math.floor}, {name:'ceil',real:Math.ceil}, {name:'round',real:Math.round},
];
export const REAL_FUNCTIONS=Object.assign(Object.create(null),Object.fromEntries(MATH_OPERATIONS.filter(o=>o.real).map(o=>[o.name,o.real!]))) as Record<string,(x:number)=>number>;
export const COMPLEX_FUNCTIONS=Object.assign(Object.create(null),Object.fromEntries(MATH_OPERATIONS.filter(o=>o.complex).map(o=>[o.name,o.complex!]))) as Record<string,(z:Complex)=>Complex|number>;
export const OPERATION_NAMES=new Set([...MATH_OPERATIONS.flatMap(o=>[o.name,...(o.aliases??[])]),'segment']);
export function canonicalName(name:string):string{return MATH_OPERATIONS.find(o=>o.name===name||o.aliases?.includes(name))?.name??name;}
