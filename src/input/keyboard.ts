import {OPERATIONS,type OperationCategory} from '../math/operations';
import type {VirtualKeyboardLayout,VirtualKeyboardKeycap} from 'mathlive';
type Key=string|Partial<VirtualKeyboardKeycap>;
const funcs=(category:OperationCategory,complex:boolean):Key[]=>OPERATIONS.filter(o=>o.category===category&&(complex?o.complex:o.real)).map(o=>({label:o.label,insert:o.latex,tooltip:o.description,class:'small'}));
const tail:Key[]=['[left]','[right]','[backspace]'];
export type KeyboardCategory='main'|'complex'|'advanced';
export function keyboardLayouts(complex:boolean):VirtualKeyboardLayout[]{
  const basic=funcs('Основная',complex),advanced=funcs('Расширенная',complex);
  return [{id:'laboratory',label:'',displayEditToolbar:false,layers:[
    {id:'main',rows:[[complex?'z':'x','a','7','8','9','+','-','(',')'],['\\pi','e','4','5','6','\\times','\\frac{#0}{#0}','#@^{#0}','\\sqrt{#0}'],['a','b','1','2','3','0','.','|#0|','[backspace]'],[...basic.filter(k=>typeof k!=='string'&&k.label!=='√'),'[left]','[right]']]},
    {id:'complex',rows:[['z','i','a','b','\\rho',...tail],[...funcs('Комплексная',true),{label:'|z|',insert:'|#0|',tooltip:'Модуль'},'\\pi'],['=','<','>','\\le','\\ge',{label:'≠',insert:'\\ne'},'[',']'],[{label:'{z: …}',insert:'\\lbrace z:#0\\rbrace',tooltip:'Множество, удовлетворяющее условиям'},',',{label:'∩',insert:'\\land',tooltip:'Пересечение условий'},{label:'∪',insert:'\\lor',tooltip:'Объединение условий'},{label:'∉',insert:'\\notin',tooltip:'Исключить точку или отрезок'},'|#0|','[left]','[right]']]},
    {id:'advanced',rows:[advanced.slice(0,6),[...advanced.slice(6),'#@^{2}','#@^{3}','#@^{-1}','\\sqrt{#0}'],['(',')','|#0|','\\frac{#0}{#0}','\\pi','e'],[complex?'z':'x','a',...tail]]},
  ].filter(layer=>complex||layer.id!=='complex')}];
}
