import type {ComplexCoordinate} from '../types';
import type {Region} from '../regions/model';
export type ComplexGeometry =
  | Region
  | { kind: 'point'; value: ComplexCoordinate; modulus: number; argument: number | null }
  | { kind: 'circle'; center: ComplexCoordinate; radius: number }
  | { kind: 'segment'; start: ComplexCoordinate; end: ComplexCoordinate }
  | { kind: 'line'; axis: 're' | 'im'; value: number };
