import { complexSource, evaluateComplex } from './math';
export interface ComplexCoordinate { re: number; im: number }
export type ComplexGeometry =
  | { kind: 'point'; value: ComplexCoordinate; modulus: number; argument: number | null }
  | { kind: 'circle'; center: ComplexCoordinate; radius: number }
  | { kind: 'line'; axis: 're' | 'im'; value: number };
// Future mappings can consume/return coordinates without depending on JSXGraph or React.
export interface ComplexMapping { evaluate: (z: ComplexCoordinate) => ComplexCoordinate }
export function parseComplexGeometry(latex: string): ComplexGeometry {
  const source = complexSource(latex).trim();
  if (!source) throw new Error('Введите комплексное число или уравнение объекта.');
  const parts = source.split('=');
  if (parts.length > 2) throw new Error('Ожидается одно равенство.');
  const left = parts[0].trim();
  if (parts.length === 2 && left !== 'z') {
    const rhs = evaluateComplex(parts[1]);
    if (rhs.im !== 0) throw new Error('Правая часть геометрического уравнения должна быть вещественной.');
    const line = /^(Re|Im|re|im)\s*\(\s*z\s*\)$/.exec(left);
    if (line) return { kind: 'line', axis: line[1].toLowerCase() as 're'|'im', value: rhs.re };
    const circle = /^(?:\|\s*(z(?:\s*-\s*.+)?)\s*\||abs\(\s*(z(?:\s*-\s*.+)?)\s*\))$/.exec(left);
    if (circle) {
      if (rhs.re < 0) throw new Error('Радиус должен быть неотрицательным.');
      const body = (circle[1] ?? circle[2]).trim();
      const offset = body.replace(/^z\s*-\s*/, '');
      let depth = 0;
      const wrapped = offset.startsWith('(') && offset.endsWith(')') && [...offset].every((c,index) => {
        if (c === '(') depth++; if (c === ')') depth--;
        return depth > 0 || (depth === 0 && index === offset.length-1);
      });
      if (body !== 'z' && !wrapped && !/^[+-]?[\d.]+$/.test(offset)) throw new Error('Укажите центр в скобках: |z − (1+i)| = 2.');
      const center = body === 'z' ? { re: 0, im: 0 } : evaluateComplex(offset);
      return { kind: 'circle', center: { re: center.re, im: center.im }, radius: rhs.re };
    }
    throw new Error('Поддерживаются z = число, |z − (центр)| = радиус, Re(z) = число и Im(z) = число.');
  }
  const value = evaluateComplex(parts.length === 2 ? parts[1] : source);
  return { kind: 'point', value: { re: value.re, im: value.im }, modulus: Math.hypot(value.re, value.im), argument: value.re === 0 && value.im === 0 ? null : Math.atan2(value.im, value.re) };
}
