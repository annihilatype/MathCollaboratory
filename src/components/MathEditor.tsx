import {trackEditor} from '../input/editorSession';
import { useEffect, useRef, useState } from 'react';
import { MathfieldElement } from 'mathlive';
MathfieldElement.fontsDirectory = new URL(`${import.meta.env.BASE_URL}fonts`, document.baseURI).href;
MathfieldElement.soundsDirectory = null;
MathfieldElement.locale = 'ru';
export function MathEditor({ value, onChange, label, complexMode = false, mapping=false }: { value: string; onChange: (value: string) => void; label: string; complexMode?: boolean; mapping?:boolean }) {
  const complexRef=useRef(complexMode);complexRef.current=complexMode;
  const mappingRef=useRef(mapping);mappingRef.current=mapping;
  const [error, setError] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathfieldElement | null>(null);
  const valueRef = useRef(value); valueRef.current = value;
  const callback = useRef(onChange); callback.current = onChange;
  useEffect(() => {
    const mf = new MathfieldElement();
    mf.mathVirtualKeyboardPolicy = 'manual';
    mf.smartFence = true;
    mf.setAttribute('aria-label', label);
    mf.value = value;
    mf.addEventListener('keydown', event=>{
      if(!complexRef.current||event.ctrlKey||event.metaKey||mf.mode!=='math')return;
      if(event.key===' '&&/^(?:\\left\s*)?(?:\\lbrace|\\\{|\{)\s*z\s*:/.test(mf.value)){event.preventDefault();event.stopImmediatePropagation();mf.executeCommand(['insert','\\,']);return;}
      if(event.key!=='|')return;
      if(mf.selection.ranges.some(([a,b])=>a!==b))return;
      // MathLive 0.111.4 loses nested smart | fences inside lbrace/rbrace.
      // Use the same literal atoms as its working virtual modulus key.
      event.preventDefault();event.stopImmediatePropagation();
      if(mf.getValue(mf.position,mf.position+1)==='|')mf.executeCommand('moveToNextChar');
      else mf.executeCommand(['insert','|#0|']);
    },{capture:true});
    mf.addEventListener('input', () => {
      if (mf.value.length > 500 && mf.value.length >= valueRef.current.length) {
        mf.setValue(valueRef.current, { silenceNotifications: true });
        setError('Выражение слишком длинное (максимум 500 символов). Ввод отклонён.');
        return;
      }
      setError('');
      valueRef.current = mf.value;
      callback.current(mf.value);
    });
    host.current!.append(mf); field.current = mf;
    mf.inlineShortcuts={...mf.inlineShortcuts,notin:'\\notin'};
    const untrack=trackEditor(mf,()=>mappingRef.current?'mapping':complexRef.current?'complex':'real');
    return () => { untrack();mf.remove(); field.current = null; };
  }, []);
  useEffect(() => { if (field.current && field.current.value !== value) field.current.setValue(value, { silenceNotifications: true }); }, [value]);
  useEffect(() => { field.current?.setAttribute('aria-label', label); }, [label]);
  return <div className="editor"><div ref={host} />{error && <p className="error" role="alert">{error}</p>}</div>;
}
