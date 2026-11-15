import type {MathNode} from 'mathjs';
import {latexToExpression} from './realLatex';
import {complexSource} from './complexLatex';
import {parseAst,parseComplexAst} from './ast';
import {geometrySource,complexAstParameters,realAstParameters} from '../parameters';
import {diagnosticOf,type Validation} from '../results';
export type ExpressionRole='real'|'complex'|'mapping'|'geometry';
export interface ExpressionSource {text:string;notation:'latex'|'expression';role:ExpressionRole}
export interface MathDocument {readonly schema:1;readonly source:Readonly<ExpressionSource>;readonly normalized:string;readonly ast:MathNode;readonly parameters:readonly string[];readonly variables:readonly string[];readonly cost:number}
const documents=new Map<string,MathDocument>();
export function readDocument(input:ExpressionSource):Validation<MathDocument>{
 try{
  if(!input||typeof input.text!=='string'||!['latex','expression'].includes(input.notation)||!['real','complex','mapping','geometry'].includes(input.role))throw new Error('Недопустимое описание математического выражения.');
  if(input.text.length>500)throw new Error('Выражение слишком длинное (максимум 500 символов).');
  const key=JSON.stringify([input.role,input.notation,input.text]),old=documents.get(key);if(old){documents.delete(key);documents.set(key,old);return {ok:true,value:old};}
  let normalized:string;
  if(input.notation==='expression')normalized=input.text;
  else if(input.role==='real')normalized=latexToExpression(input.text);
  else if(input.role==='geometry')normalized=geometrySource(input.text).source;
  else normalized=complexSource(input.text).trim().replace(/^w\s*=\s*/,'');
  if(!normalized.trim())throw new Error(input.role==='mapping'?'Введите функцию от z, например z^2 или 1/z.':'Введите математическое выражение.');
  const ast=input.role==='real'?parseAst(normalized):parseComplexAst(normalized);
  const parameters=input.role==='real'?realAstParameters(ast):complexAstParameters(ast);
  let cost=0;ast.traverse(()=>cost++);
  const variables=input.role==='real'?['x']:input.role==='complex'?[]:['z'];
  const document:MathDocument=Object.freeze({schema:1,source:Object.freeze({...input}),normalized,ast,parameters:Object.freeze([...parameters]),variables:Object.freeze(variables),cost});
  documents.set(key,document);if(documents.size>128)documents.delete(documents.keys().next().value!);return {ok:true,value:document};
 }catch(e){return {ok:false,diagnostic:diagnosticOf(e)};}
}
