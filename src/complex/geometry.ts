import type {Diagnostic} from '../math/diagnostics';
import { geometrySource } from './parameters';
import { type MathNode } from 'mathjs';
import { circleOffset } from './offset';
import { setConditions } from '../regions/setNotation';
import { parseRegion } from '../regions/parse';
import type { Region, RegionTransform } from '../regions/model';
import { complexSource, evaluateComplex, evaluateComplexNode, parseComplexAst } from './math';
export interface ComplexCoordinate { re: number; im: number }
export type ComplexGeometry =
  | Region
  | { kind: 'point'; value: ComplexCoordinate; modulus: number; argument: number | null }
  | { kind: 'circle'; center: ComplexCoordinate; radius: number }
  | { kind: 'segment'; start: ComplexCoordinate; end: ComplexCoordinate }
  | { kind: 'line'; axis: 're' | 'im'; value: number };
// Future mappings can consume/return coordinates without depending on JSXGraph or React.
export interface ComplexMapping { evaluate: (z: ComplexCoordinate) => ComplexCoordinate | null; cost: number; regionTransform?: RegionTransform; regionDiagnostic?:Diagnostic }
export function parseComplexGeometry(latex: string,parameters:Readonly<Record<string,number>>={}): ComplexGeometry {
  const conditions=setConditions(latex);
  const source = complexSource(conditions??latex).trim();
  if (!source) throw new Error('Введите комплексное число или уравнение объекта.');
  if (conditions!==null || /[<>!]/.test(source) || /\b(?:and|or|notin)\b/.test(source)) return parseRegion(parseComplexAst(geometrySource(latex).source),parameters);
  const parts = source.split('=');
  if (parts.length > 2) throw new Error('Ожидается одно равенство.');
  const left = parts[0].trim();
  if (parts.length === 2 && left !== 'z') {
    const rhs = evaluateComplex(parts[1],parameters);
    if (rhs.im !== 0) throw new Error('Правая часть геометрического уравнения должна быть вещественной.');
    const line = /^(Re|Im|re|im)\s*\(\s*z\s*\)$/.exec(left);
    if (line) return { kind: 'line', axis: line[1].toLowerCase() as 're'|'im', value: rhs.re };
    const node = parseComplexAst(left) as MathNode & { name: string; args: MathNode[]; fn: MathNode };
    if (node.type === 'FunctionNode' && node.fn.type === 'SymbolNode' && node.name === 'abs' && node.args.length === 1) {
      if (rhs.re < 0) throw new Error('Радиус должен быть неотрицательным.');
      const offset = circleOffset(node.args[0],parameters);
      return { kind: 'circle', center: { re: offset.re === 0 ? 0 : -offset.re, im: offset.im === 0 ? 0 : -offset.im }, radius: rhs.re };
    }
    throw new Error('Поддерживаются z = число, |z − (центр)| = радиус, Re(z) = число и Im(z) = число.');
  }
  if(parts.length===1){
    const node=parseComplexAst(source) as MathNode & {name:string;fn:MathNode;args:MathNode[]};
    if(node.type==='FunctionNode' && node.fn.type==='SymbolNode' && node.name==='segment' && node.args.length===2){
      const start=evaluateComplexNode(node.args[0],parameters),end=evaluateComplexNode(node.args[1],parameters);
      return {kind:'segment',start:{re:start.re,im:start.im},end:{re:end.re,im:end.im}};
    }
  }
  const value = evaluateComplex(parts.length === 2 ? parts[1] : source,parameters);
  return { kind: 'point', value: { re: value.re, im: value.im }, modulus: Math.hypot(value.re, value.im), argument: value.re === 0 && value.im === 0 ? null : Math.atan2(value.im, value.re) };
}
