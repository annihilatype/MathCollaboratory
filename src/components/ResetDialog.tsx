import { useEffect, useRef } from 'react';

export function ResetDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    return () => { element.close(); opener?.focus(); };
  }, []);
  return <dialog ref={dialog} className="reset-dialog" aria-labelledby="reset-title" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id="reset-title">Сбросить построения?</h2>
    <p>Построения и область просмотра текущего режима будут сброшены. Данные другого режима сохранятся.</p>
    <div><button autoFocus onClick={onCancel}>Отмена</button><button onClick={onConfirm}>Подтвердить сброс</button></div>
  </dialog>;
}
