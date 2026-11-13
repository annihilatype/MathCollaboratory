import { test, expect, type Page } from '@playwright/test';
const graph=(p:Page)=>p.locator('.graph');
const view=async(p:Page)=>JSON.parse((await graph(p).getAttribute('data-viewport'))!) as number[];
const span=(v:number[])=>v[1]-v[3];
async function wheel(p:Page, options:Record<string,unknown>){
  const box=(await graph(p).boundingBox())!;
  return graph(p).evaluate((e,options)=>{
    const event=new WheelEvent('wheel',options);e.dispatchEvent(event);const rect=e.getBoundingClientRect();
    return [(event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height];
  },{deltaX:0,deltaY:10,deltaMode:0,bubbles:true,cancelable:true,clientX:box.x+box.width*.3,clientY:box.y+box.height*.4,...options});
}
test.beforeEach(async({page})=>{await page.goto('/');await expect(graph(page)).toHaveAttribute('data-viewport',/.+/);});
for(const mode of ['real','complex']){
  test(`${mode}: wheel pans, Ctrl wheel zooms at cursor, viewport persists`,async({page})=>{
    if(mode==='complex')await page.getByRole('switch',{name:'Комплексная плоскость'}).click();
    await expect(page.getByText('Исследуйте математику в движении',{exact:true})).toHaveCount(0);
    const before=await view(page),box=(await graph(page).boundingBox())!;
    await page.mouse.move(box.x+100,box.y+100);await page.mouse.wheel(40,50);
    await expect.poll(async()=>(await view(page))[0]).toBeGreaterThan(before[0]);
    const panned=await view(page);expect(span(panned)).toBeCloseTo(span(before),8);expect(panned[1]).toBeLessThan(before[1]);
    const anchor=await wheel(page,{ctrlKey:true,deltaY:-2});
    await expect.poll(async()=>span(await view(page))).toBeLessThan(span(panned));
    const zoomed=await view(page);expect(span(zoomed)/span(panned)).toBeCloseTo(Math.exp(-.005),8);
    expect(zoomed[0]+anchor[0]*(zoomed[2]-zoomed[0])).toBeCloseTo(panned[0]+anchor[0]*(panned[2]-panned[0]),7);
    expect(zoomed[1]-anchor[1]*span(zoomed)).toBeCloseTo(panned[1]-anchor[1]*span(panned),7);
    await page.reload();await expect(graph(page)).toHaveAttribute('data-viewport',/.+/);
    expect(span(await view(page))).toBeCloseTo(span(zoomed),7);
    const toggle=page.getByRole('switch',{name:'Комплексная плоскость'});await toggle.click();await toggle.click();
    expect(span(await view(page))).toBeCloseTo(span(zoomed),7);
    const box2=(await graph(page).boundingBox())!;
    await page.mouse.move(box2.x+80,box2.y+140);await page.mouse.down();
    // JSXGraph throttles pointer moves. Space a synthetic drag over frames,
    // as a real drag would be, rather than sending all events in one burst.
    for(let i=1;i<=6;i++){
      await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
      await page.mouse.move(box2.x+80+i*80/6,box2.y+140+i*30/6);
    }
    await page.mouse.up();
    await expect.poll(async()=>(await view(page))[0]).not.toBe(zoomed[0]);
    await expect.poll(async()=>graph(page).evaluate(e=>Math.abs(Number((e as HTMLElement).dataset.unitX)/Number((e as HTMLElement).dataset.unitY)-1))).toBeLessThan(1e-8);
    await page.getByRole('button',{name:'Стандартный масштаб',exact:true}).click();expect(span(await view(page))).toBeCloseTo(10,7);
  });
}
test('deltaMode, burst protection, zoom limits and local event scope',async({page})=>{
  let before=await view(page);
  await wheel(page,{deltaMode:1,deltaY:1});await expect.poll(async()=>(await view(page))[1]).toBeLessThan(before[1]);
  let after=await view(page);const height=(await graph(page).boundingBox())!.height;
  expect(before[1]-after[1]).toBeCloseTo(16*span(before)/height,7);
  before=after;await wheel(page,{deltaMode:2,deltaY:1});await expect.poll(async()=>(await view(page))[1]).toBeLessThan(before[1]);
  after=await view(page);expect(before[1]-after[1]).toBeCloseTo(120*span(before)/height,7);
  const oldSpan=span(after);
  await graph(page).evaluate(e=>{for(let i=0;i<100;i++)e.dispatchEvent(new WheelEvent('wheel',{deltaY:1000,ctrlKey:true,cancelable:true,bubbles:true}));});
  await expect.poll(async()=>span(await view(page))).toBeGreaterThan(oldSpan);
  expect(span(await view(page))/oldSpan).toBeLessThanOrEqual(1.25000001);
  await graph(page).evaluate(async e=>{for(let i=0;i<65;i++){e.dispatchEvent(new WheelEvent('wheel',{deltaY:-1e9,ctrlKey:true,cancelable:true}));await new Promise(requestAnimationFrame);}});
  expect(span(await view(page))).toBeGreaterThanOrEqual(1e-4*(1-1e-8));
  await page.getByRole('button',{name:'Приблизить',exact:true}).click();expect(span(await view(page))).toBeGreaterThanOrEqual(1e-4*(1-1e-8));
  await graph(page).evaluate(async e=>{for(let i=0;i<120;i++){e.dispatchEvent(new WheelEvent('wheel',{deltaY:1e9,ctrlKey:true,cancelable:true}));await new Promise(requestAnimationFrame);}});
  expect(span(await view(page))).toBeLessThanOrEqual(1e7*(1+1e-8));
  const cancelled=await graph(page).evaluate(e=>!e.dispatchEvent(new WheelEvent('wheel',{deltaY:1,cancelable:true,bubbles:true})));
  expect(cancelled).toBe(true);
  expect(await page.locator('.app-header').evaluate(e=>e.dispatchEvent(new WheelEvent('wheel',{deltaY:1,ctrlKey:true,cancelable:true,bubbles:true})))).toBe(true);
});
test('new circle syntax renders, invalid equations retain input and previous mode',async({page})=>{
  await page.getByRole('switch',{name:'Комплексная плоскость'}).click();
  for(const source of ['|z-i|=2','|z-1-i|=2','|z+2i|=3','|z-(1+i)|=2','|z|=2','|z^2|=2']){
    await page.locator('math-field').first().evaluate((e,s)=>{const f=e as HTMLElement&{value:string};f.value=s;f.dispatchEvent(new InputEvent('input',{bubbles:true}));},source);
    if(source.includes('^'))await expect(page.getByRole('alert')).toContainText('нелинейные');else await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.reload();await expect(page.getByRole('alert')).toContainText('нелинейные');
});
