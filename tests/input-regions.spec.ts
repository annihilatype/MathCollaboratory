import { test,expect,type Locator,type Page } from '@playwright/test';
const field=(p:Page)=>p.locator('math-field[aria-label="Выражение 1"]');
const formula=(p:Page)=>p.locator('math-field[aria-label="Формула отображения"]');
const toggle=(p:Page)=>p.getByRole('switch',{name:'Отображение',exact:true});
const image=(p:Page)=>p.locator('.image-slot .graph');
const numeric=(p:Page)=>p.locator('.image-slot [data-object-id="complex-point"][data-geometry="region-image"]');
async function input(f:Locator,value:string){await f.evaluate((e,s)=>{const m=e as HTMLElement&{value:string};m.value=s;m.dispatchEvent(new InputEvent('input',{bubbles:true}));},value);}
async function type(f:Locator,p:Page,s:string){await f.evaluate(e=>{const m=e as HTMLElement&{executeCommand:(s:string)=>void};m.focus();m.executeCommand('selectAll');});await p.keyboard.press('Backspace');await p.keyboard.type(s,{delay:10});}
async function ready(p:Page){await expect(numeric(p)).toHaveAttribute('data-evaluations',/\d+/);await expect(numeric(p)).toHaveAttribute('d',/M/);await expect(numeric(p)).toHaveAttribute('data-quality','settled');}
async function inFill(p:Page,re:number,im:number){return numeric(p).evaluate((path,z)=>{
  const g=path.closest('.graph') as HTMLElement,v=JSON.parse(g.dataset.viewport!),x=(z[0]-v[0])*Number(g.dataset.unitX),y=(v[1]-z[1])*Number(g.dataset.unitY);
  return (path as SVGGeometryElement).isPointInFill(new DOMPoint(x,y));
},[re,im]);}
test.beforeEach(async({page})=>{await page.goto('/');await page.getByRole('switch',{name:'Комплексная плоскость',exact:true}).click();await expect(field(page)).toBeVisible();});

test('physical and virtual Re/Im produce safe nested operators in geometry and mappings',async({page})=>{
  for(const s of ['Re(z)<2','Im(z)>=0','Re(z)=1']){await type(field(page),page,s);await expect(page.getByRole('alert')).toHaveCount(0);expect(await field(page).evaluate(e=>(e as HTMLElement&{value:string}).value)).toMatch(/\\operatorname\{\\mathrm\{(?:Re|Im)\}\}/);}
  await type(field(page),page,'');await field(page).evaluate(e=>(e as HTMLElement&{executeCommand:(s:string)=>void}).executeCommand('showVirtualKeyboard'));
  await page.getByRole('tab',{name:'Комплексная',exact:true}).click();await page.locator('.MLK__layer.is-visible .MLK__keycap').filter({hasText:/^Re$/}).click();await expect(page.getByRole('alert')).toContainText('Заполните пустое поле');
  await page.keyboard.type('z');await page.keyboard.press('ArrowRight');await page.keyboard.type('<2');await expect(page.getByRole('alert')).toHaveCount(0);
  await field(page).evaluate(e=>(e as HTMLElement&{executeCommand:(s:string)=>void}).executeCommand('hideVirtualKeyboard'));
  await input(field(page),'z=2+3i');await toggle(page).click();await expect(page.locator('.mapping-editor-slot')).toHaveCSS('opacity','1');
  await type(formula(page),page,'w=Re(z)+i*Im(z)');await expect(page.locator('.mapping-value')).toContainText('w = 2 + 3i');
  await type(formula(page),page,'Re(z)');await page.keyboard.type('^2');await page.keyboard.press('ArrowRight');await page.keyboard.type('+Im(z)^2');await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.locator('.mapping-value')).toContainText('w = 13 + 0i');
});

test('physical set braces, modulus, comma intersections and fractional bounds persist',async({page})=>{
  await type(field(page),page,'{z:1<|z|<2}');await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await field(page).evaluate(e=>(e as HTMLElement&{value:string}).value)).toBe('\\left\\lbrace z:1<|z|<2\\right\\rbrace');
  await expect(page.locator('.source-slot [data-region-id="complex-point"] [data-region-boundary]')).toHaveCount(2);
  await type(field(page),page,'{z:Re(z)<2,Im(z)>0}');await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.locator('.source-slot [data-region-id="complex-point"] [data-region-boundary]')).toHaveCount(2);
  await input(field(page),'\\left\\{z:|z-\\frac{1+i}{2}|<\\dfrac32\\right\\}');await expect(page.getByRole('alert')).toHaveCount(0);
  const saved=await field(page).evaluate(e=>(e as HTMLElement&{value:string}).value);await page.reload();expect(await field(page).evaluate(e=>(e as HTMLElement&{value:string}).value)).toBe(saved);await expect(page.getByRole('alert')).toHaveCount(0);
  await input(field(page),'\\{z:|z|<2');await expect(page.getByRole('alert')).toContainText('Не закрыта');await page.reload();await expect(page.getByRole('alert')).toContainText('Не закрыта');
  await input(field(page),'\\unknown(z)');await expect(page.getByRole('alert')).toContainText('\\unknown');
});

test('exponential annulus uses verified preimages, bounded work and independent zoom without filling its hole',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await type(field(page),page,'{z:1<|z|<2}');await toggle(page).click();await input(formula(page),'exp(z)');await ready(page);
  await expect(page.locator('.region-accuracy')).toHaveAttribute('data-accuracy','approximate');await expect(page.locator('.sampling-details')).toContainText('px');
  expect(await inFill(page,1,0)).toBe(false);expect(await inFill(page,-1,0)).toBe(false);expect(await inFill(page,3.3,.1)).toBe(true);
  expect(Number(await numeric(page).getAttribute('data-evaluations'))).toBeLessThanOrEqual(6144);expect(Number(await numeric(page).getAttribute('data-max-uncertainty-px'))).toBeLessThan(8);
  const nodes=await page.locator('.image-slot svg *').count(),old=await numeric(page).getAttribute('data-sample-view'),sourceUnit=await page.locator('.source-slot .graph').getAttribute('data-unit-y');
  await page.getByRole('region',{name:'Плоскость образов w',exact:true}).getByRole('button',{name:'Приблизить',exact:true}).click();
  await expect(numeric(page)).not.toHaveAttribute('data-sample-view',old!);expect(await page.locator('.source-slot .graph').getAttribute('data-unit-y')).toBe(sourceUnit);
  for(let i=0;i<8;i++)await image(page).dispatchEvent('wheel',{deltaX:20,deltaY:8,deltaMode:0});
  await expect.poll(async()=>(await numeric(page).getAttribute('data-sample-view'))===(await image(page).getAttribute('data-viewport'))).toBe(true);
  expect(await page.locator('.image-slot svg *').count()).toBeLessThanOrEqual(nodes+3);
  await toggle(page).click();await toggle(page).click();await ready(page);await page.reload();await ready(page);await expect(toggle(page)).toBeChecked();
  expect(errors).toEqual([]);
});

test('shifted disks use numerical powers, retain exact paths, and render screenshots across themes/mobile',async({page,browserName})=>{
  await input(field(page),'|z-1-i|<1');await toggle(page).click();
  for(const f of ['z^2','z^3']){await input(formula(page),f);await ready(page);await expect(page.locator('.region-accuracy')).toHaveAttribute('data-accuracy','approximate');}
  await input(field(page),'|z|<2');await input(formula(page),'z^2');await expect(page.locator('.region-accuracy')).toHaveAttribute('data-accuracy','exact');await expect(numeric(page)).toHaveCount(0);
  await input(formula(page),'sin(z)');await ready(page);await expect(page.locator('.region-accuracy')).toHaveAttribute('data-accuracy','approximate');
  await input(formula(page),'ln(z)');await expect(page.locator('.region-accuracy')).toHaveAttribute('data-accuracy','unsupported');await expect(page.locator('.region-notice')).toContainText('обратных ветвей');
  await input(field(page),'Re(z)<2');await input(formula(page),'exp(z)');await expect(page.locator('.region-notice')).toContainText('диапазон Im');
  await input(field(page),'\\left\\lbrace z:1<|z|<2\\right\\rbrace');
  await page.setViewportSize({width:1440,height:960});
  await page.locator('.complex-workspace').evaluate(e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
  await expect.poll(async()=>(await numeric(page).getAttribute('data-sample-view'))===(await image(page).getAttribute('data-viewport'))).toBe(true);
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('mathcollaboratory.v1')!);s.mapping.viewport=[-1,4,8,-4];localStorage.setItem('mathcollaboratory.v1',JSON.stringify(s));});
  await page.reload();await ready(page);await expect(page.locator('.sampling-details')).toBeVisible();
  const prefix=browserName==='chromium'?'':browserName+'-';await page.screenshot({path:`test-results/${prefix}regions-v041-light.png`});
  await page.getByRole('button',{name:'Тёмная тема',exact:true}).click();await ready(page);await page.screenshot({path:`test-results/${prefix}regions-v041-dark.png`});
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:375,height:850});await ready(page);
  await expect.poll(async()=>Number(await numeric(page).getAttribute('data-max-uncertainty-px'))).toBeLessThan(8);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  for(const g of [page.locator('.source-slot .graph'),image(page)])expect(await g.evaluate(e=>Math.abs(Number((e as HTMLElement).dataset.unitX)/Number((e as HTMLElement).dataset.unitY)-1))).toBeLessThan(1e-8);
  await page.screenshot({path:`test-results/${prefix}regions-v041-mobile.png`,fullPage:true});
});
