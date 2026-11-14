import {test,expect,type Page,type Locator} from '@playwright/test';
const field=(p:Page,n=1)=>p.locator(`math-field[aria-label="Выражение ${n}"]`),formula=(p:Page)=>p.locator('math-field[aria-label="Формула отображения"]');
const toggle=(p:Page)=>p.getByRole('switch',{name:'Отображение',exact:true});
const object=(p:Page)=>p.locator('.image-slot [data-object-id="complex-point"]');
async function input(f:Locator,s:string){await f.evaluate((e,s)=>{const m=e as HTMLElement&{value:string};m.value=s;m.dispatchEvent(new InputEvent('input',{bubbles:true}));},s);}
async function type(p:Page,f:Locator,s:string){await f.evaluate(e=>{const m=e as HTMLElement&{executeCommand:(s:string)=>void};m.focus();m.executeCommand('selectAll');});await p.keyboard.press('Backspace');await p.keyboard.type(s,{delay:12});}
async function settled(p:Page){await expect(object(p)).toHaveAttribute('data-quality','settled');await expect(object(p)).toHaveAttribute('d',/M/);}
async function inFill(p:Page,re:number,im:number){return object(p).evaluate((path,z)=>{const g=path.closest('.graph') as HTMLElement,v=JSON.parse(g.dataset.viewport!),x=(z[0]-v[0])*Number(g.dataset.unitX),y=(v[1]-z[1])*Number(g.dataset.unitY);return (path as SVGGeometryElement).isPointInFill(new DOMPoint(x,y));},[re,im]);}
test.beforeEach(async({page})=>{await page.goto('/');await page.getByRole('switch',{name:'Комплексная плоскость',exact:true}).click();await expect(field(page)).toBeVisible();});

test('shared real parameters update coordinates, curves, mappings, constraints and persistent native controls',async({page})=>{
  await input(field(page),'z=a+i');await input(field(page,2),'|z|=rho');await page.getByRole('button',{name:'+ Создать ползунок rho',exact:true}).click();
  const sourceCircle=page.locator('.source-slot [data-object-id="complex-circle"]'),before=(await sourceCircle.boundingBox())!.width;
  await page.getByLabel('Значение параметра rho',{exact:true}).fill('2');await page.getByLabel('Значение параметра rho',{exact:true}).press('Enter');
  await expect.poll(async()=>(await sourceCircle.boundingBox())!.width).toBeGreaterThan(before*1.9);
  await toggle(page).click();await input(formula(page),'a*z+b');await page.getByRole('button',{name:'+ Создать ползунок b',exact:true}).click();await expect(page.locator('.mapping-value')).toContainText('w = 5 + 2i');
  await page.getByLabel('Значение параметра a',{exact:true}).fill('3');await page.getByLabel('Значение параметра a',{exact:true}).press('Enter');await expect(page.locator('.mapping-value')).toContainText('w = 10 + 3i');
  await input(formula(page),'z^n');await page.getByRole('button',{name:'+ Создать ползунок n',exact:true}).click();await expect(page.locator('#slider-n')).toHaveAttribute('step','1');
  await page.locator('#slider-n').focus();await page.keyboard.press('ArrowRight');await expect(page.getByLabel('Значение параметра n',{exact:true})).toHaveValue('3');
  await page.getByRole('button',{name:'Настройки параметра n',exact:true}).click();await page.getByLabel('Значение',{exact:true}).fill('2.5');await page.getByRole('button',{name:'Применить',exact:true}).click();await expect(page.locator('.parameter-settings .error')).toContainText('целого');
  await page.getByLabel('Значение',{exact:true}).fill('3');await page.getByRole('button',{name:'Применить',exact:true}).click();
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('mathcollaboratory.v1')!));expect(state.parameters.n.integer).toBe(true);expect(state.parameters.rho.positive).toBe(true);
  await page.reload();await expect(page.getByLabel('Значение параметра a',{exact:true})).toHaveValue('3');await expect(page.getByLabel('Значение параметра n',{exact:true})).toHaveValue('3');await expect(page.getByRole('alert')).toHaveCount(0);
});

test('physical arg, rho, unions, thin spaces and notin round trip through actual MathLive',async({page})=>{
  for(const s of ['|z|<rho','{z:Re(z)<0 or Im(z)>1}','{z:z notin [0,1]}']){
    await type(page,field(page),s);
    if(s.includes('rho')){await page.getByRole('button',{name:'+ Создать ползунок rho',exact:true}).click();await expect(field(page)).toContainText('ρ');}
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  expect(await field(page).evaluate(e=>(e as HTMLElement&{value:string}).value)).toContain('\\notin');await expect(page.locator('.source-slot [data-excluded-segment]')).toHaveAttribute('d',/M.+L/);
  await type(page,field(page),'{z:|arg(z)|<pi/8');await page.keyboard.press('ArrowRight');await page.keyboard.type(',z notin [0,1]}',{delay:12});
  await expect(page.getByRole('alert')).toHaveCount(0);await toggle(page).click();await input(formula(page),'z^8');await settled(page);expect(await inFill(page,.5,0)).toBe(false);expect(await inFill(page,0,2)).toBe(true);
  await page.reload();await settled(page);await expect(page.getByRole('alert')).toHaveCount(0);
});

test('all university scene families render as areas or one-dimensional curves without errors',async({page})=>{
  await input(field(page,2),'|z|=rho');await page.getByRole('button',{name:'+ Создать ползунок rho',exact:true}).click();await toggle(page).click();
  const cases=[
    ['{z:0<arg(z)<pi/2}','z^2'],['{z:0<arg(z)<pi/2}','z^3'],['{z:0<arg(z)<pi/2}','z^4'],
    ['{z:Im(z)>0}','z^2'],['{z:|z|<1,5*pi/4<arg(z)<3*pi/2}','z^2'],['{z:|arg(z)|<pi/8,z notin [0,1]}','z^8'],
    ['{z:|Im(z)|<pi/2}','exp(z)'],['{z:|Im(z)|<pi}','exp(z)'],['{z:0<Im(z)<pi/2,Re(z)>0}','exp(2*z)'],
    ['{z:|z|<1,0<arg(z)<pi/2}','(z+1/z)/2'],['{z:|z|>2}','(z+1/z)/2'],['{z:pi/4<arg(z)<3*pi/4}','(z+1/z)/2'],
    ['Re(z)=a','z^2'],['{z:|z|=rho,|arg(z)|<pi/4}','z^2'],
  ];
  for(const [s,f] of cases){await input(field(page),s);await input(formula(page),f);await expect(page.getByRole('alert')).toHaveCount(0);if(s.startsWith('Re(')||s.includes('=rho,')){await expect(object(page)).toHaveAttribute('data-geometry','image');await expect(object(page)).toHaveAttribute('data-evaluations',/\d+/);}else await settled(page);}
  await expect(object(page)).toHaveAttribute('fill-opacity','0');
});

test('coarse and settled sampling cancels stale parameter/viewport work and bounds SVG size',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await input(field(page),'{z:|arg(z)|<pi/8,z notin [0,1]}');await toggle(page).click();await input(formula(page),'z^n');await page.getByRole('button',{name:'+ Создать ползунок n',exact:true}).click();
  for(const n of [3,4,8,4,16,2,8])await page.locator('#slider-n').evaluate((e,n)=>{const s=e as HTMLInputElement;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(s,String(n));s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));},n);
  // Use the native numeric field for the final binding to exercise the same shared model.
  await page.getByLabel('Значение параметра n',{exact:true}).fill('8');await page.getByLabel('Значение параметра n',{exact:true}).press('Enter');await settled(page);expect(await inFill(page,0,2)).toBe(true);
  const count=await page.locator('.image-slot svg *').count(),graph=page.locator('.image-slot .graph');for(let i=0;i<16;i++)await graph.dispatchEvent('wheel',{deltaX:8,deltaY:3,deltaMode:0});
  await expect.poll(async()=>(await object(page).getAttribute('data-sample-view'))===(await graph.getAttribute('data-viewport'))).toBe(true);await settled(page);
  expect(await page.locator('.image-slot svg *').count()).toBeLessThanOrEqual(count+3);expect(Number(await object(page).getAttribute('data-evaluations'))).toBeLessThanOrEqual(6144);expect(errors).toEqual([]);
});

test('desktop screenshots of Joukowski and parameterized sectors in light and dark themes',async({page,browserName})=>{
  await page.setViewportSize({width:1600,height:1050});await input(field(page),'\\left\\{z:|z|<1,0<\\arg(z)<\\frac{\\pi}{2}\\right\\}');await input(field(page,2),'\\operatorname{Re}(z)=a');await toggle(page).click();await input(formula(page),'(z+1/z)/2');await settled(page);
  await expect(page.locator('.image-slot')).toHaveCSS('opacity','1');const prefix=browserName==='chromium'?'':browserName+'-';await page.screenshot({path:`test-results/${prefix}tfkp-joukowski-light.png`});
  await input(field(page),'\\left\\{z:|\\arg(z)|<\\frac{\\pi}{8},z\\notin[0,1]\\right\\}');await input(field(page,2),'|z|=1');await input(formula(page),'z^n');await page.getByRole('button',{name:'+ Создать ползунок n',exact:true}).click();await page.getByLabel('Значение параметра n',{exact:true}).fill('8');await page.getByLabel('Значение параметра n',{exact:true}).press('Enter');await page.getByRole('button',{name:'Тёмная тема',exact:true}).click();await settled(page);await page.screenshot({path:`test-results/${prefix}tfkp-sectors-dark.png`});
  await input(field(page),'\\left\\{z:|\\operatorname{Im}(z)|<\\frac{\\pi}{2}\\right\\}');await input(formula(page),'\\exp(a*z)');await settled(page);await page.screenshot({path:`test-results/${prefix}tfkp-strip-exp.png`});
});
