import {test,expect} from '@playwright/test';

test.use({hasTouch:true});
const referenceK=8.987551792261171e9;
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function potentialTab(page){await page.goto('/');await page.getByRole('tab',{name:'Electric Potential',exact:true}).click();}
async function details(page,id){if(!await page.locator('#'+id).evaluate(el=>el.open))await page.locator('#'+id+'>summary').click();}
async function input(page,id,value){await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('change');await frames(page);}
async function position(page,key){const prefix=key==='probe'?'probe':'b';return {x:Number(await page.locator('#'+prefix+'-x').inputValue()),y:Number(await page.locator('#'+prefix+'-y').inputValue())};}
async function comparison(page){return page.locator('#snap-comparison').evaluate(el=>Object.fromEntries(['va','vb','dv','du','work','tolerance'].map(key=>[key,Number(el.dataset[key])])));}
function close(actual,expected,tolerance=2e-7){expect(Math.abs(actual-expected)).toBeLessThanOrEqual(tolerance);}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);}
async function assertLevel(page,key,level,q=2e-6,source={x:0,y:0}){
  const p=await position(page,key),v=referenceK*q/Math.hypot(p.x-source.x,p.y-source.y);close(v,level,Math.max(1e-7,Math.abs(level)*1e-11));
  await expect(page.locator(key==='probe'?'#snap-a-state':'#snap-b-state')).toHaveAttribute('data-attachment','attached');
}
async function drag(page,context,key,points,touch=false){
  await page.evaluate(()=>scrollTo(0,0));await frames(page);
  const target=await page.locator(`.object-target[data-key="${key}"]`).boundingBox(),canvas=await page.locator('#scene').boundingBox();
  const scale=Math.min(canvas.width/.6,canvas.height/.5)*Number(await page.locator('#zoom').inputValue());
  const screen=p=>({x:canvas.x+canvas.width/2+p.x*scale,y:canvas.y+canvas.height/2-p.y*scale});
  const from={x:target.x+22,y:target.y+22};
  const before=await page.evaluate(()=>[scrollY,document.querySelector('.tabs').scrollLeft]);
  if(touch){
    const session=await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});
    for(const point of points)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...screen(point),id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
  }else{
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    for(const point of points){const p=screen(point);await page.mouse.move(p.x,p.y);}
    await page.mouse.up();
  }
  await frames(page);expect(await page.evaluate(()=>[scrollY,document.querySelector('.tabs').scrollLeft])).toEqual(before);
}

for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[768,1024],[1280,800],[844,390]]){
  for(const theme of ['light','dark'])test(`equipotential ${width}×${height} ${theme}: same potential, independent detach and screenshot`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.setViewportSize({width,height});await potentialTab(page);
    if(theme==='dark'){await page.locator('#help-button').click();await page.locator('#theme-toggle').check();await page.locator('#close-help').click();}
    const heightBefore=(await page.locator('#scene').boundingBox()).height;
    await page.getByRole('button',{name:'B → Same Potential as A',exact:true}).click();await frames(page);
    await expect(page.locator('#snap-equipotential')).toBeChecked();
    await expect(page.locator('#snap-a-state')).toHaveAttribute('data-attachment','attached');await expect(page.locator('#snap-b-state')).toHaveAttribute('data-attachment','attached');
    const c=await comparison(page),a=await position(page,'probe'),b=await position(page,'b');
    const analytical=p=>referenceK*1e-6/Math.hypot(p.x+.1,p.y)+referenceK*1e-6/Math.hypot(p.x-.1,p.y);
    close(c.va,analytical(a));close(c.vb,analytical(b));expect(Math.abs(c.dv)).toBeLessThanOrEqual(c.tolerance);close(c.dv,analytical(b)-analytical(a));
    close(c.du,2e-9*c.dv,1e-20);close(c.work,-2e-9*c.dv,1e-20);
    await expect(page.locator('#snap-comparison')).toContainText('Same Equipotential Surface');await expect(page.locator('#snap-comparison')).toContainText('Computed ΔV');
    expect((await page.locator('#scene').boundingBox()).height).toBe(heightBefore);
    for(const button of [page.locator('#same-potential'),page.locator('#detach-a'),page.locator('#detach-b')])expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.evaluate(()=>scrollTo(0,0));await frames(page);await noOverflow(page);
    await page.screenshot({path:`test-results/screenshots/snap-${width}-${height}-${theme}-attached.png`});
    const beforeA=await position(page,'probe'),beforeB=await position(page,'b');await page.getByRole('button',{name:'Detach B',exact:true}).click();
    expect(await position(page,'probe')).toEqual(beforeA);expect(await position(page,'b')).toEqual(beforeB);
    await expect(page.locator('#snap-a-state')).toHaveAttribute('data-attachment','attached');await expect(page.locator('#detach-b')).toBeHidden();
    await page.evaluate(()=>scrollTo(0,0));await frames(page);
    await page.screenshot({path:`test-results/screenshots/snap-${width}-${height}-${theme}-detached.png`});
    await details(page,'equipotential-working');await expect(page.locator('#equipotential-working')).toContainText('field can be nonzero');
    await expect(page.locator('#equipotential-working')).toContainText('Actual current positions');await noOverflow(page);
    await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await frames(page);
    const nav=await page.getByRole('tablist').boundingBox();expect(nav.y).toBeCloseTo(0,0);
    await page.locator('#snap-equipotential').uncheck();expect(await position(page,'probe')).toEqual(beforeA);expect(await position(page,'b')).toEqual(beforeB);
    await expect(page.locator('#detach-a')).toBeHidden();await noOverflow(page);expect(errors).toEqual([]);
  });
}

test('mouse snapping and curved sliding maintain the actual analytical potential',async({page,context})=>{
  await page.setViewportSize({width:1280,height:800});await potentialTab(page);await page.locator('#preset').selectOption('positive');
  await page.locator('#snap-equipotential').check();
  await drag(page,context,'probe',[{x:.22,y:.03}]);await assertLevel(page,'probe',80000);
  await drag(page,context,'b',[{x:-.16,y:.16}]);await assertLevel(page,'b',80000);
  const a=await position(page,'probe'),r=referenceK*2e-6/80000;
  const points=[135,140,145,150,155,160].map(deg=>({x:r*Math.cos(deg*Math.PI/180),y:r*Math.sin(deg*Math.PI/180)}));
  await drag(page,context,'b',points);await assertLevel(page,'b',80000);expect(await position(page,'probe')).toEqual(a);
  const c=await comparison(page);expect(Math.abs(c.dv)).toBeLessThanOrEqual(c.tolerance);
});

test('touch snapping, sliding, detachment, free movement and recapture work on a phone',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await potentialTab(page);await page.locator('#preset').selectOption('positive');await page.locator('#snap-equipotential').check();
  await drag(page,context,'probe',[{x:.22,y:.03}],true);await assertLevel(page,'probe',80000);
  await drag(page,context,'b',[{x:-.16,y:.16}],true);await assertLevel(page,'b',80000);
  const r=referenceK*2e-6/80000,a=await position(page,'probe');
  await drag(page,context,'b',[140,145,150,155].map(deg=>({x:r*Math.cos(deg*Math.PI/180),y:r*Math.sin(deg*Math.PI/180)})),true);await assertLevel(page,'b',80000);
  await page.locator('#detach-b').click();const before=await position(page,'b');
  await drag(page,context,'b',[{x:before.x-.002,y:before.y+.001}],true);await expect(page.locator('#detach-b')).toBeHidden();
  const target={x:-.05,y:-.15};await drag(page,context,'b',[target],true);let moved=await position(page,'b');close(moved.x,target.x,5e-5);close(moved.y,target.y,5e-5);
  await expect(page.locator('#snap-comparison')).toHaveAttribute('data-equal','false');expect(await position(page,'probe')).toEqual(a);
  await page.locator('#snap-equipotential').uncheck();const free={x:.08,y:.12};await drag(page,context,'b',[free],true);moved=await position(page,'b');close(moved.x,free.x,5e-5);close(moved.y,free.y,5e-5);
  await page.locator('#snap-equipotential').check();await drag(page,context,'b',[{x:-.16,y:.16}],true);await assertLevel(page,'b',80000);
});

test('source edits preserve nearby levels, polarity loss releases, and presets clear associations',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await potentialTab(page);await page.locator('#preset').selectOption('positive');await page.locator('#snap-equipotential').check();
  await drag(page,context,'probe',[{x:.22,y:.03}]);await drag(page,context,'1',[{x:.003,y:.002}],true);
  const source={x:Number(await page.locator('#charge-x').inputValue()),y:Number(await page.locator('#charge-y').inputValue())};await assertLevel(page,'probe',80000,2e-6,source);
  await details(page,'settings');await input(page,'charge-x',.004);await assertLevel(page,'probe',80000,2e-6,{x:.004,y:source.y});
  const before=await position(page,'probe');await input(page,'charge-number',-2);await expect(page.locator('#detach-a')).toBeHidden();expect(await position(page,'probe')).toEqual(before);
  await expect(page.locator('#snap-status')).toContainText('released');await page.locator('#preset').selectOption('equal');await expect(page.locator('#detach-a')).toBeHidden();
  await page.locator('#same-potential').click();await page.locator('#reset').click();await expect(page.locator('#detach-a')).toBeHidden();await expect(page.locator('#detach-b')).toBeHidden();
});

test('keyboard controls, optional explanation and guided zero-work activity are accessible',async({page})=>{
  await page.setViewportSize({width:320,height:568});await potentialTab(page);
  await page.locator('#snap-equipotential').focus();await page.keyboard.press('Space');await expect(page.locator('#snap-equipotential')).toBeChecked();
  await page.locator('#same-potential').focus();await page.keyboard.press('Enter');
  await details(page,'equipotential-working');await page.locator('#equipotential-working').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
  await page.screenshot({path:'test-results/screenshots/snap-320-working.png'});
  await details(page,'guided');await details(page,'zero-work-activity');await expect(page.locator('#zero-work-activity')).toContainText('Predict first');
  await page.locator('#start-zero-work').click();await expect(page.locator('#preset')).toHaveValue('equal');await expect(page.locator('#snap-equipotential')).toBeChecked();
  await details(page,'zero-work-answer');await expect(page.locator('#zero-work-answer')).toContainText('This does not require E = 0');
  await page.locator('#zero-work-activity>summary').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:'test-results/screenshots/snap-320-activity.png'});
  await noOverflow(page);
  await page.locator('#same-potential').click();await page.locator('#detach-a').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#detach-a')).toBeHidden();await expect(page.locator('#detach-b')).toBeVisible();
});

test('negative, mixed, three/four-source and uniform examples support the demonstration',async({page})=>{
  await page.setViewportSize({width:390,height:844});await potentialTab(page);
  await page.locator('#preset').selectOption('positive');
  for(let i=0;i<3;i++){await page.locator('#add').click();await expect(page.locator('#live-strip')).not.toContainText(/Undefined|NaN|Infinity/);}
  await page.locator('#remove').click();await expect(page.locator('#live-strip')).not.toContainText(/Undefined|NaN|Infinity/);
  for(const preset of ['negative','opposite','triangle','square']){
    await page.locator('#preset').selectOption(preset);await page.locator('#same-potential').click();
    await expect(page.locator('#snap-comparison')).toHaveAttribute('data-equal','true');const c=await comparison(page);expect(Math.abs(c.dv)).toBeLessThanOrEqual(c.tolerance);
    if(preset==='negative'){await page.evaluate(()=>scrollTo(0,0));await frames(page);await page.screenshot({path:'test-results/screenshots/snap-390-negative.png'});}
  }
  await details(page,'settings');await page.locator('#potential-mode').selectOption('uniform');await page.locator('#same-potential').click();
  const a=await position(page,'probe'),b=await position(page,'b');close(a.y,b.y,1e-12);
  await page.locator('[data-toggle="contours"]').uncheck();await expect(page.locator('#detach-a')).toBeHidden();await expect(page.locator('#detach-b')).toBeHidden();
});

test('unavailable distinct point and singular precise inputs fail gracefully without fabricated results',async({page})=>{
  await page.setViewportSize({width:390,height:844});await potentialTab(page);await page.locator('#preset').selectOption('positive');await details(page,'settings');
  await input(page,'probe-x',.002);const before=await position(page,'b');await page.locator('#same-potential').click();
  await expect(page.locator('#snap-status')).toContainText('No distinct point');expect(await position(page,'b')).toEqual(before);await expect(page.locator('#snap-equipotential')).not.toBeChecked();
  await input(page,'probe-x',0);await expect(page.locator('#input-error')).toContainText('Keep probes clear');await expect(page.locator('#live-strip')).not.toContainText(/NaN|Infinity|Undefined/);
});

test('zoom, orientation, independent keyboard sliding and other tabs retain their state',async({page})=>{
  await page.setViewportSize({width:390,height:844});await potentialTab(page);await page.locator('#same-potential').click();
  const a=await position(page,'probe'),b=await position(page,'b'),c=await comparison(page);
  await details(page,'settings');await page.locator('#zoom').fill('1.2');await page.locator('#zoom').dispatchEvent('input');await page.setViewportSize({width:844,height:390});await frames(page);
  expect(await position(page,'probe')).toEqual(a);expect(await position(page,'b')).toEqual(b);expect(await comparison(page)).toEqual(c);await noOverflow(page);
  await page.getByRole('tab',{name:'Electric Field',exact:true}).click();await expect(page.locator('#snap-equipotential')).toHaveCount(0);await page.locator('#individual-fields').check();
  await page.getByRole('tab',{name:'Electric Potential',exact:true}).click();await expect(page.locator('#snap-equipotential')).toBeChecked();await expect(page.locator('#detach-b')).toBeVisible();
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await frames(page);
  await page.locator('.object-target[data-key="b"]').evaluate(el=>el.focus({preventScroll:true}));await page.keyboard.press('ArrowRight');
  expect(await position(page,'probe')).toEqual(a);await expect(page.locator('#snap-comparison')).toHaveAttribute('data-equal','true');
});

test('a free probe can rejoin the visible custom contour created through A',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await potentialTab(page);await page.locator('#preset').selectOption('positive');
  await page.locator('#same-potential').click();const level=Number(await page.locator('#snap-a-state').getAttribute('data-level'));
  close(level,89875.5179226117);await page.locator('#detach-b').click();
  await drag(page,context,'b',[{x:.08,y:-.06}],true);await expect(page.locator('#detach-b')).toBeHidden();
  await drag(page,context,'b',[{x:-.195,y:0}],true);await assertLevel(page,'b',level);
  close(Number(await page.locator('#snap-b-state').getAttribute('data-level')),level);
  await expect(page.locator('#snap-comparison')).toHaveAttribute('data-equal','true');
  await page.evaluate(()=>scrollTo(0,0));await frames(page);await page.screenshot({path:'test-results/screenshots/snap-390-recaptured.png'});
});
