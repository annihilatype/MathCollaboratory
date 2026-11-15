import {diagnosis,type Diagnostic} from './diagnostics';
export interface BudgetUsage {limit:number;used:number;unit:'evaluations'|'cells';exhausted:boolean}
export interface FloatingAccuracy {arithmetic:'float64';certified:false;absoluteErrorBound:null;note?:string}
export const FLOAT64:FloatingAccuracy=Object.freeze({arithmetic:'float64',certified:false,absoluteErrorBound:null});
/** A future verified backend must provide evidence, not a heuristic epsilon. */
export interface ExactAnalyticEvidence {method:'exact-symbolic';identity:string;assumptions:readonly string[];backend:string}
export interface AnalyticDerivation {kind:'analytic-formula';law:string}
export interface IntervalEvidence {backend:string;method:'outward-rounded-intervals';proofReference:string}
export type MathResult<T>=
 | {kind:'analytic';value:T;verification:ExactAnalyticEvidence;diagnostics:Diagnostic[]}
 | {kind:'approximate';value:T;accuracy:FloatingAccuracy;diagnostics:Diagnostic[];derivation?:AnalyticDerivation;budget?:BudgetUsage}
 | {kind:'interval-confirmed';enclosure:T;verification:IntervalEvidence;diagnostics:Diagnostic[];budget?:BudgetUsage}
 | {kind:'uncertain';partial?:T;reason:Diagnostic;diagnostics:Diagnostic[];budget?:BudgetUsage}
 | {kind:'unsupported';reason:Diagnostic;diagnostics:Diagnostic[]}
 | {kind:'input-error';reason:Diagnostic;diagnostics:Diagnostic[]};
export type Validation<T>={ok:true;value:T}|{ok:false;diagnostic:Diagnostic};
export const approximate=<T>(value:T):Extract<MathResult<T>,{kind:'approximate'}>=>({kind:'approximate',value,accuracy:FLOAT64,diagnostics:[]});
export function diagnosticOf(error:unknown,fallback:Diagnostic['kind']='syntax'):Diagnostic {
 const e=error as Error&{kind?:Diagnostic['kind'];code?:string};return diagnosis(e?.kind??fallback,e?.code??(fallback==='syntax'?'invalid-input':'undefined-value'),e?.message??'Не удалось выполнить вычисление.');
}
export function inputError<T=never>(reason:Diagnostic):MathResult<T>{return {kind:'input-error',reason,diagnostics:[reason]};}
export function uncertain<T=never>(reason:Diagnostic,partial?:T,budget?:BudgetUsage):MathResult<T>{return {kind:'uncertain',reason,diagnostics:[reason],...(partial===undefined?{}:{partial}),...(budget?{budget}:{})};}
export function valueOf<T>(r:MathResult<T>):T|undefined{return r.kind==='analytic'||r.kind==='approximate'?r.value:r.kind==='uncertain'?r.partial:undefined;}
// No exact-analytic or interval-confirmed constructor: this version implements no verified backend.
