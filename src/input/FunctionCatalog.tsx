import {useEffect,useRef,useState} from 'react';
import {OPERATIONS,type OperationCategory} from '../math/operations';
import {activeContext,insertOperation} from './editorSession';
const categories:OperationCategory[]=['Основная','Комплексная','Расширенная'];
export function FunctionCatalog({complexMode,onClose}:{complexMode:boolean;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),[query,setQuery]=useState('');
  const context=activeContext()??(complexMode?'complex':'real'),isReal=context==='real';
  useEffect(()=>{const d=dialog.current!,opener=document.activeElement as HTMLElement|null;d.showModal();d.querySelector<HTMLInputElement>('input')?.focus();return ()=>{d.close();opener?.focus({preventScroll:true});};},[]);
  const hasEditor=[...document.querySelectorAll('math-field')].some(e=>!e.closest('[inert]'));
  const found=OPERATIONS.filter(o=>`${o.name} ${o.label} ${o.description} ${o.example} ${(o.aliases??[]).join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  function insert(latex:string){dialog.current!.close();insertOperation(latex);onClose();}
  return <dialog ref={dialog} className="function-catalog" aria-labelledby="catalog-title" onKeyDownCapture={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}}} onCancel={event=>{event.preventDefault();onClose();}}>
    <div className="catalog-heading"><div><h2 id="catalog-title">Каталог функций</h2><p>Вставка в активный редактор · {isReal?'Вещественные графики':context==='mapping'?'Отображение w=f(z)':'Комплексная плоскость'}</p></div><button type="button" className="icon-button" aria-label="Закрыть каталог" onClick={onClose}>×</button></div>
    <label className="catalog-search">Поиск функций<input autoFocus type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название или описание"/></label>
    {!hasEditor&&<p role="status">Добавьте выражение, чтобы вставить функцию.</p>}
    <div className="catalog-results">{categories.map(category=>{const entries=found.filter(o=>o.category===category);return entries.length>0&&<section key={category} aria-label={category}><h3>{category}</h3>{entries.map(o=>{const supported=hasEditor&&(isReal?!!o.real:!!o.complex);return <article className="catalog-entry" key={o.name}><div><strong>{o.label}</strong><p>{o.description}</p><code>{o.example}</code><small>Графики: {o.real?'да':'нет'} · Комплексные точки и кривые: {o.complex?'да':'нет'}.<br/>Образы областей: {o.region}</small></div><button type="button" className="small-button" disabled={!supported} aria-label={`Вставить ${o.name}`} title={supported?'Вставить в сохранённую позицию курсора':'Недоступно в активном режиме'} onClick={()=>insert(o.latex)}>Вставить</button></article>;})}</section>;})}{!found.length&&<p role="status">Функции не найдены.</p>}</div>
  </dialog>;
}
