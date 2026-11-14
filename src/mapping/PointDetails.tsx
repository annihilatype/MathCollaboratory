import { mapRegion } from '../regions/transform';
import type { ComplexGeometry, ComplexMapping, ComplexCoordinate } from '../complex/geometry';
export const formatComplex=(z:ComplexCoordinate)=>`${Number(z.re.toPrecision(7))} ${z.im<0?'−':'+'} ${Number(Math.abs(z.im).toPrecision(7))}i`;
export function PointDetails({geometry:g,mapping}:{geometry:ComplexGeometry;mapping?:ComplexMapping|null}){
  if(g.kind==='region'&&mapping){const image=mapRegion(g,mapping);return <p className="object-details region-accuracy" data-accuracy={image.accuracy}>Образ: {image.accuracy==='exact'?'точный':image.accuracy==='approximate'?'численно приближённый':'не поддерживается'}</p>;}
  if(g.kind!=='point')return null;
  const w=mapping?.evaluate(g.value);
  return <p className="object-details">Re = {g.value.re}; Im = {g.value.im}<br/>|z| = {Number(g.modulus.toPrecision(7))}; arg z = {g.argument===null?'не определён':Number(g.argument.toPrecision(7))+' рад'}
    {mapping!==undefined&&<><br/><span className="mapping-value">z = {formatComplex(g.value)} → w = {w?formatComplex(w):'не определено / переполнение'}{w&&Math.max(Math.abs(w.re),Math.abs(w.im))>1e9?' (вне диапазона рисунка)':''}</span></>}
  </p>;
}
