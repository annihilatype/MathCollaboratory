import {diagnosis,type Diagnostic} from '../diagnostics';
import type {RealScope} from '../types';
import type {Box} from '../regions/inverse';
import type {ComputationTask,TaskRequestBase,TaskStep} from '../tasks';
import {diagnosticOf,type MathResult,type Validation} from '../results';
import {compileIntervalExpression,compileIntervalRegion,compileIntervalMobius,INTERVAL_EVIDENCE,type CellClassification} from './program';
import {boxRectangle} from './geometry';
export interface IntervalSubdivisionRequest extends TaskRequestBase {kind:'interval-classification';region:string;mapping?:string;direction?:'preimage'|'image';parameters:RealScope;box:Box;budget:number;maxDepth:number;minWidth:number}
export interface IntervalSubdivision {inside:Box[];outside:Box[];unknown:Box[];verification:typeof INTERVAL_EVIDENCE;semantics:'source-region'|'preimage-region'|'image-region'}
/** D, f^{-1}(D), or f(D) with a complete validated Möbius inverse. */
export function prepareIntervalSubdivision(input:IntervalSubdivisionRequest):Validation<ComputationTask<IntervalSubdivision,IntervalSubdivisionRequest>> {
 if(!input||input.direction!==undefined&&!['image','preimage'].includes(input.direction)||input.direction!==undefined&&!input.mapping||input.schema!==1||input.kind!=='interval-classification'||typeof input.id!=='string'||!input.id||input.id.length>128||typeof input.region!=='string'||input.region.length>500||input.mapping!==undefined&&typeof input.mapping!=='string'||!Array.isArray(input.box)||input.box.length!==4||!input.box.every(Number.isFinite)||input.box[0]>input.box[1]||input.box[2]>input.box[3]||!Number.isInteger(input.budget)||input.budget<1||input.budget>12000||!Number.isInteger(input.maxDepth)||input.maxDepth<0||input.maxDepth>32||!Number.isFinite(input.minWidth)||input.minWidth<=0||!input.parameters||typeof input.parameters!=='object'||Array.isArray(input.parameters)||Object.keys(input.parameters).length>128||!Object.values(input.parameters).every(x=>typeof x==='number'&&Number.isFinite(x)))return {ok:false,diagnostic:diagnosis('syntax','invalid-interval-task','Некорректная задача интервального разбиения: проверьте границы, параметры и бюджет 1…12000.')};
 const inverse=input.direction==='image'?compileIntervalMobius(input.mapping!):undefined;if(inverse&&!inverse.ok)return inverse;
 const region=compileIntervalRegion(input.region);if(!region.ok)return region;const mapping=input.mapping===undefined||inverse?undefined:compileIntervalExpression(input.mapping);if(mapping&&!mapping.ok)return mapping;
 let pullback:ReturnType<import('./program').IntervalMobiusProgram['bindInverse']>|undefined;try{pullback=inverse?.ok?inverse.value.bindInverse(input.parameters):undefined;}catch(e){return {ok:false,diagnostic:diagnosticOf(e,'numeric')};}
 input={schema:1,id:input.id,kind:input.kind,region:input.region,...(input.mapping===undefined?{}:{mapping:input.mapping}),...(input.direction?{direction:input.direction}:{}),parameters:{...input.parameters},box:[...input.box],budget:input.budget,maxDepth:input.maxDepth,minWidth:input.minWidth};Object.freeze(input.parameters);Object.freeze(input.box);Object.freeze(input);
 const queue:{box:Box;depth:number}[]=[{box:input.box,depth:0}],data:IntervalSubdivision={inside:[],outside:[],unknown:[],verification:INTERVAL_EVIDENCE,semantics:pullback?'image-region':mapping?'preimage-region':'source-region'};
 let head=0,used=0,final:TaskStep<IntervalSubdivision>|undefined,cancelled:string|undefined,problem:Diagnostic|undefined;
 const task:ComputationTask<IntervalSubdivision,IntervalSubdivisionRequest>={id:input.id,input,cancel:(reason='Расчёт отменён.')=>{if(!final)cancelled=reason;},step(work=32){
  if(final)return final;if(cancelled!==undefined){const reason=diagnosis('cancelled','interval-task-cancelled',cancelled);return final={id:input.id,state:'cancelled',result:{kind:'uncertain',reason,diagnostics:[reason]}};}
  const stop=Math.min(input.budget,used+Math.max(1,Math.min(256,Number.isFinite(work)?Math.floor(work):32)));
  while(head<queue.length&&used<stop){const {box,depth}=queue[head++];used++;let status:CellClassification='unknown',refinable=true;
   try{const z=boxRectangle(box),image=pullback?pullback(z):mapping?.ok?mapping.value.evaluate(z,input.parameters):z;status=region.value.classify(image,input.parameters);}catch(e){const diagnostic=diagnosticOf(e,'numeric');problem??=diagnostic;refinable=!['operation','syntax'].includes(diagnostic.kind);}
   if(status!=='unknown'){data[status].push(box);continue;}
   const mx=box[0]/2+box[1]/2,my=box[2]/2+box[3]/2;
   if(!refinable||depth>=input.maxDepth||Math.max(box[1]-box[0],box[3]-box[2])<=input.minWidth||mx<=box[0]||mx>=box[1]||my<=box[2]||my>=box[3]||queue.length>=input.budget*4){data.unknown.push(box);continue;}
   queue.push(...([[box[0],mx,box[2],my],[mx,box[1],box[2],my],[box[0],mx,my,box[3]],[mx,box[1],my,box[3]]] as Box[]).map(b=>({box:b,depth:depth+1})));
  }
  if(head<queue.length&&used<input.budget)return {id:input.id,state:'pending',evaluations:used};
  const exhausted=head<queue.length;for(;head<queue.length;head++)data.unknown.push(queue[head].box);
  const budget={limit:input.budget,used,unit:'cells' as const,exhausted};let result:MathResult<IntervalSubdivision>;
  if(data.unknown.length){const reason=exhausted?diagnosis('budget','interval-budget','Вычислительный бюджет исчерпан; оставшиеся ячейки не классифицированы.'):problem??diagnosis('uncertain','interval-boundary','Пограничные ячейки требуют дальнейшего уточнения.');result={kind:'uncertain',partial:data,reason,diagnostics:[reason],budget};}
  else result={kind:'interval-confirmed',enclosure:data,verification:INTERVAL_EVIDENCE,diagnostics:[],budget};
  return final={id:input.id,state:'completed',result};
 }};return {ok:true,value:task};
}
