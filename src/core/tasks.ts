import {compileMapping,bindMapping} from './compile';
import {mathAlgorithms,mapRegionImage} from './algorithms';
import {valueOf,FLOAT64,diagnosticOf,uncertain,approximate,type MathResult,type Validation} from './results';
import {diagnosis} from './diagnostics';
import type {ExpressionSource} from './syntax/document';
import type {Region} from './regions/model';
import type {InversePlan,RegionTiling} from './regions/inverse';
import type {Viewport,RealScope} from './types';
export interface TaskRequestBase {schema:1;id:string;kind:string}
export interface RegionImageRequest extends TaskRequestBase {kind:'region-image';region:Region;mapping:{source:ExpressionSource;parameters:RealScope};view:Viewport;unit:number;budget:number;pixelSize:number}
export type RegionImageData={kind:'analytic-region';region:Region}|{kind:'sampled-region';tiling:RegionTiling};
export type TaskStep<T>={id:string;state:'pending';evaluations:number}|{id:string;state:'completed'|'cancelled';result:MathResult<T>};
export type ReadonlyData<T> = T extends object?{readonly [P in keyof T]:ReadonlyData<T[P]>}:T;
export interface ComputationTask<T,Input extends TaskRequestBase=RegionImageRequest>{readonly id:string;readonly input:ReadonlyData<Input>;step:(work?:number)=>TaskStep<T>;cancel:(reason?:string)=>void}
/** JSON-safe data only: no AST instances, closures, NaN/Infinity or cycles. */
export function isSerializable(value:unknown):boolean {
 const seen=new Set<object>();let size=0;
 function visit(v:unknown,depth:number):boolean {
  if(++size>12000||depth>40)return false;
  if(v===null||typeof v==='string'||typeof v==='boolean')return true;
  if(typeof v==='number')return Number.isFinite(v);
  if(typeof v!=='object'||seen.has(v))return false;
  if(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)return false;
  seen.add(v);const valid=Object.values(v).every(x=>visit(x,depth+1));seen.delete(v);return valid;
 }return visit(value,0);
}
function validRegion(r:Region,depth=0):boolean{
 if(!r||r.kind!=='region'||depth>2||!Array.isArray(r.constraints)||r.constraints.length>24||!Array.isArray(r.excluded)||r.excluded.length>48)return false;
 if(!r.constraints.every(q=>q&&[q.a,q.b,q.c,q.d].every(Number.isFinite)&&typeof q.strict==='boolean'))return false;
 if(!r.excluded.every(p=>p&&[p.re,p.im].every(Number.isFinite)))return false;
 if(r.excludedSegments!==undefined&&(!Array.isArray(r.excludedSegments)||r.excludedSegments.length>24||!r.excludedSegments.every(s=>s.start&&s.end&&[s.start.re,s.start.im,s.end.re,s.end.im].every(Number.isFinite))))return false;
 if(r.equality!==undefined){const e=r.equality;if(!e||typeof e!=='object')return false;if(e.kind==='circle'){if(!e.center||![e.center.re,e.center.im,e.radius].every(Number.isFinite)||e.radius<0)return false;}else if(e.kind==='line'){if(!['re','im'].includes(e.axis)||!Number.isFinite(e.value))return false;}else return false;}
 return r.union===undefined||(Array.isArray(r.union)&&r.union.length>0&&r.union.length<=16&&r.union.every(p=>validRegion(p,depth+1)));
}
function validate(input:RegionImageRequest):Validation<RegionImageRequest>{
 if(!isSerializable(input)||input.schema!==1||input.kind!=='region-image'||typeof input.id!=='string'||!input.id||input.id.length>128||!validRegion(input.region)||!input.mapping||input.mapping.source?.role!=='mapping'||!input.mapping.parameters||typeof input.mapping.parameters!=='object'||Array.isArray(input.mapping.parameters)||!Object.values(input.mapping.parameters).every(v=>typeof v==='number'&&Number.isFinite(v))||!Array.isArray(input.view)||input.view.length!==4||!input.view.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e12)||input.view[2]<=input.view[0]||input.view[1]<=input.view[3]||!Number.isFinite(input.unit)||input.unit<=0||input.unit>1e15||!Number.isInteger(input.budget)||input.budget<1||input.budget>12000||!Number.isFinite(input.pixelSize)||input.pixelSize<=0)return {ok:false,diagnostic:diagnosis('syntax','invalid-task','Недопустимая или несериализуемая вычислительная задача; бюджет 1…12000.')};
 return {ok:true,value:input};
}
export function prepareRegionImageTask(input:RegionImageRequest):Validation<ComputationTask<RegionImageData>>{
 const checked=validate(input);if(!checked.ok)return checked;
 // A worker message owns its snapshot; later caller mutations cannot change a job.
 input=JSON.parse(JSON.stringify(input)) as RegionImageRequest;
 const freeze=(v:unknown):void=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}};freeze(input);
 const compiled=compileMapping(input.mapping.source);if(!compiled.ok)return compiled;const bound=bindMapping(compiled.value,input.mapping.parameters);if(!bound.ok)return bound;
 const image=mapRegionImage({region:input.region,mapping:bound.value}),data=valueOf(image);
 if(data?.region){const result:MathResult<RegionImageData>={kind:'approximate',value:{kind:'analytic-region',region:data.region},derivation:{kind:'analytic-formula',law:bound.value.regionTransform?.kind??'analytic-region-law'},accuracy:FLOAT64,diagnostics:[]};return {ok:true,value:completedTask(input,result)};}
 if(!data?.approximation)return {ok:false,diagnostic:image.kind==='unsupported'||image.kind==='input-error'||image.kind==='uncertain'?image.reason:diagnosis('domain','no-area-task','Образ не является двумерной областью для дискретизации.')};
 return {ok:true,value:createBoundRegionTask(input,data.approximation)};
}
function completedTask(input:RegionImageRequest,result:MathResult<RegionImageData>):ComputationTask<RegionImageData>{return {id:input.id,input,step:()=>({id:input.id,state:'completed',result}),cancel:()=>{}};}
/** Internal fast path for a plan already prepared from this request by the core. */
export function createBoundRegionTask(input:RegionImageRequest,plan:InversePlan):ComputationTask<RegionImageData>{
 const task=mathAlgorithms.regionSubdivision.execute({...input,plan});let final:TaskStep<RegionImageData>|undefined,cancelled:string|undefined;
 return {id:input.id,input,cancel:(reason='Расчёт отменён.')=>{if(!final)cancelled=reason;},step:(work=32)=>{
  if(final)return final;
  if(cancelled){final={id:input.id,state:'cancelled',result:uncertain(diagnosis('cancelled','task-cancelled',cancelled))};return final;}
  try{
   const data=task.step(Math.max(1,Math.min(256,Number.isFinite(work)?Math.floor(work):32)));
   if(!data)return {id:input.id,state:'pending',evaluations:task.evaluations??0};
   const budget={limit:input.budget,used:data.evaluations,unit:'cells' as const,exhausted:data.truncated},value:RegionImageData={kind:'sampled-region',tiling:data};
   const result:MathResult<RegionImageData>=data.unresolved.length?uncertain(diagnosis(data.truncated?'budget':'uncertain',data.truncated?'sampling-budget':'unresolved-cells','Часть ячеек не определена; допуски float64 не являются строгой интервальной гарантией.'),value,budget):{...approximate(value),budget};
   final={id:input.id,state:'completed',result};return final;
  }catch(e){final={id:input.id,state:'completed',result:uncertain(diagnosticOf(e,'numeric'))};return final;}
 }};
}
