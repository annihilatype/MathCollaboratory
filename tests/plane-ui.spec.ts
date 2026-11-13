import { test, expect, type Page } from '@playwright/test';
const control=(page:Page)=>page.getByRole('switch',{name:'Комплексная плоскость',exact:true});
const saved=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('mathcollaboratory.v1')!));
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('math-field')).toHaveCount(2);});

test('mode switch supports mouse, Tab, Space and Enter and restores its state',async({page})=>{
  const toggle=control(page);await expect(toggle).not.toBeChecked();
  const before=await saved(page);
  // It is reachable by normal sequential keyboard navigation.
  await page.getByRole('button',{name:'Тёмная тема',exact:true}).focus();
  await page.keyboard.press('Tab');await expect(toggle).toBeFocused();
  await page.keyboard.press('Space');await expect(toggle).toBeChecked();
  await expect(page.locator('.object-details')).toBeVisible();
  await page.reload();await expect(toggle).toBeChecked();
  await toggle.focus();await page.keyboard.press('Enter');await expect(toggle).not.toBeChecked();
  const after=await saved(page);
  expect(after.expressions).toEqual(before.expressions);expect(after.complex.expressions).toEqual(before.complex.expressions);
  await toggle.click();await expect(toggle).toBeChecked();
  await page.getByRole('button',{name:'Тёмная тема',exact:true}).click();
  await expect(toggle).toBeChecked();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.locator('.switch-thumb').evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');
});

for(const mode of ['real','complex'])test(`${mode}: adaptive major/minor grid stays bounded through zoom and pan`,async({page})=>{
  if(mode==='complex')await control(page).click();
  const major=page.locator('.graph path[data-grid=major]'),minor=page.locator('.graph path[data-grid=minor]');
  const count=async()=>({major:(await major.getAttribute('d'))?.match(/M/gi)?.length??0,minor:(await minor.getAttribute('d'))?.match(/M/gi)?.length??0});
  await expect.poll(async()=>(await count()).minor).toBeGreaterThan(0);
  const initial=await count();expect(initial.minor).toBeGreaterThan(initial.major);
  const majorStyle=await major.evaluate(e=>({opacity:parseFloat(e.getAttribute('stroke-opacity')!),width:parseFloat(e.getAttribute('stroke-width')!)}));
  const minorStyle=await minor.evaluate(e=>({opacity:parseFloat(e.getAttribute('stroke-opacity')!),width:parseFloat(e.getAttribute('stroke-width')!)}));
  expect(majorStyle.opacity).toBeGreaterThan(minorStyle.opacity);expect(majorStyle.width).toBeGreaterThan(minorStyle.width);
  const before=JSON.parse((await page.locator('.graph').getAttribute('data-viewport'))!);
  for(let i=0;i<20;i++){
    await page.getByRole('button',{name:'Отдалить',exact:true}).click();
    const n=await count();expect(n.major).toBeGreaterThan(0);expect(n.minor).toBeGreaterThan(n.major);expect(n.major+n.minor).toBeLessThan(300);
  }
  const after=JSON.parse((await page.locator('.graph').getAttribute('data-viewport'))!);
  expect((after[2]-after[0])/(before[2]-before[0])).toBeGreaterThan(20);
  expect((await count()).major).toBeLessThan(initial.major*3);
  await expect(page.locator('.graph [data-grid]')).toHaveCount(2);
  const box=(await page.locator('.graph').boundingBox())!;
  await page.mouse.move(box.x+80,box.y+120);await page.mouse.down();await page.mouse.move(box.x+150,box.y+140,{steps:6});await page.mouse.up();
  await expect.poll(async()=>JSON.parse((await page.locator('.graph').getAttribute('data-viewport'))!)[0]).not.toBe(after[0]);
  await page.getByRole('button',{name:'Стандартный масштаб',exact:true}).click();
  for(let i=0;i<8;i++)await page.getByRole('button',{name:'Приблизить',exact:true}).click();
  expect((await count()).major+(await count()).minor).toBeLessThan(300);
  await page.setViewportSize({width:375,height:850});
  await expect.poll(async()=>page.locator('.graph').evaluate(e=>Math.abs(Number((e as HTMLElement).dataset.unitX)/Number((e as HTMLElement).dataset.unitY)-1))).toBeLessThan(1e-8);
  await page.getByRole('button',{name:'Тёмная тема',exact:true}).click();
  await expect(minor).toBeVisible();await expect(page.locator('.graph [data-grid]')).toHaveCount(2);
});
