import {useEffect,useRef,useState} from 'react';
import {keyboardLayouts,type KeyboardCategory} from './keyboard';
import {restoreEditor} from './editorSession';
import {FunctionCatalog} from './FunctionCatalog';
export function MathInputTools({complexMode,children}:{complexMode:boolean;children:React.ReactNode}){
  const [open,setOpen]=useState(false),[catalog,setCatalog]=useState(false),[category,setCategory]=useState<KeyboardCategory>('main');
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const keyboard=window.mathVirtualKeyboard;keyboard.container=host.current;keyboard.editToolbar='none';
    const toggle=()=>setOpen(keyboard.visible);keyboard.addEventListener('virtual-keyboard-toggle',toggle);
    return ()=>{keyboard.removeEventListener('virtual-keyboard-toggle',toggle);keyboard.hide({animate:false});keyboard.container=null;};
  },[]);
  useEffect(()=>{const keyboard=window.mathVirtualKeyboard;keyboard.layouts=keyboardLayouts(complexMode);setCategory('main');
    // MathLive rebuilds layouts on its next frame. Select after that rebuild so
    // a previous complex layer cannot survive switching back to real graphs.
    const frame=requestAnimationFrame(()=>{if(keyboard.visible){restoreEditor();keyboard.executeCommand(['switchKeyboardLayer','main']);}});
    return ()=>cancelAnimationFrame(frame);
  },[complexMode]);
  useEffect(()=>{
    function escape(e:KeyboardEvent){if(e.key==='Escape'&&window.mathVirtualKeyboard.visible&&!document.querySelector('dialog[open]')){e.preventDefault();window.mathVirtualKeyboard.hide({animate:false});restoreEditor();}}
    document.addEventListener('keydown',escape);return ()=>document.removeEventListener('keydown',escape);
  },[]);
  function show(){if(window.mathVirtualKeyboard.visible)window.mathVirtualKeyboard.hide({animate:false});else{restoreEditor();window.mathVirtualKeyboard.show({animate:false});}}
  const categories=([['main','Основная'],...(complexMode?[['complex','Комплексная']]:[]),['advanced','Расширенная']] as [KeyboardCategory,string][]);
  function change(next:KeyboardCategory){setCategory(next);restoreEditor();window.mathVirtualKeyboard.executeCommand(['switchKeyboardLayer',next]);}
  return <>
    {children}
    <div className="input-toolbar"><span>Математический ввод</span><button type="button" aria-expanded={open} aria-controls="math-keyboard" onPointerDown={e=>e.preventDefault()} onClick={show}>⌨ Клавиатура</button><button type="button" aria-haspopup="dialog" onPointerDown={e=>e.preventDefault()} onClick={()=>setCatalog(true)}>ƒ Функции</button></div>
    <section id="math-keyboard" className={`keyboard-dock ${open?'open':''}`} aria-label="Математическая клавиатура" aria-hidden={!open} inert={!open}>
      <div className="keyboard-heading"><div role="tablist" aria-label="Категории клавиатуры">{categories.map(([key,label],index)=><button type="button" key={key} role="tab" tabIndex={category===key?0:-1} aria-selected={category===key} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?categories.length-1:(index+(e.key==='ArrowRight'?1:-1)+categories.length)%categories.length;change(categories[next][0]);(e.currentTarget.parentElement!.children[next] as HTMLButtonElement).focus();}} onPointerDown={e=>e.preventDefault()} onClick={()=>change(key)}>{label}</button>)}</div><button type="button" className="icon-button" aria-label="Закрыть клавиатуру" onClick={()=>{window.mathVirtualKeyboard.hide({animate:false});restoreEditor();}}>×</button></div>
      <div className="keyboard-host" ref={host}/>
    </section>
    {catalog&&<FunctionCatalog complexMode={complexMode} onClose={()=>setCatalog(false)}/>}
  </>;
}
