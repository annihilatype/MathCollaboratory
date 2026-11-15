/** Public, environment-independent mathematical API. Compatibility paths remain. */
export * from './types';
export * from './diagnostics';
export * from './results';
export * from './syntax/document';
export * from './semantics';
export * from './compile';
export * from './domain';
export {availableAlgorithms,defineAlgorithm,mapRegionImage,checkImageMembership,checkRegionMembership,type Algorithm,type AlgorithmCategory} from './algorithms';
export {prepareRegionImageTask,isSerializable,type TaskRequestBase,type RegionImageRequest,type RegionImageData,type ComputationTask,type TaskStep} from './tasks';
export type {ComplexGeometry} from './geometry/types';
export type {ComplexMapping} from './mapping/types';
export {contains,partsOf,intersectRegions,unionRegions,type Region,type RegionConstraint} from './regions/model';

export * from './interval/index';

export {analyzeSourceBox} from './regions/inverse';
