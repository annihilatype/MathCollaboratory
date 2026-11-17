import {test,expect,type Locator,type Page} from '@playwright/test';
import {OPERATIONS} from '../src/math/operations';
const field=(p:Page)=>p.locator('math-field[aria-label="Выражение 1"]');
const formula=(p:Page)=>p.locator('math-field[aria-label="Формула отображения"]');
const trigger=(p:Page)=>p.getByRole('button',{name:'Функции',exact:true});
const menu=(p:Page)=>p.getByRole('dialog',{name:'Математические функции'});
async function input(f:Locator,value:string){await f.evaluate((e,value)=>{const m=e as HTMLElement&{value:string};m.value=value;m.dispatchEvent(new InputEvent('input',{bubbles:true}));},value);}
async function keyboard(p:Page){await field(p).click();const button=p.getByRole('button',{name:'⌨ Клавиатура',exact:true});if(await button.getAttribute('aria-expanded')!=='true')await button.click();await expect(p.locator('.keyboard-dock')).toHaveCSS('height','205px');}
async function expectRegistry(p:Page,complex:boolean){
 const names=await menu(p).getByRole('button').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')!.replace('Вставить ','')));
 expect(names.sort()).toEqual(OPERATIONS.filter(o=>complex?o.complex:o.real).map(o=>o.name).sort());
}
test.beforeEach(async({page})=>{await page.setViewportSize({width:1366,height:768});await page.goto('/');await keyboard(page);});
test('fx is a three-column popover with one scroll list, no auxiliary content, and native dismissal',async({page})=>{
 await field(page).click();await trigger(page).click();await expect(menu(page)).toBeVisible();await expect(trigger(page)).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('.keyboard-dock')).toHaveClass(/open/);await expectRegistry(page,false);
 expect(await menu(page).evaluate(e=>e.matches(':popover-open'))).toBe(true);
 await expect(menu(page).locator('input,p,small,code')).toHaveCount(0);await expect(menu(page).locator('.function-menu-scroll')).toHaveCount(1);
 const columns=await menu(page).locator('.function-menu-grid').evaluateAll(es=>es.map(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length));expect(columns.every(n=>n===3)).toBe(true);
 await expect(menu(page).locator('.ML__latex')).toHaveCount(OPERATIONS.filter(o=>o.real).length);
 await trigger(page).click();await expect(menu(page)).toHaveCount(0);await expect(trigger(page)).toHaveAttribute('aria-expanded','false');
 await trigger(page).click();await page.keyboard.press('Escape');await expect(menu(page)).toHaveCount(0);await expect(field(page)).toBeFocused();
 await trigger(page).click();await page.locator('.graph').first().click({position:{x:70,y:120}});await expect(menu(page)).toHaveCount(0);
 await trigger(page).focus();await page.keyboard.press('Enter');await expect(menu(page)).toBeVisible();await expect(menu(page).getByRole('button',{name:'Вставить sin',exact:true})).toBeFocused();await page.keyboard.press('Escape');await page.keyboard.press('Escape');await expect(trigger(page)).toHaveCount(0);
});
test('scrolling and inserting preserve the selected range, keyboard category and board layout',async({page})=>{
 await keyboard(page);await page.getByRole('tab',{name:'Расширенная',exact:true}).click();await input(field(page),'1+2');
 await field(page).evaluate(e=>{const m=e as HTMLElement&{selection:{ranges:[number,number][]}};m.focus();m.selection={ranges:[[2,3]]};});
 const dockBefore=await page.locator('.keyboard-dock').boundingBox(),viewBefore=await page.locator('.graph').first().getAttribute('data-viewport');
 await trigger(page).click();await expect(menu(page)).toBeVisible();await expect(page.getByRole('tab',{name:'Расширенная',exact:true})).toHaveAttribute('aria-selected','true');
 expect(await page.locator('.keyboard-dock').boundingBox()).toEqual(dockBefore);expect(await page.locator('.graph').first().getAttribute('data-viewport')).toBe(viewBefore);
 const scroll=menu(page).locator('.function-menu-scroll');expect(await scroll.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);await scroll.hover();await page.mouse.wheel(0,700);await expect.poll(()=>scroll.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
 await menu(page).getByRole('button',{name:'Вставить round',exact:true}).click();await expect(menu(page)).toHaveCount(0);await expect(field(page)).toBeFocused();await expect.poll(()=>field(page).evaluate(e=>(e as HTMLElement&{value:string}).value)).toMatch(/^1\+\\operatorname\{(?:round|\\mathrm\{round\})\}\(2\)$/);
 await page.keyboard.type('+3');await expect.poll(()=>field(page).evaluate(e=>(e as HTMLElement&{value:string}).value)).toMatch(/^1\+\\operatorname\{(?:round|\\mathrm\{round\})\}\(2\)\+3$/);await expect(page.locator('.keyboard-dock')).toHaveClass(/open/);await expect(page.getByRole('tab',{name:'Расширенная',exact:true})).toHaveAttribute('aria-selected','true');
 await trigger(page).click();await page.keyboard.press('Escape');await expect(page.locator('.keyboard-dock')).toHaveClass(/open/);await page.keyboard.press('Escape');await expect(page.locator('.keyboard-dock')).not.toHaveClass(/open/);
});
test('active complex and mapping editors get their supported functions and receive the insertion',async({page})=>{
 await page.getByRole('switch',{name:'Комплексная плоскость',exact:true}).click();await input(field(page),'z=1+i');await field(page).click();await trigger(page).click();await expectRegistry(page,true);await expect(menu(page).getByRole('button',{name:'Вставить floor',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');
 await page.getByRole('switch',{name:'Отображение',exact:true}).click();await input(formula(page),'1+z');await formula(page).click();await formula(page).evaluate(e=>{const m=e as HTMLElement&{selection:{ranges:[number,number][]}};m.selection={ranges:[[2,3]]};});
 await trigger(page).click();await expectRegistry(page,true);await menu(page).getByRole('button',{name:'Вставить conj',exact:true}).click();await expect.poll(()=>formula(page).evaluate(e=>(e as HTMLElement&{value:string}).value)).toMatch(/^1\+\\operatorname\{(?:conj|\\mathrm\{conj\})\}\(z\)$/);await expect(field(page)).toHaveJSProperty('value','z=1+i');await expect(page.getByRole('alert')).toHaveCount(0);
});
test('popover stays above the keyboard and inside the viewport across sizes and themes',async({page,browserName})=>{
 await keyboard(page);
 for(const [width,height] of [[1366,768],[1024,600],[375,720]]){
  await page.setViewportSize({width,height});await trigger(page).click();await expect(menu(page)).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  await expect.poll(async()=>{const m=(await menu(page).boundingBox())!,b=(await trigger(page).boundingBox())!;return m.x>=7&&m.y>=7&&m.x+m.width<=width-7&&m.y+m.height<=b.y;}).toBe(true);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Тёмная тема',exact:true}).click();await expect(menu(page)).toHaveCount(0);await trigger(page).click();await expect(menu(page)).toHaveCSS('background-color','rgb(25, 33, 49)');
  if(width===1366){const prefix=browserName==='chromium'?'':browserName+'-';await page.screenshot({path:`test-results/${prefix}functions-popover-dark.png`});await page.keyboard.press('Escape');await page.getByRole('button',{name:'Светлая тема',exact:true}).click();await trigger(page).click();await page.screenshot({path:`test-results/${prefix}functions-popover-light.png`});}
  else {await page.keyboard.press('Escape');await page.getByRole('button',{name:'Светлая тема',exact:true}).click();}
  if(await menu(page).count())await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:1366,height:768});await trigger(page).click();await page.setViewportSize({width:768,height:700});await expect(menu(page)).toBeVisible();await expect.poll(async()=>{const m=(await menu(page).boundingBox())!,b=(await trigger(page).boundingBox())!;return m.x>=7&&m.y>=7&&m.x+m.width<=761&&m.y+m.height<=b.y;}).toBe(true);await page.keyboard.press('Escape');
});
