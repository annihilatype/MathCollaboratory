import {useRef,type PointerEvent} from 'react';
import type {VirtualKeyboardKeycap} from 'mathlive';
import {restoreEditor} from './editorSession';
/** MathLive connects its message receiver 60ms after focus. Dispatch via its
 * public editor API so the first key after a toolbar/theme click is not lost.
 * Key definitions still come from MathLive's normalized registry. */
export function useKeyboardPointer(){
 const pending=useRef<{id:number;key:Partial<VirtualKeyboardKeycap>;element:HTMLElement}|null>(null);
 function clear(){pending.current?.element.classList.remove('is-pressed');pending.current=null;}
 return {
  onPointerDownCapture(event:PointerEvent<HTMLDivElement>){
   if(event.button!==0)return;const element=(event.target as Element).closest<HTMLElement>('.MLK__keycap,.laboratory-action'),key=element&&window.mathVirtualKeyboard.getKeycap(element.id);
   if(!element||!key||!restoreEditor())return;
   event.preventDefault();event.stopPropagation();clear();pending.current={id:event.pointerId,key,element};element.classList.add('is-pressed');element.setPointerCapture(event.pointerId);
  },
  onPointerUpCapture(event:PointerEvent<HTMLDivElement>){
   const press=pending.current;if(!press||press.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();clear();const box=press.element.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)return;
   const field=restoreEditor();if(!field)return;let key=press.key;
   if((event.shiftKey||window.mathVirtualKeyboard.isShifted)&&key.shift)key=typeof key.shift==='string'?{insert:key.shift}:key.shift;
   if(key.command)field.executeCommand(key.command as Parameters<typeof field.executeCommand>[0]);
   else if(key.insert||key.latex)field.insert(key.insert||key.latex!,{focus:true,format:'latex',mode:'math',selectionMode:'placeholder'});
   else if(key.key)field.executeCommand(['typedText',key.key]);
  },
  onPointerCancelCapture(){clear();},
 };
}
