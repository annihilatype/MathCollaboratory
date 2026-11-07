import { useEffect, useRef } from 'react';
import { MathfieldElement } from 'mathlive';
MathfieldElement.fontsDirectory = new URL(`${import.meta.env.BASE_URL}fonts`, document.baseURI).href;
MathfieldElement.soundsDirectory = null;
MathfieldElement.locale = 'ru';
window.mathVirtualKeyboard.layouts = [{ label: 'Математика', rows: [
  ['x', 'a', 'b', '7', '8', '9', '+', '-'],
  ['\\sin', '\\cos', '\\tan', '4', '5', '6', '\\times', '\\frac{#0}{#0}'],
  ['\\ln', '\\log', '\\exp', '1', '2', '3', '(', ')'],
  ['\\pi', 'e', '\\sqrt{#0}', '0', '.', '#@^{#0}', '|#0|', '[backspace]'],
  ['[left]', '[right]', { label: 'Готово', command: 'hideVirtualKeyboard' }],
] }];
export function MathEditor({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathfieldElement | null>(null);
  const callback = useRef(onChange); callback.current = onChange;
  useEffect(() => {
    const mf = new MathfieldElement();
    mf.mathVirtualKeyboardPolicy = 'manual';
    mf.smartFence = true;
    mf.setAttribute('aria-label', label);
    mf.value = value;
    mf.addEventListener('input', () => callback.current(mf.value));
    host.current!.append(mf); field.current = mf;
    return () => { mf.remove(); field.current = null; };
  }, []);
  useEffect(() => { if (field.current && field.current.value !== value) field.current.setValue(value, { silenceNotifications: true }); }, [value]);
  return <div className="editor" ref={host} />;
}
