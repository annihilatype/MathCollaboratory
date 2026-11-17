import {prepareIntervalSubdivision,type IntervalSubdivisionRequest} from './interval/subdivision';
import {mapRegion,type RegionImage} from './regions/transform';
import {imageMembership,createRegionTilingTask,analyzeSourceBox,type InversePlan,type RegionTilingTask} from './regions/inverse';
import type {Region} from './regions/model';
import type {ComplexMapping} from './mapping/types';
import type {ComplexCoordinate,Viewport} from './types';
import {FLOAT64,approximate,uncertain,type MathResult} from './results';
import {contains} from './regions/model';
import {inputError} from './results';
import {diagnosis} from './diagnostics';
export type AlgorithmCategory='analytic-transform'|'equation-solving'|'complex-preimages'|'interval-arithmetic'|'integration'|'differentiation'|'ode'|'geometry'|'adaptive-sampling';
export interface Algorithm<Input,Output>{id:string;category:AlgorithmCategory;description:string;execute:(input:Input)=>Output}
export function defineAlgorithm<I,O>(algorithm:Algorithm<I,O>):Readonly<Algorithm<I,O>>{return Object.freeze(algorithm);}
// Only implemented methods are registered. Future categories promise no capability.
export const mathAlgorithms={
 verifiedRegionClassification:defineAlgorithm({id:'region-coefficients-interval-v1',category:'interval-arithmetic',description:'Верифицированная классификация заданных двоичных коэффициентов, без заявления о точности их прежней нормализации.',execute:({region,box,fallback=false}:{region:Region;box:import('./regions/inverse').Box;fallback?:boolean})=>analyzeSourceBox(region,box,fallback)}),
 verifiedSubdivision:defineAlgorithm({id:'region-predicate-interval-v1',category:'interval-arithmetic',description:'Проверка исходного AST области или прообраза с сохранением десятичных литералов.',execute:(input:IntervalSubdivisionRequest)=>prepareIntervalSubdivision(input)}),
 regionImage:defineAlgorithm<{region:Region;mapping:ComplexMapping},MathResult<RegionImage>>({id:'region-image-v1',category:'analytic-transform',description:'Аналитические семейства с переходом к обратному численному плану.',execute:({region,mapping})=>{
  const image=mapRegion(region,mapping);
  if(image.accuracy==='exact')return {...approximate(image),derivation:{kind:'analytic-formula',law:mapping.regionTransform?.kind??'analytic-region-law'}};
  if(image.accuracy==='approximate')return {...approximate(image),diagnostics:image.diagnostic?[image.diagnostic]:[]};
  const reason=image.diagnostic??diagnosis('operation','region-image-unavailable',image.notice);return {kind:'unsupported',reason,diagnostics:[reason]};
 }}),
 regionMembership:defineAlgorithm<{region:Region;point:ComplexCoordinate},MathResult<boolean>>({id:'region-membership-v1',category:'geometry',description:'Принадлежность существующей модели с допусками float64, без строгой сертификации.',execute:({region,point})=>Number.isFinite(point.re)&&Number.isFinite(point.im)?approximate(contains(region,point)):inputError(diagnosis('syntax','invalid-point','Координаты должны быть конечными.'))}),
 preimageMembership:defineAlgorithm<{plan:InversePlan;point:ComplexCoordinate},MathResult<boolean>>({id:'inverse-membership-v1',category:'complex-preimages',description:'Все допустимые ветви существующего обратного плана; эвристические допуски float64.',execute:({plan,point})=>{
  const result=imageMembership(plan,point);return result==='uncertain'?uncertain(diagnosis('uncertain','inverse-uncertain','Численная проверка прообразов не определила принадлежность.')):approximate(result==='inside');
 }}),
 regionSubdivision:defineAlgorithm<{plan:InversePlan;view:Viewport;unit:number;budget:number;pixelSize:number},RegionTilingTask>({id:'region-subdivision-v1',category:'adaptive-sampling',description:'Возобновляемое разбиение с ограниченным бюджетом, без интервальной сертификации.',execute:({plan,view,unit,budget,pixelSize})=>createRegionTilingTask(plan,view,unit,budget,pixelSize)}),
} as const;
export function availableAlgorithms(){return Object.values(mathAlgorithms).map(({id,category,description})=>({id,category,description}));}
export const mapRegionImage=mathAlgorithms.regionImage.execute;
export const checkImageMembership=mathAlgorithms.preimageMembership.execute;

export const checkRegionMembership=mathAlgorithms.regionMembership.execute;
