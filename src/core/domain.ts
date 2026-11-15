import {complex,cos,cosh,multiply,add,type Complex} from 'mathjs';
import type {CompiledExpression} from './compile';
import {parameterScope} from './compile';
import {buildRealEvaluator} from './evaluation/real';
import {buildComplexProgram} from './evaluation/complex';
import type {ComplexCoordinate,RealScope} from './types';
import type {DomainDescription} from './semantics';
import {diagnosis} from './diagnostics';
import {approximate,inputError,uncertain,diagnosticOf,type MathResult} from './results';
export interface DomainMembership {membership:'inside'|'outside'|'unknown';checkedConditions:number;purpose:'evaluation-domain'}
export function analyzeDomain(program:CompiledExpression):DomainDescription{return program.semantics.domain;}
export function checkDomain(program:CompiledExpression,point:number|ComplexCoordinate,parameters:RealScope={}):MathResult<DomainMembership>{
 const p=parameterScope(program,parameters);if(!p.ok)return inputError(p.diagnostic);
 const z=typeof point==='number'?{re:point,im:0}:point;
 if(!z||!Number.isFinite(z.re)||!Number.isFinite(z.im))return inputError(diagnosis('syntax','invalid-point','Координаты должны быть конечными.'));
 const real=program.kind==='real';let unknown=program.semantics.domain.coverage==='partial',checked=0;
 for(const test of program.domainTests){
  try{
   const values=test.nodes.map(n=>real?{re:buildRealEvaluator(n).evaluate(z.re,parameters),im:0}:buildComplexProgram(n,true)(complex(z.re,z.im),parameters));
   if(values.some(v=>!Number.isFinite(v.re)||!Number.isFinite(v.im))){unknown=true;continue;}
   const a=values[0],b=values[1];let valid=true,indeterminate=false;
   if(test.rule==='nonzero')valid=a.re!==0||a.im!==0;
   if(test.rule==='positive')valid=a.im===0&&a.re>0;
   if(test.rule==='nonnegative')valid=a.im===0&&a.re>=0;
   if(test.rule==='unit-interval')valid=a.im===0&&Math.abs(a.re)<=1;
   if(test.rule==='defined-power'){
    if(!real&&(b.im!==0||!Number.isInteger(b.re)||Math.abs(b.re)>1000)){const reason=diagnosis('operation','integer-power','Область общей комплексной степени требует выбора ветви; текущий вычислитель поддерживает целые показатели −1000…1000.');return {kind:'unsupported',reason,diagnostics:[reason]};}
    valid=real?(a.re!==0?(a.re>=0||Number.isInteger(b.re)):b.re>=0):((a.re!==0||a.im!==0)||b.re>0);
   }
   if(test.rule==='nonzero-cos'||test.rule==='nonzero-cosh'||test.rule==='nonzero-atan-denominator'){
    const A=complex(a.re,a.im),v=test.rule==='nonzero-cos'?cos(A) as Complex:test.rule==='nonzero-cosh'?cosh(A) as Complex:add(multiply(A,A),complex(1,0)) as Complex;
    const magnitude=Math.hypot(v.re,v.im);valid=magnitude!==0;indeterminate=valid&&(!Number.isFinite(magnitude)||magnitude<=32*Number.EPSILON*Math.max(1,Math.hypot(a.re,a.im)));
   }
   checked++;if(!valid)return approximate({membership:'outside',checkedConditions:checked,purpose:'evaluation-domain'});
   if(indeterminate)unknown=true;
  }catch{unknown=true;}
 }
 const value:DomainMembership={membership:unknown?'unknown':'inside',checkedConditions:checked,purpose:'evaluation-domain'};
 return unknown?uncertain(diagnosis('uncertain','domain-undetermined','Проверка области определения неполна или недостаточно точна в этой точке.'),value):approximate(value);
}
