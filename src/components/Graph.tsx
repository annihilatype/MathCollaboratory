import { useEffect, useRef, useState } from 'react';
import JXG from 'jsxgraph';
import { attachWheelNavigation } from './wheelNavigation';
import { constrainViewport } from './planeNavigation';
import { createObjectLayer, type DrawablePlot, type PointMove } from '../complex/render';
import { REAL_VIEW, COMPLEX_VIEW, validViewport, type Viewport } from '../state/view';
import type { ParsedExpression } from '../math/expression';
import { sampleFunction } from '../math/sample';
const EMPTY_OBJECTS:DrawablePlot[]=[];
export interface Plot { id: string; color: string; parsed: ParsedExpression }
export function Graph({ plots, parameters, theme, mode = 'real', viewport, onViewportChange, objects = EMPTY_OBJECTS, onPointMove, axisSymbol = 'z', label }: { plots: Plot[]; parameters: Record<string, number>; theme: 'light'|'dark'; mode?: 'real'|'complex'; viewport?: Viewport; onViewportChange?: (v: Viewport) => void; objects?: DrawablePlot[]; onPointMove?: PointMove; axisSymbol?: 'z'|'w'; label?:string }) {
  const host = useRef<HTMLDivElement>(null);
  const board = useRef<JXG.Board | null>(null);
  const curves = useRef<JXG.Curve[]>([]);
  const scope = useRef(parameters); scope.current = parameters;
  const [cursor, setCursor] = useState<[number,number] | null>(null);
  const bounds = useRef<Viewport>(viewport ?? (mode === 'complex' ? COMPLEX_VIEW : REAL_VIEW));
  const viewportCallback = useRef(onViewportChange); viewportCallback.current = onViewportChange;
  const layer = useRef<ReturnType<typeof createObjectLayer>|null>(null);
  const pointMove = useRef(onPointMove);pointMove.current=onPointMove;
  useEffect(() => {
    const dark = theme === 'dark';
    const b = JXG.JSXGraph.initBoard(host.current!, {
      boundingbox: bounds.current, keepaspectratio: true, axis: true, resize:{enabled:false,throttle:0},
      showCopyright: false, showNavigation: false, showInfobox: false,
      pan: { enabled: true, needShift: false }, zoom: { wheel: false, min: 1e-8, max: 1e8, needShift: false, factorX: 1.2, factorY: 1.2 },
      defaultAxes: { x: { name: mode === 'complex' ? `Re(${axisSymbol})` : 'x', withLabel: true, label: { position: 'rt', offset: mode === 'complex' ? [-50, 15] : [-15, 15], strokeColor: dark ? '#aab6ca' : '#67758a' }, strokeColor: dark ? '#8593aa' : '#8693a8', ticks: { strokeColor: dark ? '#65758d' : '#b5c0cf', label: { strokeColor: dark ? '#aab6ca' : '#67758a' }, minorTicks: 4, minorHeight: 4, minTicksDistance: 12 } }, y: { name: mode === 'complex' ? `Im(${axisSymbol})` : 'y', withLabel: true, label: { position: 'rt', offset: [15, -15], strokeColor: dark ? '#aab6ca' : '#67758a' }, strokeColor: dark ? '#8593aa' : '#8693a8', ticks: { strokeColor: dark ? '#65758d' : '#b5c0cf', label: { strokeColor: dark ? '#aab6ca' : '#67758a' }, minorTicks: 4, minorHeight: 4, minTicksDistance: 12 } } },
    });
    // JSXGraph derives the spacing from adaptive axis ticks; both grids are
    // batched SVG curves, rather than a DOM element per line.
    const gridOptions = {
      majorStep: 'auto', minorElements: 'auto', forceSquare: 'max',
      strokeColor: dark ? '#46536b' : '#c9d3e3',
      major: { face: 'line', strokeWidth: 1, strokeOpacity: 0.85, drawZero: false },
      minor: { face: 'line', strokeWidth: 0.7, strokeColor: dark ? '#303c50' : '#e3e9f2', strokeOpacity: 0.65, drawZero: false },
    };
    const grid = b.create('grid', [b.defaultAxes.x, b.defaultAxes.y], gridOptions) as JXG.Grid & { minorGrid: JXG.Grid };
    grid.rendNode.setAttribute('data-grid', 'major');
    grid.minorGrid.rendNode.setAttribute('data-grid', 'minor');
    board.current = b;
    layer.current=createObjectLayer(b,()=>pointMove.current);
    const detachWheel = attachWheelNavigation(host.current!, b);
    const changed = () => {
      const view = b.getBoundingBox();
      const bounded = constrainViewport(view);
      if (bounded !== view) { b.setBoundingBox(bounded,true,'update'); return; }
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
      const unit=b.unitY;
      b.suspendUpdate();
      b.resizeContainer(host.current.parentElement!.clientWidth,host.current.parentElement!.clientHeight,true);
      const halfX=host.current.parentElement!.clientWidth/(2*unit),halfY=host.current.parentElement!.clientHeight/(2*unit);
      b.setBoundingBox([cx-halfX,cy+halfY,cx+halfX,cy-halfY],true);
      b.unsuspendUpdate();
    });
    observer.observe(host.current!.parentElement!);
    b.on('move', (event: Event) => { const pos = b.getUsrCoordsOfMouse(event as MouseEvent); setCursor([pos[0],pos[1]]); });
    return () => { detachWheel(); b.off('boundingbox', changed); bounds.current = b.getBoundingBox(); observer.disconnect(); curves.current=[]; layer.current=null; JXG.JSXGraph.freeBoard(b); board.current=null; };
  }, [theme,axisSymbol]);
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
  useEffect(() => { layer.current?.update(objects); }, [objects,theme,axisSymbol,onPointMove]);
  useEffect(() => { board.current?.update(); }, [parameters]);
  function reset() { board.current?.setBoundingBox(mode === 'complex' ? COMPLEX_VIEW : REAL_VIEW,true); }
  return <section className="graph-panel" aria-label={label ?? (mode === 'complex' ? 'Комплексная плоскость' : 'Координатная плоскость')}>
    <div className="graph" ref={host} onMouseLeave={() => setCursor(null)} />
    <div className="graph-caption"><span className="live-dot" />{label ?? (mode === 'complex' ? 'Комплексная плоскость' : 'Координатная плоскость')} <span className="radians">Радианы</span></div>
    <div className="graph-tools"><button aria-label="Приблизить" title="Приблизить" onClick={() => board.current?.zoomIn()}>+</button><button aria-label="Отдалить" title="Отдалить" onClick={() => board.current?.zoomOut()}>−</button><div /><button aria-label="Стандартный масштаб" title="Стандартный масштаб" onClick={reset}>⌂</button></div>
    <div className="graph-bottom"><span>Прокрутка — перемещение · Ctrl + прокрутка — масштаб</span><output>{cursor ? `${mode === 'complex' ? 'Re' : 'x'}: ${cursor[0].toFixed(2)}   ${mode === 'complex' ? 'Im' : 'y'}: ${cursor[1].toFixed(2)}` : mode === 'complex' ? 'Re: —   Im: —' : 'x: —   y: —'}</output></div>
  </section>;
}
