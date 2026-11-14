import { useEffect, useRef, useState } from 'react';
import { MathfieldElement } from 'mathlive';
MathfieldElement.fontsDirectory = new URL(`${import.meta.env.BASE_URL}fonts`, document.baseURI).href;
MathfieldElement.soundsDirectory = null;
MathfieldElement.locale = 'ru';
function configureKeyboard(complexMode: boolean) { window.mathVirtualKeyboard.layouts = [{ label: 'Математика', rows: [
  ['x', 'a', 'b', '7', '8', '9', '+', '-'],
  ['\\sin', '\\cos', '\\tan', '4', '5', '6', '\\times', '\\frac{#0}{#0}'],
  ['\\ln', '\\log', '\\exp', '1', '2', '3', '(', ')'],
  ['\\pi', 'e', '\\sqrt{#0}', '0', '.', '#@^{#0}', '|#0|', '[backspace]'],
  ...(complexMode ? [['z', 'i', '\\operatorname{conj}(#0)', '\\operatorname{abs}(#0)', '\\operatorname{arg}(#0)', '\\operatorname{Re}(#0)', '\\operatorname{Im}(#0)'], ['<', '>', '\\le', '\\ge', '\\land', '=', '|#0|']] : []),
  ['[left]', '[right]', { label: 'Готово', command: 'hideVirtualKeyboard' }],
] }]; }
export function MathEditor({ value, onChange, label, complexMode = false }: { value: string; onChange: (value: string) => void; label: string; complexMode?: boolean }) {
  useEffect(() => { configureKeyboard(complexMode); }, [complexMode]);
  const complexRef=useRef(complexMode);complexRef.current=complexMode;
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
      if(!complexRef.current||event.key!=='|'||event.ctrlKey||event.metaKey)return;
      if(!/^(?:\\left\s*)?(?:\\lbrace|\\\{|\{)\s*z\s*:/.test(mf.value))return;
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
    return () => { mf.remove(); field.current = null; };
  }, []);
  useEffect(() => { if (field.current && field.current.value !== value) field.current.setValue(value, { silenceNotifications: true }); }, [value]);
  useEffect(() => { field.current?.setAttribute('aria-label', label); }, [label]);
  return <div className="editor"><div ref={host} />{error && <p className="error" role="alert">{error}</p>}</div>;
}
