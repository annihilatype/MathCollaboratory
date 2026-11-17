import {test,expect,type Locator,type Page} from '@playwright/test';
const field=(p:Page)=>p.locator('math-field[aria-label="Выражение 1"]');
const formula=(p:Page)=>p.locator('math-field[aria-label="Формула отображения"]');
async function input(f:Locator,s:string){await f.evaluate((e,s)=>{const m=e as HTMLElement&{value:string};m.value=s;m.dispatchEvent(new InputEvent('input',{bubbles:true}));},s);}
const layer=(p:Page)=>p.locator('.MLK__layer.is-visible');
test.beforeEach(async({page})=>{await page.setViewportSize({width:1366,height:768});await page.goto('/');});
test('fraction, power, root, backspace and arrows fit their keys and retain MathLive templates across sizes/themes',async({page})=>{
 await field(page).click();await page.getByRole('button',{name:'⌨ Клавиатура',exact:true}).click();
 for(const width of [1366,1024]){await page.setViewportSize({width,height:768});for(const dark of [false,true]){
  if(dark)await page.getByRole('button',{name:'Тёмная тема',exact:true}).click();
  const keys=layer(page).locator('.template-fraction,.template-power,.template-root,.laboratory-action');await expect(keys).toHaveCount(6);
  const boxes=await keys.evaluateAll(es=>es.map(e=>{const k=e.getBoundingClientRect(),label=e.querySelector('.ML__latex,svg')!.getBoundingClientRect();return {k:k.toJSON(),label:label.toJSON()};}));
  for(const {k,label} of boxes){expect(k.height).toBe(30);expect(Math.abs(k.width-boxes[0].k.width)).toBeLessThan(1);expect(label.top).toBeGreaterThanOrEqual(k.top-1);expect(label.bottom).toBeLessThanOrEqual(k.bottom+1);expect(label.left).toBeGreaterThanOrEqual(k.left);expect(label.right).toBeLessThanOrEqual(k.right);}
  expect(await layer(page).textContent()).not.toContain('[backspace]');
  if(dark)await page.getByRole('button',{name:'Светлая тема',exact:true}).click();
 }}
 await input(field(page),'');await layer(page).locator('.template-fraction').click();await page.keyboard.type('1');await page.keyboard.press('ArrowDown');await page.keyboard.type('2');await expect.poll(()=>field(page).evaluate(e=>(e as HTMLElement&{value:string}).value)).toMatch(/^\\frac(?:\{1\}\{2\}|12)$/);await expect(page.getByRole('alert')).toHaveCount(0);
 await input(field(page),'x');await field(page).evaluate(e=>{const m=e as HTMLElement&{position:number;lastOffset:number};m.position=m.lastOffset;});await layer(page).locator('.template-power').click();await page.keyboard.type('3');await expect(field(page)).toHaveJSProperty('value','x^3');
 await input(field(page),'');await layer(page).locator('.template-root').click();await page.keyboard.type('4');await expect.poll(()=>field(page).evaluate(e=>(e as HTMLElement&{value:string}).value)).toMatch(/^\\sqrt(?:\{4\}|4)$/);await expect(page.getByRole('alert')).toHaveCount(0);
 await input(field(page),'123');await field(page).evaluate(e=>{const m=e as HTMLElement&{position:number;lastOffset:number};m.position=m.lastOffset;});await layer(page).locator('[data-tooltip="Курсор влево"]').click();await layer(page).locator('[data-tooltip="Удалить слева"]').click();await expect(field(page)).toHaveJSProperty('value','13');await layer(page).locator('[data-tooltip="Курсор вправо"]').click();await page.keyboard.type('4');await expect(field(page)).toHaveJSProperty('value','134');
 await page.keyboard.press('Escape');await page.getByRole('switch',{name:'Комплексная плоскость',exact:true}).click();await input(field(page),'');await field(page).click();await page.getByRole('button',{name:'⌨ Клавиатура',exact:true}).click();await layer(page).locator('.template-root').click();await page.keyboard.type('4');await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.locator('.object-details')).toContainText('2');
});
test('fx popover leaves the ordinary keyboard and its selection in place',async({page})=>{
 await field(page).click();await page.getByRole('button',{name:'⌨ Клавиатура',exact:true}).click();await page.getByRole('tab',{name:'Расширенная',exact:true}).click();await expect(page.locator('.keyboard-dock')).toHaveCSS('height','205px');
 await input(field(page),'1+2');await field(page).evaluate(e=>{const m=e as HTMLElement&{selection:{ranges:[number,number][]}};m.focus();m.selection={ranges:[[2,3]]};});
 const before=await page.locator('.keyboard-dock').boundingBox();await page.getByRole('button',{name:'Функции',exact:true}).click();const menu=page.getByRole('dialog',{name:'Математические функции'});await expect(menu).toBeVisible();
 await expect(page.getByRole('tab',{name:'Расширенная',exact:true})).toHaveAttribute('aria-selected','true');await expect(layer(page)).toBeVisible();expect(await page.locator('.keyboard-dock').boundingBox()).toEqual(before);
 await menu.getByRole('button',{name:'Вставить sin',exact:true}).click();await expect(menu).toHaveCount(0);await expect(field(page)).toHaveJSProperty('value','1+\\sin(2)');await expect(field(page)).toBeFocused();await page.keyboard.type('+3');await expect(field(page)).toHaveJSProperty('value','1+\\sin(2)+3');
 await page.getByRole('button',{name:'Функции',exact:true}).click();await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(layer(page)).toBeVisible();
});

test('image notice and expandable diagnostics stay above the board while zooming and resizing',async({page,browserName})=>{
 await page.getByRole('switch',{name:'Комплексная плоскость',exact:true}).click();await input(field(page),'1<|z|<2');await page.getByRole('switch',{name:'Отображение',exact:true}).click();await input(formula(page),'exp(z)');
 const path=page.locator('.image-slot [data-geometry="region-image"]');await expect(path).toHaveAttribute('data-quality','settled');
 const notice=page.locator('.image-precision'),graph=page.locator('.image-slot .graph');await expect(notice).toHaveText('Приближённое построение · возможны неточности у границ');
 async function outside(){const n=(await page.locator('.image-note').boundingBox())!,g=(await graph.boundingBox())!;expect(n.y+n.height).toBeLessThanOrEqual(g.y+1);expect(await graph.locator('.region-notice').count()).toBe(0);expect(await graph.evaluate(e=>Math.abs(Number((e as HTMLElement).dataset.unitX)/Number((e as HTMLElement).dataset.unitY)-1))).toBeLessThan(1e-8);}
 await outside();await page.getByText('Численные подробности',{exact:true}).click();await expect(page.locator('.sampling-details')).toBeVisible();await outside();await graph.dispatchEvent('wheel',{deltaY:-15,ctrlKey:true});await expect(path).toHaveAttribute('data-quality','settled');await outside();await page.getByText('Численные подробности',{exact:true}).click();
 await formula(page).click();await page.getByRole('button',{name:'⌨ Клавиатура',exact:true}).click();const prefix=browserName==='chromium'?'':browserName+'-';await page.screenshot({path:`test-results/${prefix}verified-v061-light.png`});await page.getByRole('button',{name:'Тёмная тема',exact:true}).click();await page.screenshot({path:`test-results/${prefix}verified-v061-dark.png`});await page.getByRole('button',{name:'Функции',exact:true}).click();await page.screenshot({path:`test-results/${prefix}functions-v061-dark.png`});
 await page.setViewportSize({width:1024,height:768});await outside();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);await input(formula(page),'1/');await expect(page.getByRole('alert')).toBeVisible();await expect(notice).toHaveCount(0);
});
