import {test,expect} from '@playwright/test';
import {expectZeroPotential,expectEquation} from './math-assertions.js';
test.use({hasTouch:true});
const sizes=[[320,568],[360,640],[390,844],[430,932],[768,1024],[1280,800],[844,390]];
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function start(page){await page.goto('/');await page.getByRole('tab',{name:'Electric Potential',exact:true}).click();}
async function details(page,id){if(!await page.locator('#'+id).evaluate(e=>e.open))await page.locator('#'+id+'>summary').click();}
async function input(page,id,value){await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('change');await frames(page);}
async function zero(page){await expect(page.locator('#snap-comparison')).toHaveAttribute('data-equal','true');await expectZeroPotential(page);}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);}
async function captureStrokes(page){await page.evaluate(()=>{
  const ctx=document.getElementById('scene').getContext('2d');window.strokes=[];let path=[];
  for(const name of ['beginPath','moveTo','lineTo','stroke']){const original=ctx[name].bind(ctx);ctx[name]=(...args)=>{if(name==='beginPath')path=[];if(name==='moveTo'||name==='lineTo')path.push(args);if(name==='stroke')window.strokes.push({color:ctx.strokeStyle,path:[...path]});return original(...args);};}
});}

for(const [width,height] of sizes)for(const dark of [false,true])test(`models ${width}×${height} ${dark?'dark':'light'}: screenshots, zero work and responsive controls`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});await start(page);
  if(dark){await page.getByRole('button',{name:'Help and display settings'}).click();await page.locator('#theme-toggle').check();await page.locator('#close-help').click();}
  await page.locator('#preset').selectOption('opposite');await page.locator('[data-toggle="fieldLines"]').check();await frames(page);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/screenshots/point-lines-${width}-${height}-${dark?'dark':'light'}.png`,fullPage:false});
  await page.locator('#field-model').selectOption('plates');await expect(page.locator('[data-toggle="fieldLines"]')).not.toBeChecked();
  await page.locator('[data-toggle="fieldLines"]').check();await page.locator('#same-potential').click();await zero(page);
  await expect(page.locator('#plate-readout')).toContainText('1.000 × 10⁴ V/m');
  await expect(page.locator('#scene')).toBeVisible();await noOverflow(page);
  await page.evaluate(()=>scrollTo(0,0));await frames(page);await page.screenshot({path:`test-results/screenshots/plates-${width}-${height}-${dark?'dark':'light'}.png`,fullPage:false});
  const bounds=await page.locator('#scene').boundingBox();expect(bounds.y).toBeLessThan(260);
  await details(page,'plate-secondary');await page.locator('#plate-orientation').selectOption('vertical');
  await page.locator('#same-potential').click();await zero(page);await noOverflow(page);
  await page.evaluate(()=>scrollTo(0,0));await frames(page);await page.screenshot({path:`test-results/screenshots/plates-vertical-${width}-${height}-${dark?'dark':'light'}.png`,fullPage:false});
  for(const label of ['Show Electric Field Lines','Show Equipotential Lines'])expect(await page.getByLabel(label,{exact:true}).evaluate(e=>e.closest('label').getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.evaluate(()=>scrollTo(0,700));expect(await page.locator('.tabs').evaluate(e=>Math.abs(e.getBoundingClientRect().top))).toBeLessThan(1);
  expect(errors).toEqual([]);await expect(page.locator('#live-strip')).not.toContainText(/NaN|Infinity|Undefined/);
});

test('point overlay defaults OFF, draws continuous paths with arrows and restores exact baseline when hidden',async({page})=>{
  await start(page);await page.locator('#preset').selectOption('positive');await frames(page);
  const toggle=page.locator('[data-toggle="fieldLines"]');await expect(toggle).not.toBeChecked();
  const before=await page.locator('#scene').evaluate(c=>c.toDataURL()),values=await page.locator('#live-strip').innerText();
  await captureStrokes(page);await toggle.check();await frames(page);
  const lines=await page.evaluate(()=>window.strokes.filter(s=>s.color==='#167d79'));
  expect(lines.filter(s=>s.path.length>20).length).toBeGreaterThan(4);expect(lines.filter(s=>s.path.length===2).length).toBeGreaterThan(4);
  expect(await page.locator('#scene').evaluate(c=>c.toDataURL())).not.toBe(before);expect(await page.locator('#live-strip').innerText()).toBe(values);
  await toggle.uncheck();await frames(page);expect(await page.locator('#scene').evaluate(c=>c.toDataURL())).toBe(before);
});

test('all seven point presets render field paths and update on magnitude, polarity, add/remove, source drag and resize',async({page})=>{
  await start(page);await page.locator('[data-toggle="fieldLines"]').check();
  for(const key of ['positive','negative','equal','opposite','unequal','triangle','square']){
    await page.locator('#preset').selectOption(key);await captureStrokes(page); // Force a layer change to inspect live rendering.
    await page.locator('[data-toggle="fieldLines"]').uncheck();await page.locator('[data-toggle="fieldLines"]').check();await frames(page);
    expect(await page.evaluate(()=>window.strokes.filter(s=>s.color==='#167d79'&&s.path.length>5).length)).toBeGreaterThan(0);
    await expect(page.locator('#live-strip')).not.toContainText(/NaN|Undefined/);
  }
  await page.locator('#preset').selectOption('positive');await page.locator('#add').click();await page.locator('#remove').click();await details(page,'settings');
  await input(page,'charge-number',-3);await input(page,'charge-x',.03);await page.setViewportSize({width:320,height:568});await frames(page);await noOverflow(page);
  await page.evaluate(()=>scrollTo(0,0));const charge=page.locator('.object-target[data-key="1"]');await charge.focus();await page.keyboard.press('ArrowRight');
  expect(Number(await page.locator('#charge-x').inputValue())).toBeCloseTo(.035);await expect(page.locator('[data-toggle="fieldLines"]')).toBeChecked();
});

test('plates draw straight equally spaced field/equipotential lines and reverse physical arrow direction',async({page})=>{
  await start(page);await page.locator('#field-model').selectOption('plates');await captureStrokes(page);
  await page.locator('[data-toggle="fieldLines"]').check();await frames(page);
  let strokes=await page.evaluate(()=>window.strokes);
  const field=strokes.filter(s=>s.color==='#167d79'&&s.path.length===2),contours=strokes.filter(s=>s.color==='#7955ad'&&s.path.length===2&&Math.hypot(s.path[1][0]-s.path[0][0],s.path[1][1]-s.path[0][1])>60);
  expect(field.length).toBeGreaterThanOrEqual(15);expect(contours.length).toBe(3);
  for(const s of field){expect(s.path[0][0]).toBeCloseTo(s.path[1][0]);expect(s.path[1][1]).toBeGreaterThan(s.path[0][1]);}
  for(const s of contours)expect(s.path[0][1]).toBeCloseTo(s.path[1][1]);
  const y=contours.map(s=>s.path[0][1]).sort((a,b)=>a-b);expect(y[1]-y[0]).toBeCloseTo(y[2]-y[1]);
  await page.locator('#reverse-polarity').click();await captureStrokes(page);await page.locator('[data-toggle="fieldLines"]').uncheck();await page.locator('[data-toggle="fieldLines"]').check();await frames(page);
  strokes=await page.evaluate(()=>window.strokes.filter(s=>s.color==='#167d79'&&s.path.length===2));for(const s of strokes)expect(s.path[1][1]).toBeLessThan(s.path[0][1]);
  await page.locator('[data-toggle="contours"]').uncheck();await expect(page.locator('[data-toggle="contours"]')).not.toBeChecked();
});

test('plate voltage, separation, reversal, precise probes and work signs remain physically linked',async({page})=>{
  await start(page);await page.locator('#field-model').selectOption('plates');
  await input(page,'plate-separation',.04);await expect(page.locator('#plate-readout')).toContainText('5000 V/m');
  await input(page,'plate-voltage',400);await expect(page.locator('#plate-readout')).toContainText('1.000 × 10⁴ V/m');
  await input(page,'plate-voltage',200);await input(page,'plate-separation',.02);await details(page,'settings');
  await input(page,'probe-y',.005);await input(page,'b-y',0);await details(page,'calculations');
  await expect(page.locator('#live-strip')).toContainText('-50 V');await expectEquation(page,String.raw`\Delta U=-1.000\times10^{-7}\;\mathrm{J}`);await expectEquation(page,String.raw`W_{\mathrm{field}}=1.000\times10^{-7}\;\mathrm{J}`);
  await page.locator('#reverse-polarity').click();await expect(page.locator('#live-strip')).toContainText('50 V');
  await input(page,'plate-separation',0);await expect(page.locator('#input-error')).toContainText('Enter a value');
  await input(page,'plate-separation',.02);await input(page,'b-y',.02);await expect(page.locator('#input-error')).toContainText('modeled central region');
  expect(Number(await page.locator('#b-y').inputValue())).toBe(.02); // Invalid text is retained for correction; engine remains at last valid position.
  await expect(page.locator('#live-strip')).not.toContainText(/NaN|Undefined/);
});

test('models retain independent probes, contours, voltage, zoom and attachments across tabs',async({page})=>{
  await start(page);await page.locator('#preset').selectOption('negative');await page.locator('[data-toggle="fieldLines"]').check();await page.locator('#same-potential').click();await zero(page);
  const oldLevel=await page.locator('#snap-a-state').getAttribute('data-level');
  await page.locator('#field-model').selectOption('plates');await input(page,'plate-voltage',300);await page.locator('#same-potential').click();await zero(page);
  await details(page,'settings');await page.locator('#zoom').fill('1.2');await page.locator('#zoom').dispatchEvent('input');
  await page.getByRole('tab',{name:'Uniform Electric Field',exact:true}).click();await expect(page.locator('#play')).toBeVisible();
  await page.getByRole('tab',{name:'Electric Potential',exact:true}).click();await expect(page.locator('#plate-voltage')).toHaveValue('300');await zero(page);
  await page.locator('#field-model').selectOption('point');await expect(page.locator('#preset')).toHaveValue('negative');await expect(page.locator('#snap-a-state')).toHaveAttribute('data-level',oldLevel);await zero(page);
  await page.locator('#field-model').selectOption('plates');await expect(page.locator('#zoom')).toHaveValue('1.2');await zero(page);
});

test('real phone touch snaps and slides both probes, detaches independently, recaptures and moves freely',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await start(page);await page.locator('#field-model').selectOption('plates');await page.locator('[data-toggle="fieldLines"]').check();await page.locator('#snap-equipotential').check();
  const session=await context.newCDPSession(page);
  async function drag(key,points){await page.evaluate(()=>scrollTo(0,0));await frames(page);const box=await page.locator('#scene').boundingBox(),o=await page.locator(`.object-target[data-key="${key}"]`).boundingBox();const scale=Math.min(box.width/.065,box.height/.060);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:o.x+22,y:o.y+22,id:1}]});for(const p of points)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2+p.x*scale,y:box.y+box.height/2-p.y*scale,id:1}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames(page);}
  await drag('probe',[{x:-.011,y:.005}]);await expect(page.locator('#snap-a-state')).toHaveAttribute('data-attachment','attached');
  await page.locator('#same-potential').click();await zero(page);
  await drag('b',[{x:.014,y:.004},{x:.016,y:.003}]);await zero(page);
  await page.locator('#detach-b').click();await expect(page.locator('#detach-a')).toBeVisible();await expect(page.locator('#detach-b')).toBeHidden();
  await drag('b',[{x:.016,y:.001},{x:.016,y:-.008}]);await expect(page.locator('#snap-comparison')).toHaveAttribute('data-equal','false');
  await drag('b',[{x:.016,y:-.005}]);await expect(page.locator('#snap-b-state')).toHaveAttribute('data-attachment','attached');
  await page.locator('#snap-equipotential').uncheck();await drag('b',[{x:.014,y:-.003}]);await expect(page.locator('#detach-a')).toBeHidden();await expect(page.locator('#detach-b')).toBeHidden();await noOverflow(page);await session.detach();
});

test('guided activity sets up both models and preserves the original investigations',async({page})=>{
  await start(page);await details(page,'guided');await details(page,'field-equipotential-activity');
  await page.locator('#start-field-point').click();await expect(page.locator('#preset')).toHaveValue('positive');await expect(page.locator('[data-toggle="fieldLines"]')).toBeChecked();
  await page.locator('#start-field-plates').click();await expect(page.locator('#plate-voltage')).toHaveValue('200');await expect(page.locator('#plate-separation')).toHaveValue('0.02');await page.locator('#same-potential').click();await zero(page);
  await page.locator('#guide').selectOption('0');await page.locator('#load-guide').click();await expect(page.locator('#field-model')).toHaveValue('point');await expect(page.locator('#guide option')).toHaveCount(3);
});
