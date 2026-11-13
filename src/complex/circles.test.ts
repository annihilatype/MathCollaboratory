import { it, expect } from 'vitest';
import { parseComplexGeometry } from './geometry';
it.each([
 ['|z-i|=2',0,1,2],['|z-1-i|=2',1,1,2],['|z+2i|=3',0,-2,3],['|z-(1+i)|=2',1,1,2],['|z|=2',0,0,2],
 ['|z+2+3i|=4',-2,-3,4],['|z-1+i|=2',1,-1,2],['|z-(1+i)+(2)|=2',-1,1,2],
 ['abs(z-conj(1+i))=2',1,-1,2],['|z-\\frac{1+i}{2}|=1',.5,.5,1],['|z-(-2-3i)|=2',-2,-3,2],
 ['|z|=0',0,0,0],['|+(z)+i|=2',0,-1,2],
])('parses %s structurally',(s,re,im,radius)=>expect(parseComplexGeometry(s as string)).toEqual({kind:'circle',center:{re,im},radius}));
it.each(['|z^2|=2','|z*z|=2','|1/z|=2','|conj(z)|=2','|z-z+z|=2','|2z|=2','|-z+i|=2','|3+i|=2','|z+1/0|=2','|z|=-1','|z|=i','|z|=z','|z+i|=2=3','|z+foo(1)|=2','|z+import("x")|=2'])('rejects unsafe or unsupported %s',s=>expect(()=>parseComplexGeometry(s)).toThrow());
