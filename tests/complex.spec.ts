import { test, expect, type Page } from '@playwright/test';
async function formula(page: Page, value: string, index=0) {
  await page.locator('math-field').nth(index).evaluate((field, value)=>{const e=field as HTMLElement & {value:string};e.value=value;e.dispatchEvent(new InputEvent('input',{bubbles:true}));},value);
}
const state=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('mathcollaboratory.v1')!));
const complex=async(page:Page)=>{const control=page.getByRole('switch',{name:'Комплексная плоскость',exact:true});if(await control.getAttribute('aria-checked') !== 'true')await control.click();};
const real=async(page:Page)=>{const control=page.getByRole('switch',{name:'Комплексная плоскость',exact:true});if(await control.getAttribute('aria-checked') !== 'false')await control.click();};
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('math-field')).toHaveCount(2);});
test('separate expressions, errors and viewports survive switching and reload',async({page})=>{
  await formula(page,'x+3');await page.getByRole('button',{name:'Приблизить',exact:true}).click();const realView=(await state(page)).realViewport;
  await complex(page);await formula(page,'z=-1-i');await expect(page.locator('.object-details')).toContainText('Re = -1; Im = -1');
  await page.getByRole('button',{name:'Отдалить',exact:true}).click();const complexView=(await state(page)).complex.viewport;
  await real(page);expect((await state(page)).expressions[0].latex).toBe('x+3');
  expect((await state(page)).realViewport[1]).toBeCloseTo(realView[1],5);
  await complex(page);expect((await state(page)).complex.viewport[1]).toBeCloseTo(complexView[1],5);
  await formula(page,'z=1/0');await expect(page.getByRole('alert')).toContainText('ноль');
  await page.reload();await expect(page.getByRole('alert')).toContainText('ноль');expect((await state(page)).complex.expressions[0].latex).toBe('z=1/0');
  await real(page);expect((await state(page)).expressions[0].latex).toBe('x+3');
});
test('equal unit scale on rectangular canvas, zoom and resize',async({page})=>{
  await complex(page);
  for(const width of [1400,900,375]){
    await page.setViewportSize({width,height:850});
    await expect.poll(async()=>page.locator('.graph').evaluate(e=>Math.abs(Number((e as HTMLElement).dataset.unitX)/Number((e as HTMLElement).dataset.unitY)-1))).toBeLessThan(1e-8);
    await page.getByRole('button',{name:'Приблизить',exact:true}).click();
  }
  await expect(page.locator('.graph-panel')).toContainText('Re(z)');await expect(page.locator('.graph-panel')).toContainText('Im(z)');
});
test('geometry, visibility, colors and current-mode reset',async({page})=>{
  await formula(page,'x+7');await complex(page);
  for(const value of ['z=2+3i','|z-(1+i)|=2','Re(z)=1','Im(z)=-2','z=(1+i)(1-i)']){
    await formula(page,value);await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.getByRole('button',{name:'Скрыть объект 1',exact:true}).click();
  await expect(page.getByRole('button',{name:'Показать объект 1',exact:true})).toBeVisible();
  await page.getByLabel('Цвет объекта 1', {exact:true}).fill('#123456');
  await page.getByRole('button',{name:'Добавить выражение'}).click();await formula(page,'z=2i',2);
  await page.getByRole('button',{name:'Удалить объект 2',exact:true}).click();
  await expect(page.locator('math-field').nth(1)).toHaveAttribute('aria-label','Выражение 2');
  await page.getByRole('button',{name:'Сбросить',exact:true}).click();await page.getByRole('button',{name:'Подтвердить сброс',exact:true}).click();
  expect((await state(page)).complex.expressions[0].latex).toBe('z=2+3i');
  await real(page);expect((await state(page)).expressions[0].latex).toBe('x+7');
  await complex(page);await formula(page,'z=4i');await real(page);
  await page.getByRole('button',{name:'Сбросить',exact:true}).click();await page.getByRole('button',{name:'Подтвердить сброс',exact:true}).click();
  await complex(page);expect((await state(page)).complex.expressions[0].latex).toBe('z=4i');
});
test('native keyboard input into complex editor persists',async({page})=>{
  await complex(page);await page.getByRole('button',{name:'Добавить выражение'}).click();
  const editor=page.locator('math-field').last();await editor.click({position:{x:20,y:20}});await expect(editor).toBeFocused();
  await page.keyboard.type('2+3i');await expect.poll(async()=>(await state(page)).complex.expressions[2].latex).toBe('2+3i');
  await page.reload();await expect(page.locator('.object-details').last()).toContainText('Im = 3');
});
test('legacy save migrates, plane pans and cursor coordinates respond',async({page})=>{
  await page.addInitScript(()=>{
    if(sessionStorage.getItem('seed-legacy'))return;sessionStorage.setItem('seed-legacy','1');
    const s=JSON.parse(localStorage.getItem('mathcollaboratory.v1')!);
    localStorage.setItem('mathcollaboratory.v1',JSON.stringify({version:1,theme:'dark',expressions:s.expressions,parameters:s.parameters}));
  });
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await complex(page);
  await expect(page.locator('.graph')).toHaveAttribute('data-unit-x',/.+/);
  const before=(await state(page)).complex.viewport;
  const box=(await page.locator('.graph').boundingBox())!;
  await page.mouse.move(box.x+100,box.y+150);await page.mouse.down();await page.mouse.move(box.x+170,box.y+185,{steps:8});await page.mouse.up();
  await expect.poll(async()=>(await state(page)).complex.viewport[0]).not.toBe(before[0]);
  await expect(page.locator('output')).toContainText('Re:');
  await page.getByRole('button',{name:'Стандартный масштаб',exact:true}).click();
  await page.screenshot({path:'test-results/complex-plane-dark.png'});
  await page.getByRole('button',{name:'Светлая тема',exact:true}).click();
  await page.screenshot({path:'test-results/complex-plane-light.png'});
  await page.setViewportSize({width:375,height:850});
  await expect.poll(async()=>page.locator('.graph').evaluate(e=>Math.abs(Number((e as HTMLElement).dataset.unitX)/Number((e as HTMLElement).dataset.unitY)-1))).toBeLessThan(1e-8);
  await page.screenshot({path:'test-results/complex-plane-mobile.png',fullPage:true});
});
