import {test,expect,type Locator,type Page} from '@playwright/test';
const field=(p:Page)=>p.locator('math-field[aria-label="Выражение 1"]');
const mapping=(p:Page)=>p.locator('math-field[aria-label="Формула отображения"]');
const image=(p:Page)=>p.locator('.image-slot [data-object-id="complex-point"][data-geometry="region-image"]');
const key=(p:Page,label:RegExp)=>p.locator('.MLK__layer.is-visible .MLK__keycap').filter({hasText:label});
async function input(f:Locator,latex:string){await f.evaluate((e,s)=>{const m=e as HTMLElement&{value:string};m.value=s;m.dispatchEvent(new InputEvent('input',{bubbles:true}));},latex);}
async function ready(p:Page){await expect(image(p)).toHaveAttribute('data-quality','settled');await expect(image(p)).toHaveAttribute('d',/M/);}
async function inside(p:Page,x:number,y:number){return image(p).evaluate((path,z)=>{const g=path.closest('.graph') as HTMLElement,v=JSON.parse(g.dataset.viewport!);return (path as SVGGeometryElement).isPointInFill(new DOMPoint((z[0]-v[0])*Number(g.dataset.unitX),(v[1]-z[1])*Number(g.dataset.unitY)));},[x,y]);}
async function complex(p:Page){await p.getByRole('switch',{name:'Комплексная плоскость',exact:true}).click();}
test.beforeEach(async({page})=>{await page.setViewportSize({width:1366,height:768});await page.goto('/');});

test('explicit compact keyboard preserves cursor across categories, physical typing, Escape and modes',async({page})=>{
 await field(page).click();await expect(page.locator('.keyboard-dock')).not.toHaveClass(/open/);
 await input(field(page),'1+2');await field(page).evaluate(e=>{const m=e as HTMLElement&{position:number};m.focus();m.position=1;});
 await page.getByRole('button',{name:'⌨ Клавиатура',exact:true}).click();await expect(page.locator('.keyboard-dock')).toHaveClass(/open/);
 await page.getByRole('tab',{name:'Расширенная',exact:true}).click();await expect(key(page,/^sinh$/)).toBeVisible();
 await page.getByRole('tab',{name:'Основная',exact:true}).click();expect(await field(page).evaluate(e=>(e as HTMLElement&{position:number}).position)).toBe(1);
 await key(page,/^5$/).click();await expect(field(page)).toHaveJSProperty('value','15+2');await page.keyboard.type('4');await expect(field(page)).toHaveJSProperty('value','154+2');
 const graph=(await page.locator('.graph').first().boundingBox())!,dock=(await page.locator('.keyboard-dock').boundingBox())!;expect(graph.y+graph.height).toBeLessThanOrEqual(dock.y);expect(dock.height).toBeLessThan(220);expect(graph.height).toBeGreaterThan(400);
 const visibleKeys=await page.locator('.MLK__layer.is-visible .MLK__keycap').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));for(const k of visibleKeys){expect(k.bottom).toBeLessThanOrEqual(768);expect(k.top).toBeGreaterThanOrEqual(dock.y);}
 await page.keyboard.press('Escape');await expect(page.locator('.keyboard-dock')).not.toHaveClass(/open/);await expect(field(page)).toBeFocused();
 await complex(page);await field(page).click();await page.getByRole('button',{name:'⌨ Клавиатура',exact:true}).click();await page.getByRole('tab',{name:'Комплексная',exact:true}).click();await expect(key(page,/^Re$/)).toBeVisible();await expect(key(page,/^∉$/)).toBeVisible();
 await page.getByRole('tab',{name:'Расширенная',exact:true}).click();await expect(key(page,/^floor$/)).toHaveCount(0);
 await page.getByRole('tab',{name:'Комплексная',exact:true}).click();await page.getByRole('switch',{name:'Комплексная плоскость',exact:true}).click();await expect(page.getByRole('tab',{name:'Основная',exact:true})).toHaveAttribute('aria-selected','true');await expect(key(page,/^Re$/)).toHaveCount(0);await expect(key(page,/^5$/)).toBeVisible();await expect(field(page)).toHaveJSProperty('value','154+2');await page.keyboard.press('Escape');
});

test('catalog searches supported operations and inserts at the saved MathLive selection',async({page})=>{
 await input(field(page),'1+2');await field(page).evaluate(e=>{const m=e as HTMLElement&{selection:{ranges:[number,number][]}};m.focus();m.selection={ranges:[[2,3]]};});
 await page.getByRole('button',{name:'ƒ Функции',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Каталог функций'});await expect(dialog).toBeVisible();await expect(page.getByRole('searchbox',{name:'Поиск функций'})).toBeFocused();
 await page.getByRole('searchbox',{name:'Поиск функций'}).fill('синус');await expect(dialog.getByText('Синус; аргумент в радианах.',{exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Вставить sin',exact:true}).click();
 await expect(dialog).toHaveCount(0);await expect(field(page)).toBeFocused();await expect(field(page)).toHaveJSProperty('value','1+\\sin(2)');await expect(page.getByRole('alert')).toHaveCount(0);
 await page.keyboard.type('+3');await expect(field(page)).toHaveJSProperty('value','1+\\sin(2)+3');
 await page.getByRole('button',{name:'ƒ Функции',exact:true}).click();await page.getByRole('searchbox',{name:'Поиск функций'}).fill('conj');await expect(page.getByRole('button',{name:'Вставить conj',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await complex(page);await page.getByRole('switch',{name:'Отображение',exact:true}).click();await input(mapping(page),'');await mapping(page).click();await page.getByRole('button',{name:'ƒ Функции',exact:true}).click();await page.getByRole('searchbox',{name:'Поиск функций'}).fill('exp');await page.getByRole('button',{name:'Вставить exp',exact:true}).click();await page.keyboard.type('z');await expect(mapping(page)).toHaveJSProperty('value','\\exp(z)');
});

test('MathLive Euler/exp forms map the whole half strip and compositions retain inverse membership',async({page})=>{
 await page.setViewportSize({width:1600,height:960});await complex(page);await input(field(page),'\\left\\{z:0<\\operatorname{Im}(z)<\\frac{\\pi}{2},\\operatorname{Re}(z)>0\\right\\}');await page.getByRole('switch',{name:'Отображение',exact:true}).click();
 for(const f of ['\\exp(2\\cdot z)','\\mathrm{e}^{2z}']){await input(mapping(page),f);await ready(page);expect(await inside(page,2,2)).toBe(true);expect(await inside(page,.5,.5)).toBe(false);expect(await inside(page,2,-1)).toBe(false);expect(await inside(page,2,0)).toBe(false);}
 await expect(page.locator('.region-notice')).toHaveAttribute('data-diagnostic','uncertain');await expect(page.locator('.image-slot [data-uncertainty-for="complex-point"]')).toHaveAttribute('d',/M/);
 await input(field(page),'|z|<.8');for(const f of ['exp(z^2)','sin(z)','1/(z^2+1)']){await input(mapping(page),f);await ready(page);await expect(page.getByRole('alert')).toHaveCount(0);}
 await input(mapping(page),'exp(z)+z');await expect(page.locator('.region-notice')).toHaveAttribute('data-diagnostic','operation');await expect(page.locator('.region-notice')).toContainText('обратного плана');
 await input(field(page),'Re(z)>0');await input(mapping(page),'exp(z)');await expect(page.locator('.region-notice')).toHaveAttribute('data-diagnostic','preimages');await expect(page.locator('.region-notice')).toContainText('видимое окно');
});

test('color changes reuse sampling, rapid edits cancel stale plans, reload retains state',async({page})=>{
 await page.setViewportSize({width:1600,height:960});await complex(page);await input(field(page),'{z:0<Im(z)<pi/2,Re(z)>0}');await page.getByRole('switch',{name:'Отображение',exact:true}).click();await input(mapping(page),'exp(a*z)');await ready(page);
 const initial=await image(page).getAttribute('data-generation'),data=await image(page).getAttribute('d');await page.getByLabel('Цвет объекта 1',{exact:true}).fill('#ff3366');await expect(image(page)).toHaveAttribute('fill','#ff3366');expect(await image(page).getAttribute('data-generation')).toBe(initial);expect(await image(page).getAttribute('d')).toBe(data);
 for(const a of ['1','3','2']){await page.getByLabel('Значение параметра a',{exact:true}).fill(a);await page.getByLabel('Значение параметра a',{exact:true}).press('Enter');}
 await ready(page);expect(await inside(page,2,-1)).toBe(false);expect(await inside(page,2,2)).toBe(true);
 const graph=page.locator('.image-slot .graph');for(let i=0;i<8;i++)await graph.dispatchEvent('wheel',{deltaX:5,deltaY:2});await expect.poll(async()=>(await image(page).getAttribute('data-sample-view'))===(await graph.getAttribute('data-viewport'))).toBe(true);
 await page.reload();await ready(page);await expect(page.getByLabel('Значение параметра a',{exact:true})).toHaveValue('2');await expect(image(page)).toHaveAttribute('fill','#ff3366');
});

test('desktop keyboard and catalog screenshots in both themes; reduced motion',async({page,browserName})=>{
 await complex(page);await page.getByRole('switch',{name:'Отображение',exact:true}).click();await input(field(page),'{z:0<Im(z)<pi/2,Re(z)>0}');await input(mapping(page),'exp(2*z)');await mapping(page).click();await page.getByRole('button',{name:'⌨ Клавиатура',exact:true}).click();await page.getByRole('tab',{name:'Комплексная',exact:true}).click();await ready(page);
 const prefix=browserName==='chromium'?'':browserName+'-';await page.screenshot({path:`test-results/${prefix}keyboard-v051-light.png`});await page.getByRole('button',{name:'Тёмная тема',exact:true}).click();await page.screenshot({path:`test-results/${prefix}keyboard-v051-dark.png`});
 await page.getByRole('button',{name:'ƒ Функции',exact:true}).click();await page.screenshot({path:`test-results/${prefix}catalog-v051-dark.png`});await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.keyboard-dock')).toHaveCSS('transition-duration','0s');await page.keyboard.press('Escape');await expect(page.locator('.keyboard-dock')).not.toHaveClass(/open/);
});
