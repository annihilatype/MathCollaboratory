import { test, expect } from '@playwright/test';
test.use({hasTouch:true,isMobile:true,viewport:{width:700,height:900}});
test('native touchscreen pinch stays in JSXGraph and preserves equal unit scale',async({page})=>{
  await page.goto('/');const graph=page.locator('.graph');await expect(graph).toHaveAttribute('data-viewport',/.+/);
  const read=async()=>JSON.parse((await graph.getAttribute('data-viewport'))!);
  const before=await read(),box=(await graph.boundingBox())!;
  const client=await page.context().newCDPSession(page);const x=box.x+box.width/2,y=box.y+box.height*.7;
  const points=(distance:number)=>[{x:x-distance,y,id:1},{x:x+distance,y,id:2}];
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(40)});
  for(let i=1;i<=8;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(40+i*12)});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>{const v=await read();return v[1]-v[3];}).toBeLessThan(before[1]-before[3]);
  expect(await graph.evaluate(e=>Math.abs(Number((e as HTMLElement).dataset.unitX)/Number((e as HTMLElement).dataset.unitY)-1))).toBeLessThan(1e-8);
});
