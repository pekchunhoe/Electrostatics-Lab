import {test,expect} from '@playwright/test';

test.use({hasTouch:true});
const names=['Coulomb Force','Electric Field','Electric Potential','Uniform Electric Field'];
const sizes=[[320,568],[360,640],[390,844],[430,932],[768,1024],[1280,800],[844,390]];
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function fullyVisible(page){
  const bounds=await page.locator('[role=tab][aria-selected=true]').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
}
async function sticky(page){
  await frames(page);
  const bar=await page.getByRole('tablist').boundingBox();
  expect(bar.y).toBeCloseTo(0,0);
  expect(bar.height).toBeLessThanOrEqual(70);
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(0);
  // Verify the rendered bar receives pointer input over page content.
  expect(await page.getByRole('tablist').evaluate(el=>{
    const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(10,r.y+r.height/2));
  })).toBe(true);
}
async function noOverflow(page){
  expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,x:scrollX})))
    .toEqual({width:page.viewportSize().width,viewport:page.viewportSize().width,x:0});
}
async function noBrand(page){
  expect(await page.evaluate(()=>document.documentElement.textContent+' '+[...document.querySelectorAll('*')]
    .flatMap(el=>[...el.attributes].map(a=>a.value)).join(' '))).not.toMatch(/sp025/i);
}
async function openAtTop(page,id){
  const summary=page.locator('#'+id+'>summary');
  if(!await page.locator('#'+id).evaluate(el=>el.open))await summary.click();
  await summary.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
  await sticky(page);
  const bar=await page.getByRole('tablist').boundingBox(),content=await summary.boundingBox();
  expect(content.y).toBeGreaterThanOrEqual(bar.y+bar.height);
}
async function swipeTabs(page,context){
  const session=await context.newCDPSession(page),bar=await page.getByRole('tablist').boundingBox();
  const y=bar.y+22,start=page.viewportSize().width-25,end=25;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y,id:1}]});
  for(let step=1;step<=8;step++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start+(end-start)*step/8,y,id:1}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await session.detach();
  await expect.poll(()=>page.getByRole('tablist').evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
}
async function dragProbe(page,context){
  const bar=page.getByRole('tablist'),left=await bar.evaluate(el=>el.scrollLeft),yBefore=await page.evaluate(()=>scrollY);
  const session=await context.newCDPSession(page),probe=page.locator('.object-target[data-key="probe"]'),box=await probe.boundingBox();
  const x=box.x+22,y=box.y+22;
  const oldLabel=await probe.getAttribute('aria-label');
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+25,y:y-20,id:1}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await session.detach();await frames(page);
  expect(await probe.getAttribute('aria-label')).not.toBe(oldLabel);
  expect(await bar.evaluate(el=>el.scrollLeft)).toBe(left);
  expect(await page.evaluate(()=>scrollY)).toBe(yBefore);
}

for(const [width,height] of sizes)test(`topic navigation ${width}×${height}: touch, sticky panels and screenshots`,async({page,context})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.setViewportSize({width,height});await page.goto('/');
  await expect(page).toHaveTitle('Electrostatics Lab');
  await expect(page.getByRole('heading',{level:1})).toHaveText('Electrostatics Lab');
  expect(await page.getByRole('heading',{level:1}).evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(25);
  await expect(page.getByRole('tab')).toHaveText(names);
  await expect(page.getByRole('tab',{selected:true})).toHaveText(names[0]);
  const tabs=page.getByRole('tablist'),natural=await tabs.boundingBox(),header=await page.locator('header').boundingBox();
  expect(natural.y).toBeCloseTo(header.y+header.height,0);
  for(const button of await page.getByRole('tab').all()){
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await button.evaluate(el=>el.scrollWidth<=el.clientWidth&&getComputedStyle(el).whiteSpace==='nowrap')).toBe(true);
  }
  if(width<=430)await swipeTabs(page,context);
  await expect(page.getByRole('tab',{selected:true})).toHaveText(names[0]);
  expect(await page.evaluate(()=>scrollY)).toBe(0);
  await page.getByRole('tab',{name:names[3],exact:true}).click();await fullyVisible(page);
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby','tab-3');
  expect(await page.getByRole('tab',{selected:true}).evaluate(el=>getComputedStyle(el).backgroundColor))
    .not.toBe(await page.getByRole('tab').first().evaluate(el=>getComputedStyle(el).backgroundColor));
  await noBrand(page);await noOverflow(page);
  await page.screenshot({path:`test-results/screenshots/navigation-${width}-${height}-top.png`});
  // Exercise the real shortcut on mobile; desktop has no shortcut, so use its summary.
  if(width<1120)await page.locator('[data-open="calculations"]').click();
  await openAtTop(page,'calculations');
  await page.screenshot({path:`test-results/screenshots/navigation-${width}-${height}-middle.png`});
  if(width<1120)await page.locator('[data-open="challenge-panel"]').click();
  await openAtTop(page,'challenge-panel');await expect(page.locator('#prediction')).toBeVisible();
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await sticky(page);
  await page.screenshot({path:`test-results/screenshots/navigation-${width}-${height}-bottom.png`});
  const oldY=await page.evaluate(()=>scrollY);
  // Reveal horizontally before clicking, as a student would. Playwright's click on an
  // offscreen sticky tab can scroll the page itself before the app receives the click.
  await tabs.evaluate(el=>el.scrollTo({left:el.children[1].offsetLeft-6,behavior:'instant'}));
  await frames(page);
  const fieldTab=await page.getByRole('tab',{name:names[1],exact:true}).boundingBox();
  await page.mouse.click(fieldTab.x+fieldTab.width/2,fieldTab.y+fieldTab.height/2);
  await fullyVisible(page);await sticky(page);
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby','tab-1');
  await expect(page.locator('#scene')).toHaveAttribute('aria-label',/^Electric Field diagram/);
  const expectedY=await page.evaluate(old=>Math.min(old,document.documentElement.scrollHeight-innerHeight),oldY);
  expect(await page.evaluate(()=>scrollY)).toBeCloseTo(expectedY,0);
  await noBrand(page);await noOverflow(page);
  await page.evaluate(()=>scrollTo(0,0));await frames(page);
  expect((await tabs.boundingBox()).y).toBeCloseTo(natural.y,0);
  if(width<=430)await dragProbe(page,context);
  if(width>=768)expect(await tabs.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('keyboard tab semantics, page position, orientation and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:320,height:568});await page.goto('/');
  await page.getByRole('tab',{selected:true}).focus();await page.keyboard.press('End');await fullyVisible(page);
  await expect(page.getByRole('tab',{selected:true})).toHaveText(names[3]);
  await openAtTop(page,'calculations');const oldY=await page.evaluate(()=>scrollY);
  await page.getByRole('tab',{selected:true}).evaluate(el=>el.focus({preventScroll:true}));await page.keyboard.press('Home');
  await expect(page.getByRole('tab',{selected:true})).toBeFocused();await fullyVisible(page);await sticky(page);
  expect(await page.evaluate(()=>scrollY)).toBe(oldY);
  await page.keyboard.press('ArrowLeft');await expect(page.getByRole('tab',{selected:true})).toHaveText(names[3]);
  await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{selected:true})).toHaveText(names[0]);
  await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{selected:true})).toHaveText(names[1]);
  await page.keyboard.press('Tab');await expect(page.getByRole('tabpanel')).toBeFocused();
  await page.getByRole('tab',{selected:true}).evaluate(el=>el.focus({preventScroll:true}));await page.keyboard.press('End');
  for(const size of [{width:844,height:390},{width:320,height:568}]){
    await page.setViewportSize(size);await frames(page);await fullyVisible(page);await noOverflow(page);await sticky(page);
  }
  expect(await page.getByRole('tab').evaluateAll(es=>es.filter(el=>el.tabIndex===0).length)).toBe(1);
});

test('dark theme, help and selected-tab visibility survive UI rerenders',async({page})=>{
  await page.setViewportSize({width:360,height:640});await page.goto('/');
  await page.getByRole('tab',{name:names[3],exact:true}).click();
  await page.getByRole('button',{name:'Help and display settings'}).click();
  await page.getByRole('checkbox',{name:'Dark theme'}).check();
  await page.getByRole('button',{name:'Close help',exact:true}).click();
  await page.locator('#preset').selectOption('equilibrium');await fullyVisible(page);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'test-results/screenshots/navigation-360-dark.png'});
  await openAtTop(page,'calculations');await sticky(page);await noBrand(page);await noOverflow(page);
  expect(await page.getByRole('tablist').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(25, 53, 58)');
});

test('native touch taps switch topics while the navigation is sticky',async({page})=>{
  await page.setViewportSize({width:360,height:640});await page.goto('/');
  await page.getByRole('tablist').evaluate(el=>el.scrollLeft=el.scrollWidth);
  let target=await page.getByRole('tab').nth(3).boundingBox();
  await page.touchscreen.tap(target.x+target.width/2,target.y+target.height/2);
  await expect(page.getByRole('tab',{selected:true})).toHaveText(names[3]);
  await page.locator('#play').click();
  await openAtTop(page,'calculations');
  const live=await page.locator('#live-strip').textContent();
  await expect.poll(()=>page.locator('#live-strip').textContent()).not.toBe(live);
  await sticky(page);
  await page.getByRole('tablist').evaluate(el=>el.scrollTo({left:el.children[1].offsetLeft-6,behavior:'instant'}));
  await frames(page);const oldY=await page.evaluate(()=>scrollY);
  target=await page.getByRole('tab').nth(1).boundingBox();
  await page.touchscreen.tap(target.x+target.width/2,target.y+target.height/2);
  await expect(page.getByRole('tab',{selected:true})).toHaveText(names[1]);await sticky(page);await fullyVisible(page);
  expect(await page.evaluate(()=>scrollY)).toBe(oldY);
});
