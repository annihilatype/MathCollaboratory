import {OPERATION_NAMES,canonicalName} from '../operations';
export function normalizeOperationLatex(source:string):string{
  for(let depth=0;depth<16;depth++){
    const next=source.replace(/\\(?:operatorname|mathrm|mathop)\s*\{\s*([a-zA-Z]+)\s*\}/g,(whole,name:string)=>OPERATION_NAMES.has(name)||['e','i','pi'].includes(name)?canonicalName(name):whole);
    if(next===source)break;source=next;
  }
  return source.replace(/\\(arcsin|arccos|arctan)(?![a-zA-Z])/g,(_m,name:string)=>`\\${canonicalName(name)}`);
}
