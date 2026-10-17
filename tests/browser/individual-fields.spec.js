import {test,expect} from '@playwright/test';

test.use({hasTouch:true});
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function fieldTab(page){await page.goto('/');await page.getByRole('tab',{name:'Electric Field',exact:true}).click();}
async function details(page,id){if(!await page.locator('#'+id).evaluate(el=>el.open))await page.locator('#'+id+'>summary').click();}
async function input(page,id,value){await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('change');}
async function component(page,id,key){return Number(await page.locator(`[data-field-source="${id}"] [data-value-key="${key}"]`).getAttribute('data-value'));}
function close(actual,expected){expect(Math.abs(actual-expected)).toBeLessThanOrEqual(Math.max(1e-8,Math.abs(expected)*1e-10));}
async function overflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);}
async function enable(page){await page.getByRole('checkbox',{name:'Show Individual Fields',exact:true}).check();await frames(page);}
async function identities(page,ids){
  await expect(page.locator('[data-field-source]')).toHaveCount(ids.length+1);
  expect(await page.locator('[data-field-source]').evaluateAll(es=>es.map(e=>e.dataset.fieldSource))).toEqual([...ids,'resultant']);
  expect(await page.locator('#field-vector-key button').evaluateAll(es=>es.map(e=>e.dataset.fieldVector))).toEqual(['all',...ids,'resultant']);
}
async function touchDrag(page,context,key,dx,dy){
  await page.evaluate(()=>scrollTo(0,0));await frames(page);
  const box=await page.locator(`.object-target[data-key="${key}"]`).boundingBox();
  const session=await context.newCDPSession(page),x=box.x+22,y=box.y+22;
  const before=await page.evaluate(()=>[scrollY,document.querySelector('.tabs').scrollLeft]);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(let i=1;i<=4;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/4,y:y+dy*i/4,id:1}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();await frames(page);
  expect(await page.evaluate(()=>[scrollY,document.querySelector('.tabs').scrollLeft])).toEqual(before);
}

for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[768,1024],[1280,800],[844,390]]){
  for(const theme of ['light','dark'])test(`individual fields ${width}×${height} ${theme}: responsive workspace and breakdown`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.setViewportSize({width,height});await fieldTab(page);
    if(theme==='dark'){await page.locator('#help-button').click();await page.locator('#theme-toggle').check();await page.locator('#close-help').click();}
    await page.locator('#preset').selectOption('equal');await details(page,'settings');await input(page,'probe-y',.1);
    const original=await page.locator('#live-strip').textContent(),canvasHeight=(await page.locator('#scene').boundingBox()).height;
    await enable(page);await expect(page.locator('#live-strip')).toHaveText(original);
    expect((await page.locator('#scene').boundingBox()).height).toBe(canvasHeight);
    expect(await page.locator('#individual-field-panel').evaluate(el=>el.open)).toBe(false);
    await identities(page,['1','2']);await expect(page.getByRole('button',{name:'Emphasize E₁ from q1',exact:true})).toBeVisible();
    const value=8.987551792261171e9*1e-6*.1/(.02**1.5);
    close(await component(page,'1','x'),value);close(await component(page,'2','x'),-value);
    close(await component(page,'1','y'),value);close(await component(page,'2','y'),value);
    close(await component(page,'resultant','x'),0);close(await component(page,'resultant','y'),2*value);
    await overflow(page);await page.evaluate(()=>scrollTo(0,0));await frames(page);
    await page.screenshot({path:`test-results/screenshots/fields-${width}-${height}-${theme}-top.png`});
    await details(page,'individual-field-panel');
    await page.locator('#individual-field-panel>summary').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await frames(page);
    const nav=await page.getByRole('tablist').boundingBox(),summary=await page.locator('#individual-field-panel>summary').boundingBox();
    expect(nav.y).toBeCloseTo(0,0);expect(summary.y).toBeGreaterThanOrEqual(nav.height);
    await page.screenshot({path:`test-results/screenshots/fields-${width}-${height}-${theme}-details.png`});
    await expect(page.locator('#individual-field-body')).toContainText('not an x/y component');
    await expect(page.locator('#individual-field-body')).not.toContainText(/NaN|Infinity|Undefined/);
    await overflow(page);
    // Real coordinates avoid automation scrolling an offscreen topic before clicking it.
    await page.getByRole('tablist').evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));await frames(page);
    const target=await page.getByRole('tab',{name:'Coulomb Force',exact:true}).boundingBox();await page.mouse.click(target.x+target.width/2,target.y+target.height/2);
    await expect(page.getByRole('tab',{selected:true})).toHaveText('Coulomb Force');
    await expect(page.locator('#individual-fields')).toHaveCount(0);await expect(page.locator('#individual-field-panel')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('one through four contributions, removal, stable IDs, presets and reset',async({page})=>{
  await page.setViewportSize({width:390,height:844});await fieldTab(page);await enable(page);await identities(page,['1']);
  await page.locator('#add').click();await identities(page,['1','2']);
  await page.locator('#add').click();await identities(page,['1','2','3']);
  await page.locator('#add').click();await identities(page,['1','2','3','4']);
  await page.locator('#selected').selectOption('2');await page.locator('#remove').click();await identities(page,['1','3','4']);
  await expect(page.locator('[data-field-source="3"] h4')).toHaveText('E₃ · source q3');
  await page.locator('#add').click();await identities(page,['1','3','4','2']);
  await page.getByRole('button',{name:'Emphasize E₃ from q3',exact:true}).click();
  await page.locator('#reset').click();await identities(page,['1']);await expect(page.locator('[data-field-vector="all"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#preset').selectOption('square');await identities(page,['1','2','3','4']);
  await page.locator('#preset').selectOption('negative');await identities(page,['1']);
  close(await component(page,'1','x'),-449377.58961305855);close(await component(page,'1','direction'),-180);
  await page.locator('#preset').selectOption('triangle');await identities(page,['1','2','3']);
  await details(page,'guided');await page.locator('#guide').selectOption('1');await page.locator('#load-guide').click();
  expect(await page.locator('#individual-fields').isChecked()).toBe(true);
  expect(await page.locator('[data-field-source]').count()).toBe(await page.locator('#selected option').count()+1);
});

test('toggle restores the exact baseline canvas and changes visualization only',async({page})=>{
  await page.setViewportSize({width:390,height:844});await fieldTab(page);await frames(page);
  const canvas=await page.locator('#scene').evaluate(el=>el.toDataURL()),live=await page.locator('#live-strip').textContent(),calcs=await page.locator('#calculation-body').textContent();
  await enable(page);await expect(page.locator('#live-strip')).toHaveText(live);await expect(page.locator('#calculation-body')).toHaveText(calcs);
  expect(await page.locator('#scene').evaluate(el=>el.toDataURL())).not.toBe(canvas);
  await page.locator('#individual-fields').focus();await page.keyboard.press('Space');await frames(page);
  await expect(page.locator('#individual-field-panel')).toBeHidden();await expect(page.locator('#field-vector-key')).toBeHidden();
  expect(await page.locator('#scene').evaluate(el=>el.toDataURL())).toBe(canvas);
  await expect(page.locator('#live-strip')).toHaveText(live);
  for(const name of ['Electric Potential','Uniform Electric Field']){await page.getByRole('tab',{name,exact:true}).click();await expect(page.locator('#individual-fields')).toHaveCount(0);}
});

test('touch dragging, magnitude/polarity edits, zoom, resize and state persistence update live fields',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await fieldTab(page);await page.locator('#preset').selectOption('equal');
  await details(page,'settings');await input(page,'probe-y',.08);await enable(page);
  const direction=await component(page,'1','direction'),other=await component(page,'2','magnitude');
  await touchDrag(page,context,'1',-22,18);expect(await component(page,'1','direction')).not.toBe(direction);close(await component(page,'2','magnitude'),other);
  const before=[await component(page,'1','x'),await component(page,'2','x')];await touchDrag(page,context,'probe',25,-18);
  expect(await component(page,'1','x')).not.toBe(before[0]);expect(await component(page,'2','x')).not.toBe(before[1]);
  const x=await component(page,'1','x'),y=await component(page,'1','y');await details(page,'settings');
  await input(page,'charge-number',-1);close(await component(page,'1','x'),-x);close(await component(page,'1','y'),-y);
  await input(page,'charge-number',-2);close(await component(page,'1','x'),-2*x);
  const values=await page.locator('#individual-field-body').textContent();
  await page.locator('#zoom').fill('1.5');await page.locator('#zoom').dispatchEvent('input');await frames(page);await expect(page.locator('#individual-field-body')).toHaveText(values);
  await page.setViewportSize({width:320,height:568});await frames(page);await expect(page.locator('#individual-field-body')).toHaveText(values);await overflow(page);
  await page.getByRole('tab',{name:'Coulomb Force',exact:true}).click();await page.getByRole('tab',{name:'Electric Field',exact:true}).click();
  await expect(page.locator('#individual-fields')).toBeChecked();await expect(page.locator('#individual-field-body')).toHaveText(values);
});

test('actual canvas strokes share A, preserve common scaling and suppress a zero-resultant arrow',async({page})=>{
  await page.addInitScript(()=>{
    window.fieldStrokes=[];window.fieldTexts=[];
    const p=CanvasRenderingContext2D.prototype;
    for(const name of ['beginPath','moveTo','lineTo']){const original=p[name];p[name]=function(...args){if(name==='beginPath')this.fieldPath=[];else (this.fieldPath??=[]).push([name,...args]);return original.apply(this,args);};}
    const stroke=p.stroke;p.stroke=function(...args){if(Math.abs(this.lineWidth-2.2)<.01||Math.abs(this.lineWidth-3.6)<.01)window.fieldStrokes.push({color:this.strokeStyle,width:this.lineWidth,path:this.fieldPath,dash:this.getLineDash(),alpha:this.globalAlpha});return stroke.apply(this,args);};
    const text=p.fillText;p.fillText=function(...args){if(/^E[₁₂₃₄ᴿ]/.test(args[0]))window.fieldTexts.push(args[0]);return text.apply(this,args);};
  });
  await page.setViewportSize({width:390,height:844});await fieldTab(page);await page.locator('#preset').selectOption('equal');
  await details(page,'settings');await input(page,'probe-y',.1);await page.evaluate(()=>{fieldStrokes=[];fieldTexts=[];});await enable(page);
  const strokes=await page.evaluate(()=>fieldStrokes.slice(-3));expect(strokes).toHaveLength(3);
  const canvas=await page.locator('#scene').boundingBox(),probe=await page.locator('[data-key="probe"]').boundingBox();
  // Object buttons undergo CSS subpixel rounding; the canvas keeps double precision.
  const origin={x:strokes[0].path[0][1],y:strokes[0].path[0][2]};
  expect(Math.abs(origin.x-(probe.x+22-canvas.x))).toBeLessThan(.1);
  expect(Math.abs(origin.y-(probe.y+22-canvas.y))).toBeLessThan(.1);
  for(const v of strokes){close(v.path[0][1],origin.x);close(v.path[0][2],origin.y);}
  const [first,second,result]=strokes;expect(first.path[1][1]).toBeGreaterThan(origin.x);expect(second.path[1][1]).toBeLessThan(origin.x);
  expect(first.path[1][2]).toBeLessThan(origin.y);expect(second.path[1][2]).toBeLessThan(origin.y);
  close(result.path[1][1],origin.x);close(origin.y-result.path[1][2],2*(origin.y-first.path[1][2]));
  expect(first.color).toBe('#2b67b1');expect(second.color).toBe('#a4550b');expect(result.width).toBeGreaterThan(first.width);expect(second.dash).toEqual([7,3]);
  expect(await page.evaluate(()=>fieldTexts)).toEqual(expect.arrayContaining(['E₁','E₂','Eᴿ']));
  await input(page,'probe-y',0);await frames(page);close(await component(page,'resultant','magnitude'),0);
  await page.evaluate(()=>{fieldStrokes=[];fieldTexts=[];});await page.locator('#zoom').fill('1.1');await page.locator('#zoom').dispatchEvent('input');await frames(page);
  expect(await page.evaluate(()=>fieldStrokes.some(v=>Math.abs(v.width-3.6)<.01))).toBe(false);
  expect(await page.evaluate(()=>fieldTexts)).toContain('Eᴿ = 0 N/C');
  await details(page,'individual-field-panel');await expect(page.locator('.field-resultant')).toContainText('No direction (zero field)');
  for(const id of ['1','2'])expect(await component(page,id,'magnitude')).toBeGreaterThan(0);
  await input(page,'probe-x',-.1);await expect(page.locator('#individual-field-body')).toContainText('Undefined at a point charge');
  await expect(page.locator('#individual-field-body')).not.toContainText(/NaN|Infinity/);
});

test('overlapping vectors can be emphasized with keyboard controls without changing numbers',async({page})=>{
  await page.setViewportSize({width:320,height:568});await fieldTab(page);await page.locator('#preset').selectOption('equal');await enable(page);
  const original=await page.locator('#individual-field-body').textContent();
  const first=page.getByRole('button',{name:'Emphasize E₁ from q1',exact:true});await first.focus();await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-field-vector="all"]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#individual-field-body')).toHaveText(original);
  await page.getByRole('button',{name:'Show All',exact:true}).click();await expect(first).toHaveAttribute('aria-pressed','false');
  await page.evaluate(()=>scrollTo(0,0));await frames(page);await page.screenshot({path:'test-results/screenshots/fields-320-symmetry.png'});
  await page.locator('#preset').selectOption('square');await page.getByRole('button',{name:'Emphasize E₃ from q3',exact:true}).click();
  await page.evaluate(()=>scrollTo(0,0));await frames(page);await page.screenshot({path:'test-results/screenshots/fields-320-four-selected.png'});
  await details(page,'individual-field-panel');
  await expect(page.locator('#individual-field-body math msub')).toHaveCount(5);
  await page.locator('.field-resultant').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await frames(page);
  await page.screenshot({path:'test-results/screenshots/fields-320-four-resultant.png'});
  await overflow(page);
});
