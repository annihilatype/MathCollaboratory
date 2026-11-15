import type {RegionConstraint} from '../regions/model';
import type {Viewport} from '../types';
export function halfplanePolygon(q:RegionConstraint,view:Viewport):[number,number][]{
  const corners:[number,number][]=[[view[0],view[1]],[view[2],view[1]],[view[2],view[3]],[view[0],view[3]]],out:[number,number][]=[];
  const value=(p:number[])=>q.b*p[0]+q.c*p[1]+q.d;
  for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],av=value(a),bv=value(b);if(av<=0)out.push(a);if((av<0&&bv>0)||(av>0&&bv<0)){const t=av/(av-bv);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;
}
