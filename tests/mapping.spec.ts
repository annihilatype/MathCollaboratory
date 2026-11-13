import { test, expect, type Page, type Locator } from '@playwright/test';
const complex=(p:Page)=>p.getByRole('switch',{name:'Комплексная плоскость',exact:true});
const toggle=(p:Page)=>p.getByRole('switch',{name:'Отображение',exact:true});
const source=(p:Page)=>p.locator('.source-slot .graph');
const image=(p:Page)=>p.locator('.image-slot .graph');
async function input(field:Locator,value:string){await field.evaluate((e,value)=>{const f=e as HTMLElement&{value:string};f.value=value;f.dispatchEvent(new InputEvent('input',{bubbles:true}));},value);}
const formula=(p:Page,s:string)=>input(p.locator('math-field[aria-label="Формула отображения"]'),s);
const point=(p:Page,s:string)=>input(p.locator('math-field[aria-label="Выражение 1"]'),s);
const unit=(g:Locator)=>g.evaluate(e=>Number((e as HTMLElement).dataset.unitY));
const view=(g:Locator)=>g.evaluate(e=>JSON.parse((e as HTMLElement).dataset.viewport!));
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('math-field')).toHaveCount(2);await complex(page).click();await expect(source(page)).toHaveAttribute('data-viewport',/.+/);});

test('animated layout retains board identities, center and unit scale through rapid toggles',async({page})=>{
  const s=source(page),beforeUnit=await unit(s),beforeView=await view(s),id=await s.getAttribute('id');
  const fullWidth=(await s.boundingBox())!.width;
  await toggle(page).focus();await page.keyboard.press('Space');await expect(toggle(page)).toBeChecked();
  await expect(image(page)).toHaveAttribute('data-viewport',/.+/);
  await expect.poll(async()=>(await s.boundingBox())!.width).toBeLessThan(fullWidth*.6);
  expect(await s.getAttribute('id')).toBe(id);expect(await unit(s)).toBeCloseTo(beforeUnit,6);
  const after=await view(s);expect((after[0]+after[2])/2).toBeCloseTo((beforeView[0]+beforeView[2])/2,6);expect((after[1]+after[3])/2).toBeCloseTo((beforeView[1]+beforeView[3])/2,6);
  const imageId=await image(page).getAttribute('id');
  for(let i=0;i<6;i++)await toggle(page).click();
  await expect(toggle(page)).toBeChecked();
  await toggle(page).evaluate(e=>{for(let i=0;i<4;i++)(e as HTMLButtonElement).click();});
  await expect(toggle(page)).toBeChecked();
  expect(await s.getAttribute('id')).toBe(id);expect(await image(page).getAttribute('id')).toBe(imageId);
  await toggle(page).click();await expect(page.locator('.image-slot')).toHaveCSS('visibility','hidden');
  await expect.poll(async()=>(await s.boundingBox())!.width).toBeGreaterThan(fullWidth*.99);
  expect(await s.getAttribute('id')).toBe(id);expect(await unit(s)).toBeCloseTo(beforeUnit,6);
  await toggle(page).click();await expect(image(page)).toHaveAttribute('id',imageId!);
});

test('point values, poles, point dragging and independent zoom persist',async({page})=>{
  await point(page,'z=1+i');await toggle(page).click();await formula(page,'z^2');
  await expect(page.locator('.mapping-value')).toContainText('w = 0 + 2i');
  const s=source(page),im=image(page);await expect.poll(async()=>(await im.boundingBox())!.width).toBeGreaterThan(300);
  const sourceUnit=await unit(s),imageUnit=await unit(im);
  await page.getByRole('region',{name:'Плоскость образов w',exact:true}).getByRole('button',{name:'Приблизить',exact:true}).click();
  await expect.poll(async()=>unit(im)).toBeGreaterThan(imageUnit);expect(await unit(s)).toBeCloseTo(sourceUnit,6);
  await formula(page,'1/z');await point(page,'z=2');await expect(page.locator('.mapping-value')).toContainText('w = 0.5 + 0i');
  await point(page,'z=0');await expect(page.locator('.mapping-value')).toContainText('не определено');await expect(page.getByRole('alert')).toHaveCount(0);
  await point(page,'z=1+i');await formula(page,'conj(z)');await expect(page.locator('.mapping-value')).toContainText('w = 1 − 1i');
  const marker=page.locator('.source-slot [data-object-id="complex-point"]');const id=await marker.getAttribute('id');
  const box=(await marker.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  for(let i=1;i<=6;i++){await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));await page.mouse.move(box.x+box.width/2+i*6,box.y+box.height/2-i*3);}
  await page.mouse.up();expect(await marker.getAttribute('id')).toBe(id);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('mathcollaboratory.v1')!));expect(stored.complex.expressions[0].latex).not.toBe('z=1+i');
  const savedSourceUnit=await unit(s),savedImageUnit=await unit(im);
  await page.reload();await expect(toggle(page)).toBeChecked();
  await expect(source(page)).toHaveAttribute('data-unit-y',/.+/);await expect(image(page)).toHaveAttribute('data-unit-y',/.+/);
  expect(await unit(source(page))).toBeCloseTo(savedSourceUnit,5);expect(await unit(image(page))).toBeCloseTo(savedImageUnit,5);
  expect(await page.locator('math-field[aria-label="Выражение 1"]').evaluate(e=>(e as HTMLElement&{value:string}).value)).toBe(stored.complex.expressions[0].latex);
  await page.getByRole('button',{name:'Тёмная тема',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('.image-slot [data-object-id="complex-point"]')).toBeVisible();
});

test('curve images, colors, invalid mapping and mobile reduced motion',async({page})=>{
  await toggle(page).click();await formula(page,'z^2');
  const mappedCircle=page.locator('.image-slot [data-object-id="complex-circle"]');await expect(mappedCircle).toBeVisible();
  await expect(mappedCircle).toHaveAttribute('data-evaluations',/\d+/);
  await page.getByLabel('Цвет объекта 2',{exact:true}).fill('#123456');
  await expect(mappedCircle).toHaveAttribute('stroke','#123456');
  await formula(page,'abs(z)');await expect(mappedCircle).toHaveAttribute('stroke-linecap','round');
  await page.getByRole('button',{name:'Добавить отрезок',exact:true}).click();
  await formula(page,'1/z');await expect(page.getByRole('alert')).toHaveCount(0);
  const segment=page.locator('.image-slot [data-geometry="image"]').last();await expect(segment).toHaveAttribute('data-evaluations',/\d+/);
  await formula(page,'z[');await expect(page.getByRole('alert')).toBeVisible();
  await page.reload();await expect(page.getByRole('alert')).toBeVisible();await formula(page,'exp(z)');await expect(page.getByRole('alert')).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.complex-workspace')).toHaveCSS('transition-duration','0s');
  await page.setViewportSize({width:375,height:850});
  await expect.poll(async()=>{const a=(await source(page).boundingBox())!,b=(await image(page).boundingBox())!;return b.y>=a.y+a.height-1;}).toBe(true);
  for(const g of [source(page),image(page)])expect(await g.evaluate(e=>Math.abs(Number((e as HTMLElement).dataset.unitX)/Number((e as HTMLElement).dataset.unitY)-1))).toBeLessThan(1e-8);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await toggle(page).click();await expect(page.locator('.image-slot')).toHaveCSS('visibility','hidden');
  await toggle(page).click();await expect(image(page)).toBeVisible();
});

test('screenshots of one and two planes in light, dark and mobile layouts',async({page,browserName})=>{
  const prefix=browserName==='chromium'?'':browserName+'-';
  await page.setViewportSize({width:1440,height:960});await page.screenshot({path:`test-results/${prefix}mapping-single.png`});
  await point(page,'z=1+i');await toggle(page).click();await formula(page,'z^2');
  await expect.poll(async()=>Math.abs((await source(page).boundingBox())!.width-(await image(page).boundingBox())!.width)).toBeLessThan(1);
  await expect(page.locator('.image-slot')).toHaveCSS('opacity','1');
  await page.screenshot({path:`test-results/${prefix}mapping-double-light.png`});
  await page.getByRole('button',{name:'Тёмная тема',exact:true}).click();await page.screenshot({path:`test-results/${prefix}mapping-double-dark.png`});
  await page.setViewportSize({width:375,height:850});await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(async()=>(await image(page).boundingBox())!.y).toBeGreaterThan((await source(page).boundingBox())!.y+300);
  await page.screenshot({path:`test-results/${prefix}mapping-mobile.png`,fullPage:true});
});
