import type {MathfieldElement} from 'mathlive';
export type EditorContext='real'|'complex'|'mapping';
type Selection=MathfieldElement['selection'];
let active:{field:MathfieldElement;context:EditorContext;selection:Selection}|undefined;
export function trackEditor(field:MathfieldElement,context:()=>EditorContext):()=>void {
  const remember=()=>{active={field,context:context(),selection:{...field.selection,ranges:field.selection.ranges.map(r=>[...r] as [number,number])}};};
  const update=()=>{if(active?.field===field)remember();};
  field.addEventListener('focusin',remember);field.addEventListener('selection-change',update);field.addEventListener('input',update);field.addEventListener('focusout',update);
  return ()=>{field.removeEventListener('focusin',remember);field.removeEventListener('selection-change',update);field.removeEventListener('input',update);field.removeEventListener('focusout',update);if(active?.field===field){active=undefined;}};
}
export function activeContext():EditorContext|undefined{return active?.field.isConnected&&!active.field.closest('[inert]')?active.context:undefined;}
// MathLive 0.111 delays its programmatic keyboard-sink focus by 60 ms.
// Native focus uses the custom element's delegatesFocus shadow root immediately,
// so physical keys right after closing a dialog cannot fall into the gap.
function focusEditor(field:MathfieldElement){HTMLElement.prototype.focus.call(field,{preventScroll:true});field.focus();}
export function restoreEditor():MathfieldElement|null {
  const saved=active;
  if(saved?.field.isConnected&&!saved.field.closest('[inert]')){
    const {field,selection}=saved;focusEditor(field);field.selection={...selection,ranges:selection.ranges.map(([a,b])=>[Math.min(a,field.lastOffset),Math.min(b,field.lastOffset)])};return field;
  }
  const first=[...document.querySelectorAll<MathfieldElement>('math-field')].find(m=>!m.closest('[inert]'));
  if(first)focusEditor(first);return first??null;
}
export function insertOperation(latex:string):boolean {return restoreEditor()?.insert(latex,{focus:true,selectionMode:'placeholder'})??false;}
