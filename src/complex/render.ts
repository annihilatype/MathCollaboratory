import JXG from 'jsxgraph';
import type { ComplexGeometry } from './geometry';
export interface ComplexPlot { id: string; color: string; geometry: ComplexGeometry }
export function drawComplexObjects(board: JXG.Board, plots: ComplexPlot[]): JXG.GeometryElement[] {
  return plots.map(({geometry:g, color}) => {
    const style = { strokeColor: color, fillColor: color, highlight: false, fixed: true };
    if (g.kind === 'point') return board.create('point', [g.value.re, g.value.im], { ...style, name: '', size: 4, withLabel: false });
    if (g.kind === 'circle') return board.create('circle', [[g.center.re,g.center.im],g.radius], { ...style, strokeWidth: 2.5, fillOpacity: 0 });
    return board.create('line', g.axis === 're' ? [-g.value,1,0] : [-g.value,0,1], { ...style, strokeWidth: 2.5 });
  });
}
