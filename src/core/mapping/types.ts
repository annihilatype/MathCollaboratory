import type {ExpressionSource} from '../syntax/document';
import type {RealScope} from '../types';
import type {ComplexCoordinate} from '../types';
import type {RegionTransform} from '../regions/model';
import type {Diagnostic} from '../diagnostics';
export interface ComplexMapping { evaluate:(z:ComplexCoordinate)=>ComplexCoordinate|null; cost:number;regionTransform?:RegionTransform;regionDiagnostic?:Diagnostic;definition?:{source:ExpressionSource;parameters:RealScope} }
