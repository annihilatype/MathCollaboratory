import {useEffect,useRef,useState,type RefObject} from 'react';
import {convertLatexToMarkup} from 'mathlive';
import 'mathlive/static.css';
import {OPERATIONS,type Operation} from '../math/operations';
import {activeContext,insertOperation,restoreEditor,type EditorContext} from './editorSession';
// Only trusted registry labels are rendered as HTML; never user expressions.
const labels=new Map(OPERATIONS.map(o=>[o.name,convertLatexToMarkup(o.menuLatex??`\\operatorname{${o.label}}`)]));
export function FunctionPopover({id,anchor,complexMode,onOpenChange}:{id:string;anchor:RefObject<HTMLButtonElement|null>;complexMode:boolean;onOpenChange:(open:boolean)=>void}){
 const host=useRef<HTMLDivElement>(null),[context,setContext]=useState<EditorContext>(complexMode?'complex':'real');
 const groups=new Map<string,Operation[]>();
 for(const operation of OPERATIONS.filter(o=>context==='real'?o.real:o.complex))groups.set(operation.menuGroup,[...(groups.get(operation.menuGroup)??[]),operation]);
 useEffect(()=>{
  const popup=host.current!,button=anchor.current!;
  function position(){
   if(!popup.matches(':popover-open'))return;
   const rect=button.getBoundingClientRect(),viewport=window.visualViewport,margin=8,gap=9;
   const leftEdge=viewport?.offsetLeft??0,topEdge=viewport?.offsetTop??0,width=viewport?.width??window.innerWidth,height=viewport?.height??window.innerHeight;
   const popupWidth=Math.min(276,width-2*margin),left=Math.max(leftEdge+margin,Math.min(rect.right-popupWidth,leftEdge+width-popupWidth-margin));
   const above=Math.max(0,rect.top-topEdge-margin-gap),below=Math.max(0,topEdge+height-rect.bottom-margin-gap),isAbove=above>=Math.min(160,below);
   popup.style.width=`${popupWidth}px`;popup.style.left=`${left}px`;
   popup.style.top=isAbove?'auto':`${rect.bottom+gap}px`;popup.style.bottom=isAbove?`${window.innerHeight-rect.top+gap}px`:'auto';
   popup.style.setProperty('--functions-height',`${Math.min(340,isAbove?above:below)}px`);
   popup.style.setProperty('--functions-anchor-x',`${Math.max(16,Math.min(popupWidth-26,rect.left+rect.width/2-left))}px`);
   popup.dataset.placement=isAbove?'above':'below';
  }
  function beforeToggle(event:Event){
   const opening=(event as ToggleEvent).newState==='open';
   if(opening){if(!restoreEditor()){event.preventDefault();return;}setContext(activeContext()??(complexMode?'complex':'real'));}
   onOpenChange(opening);
  }
  function toggle(){
   if(popup.matches(':popover-open')){position();popup.querySelector('.function-menu-scroll')!.scrollTop=0;popup.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});}
  }
  function escape(event:KeyboardEvent){
   if(event.key!=='Escape'||!popup.matches(':popover-open')||document.querySelector('dialog[open]'))return;
   event.preventDefault();event.stopPropagation();popup.hidePopover();if(!restoreEditor())button.focus({preventScroll:true});
  }
  const observer=new ResizeObserver(position);observer.observe(button);const dock=document.getElementById('math-keyboard');if(dock)observer.observe(dock);
  popup.addEventListener('beforetoggle',beforeToggle);popup.addEventListener('toggle',toggle);
  document.addEventListener('keydown',escape,true);document.addEventListener('scroll',position,true);window.addEventListener('resize',position);
  window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);
  return ()=>{observer.disconnect();popup.removeEventListener('beforetoggle',beforeToggle);popup.removeEventListener('toggle',toggle);document.removeEventListener('keydown',escape,true);document.removeEventListener('scroll',position,true);window.removeEventListener('resize',position);window.visualViewport?.removeEventListener('resize',position);window.visualViewport?.removeEventListener('scroll',position);};
 },[anchor,complexMode,onOpenChange]);
 return <div ref={host} id={id} popover="auto" role="dialog" aria-label="Математические функции" className="function-popover">
  <div className="function-menu-scroll">{[...groups].map(([group,operations])=><section key={group} aria-label={group}>
   <h3>{group}</h3><div className="function-menu-grid">{operations.map(o=><button type="button" key={o.name} aria-label={`Вставить ${o.name}`} onPointerDown={e=>e.preventDefault()} onClick={()=>{host.current!.hidePopover();insertOperation(o.latex);}}><span aria-hidden="true" dangerouslySetInnerHTML={{__html:labels.get(o.name)!}}/></button>)}</div>
  </section>)}</div>
 </div>;
}
