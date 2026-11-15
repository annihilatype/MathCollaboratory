import {complex,type Complex} from 'mathjs';
import {readDocument,type MathDocument,type ExpressionSource,type ExpressionRole} from './syntax/document';
import type {MathematicalObject} from './semantics';
import {interpretSemantics,type DomainTest} from './syntax/interpret';
import {buildRealEvaluator,type ParsedExpression} from './evaluation/real';
import {buildComplexProgram,type ComplexProgram} from './evaluation/complex';
import {prepareGeometry,type GeometryProgram} from './geometry/parse';
import {bindMappingAst} from './mapping/compile';
import type {ComplexMapping} from './mapping/types';
import type {ComplexGeometry} from './geometry/types';
import type {ComplexCoordinate,RealScope} from './types';
import {diagnosis} from './diagnostics';
import {approximate,diagnosticOf,inputError,uncertain,type MathResult,type Validation} from './results';
interface ProgramBase {document:MathDocument;semantics:MathematicalObject;domainTests:readonly DomainTest[]}
export interface CompiledReal extends ProgramBase {kind:'real';fast:ParsedExpression}
export interface CompiledComplex extends ProgramBase {kind:'complex';fast:ComplexProgram}
export interface CompiledMapping extends ProgramBase {kind:'mapping';fast:ComplexProgram}
export interface CompiledGeometry extends ProgramBase {kind:'geometry';fast:GeometryProgram}
export type CompiledExpression=CompiledReal|CompiledComplex|CompiledMapping|CompiledGeometry;
const programs=new WeakMap<MathDocument,CompiledExpression>();
function compile(source:string|ExpressionSource,role:ExpressionRole):Validation<CompiledExpression>{
 const input=typeof source==='string'?{text:source,notation:'latex' as const,role}:source;
 if(input.role!==role)return {ok:false,diagnostic:diagnosis('syntax','expression-role',`Ожидается выражение типа ${role}.`)};
 const read=readDocument(input);if(!read.ok)return read;const document=read.value,cached=programs.get(document);if(cached)return {ok:true,value:cached};
 try{
  const {object:semantics,tests:domainTests}=interpretSemantics(document),base={document,semantics,domainTests};
  let program:CompiledExpression;
  if(role==='real')program={...base,kind:'real',fast:buildRealEvaluator(document.ast)};
  else if(role==='geometry'){let text=input.notation==='latex'?input.text:document.normalized.replace(/==/g,'=');if(input.notation==='expression'&&/\bexcludeSegment\s*\(/.test(text))text='{z:'+text+'}';program={...base,kind:'geometry',fast:prepareGeometry(text)};}
  else if(role==='mapping')program={...base,kind:'mapping',fast:buildComplexProgram(document.ast,true)};
  else program={...base,kind:'complex',fast:buildComplexProgram(document.ast,false)};
  Object.freeze(program);programs.set(document,program);return {ok:true,value:program};
 }catch(e){return {ok:false,diagnostic:diagnosticOf(e,'operation')};}
}
export const compileReal=(s:string|ExpressionSource)=>compile(s,'real') as Validation<CompiledReal>;
export const compileComplex=(s:string|ExpressionSource)=>compile(s,'complex') as Validation<CompiledComplex>;
export const compileMapping=(s:string|ExpressionSource)=>compile(s,'mapping') as Validation<CompiledMapping>;
export const compileGeometry=(s:string|ExpressionSource)=>compile(s,'geometry') as Validation<CompiledGeometry>;
export function parameterScope(program:ProgramBase,parameters:RealScope):Validation<RealScope>{
 if(!parameters||typeof parameters!=='object'||Array.isArray(parameters))return {ok:false,diagnostic:diagnosis('syntax','invalid-parameters','Ожидается словарь конечных вещественных параметров.')};
 const missing=program.document.parameters.filter(p=>!Object.hasOwn(parameters,p));
 if(missing.length)return {ok:false,diagnostic:diagnosis('syntax','missing-parameters',`Создайте параметры: ${missing.join(', ')}.`)};
 const invalid=program.document.parameters.filter(p=>typeof parameters[p]!=='number'||!Number.isFinite(parameters[p]));
 if(invalid.length)return {ok:false,diagnostic:diagnosis('syntax','invalid-parameters',`Параметры должны быть конечными вещественными числами: ${invalid.join(', ')}.`)};
 return {ok:true,value:parameters};
}
export function evaluateReal(program:CompiledReal,x:number,parameters:RealScope={}):MathResult<number>{
 const scope=parameterScope(program,parameters);if(!scope.ok)return inputError(scope.diagnostic);
 if(!Number.isFinite(x))return inputError(diagnosis('syntax','invalid-point','Координата должна быть конечной.'));
 const y=program.fast.evaluate(x,parameters);
 return Number.isFinite(y)?approximate(y):uncertain(diagnosis('numeric','undefined-or-overflow','Результат не определён в точке или выходит за точность float64.'));
}
function complexPoint(program:CompiledComplex|CompiledMapping,z:Complex|undefined,parameters:RealScope):MathResult<ComplexCoordinate>{
 const scope=parameterScope(program,parameters);if(!scope.ok)return inputError(scope.diagnostic);
 try{const value=program.fast(z,parameters);return approximate({re:value.re,im:value.im});}
 catch(e){const reason=diagnosticOf(e,'numeric');return reason.kind==='operation'?{kind:'unsupported',reason,diagnostics:[reason]}:uncertain(reason);}
}
export function evaluateComplex(program:CompiledComplex,parameters:RealScope={}):MathResult<ComplexCoordinate>{return complexPoint(program,undefined,parameters);}
export function evaluateMapping(program:CompiledMapping,z:ComplexCoordinate,parameters:RealScope={}):MathResult<ComplexCoordinate>{
 if(!z||!Number.isFinite(z.re)||!Number.isFinite(z.im))return inputError(diagnosis('syntax','invalid-point','Координаты должны быть конечными.'));
 return complexPoint(program,complex(z.re,z.im),parameters);
}
export function bindMapping(program:CompiledMapping,parameters:RealScope={}):Validation<ComplexMapping>{
 const scope=parameterScope(program,parameters);if(!scope.ok)return scope;
 try{const snapshot=Object.freeze(Object.fromEntries(program.document.parameters.map(n=>[n,parameters[n]])));const value=bindMappingAst(program.document.ast,snapshot);value.definition={source:program.document.source,parameters:snapshot};return {ok:true,value};}
 catch(e){return {ok:false,diagnostic:diagnosticOf(e,'operation')};}
}
export function bindGeometry(program:CompiledGeometry,parameters:RealScope={}):Validation<ComplexGeometry>{
 const scope=parameterScope(program,parameters);if(!scope.ok)return scope;
 try{return {ok:true,value:program.fast(parameters)};}catch(e){return {ok:false,diagnostic:diagnosticOf(e,'domain')};}
}

export function evaluateGeometry(program:CompiledGeometry,parameters:RealScope={}):MathResult<ComplexGeometry>{
 const result=bindGeometry(program,parameters);return result.ok?approximate(result.value):inputError(result.diagnostic);
}
