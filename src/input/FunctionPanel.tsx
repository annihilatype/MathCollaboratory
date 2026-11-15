import {useEffect,useRef,useState} from 'react';
import {OPERATIONS,type OperationCategory} from '../math/operations';
import {activeContext,insertOperation} from './editorSession';
const categories:OperationCategory[]=['Основная','Комплексная','Расширенная'];
/** Inline view of the same operation registry used by the MathLive keyboard. */
export function FunctionPanel({complexMode,onBack}:{complexMode:boolean;onBack:()=>void}){
 const search=useRef<HTMLInputElement>(null),[query,setQuery]=useState(''),[category,setCategory]=useState<OperationCategory|null>(null);
 const context=activeContext()??(complexMode?'complex':'real'),isReal=context==='real';
 useEffect(()=>{search.current?.focus();},[]);
 const hasEditor=[...document.querySelectorAll('math-field')].some(e=>!e.closest('[inert]'));
 const found=OPERATIONS.filter(o=>(!category||o.category===category)&&`${o.name} ${o.label} ${o.description} ${o.example} ${(o.aliases??[]).join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <section className="function-panel" aria-label="Математические функции" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onBack();}}}>
  <div className="function-search-row"><button type="button" className="small-button" onPointerDown={e=>e.preventDefault()} onClick={onBack}>← Клавиатура</button><label>Поиск функций<input ref={search} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название или описание"/></label><span>{isReal?'Вещественные графики':context==='mapping'?'Отображение w=f(z)':'Комплексная плоскость'}</span></div>
  <div className="function-categories" role="group" aria-label="Категории функций"><button type="button" aria-pressed={category===null} onClick={()=>setCategory(null)}>Все</button>{categories.map(c=><button type="button" key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
  <div className="function-results">{found.map(o=>{const supported=hasEditor&&(isReal?!!o.real:!!o.complex);return <article className="function-entry" key={o.name}><button type="button" disabled={!supported} aria-label={`Вставить ${o.name}`} title={supported?'Вставить в сохранённую позицию курсора':'Недоступно в активном режиме'} onClick={()=>{insertOperation(o.latex);onBack();}}>{o.label}</button><div><p>{o.description}</p><code>{o.example}</code><small>{supported?'Доступна':'Недоступна'} в текущем режиме · {o.category}<br/>Образы областей: {o.region}</small></div></article>;})}{!found.length&&<p role="status">Функции не найдены.</p>}</div>
 </section>;
}
