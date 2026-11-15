import type {Region} from '../regions/model';
import type {Box} from '../regions/inverse';
import type {MathResult} from '../results';
import * as R from './real';
import * as C from './complex';
import {classificationResult,failedInterval,type CellClassification} from './program';
export const boxRectangle=(box:Box)=>C.rectangle(R.interval(box[0],box[1]),R.interval(box[2],box[3]));
/** Proof applies to the supplied binary64 coefficients, NOT the pre-normalized input. */
export function coefficientRegionStatus(region:Region,z:C.ComplexInterval):CellClassification {
 let status:CellClassification='inside';
 if(region.union){const states=region.union.map(r=>coefficientRegionStatus(r,z));status=states.includes('inside')?'inside':states.every(s=>s==='outside')?'outside':'unknown';if(status==='outside')return status;}
 for(const q of region.constraints){
  const norm=R.add(R.integerPower(z.re,2),R.integerPower(z.im,2)),value=R.add(R.add(R.multiply(R.interval(q.a),norm),R.multiply(R.interval(q.b),z.re)),R.add(R.multiply(R.interval(q.c),z.im),R.interval(q.d)));
  if(q.strict?value.lower>=0:value.lower>0)return 'outside';
  if(!(q.strict?value.upper<0:value.upper<=0))status='unknown';
 }
 for(const p of region.excluded){if(R.includes(z.re,R.interval(p.re))&&R.includes(z.im,R.interval(p.im))){if(R.singleton(z.re,p.re)&&R.singleton(z.im,p.im))return 'outside';status='unknown';}}
 for(const s of region.excludedSegments??[]){
  const re=R.interval(Math.min(s.start.re,s.end.re),s.ray?Infinity:Math.max(s.start.re,s.end.re)),im=R.interval(Math.min(s.start.im,s.end.im),s.ray?Infinity:Math.max(s.start.im,s.end.im));
  // Rays may point in either direction: defer their classification entirely.
  if(s.ray||R.intersection(z.re,re)&&R.intersection(z.im,im))status='unknown';
 }
 return status;
}
export function classifyCoefficientRegion(region:Region,box:Box):MathResult<CellClassification>{try{return classificationResult(coefficientRegionStatus(region,boxRectangle(box)));}catch(e){return failedInterval(e);}}
