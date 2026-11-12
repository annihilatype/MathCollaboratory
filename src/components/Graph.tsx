import { useEffect, useRef, useState } from 'react';
import JXG from 'jsxgraph';
import { drawComplexObjects, type ComplexPlot } from '../complex/render';
import { REAL_VIEW, COMPLEX_VIEW, validViewport, type Viewport } from '../state/view';
import type { ParsedExpression } from '../math/expression';
import { sampleFunction } from '../math/sample';
export interface Plot { id: string; color: string; parsed: ParsedExpression }
export function Graph({ plots, parameters, theme, mode = 'real', viewport, onViewportChange, objects = [] }: { plots: Plot[]; parameters: Record<string, number>; theme: 'light'|'dark'; mode?: 'real'|'complex'; viewport?: Viewport; onViewportChange?: (v: Viewport) => void; objects?: ComplexPlot[] }) {
  const host = useRef<HTMLDivElement>(null);
  const board = useRef<JXG.Board | null>(null);
  const curves = useRef<JXG.Curve[]>([]);
  const scope = useRef(parameters); scope.current = parameters;
  const [cursor, setCursor] = useState<[number,number] | null>(null);
  const bounds = useRef<Viewport>(viewport ?? (mode === 'complex' ? COMPLEX_VIEW : REAL_VIEW));
  const viewportCallback = useRef(onViewportChange); viewportCallback.current = onViewportChange;
  const geometry = useRef<JXG.GeometryElement[]>([]);
  useEffect(() => {
    const dark = theme === 'dark';
    const b = JXG.JSXGraph.initBoard(host.current!, {
      boundingbox: bounds.current, keepaspectratio: true, axis: true,
      showCopyright: false, showNavigation: false, showInfobox: false,
      pan: { enabled: true, needShift: false }, zoom: { wheel: true, needShift: false, factorX: 1.2, factorY: 1.2 },
      defaultAxes: { x: { name: mode === 'complex' ? 'Re(z)' : 'x', withLabel: true, label: { position: 'rt', offset: mode === 'complex' ? [-50, 15] : [-15, 15], strokeColor: dark ? '#aab6ca' : '#67758a' }, strokeColor: dark ? '#8593aa' : '#8693a8', ticks: { strokeColor: dark ? '#65758d' : '#b5c0cf', label: { strokeColor: dark ? '#aab6ca' : '#67758a' }, minorTicks: 0 } }, y: { name: mode === 'complex' ? 'Im(z)' : 'y', withLabel: true, label: { position: 'rt', offset: [15, -15], strokeColor: dark ? '#aab6ca' : '#67758a' }, strokeColor: dark ? '#8593aa' : '#8693a8', ticks: { strokeColor: dark ? '#65758d' : '#b5c0cf', label: { strokeColor: dark ? '#aab6ca' : '#67758a' }, minorTicks: 0 } } },
    });
    b.create('grid', [], { strokeColor: dark ? '#293349' : '#e5eaf2', strokeOpacity: 0.8 });
    board.current = b;
    const changed = () => {
      const view = b.getBoundingBox();
      if (host.current) {
        host.current.dataset.unitX = String(b.unitX); host.current.dataset.unitY = String(b.unitY);
        host.current.dataset.viewport = JSON.stringify(view);
      }
      if (validViewport(view)) { bounds.current = view; viewportCallback.current?.(view); }
    };
    b.on('boundingbox', changed);

    const observer = new ResizeObserver(() => {
      if (!host.current || host.current.parentElement!.clientWidth === 0) return;
      const bb = b.getBoundingBox(), cx = (bb[0]+bb[2])/2, cy=(bb[1]+bb[3])/2;
      const halfY=(bb[1]-bb[3])/2;
      b.resizeContainer(host.current.parentElement!.clientWidth,host.current.parentElement!.clientHeight,true);
      const halfX=halfY*host.current.parentElement!.clientWidth/host.current.parentElement!.clientHeight;
      b.setBoundingBox([cx-halfX,cy+halfY,cx+halfX,cy-halfY],true);
    });
    observer.observe(host.current!.parentElement!);
    b.on('move', (event: Event) => { const pos = b.getUsrCoordsOfMouse(event as MouseEvent); setCursor([pos[0],pos[1]]); });
    return () => { b.off('boundingbox', changed); bounds.current = b.getBoundingBox(); observer.disconnect(); curves.current=[]; geometry.current=[]; JXG.JSXGraph.freeBoard(b); board.current=null; };
  }, [theme]);
  useEffect(() => {
    const b = board.current!;
    b.suspendUpdate();
    for (const curve of curves.current) b.removeObject(curve);
    curves.current = plots.map(plot => {
      const curve = b.create('curve', [[], []], { strokeColor: plot.color, strokeWidth: 2.8, highlight: false, fixed: true });
      curve.updateDataArray = function () {
        const bb = b.getBoundingBox();
        const data = sampleFunction(x => plot.parsed.evaluate(x, scope.current), bb[0], bb[2], b.canvasWidth, b.unitY);
        this.dataX = data.xs; this.dataY = data.ys;
      };
      return curve;
    });
    b.unsuspendUpdate();
  }, [plots, theme]);
  useEffect(() => {
    const b = board.current!; b.suspendUpdate();
    geometry.current.forEach(object => b.removeObject(object));
    geometry.current = drawComplexObjects(b, objects);
    b.unsuspendUpdate();
  }, [objects, theme]);
  useEffect(() => { board.current?.update(); }, [parameters]);
  function reset() { board.current?.setBoundingBox(mode === 'complex' ? COMPLEX_VIEW : REAL_VIEW,true); }
  return <section className="graph-panel" aria-label={mode === 'complex' ? 'Комплексная плоскость' : 'Координатная плоскость'}>
    <div className="graph" ref={host} onMouseLeave={() => setCursor(null)} />
    <div className="graph-caption"><span className="live-dot" />{mode === 'complex' ? 'Комплексная плоскость' : 'Координатная плоскость'} <span className="radians">Радианы</span></div>
    <div className="graph-tools"><button aria-label="Приблизить" title="Приблизить" onClick={() => board.current?.zoomIn()}>+</button><button aria-label="Отдалить" title="Отдалить" onClick={() => board.current?.zoomOut()}>−</button><div /><button aria-label="Стандартный масштаб" title="Стандартный масштаб" onClick={reset}>⌂</button></div>
    <div className="graph-bottom"><span>Перетаскивайте плоскость · Колёсико для масштаба</span><output>{cursor ? `${mode === 'complex' ? 'Re' : 'x'}: ${cursor[0].toFixed(2)}   ${mode === 'complex' ? 'Im' : 'y'}: ${cursor[1].toFixed(2)}` : mode === 'complex' ? 'Re: —   Im: —' : 'x: —   y: —'}</output></div>
  </section>;
}
