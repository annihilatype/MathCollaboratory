import { test, expect, type Page, type Locator } from '@playwright/test';
const mode=(p:Page)=>p.getByRole('switch',{name:'Комплексная плоскость',exact:true});
const mapping=(p:Page)=>p.getByRole('switch',{name:'Отображение',exact:true});
const field=(p:Page)=>p.locator('math-field[aria-label="Выражение 1"]');
const formula=(p:Page)=>p.locator('math-field[aria-label="Формула отображения"]');
async function input(f:Locator,value:string){await f.evaluate((e,s)=>{const m=e as HTMLElement&{value:string};m.value=s;m.dispatchEvent(new InputEvent('input',{bubbles:true}));},value);}
const fill=(p:Page,plane='source')=>p.locator(`.${plane}-slot [data-region-fill="complex-point"]`);
const boundary=(p:Page,plane='source')=>p.locator(`.${plane}-slot [data-region-id="complex-point"] [data-region-boundary]`);
const finished=async(p:Page)=>{await p.locator('.complex-workspace').evaluate(e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));};
test.beforeEach(async({page})=>{await page.goto('/');await mode(page).click();await expect(field(page)).toBeVisible();});

test('MathLive keyboard emits short fractions; Joukowski and nested display fractions are correct',async({page})=>{
  await input(field(page),'z=2');await mapping(page).click();await finished(page);
  await formula(page).evaluate(e=>{const m=e as HTMLElement&{executeCommand:(s:string)=>void};m.focus();m.executeCommand('selectAll');});
  await page.keyboard.press('Backspace');await page.keyboard.type('1/2',{delay:20});
  expect(await formula(page).evaluate(e=>(e as HTMLElement&{value:string}).value)).toBe('\\frac12');
  await page.keyboard.press('ArrowRight');await page.keyboard.type('(z+1/z)',{delay:20});
  await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.locator('.mapping-value')).toContainText('w = 1.25 + 0i');
  const latex=await formula(page).evaluate(e=>(e as HTMLElement&{value:string}).value);
  expect(latex).toContain('\\frac12');expect(latex).toContain('\\frac{1}{z}');
  await page.reload();await expect(page.locator('.mapping-value')).toContainText('w = 1.25 + 0i');
  await input(field(page),'z=0');await expect(page.locator('.mapping-value')).toContainText('не определено');
  await input(field(page),'z=2');
  for(const [s,expected] of [['\\dfrac{z+\\frac{1}{z}}{2}','1.25'],['\\tfrac{1}{2}(1+\\frac{1}{z})','0.75'],['\\frac{1}{\\frac{z+1}{2}}','0.6666667']]){
    await input(formula(page),s);await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.locator('.mapping-value')).toContainText(`w = ${expected} + 0i`);
  }
});

test('exact disk, ring, half-plane intersections and boundary styles survive zoom, pan and reload',async({page})=>{
  await input(field(page),'|z-(1+i)|<2');await expect(fill(page)).toHaveAttribute('fill-opacity','0.17');
  await expect(boundary(page)).toHaveAttribute('stroke-dasharray','6 5');
  const path=await boundary(page).getAttribute('d'),count=await page.locator('.source-slot svg *').count();
  await page.getByRole('button',{name:'Приблизить',exact:true}).click();await expect(boundary(page)).not.toHaveAttribute('d',path!);
  const graph=page.locator('.source-slot .graph'),bb=(await graph.boundingBox())!;
  await graph.dispatchEvent('wheel',{deltaX:40,deltaY:30,deltaMode:0,clientX:bb.x+100,clientY:bb.y+100});
  expect(await page.locator('.source-slot svg *').count()).toBeLessThanOrEqual(count+3);
  await input(field(page),'1<=|z|<3 and Im(z)>=0');await expect(boundary(page)).toHaveCount(3);
  await expect(page.locator('.source-slot [data-region-boundary="strict"]')).toHaveCount(1);
  await expect(page.locator('.source-slot [data-region-boundary="inclusive"]')).toHaveCount(2);
  await page.getByLabel('Цвет объекта 1',{exact:true}).fill('#28a49a');await expect(fill(page)).toHaveAttribute('fill','#28a49a');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mathcollaboratory.v1')!));
  await page.reload();await expect(fill(page)).toHaveAttribute('fill','#28a49a');await expect(boundary(page)).toHaveCount(3);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mathcollaboratory.v1')!).complex.expressions[0].latex)).toBe(saved.complex.expressions[0].latex);
  await mode(page).click();await expect(page.locator('[data-region-fill]')).toHaveCount(0);await mode(page).click();await expect(fill(page)).toBeVisible();
  await page.getByRole('button',{name:'Скрыть объект 1',exact:true}).click();await expect(fill(page)).toHaveCount(0);
  await page.getByRole('button',{name:'Показать объект 1',exact:true}).click();await expect(fill(page)).toBeVisible();
});

test('analytic images retain transparency, excluded poles and explicit unsupported-case notices',async({page})=>{
  await input(field(page),'|z|<=2');await mapping(page).click();await finished(page);
  await expect(fill(page,'image')).toHaveAttribute('fill-opacity','0.17');await expect(boundary(page,'image')).toHaveAttribute('stroke-dasharray','none');
  await input(formula(page),'1/z');await expect(fill(page,'image')).toBeVisible();
  await expect(page.locator('.image-slot [data-object-id="complex-circle"]')).toHaveAttribute('fill-opacity','0');
  await input(field(page),'|z|>=2');await expect(page.locator('.image-slot [data-region-exclusion="true"]')).toHaveAttribute('visibility','visible');
  await expect(page.locator('.image-note')).toContainText('полыми кружками');
  await input(field(page),'Re(z)<1');await input(formula(page),'z+1');await expect(fill(page,'image')).toBeVisible();
  await input(formula(page),'conj(z)');await expect(fill(page,'image')).toBeVisible();
  await input(formula(page),'z^2');await expect(fill(page,'image')).toHaveCount(0);await expect(page.locator('.region-notice[role="status"]')).toContainText('Образ области не закрашен');
  await input(field(page),'|z|<2');await expect(fill(page,'image')).toBeVisible();await expect(page.locator('.region-notice[role="status"]')).toHaveCount(0);
  await input(formula(page),'exp(z)');await expect(fill(page,'image')).toHaveCount(0);await expect(page.locator('.region-notice[role="status"]')).toBeVisible();
  await input(field(page),'|z^2|<2');await expect(page.getByRole('alert')).toBeVisible();await expect(fill(page)).toHaveCount(0);
  await page.reload();await expect(page.getByRole('alert')).toBeVisible();
});

test('region screenshots in both themes and mobile layout with independent viewports',async({page,browserName})=>{
  const prefix=browserName==='chromium'?'':browserName+'-';
  await page.setViewportSize({width:1440,height:960});await input(field(page),'1<|z|\\le2');await mapping(page).click();await input(formula(page),'1/z');await finished(page);
  await expect(fill(page,'image')).toBeVisible();await expect(page.locator('.image-slot')).toHaveCSS('opacity','1');
  const s=page.locator('.source-slot .graph'),w=page.locator('.image-slot .graph'),unit=await s.getAttribute('data-unit-y');
  await page.getByRole('region',{name:'Плоскость образов w',exact:true}).getByRole('button',{name:'Приблизить',exact:true}).click({clickCount:3});
  expect(await s.getAttribute('data-unit-y')).toBe(unit);
  for(const g of [s,w])expect(await g.evaluate(e=>Math.abs(Number((e as HTMLElement).dataset.unitX)/Number((e as HTMLElement).dataset.unitY)-1))).toBeLessThan(1e-8);
  await page.screenshot({path:`test-results/${prefix}regions-light.png`});
  await page.getByRole('button',{name:'Тёмная тема',exact:true}).click();await expect(fill(page,'image')).toBeVisible();await page.screenshot({path:`test-results/${prefix}regions-dark.png`});
  await page.setViewportSize({width:375,height:850});await page.emulateMedia({reducedMotion:'reduce'});await finished(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);await expect(fill(page)).toBeVisible();await expect(fill(page,'image')).toBeVisible();
  await page.screenshot({path:`test-results/${prefix}regions-mobile.png`,fullPage:true});
});
