import {test,expect} from '@playwright/test';
import {expectEquation} from './math-assertions.js';
import {makeState} from '../../src/presets.js';
import {challenges} from '../../src/learning.js';
test.use({hasTouch:true});
const sizes=[[320,568],[360,640],[390,844],[430,932],[768,1024],[1280,800],[1440,900],[844,390]];
async function tab(page,i){await page.getByRole('tab').nth(i).click();await expect(page.locator('#scene')).toBeVisible();}
async function openDetails(page,id){if(!await page.locator('#'+id).evaluate(e=>e.open))await page.locator('#'+id+'>summary').click();}
async function settings(page){await openDetails(page,'settings');}
for(const [width,height] of sizes)test(`layout ${width}×${height}: every tab, panels and screenshot`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});await page.goto('/');
  for(let i=0;i<4;i++){
    await tab(page,i);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const bounds=await page.locator('#scene').boundingBox();expect(bounds.width).toBeGreaterThan(200);expect(bounds.y).toBeLessThan(260);
    await expect(page.locator('#live-strip')).not.toContainText(/NaN|Infinity|Undefined/);
    await page.screenshot({path:`test-results/screenshots/${width}-${height}-tab${i+1}.png`,fullPage:false});
    await openDetails(page,'calculations');await expect(page.locator('#calculation-body')).toBeVisible();
    await openDetails(page,'challenge-panel');await expect(page.locator('#prediction')).toBeVisible();
    await page.locator('#prediction').fill('1');await page.locator('#check-answer').click();await expect(page.locator('#feedback')).toContainText('Current answer');
    await page.locator('[data-close="challenge-panel"]').click();await expect(page.locator('#prediction')).not.toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    // Restore top position so tab workspace placement is measured fairly.
    await page.evaluate(()=>scrollTo(0,0));
  }
  expect(errors).toEqual([]);
});
test('all arrangements, guided investigations and live challenges work',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  for(let i=0;i<4;i++){
    await tab(page,i);const presets=await page.locator('#preset option').evaluateAll(es=>es.map(e=>e.value));
    for(const p of presets){await page.locator('#preset').selectOption(p);await expect(page.locator('#live-strip')).not.toContainText(/NaN|Infinity|Undefined/);}
    await openDetails(page,'guided');
    for(const g of ['0','1','2']){await page.locator('#guide').selectOption(g);await page.locator('#load-guide').click();await expect(page.locator('#live-strip')).not.toContainText(/NaN|Infinity|Undefined/);}
    // Reset to defaults for engine-backed expected answers.
    await page.locator('#preset').selectOption(i===3?'perpendicular':i===0?'opposite':i===1?'positive':'equal');
    await openDetails(page,'challenge-panel');
    for(let j=0;j<challenges[i].length;j++){
      await page.locator('#challenge-select').selectOption(String(j));await page.locator('#prediction').fill(String(challenges[i][j].answer(makeState(i))));await page.locator('#check-answer').click();await expect(page.locator('#feedback')).toContainText('Correct prediction.');
    }
  }
  expect(errors).toEqual([]);
});
test('mouse drag, keyboard movement, resize invariance and precise input validation',async({page})=>{
  await page.setViewportSize({width:1280,height:800});await page.goto('/');
  const target=page.locator('.object-target[data-key="1"]');let box=await target.boundingBox();
  await page.mouse.move(box.x+22,box.y+22);await page.mouse.down();await page.mouse.move(box.x+42,box.y+2,{steps:8});await page.mouse.up();
  await settings(page);const x=Number(await page.locator('#charge-x').inputValue());expect(x).toBeGreaterThan(-.1);
  await target.focus();await page.keyboard.press('ArrowRight');expect(Number(await page.locator('#charge-x').inputValue())).toBeCloseTo(x+.005,5);
  const value=await page.locator('#live-strip').textContent();await page.setViewportSize({width:320,height:568});await expect(page.locator('#live-strip')).toHaveText(value);
  await page.locator('#charge-number').fill('-2');await page.locator('#charge-number').dispatchEvent('change');await expect(page.locator('#charge-output')).toHaveText('-2 μC');
  await page.locator('#charge-number').fill('7');await page.locator('#charge-number').dispatchEvent('change');await expect(page.locator('#input-error')).toContainText('from -5 to 5');
  await page.locator('#charge-number').fill('0');await page.locator('#charge-number').dispatchEvent('change');await expect(page.locator('#live-strip')).toContainText('0 N');
  await page.locator('#charge-range').focus();await page.keyboard.press('End');await expect(page.locator('#charge-output')).toHaveText('5 μC');
});
test('real touch drag and two-finger pinch preserve the physical calculation',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');const session=await context.newCDPSession(page);let box=await page.locator('.object-target[data-key="1"]').boundingBox();
  const x=box.x+22,y=box.y+22;await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+35,y:y-25,id:1}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await settings(page);expect(Number(await page.locator('#charge-x').inputValue())).toBeGreaterThan(-.09);await page.evaluate(()=>scrollTo(0,0));
  const old=await page.locator('#live-strip').textContent(),canvas=await page.locator('#scene').boundingBox();const cy=canvas.y+canvas.height*.8;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:cy,id:1},{x:220,y:cy,id:2}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:110,y:cy,id:1},{x:250,y:cy,id:2}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('#live-strip')).toHaveText(old);expect(Number(await page.locator('#zoom').inputValue())).toBeGreaterThan(1);
});
test('source count limits, independent tab state, reset, singularity and zero-field hunt',async({page})=>{
  await page.goto('/');await page.locator('#add').click();await page.locator('#add').click();await expect(page.locator('#add')).toBeDisabled();await expect(page.locator('.object-target')).toHaveCount(4);
  await page.locator('#preset').selectOption('equal');await tab(page,1);await page.locator('#preset').selectOption('equal');await settings(page);
  await page.locator('#probe-x').fill('0');await page.locator('#probe-x').dispatchEvent('change');await expect(page.locator('#live-strip')).toContainText('0 N/C');
  await page.locator('#probe-x').fill('-0.1');await page.locator('#probe-x').dispatchEvent('change');await expect(page.locator('#live-strip')).toContainText('Undefined at a point charge');await expect(page.locator('#live-strip')).not.toContainText(/NaN|Infinity/);
  await page.locator('#reset').click();await tab(page,0);await expect(page.locator('#preset')).toHaveValue('equal');await tab(page,1);await expect(page.locator('#preset')).toHaveValue('equal');
});
test('animation play, pause, step, reset and equilibrium',async({page})=>{
  await page.goto('/');await tab(page,3);await page.locator('#play').click();await page.waitForTimeout(250);await page.locator('#play').click();const paused=await page.locator('#live-strip').textContent();await page.waitForTimeout(150);await expect(page.locator('#live-strip')).toHaveText(paused);
  await page.locator('#step').click();expect(await page.locator('#live-strip').textContent()).not.toBe(paused);await page.locator('#reset').click();await expect(page.locator('#live-strip')).toContainText('0 s');
  await page.locator('#preset').selectOption('equilibrium');await openDetails(page,'calculations');await expect(page.locator('#calculation-body')).toContainText('dynamic equilibrium');
  await settings(page);await page.locator('#m-mass').fill('0');await page.locator('#m-mass').dispatchEvent('change');await expect(page.locator('#input-error')).toContainText('Enter a value');await expect(page.locator('#live-strip')).not.toContainText(/NaN|Infinity/);
});
test('keyboard tabs, help, theme and mobile panel shortcuts',async({page})=>{
  await page.setViewportSize({width:360,height:640});await page.goto('/');await page.getByRole('tab').nth(0).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab').nth(1)).toHaveAttribute('aria-selected','true');
  await page.locator('#help-button').click();await expect(page.locator('#help-panel')).toBeVisible();await page.locator('#theme-toggle').check();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.locator('#close-help').click();
  await page.locator('[data-open="challenge-panel"]').click();await expect(page.locator('#prediction')).toBeVisible();await page.locator('[data-close="challenge-panel"]').click();await expect(page.locator('#prediction')).not.toBeVisible();
  await page.screenshot({path:'test-results/screenshots/dark-360.png',fullPage:false});
});
test('diagram layers, exact isolated contours, uniform potential and work signs',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.locator('#preset').selectOption('triangle');await settings(page);await page.locator('[data-toggle="components"]').check();await page.locator('[data-toggle="fbd"]').check();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/screenshots/force-components.png'});
  await tab(page,1);await settings(page);await page.locator('#preset').selectOption('negative');await page.locator('[data-toggle="lines"]').uncheck();await page.locator('[data-toggle="grid"]').check();await expect(page.locator('#live-strip')).not.toContainText(/NaN|Infinity/);await page.locator('[data-toggle="lines"]').check();
  await tab(page,2);await settings(page);await page.locator('#preset').selectOption('positive');await page.locator('[data-toggle="heat"]').check();await page.locator('[data-toggle="overlay"]').check();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/screenshots/isolated-potential.png'});
  await page.locator('#potential-mode').selectOption('uniform');await page.locator('#probe-y').fill('0');await page.locator('#probe-y').dispatchEvent('change');await page.locator('#b-y').fill('0.1');await page.locator('#b-y').dispatchEvent('change');await expect(page.locator('#live-strip')).toContainText('-1500 V');
  await openDetails(page,'calculations');await expectEquation(page,String.raw`W_{\mathrm{field}}=-\Delta U=3.000\times10^{-6}\;\mathrm{J}`);await expectEquation(page,String.raw`\Delta U=-3.000\times10^{-6}\;\mathrm{J}`);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/screenshots/uniform-potential.png'});
  await page.locator('#preset').selectOption('square');await expect(page.locator('#calculation-body')).toContainText('Use up to three charges');expect(errors).toEqual([]);
});
test('rendered plate exit, impact freeze and moving equilibrium',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await tab(page,3);await openDetails(page,'calculations');
  for(let i=0;i<14;i++)await page.locator('#step').click();await expect(page.locator('#calculation-body')).toContainText('Outside field');await expect(page.locator('#live-strip')).toContainText('0 m/s²');
  await page.locator('#preset').selectOption('rest');for(let i=0;i<20;i++)await page.locator('#step').click();await expect(page.locator('#calculation-body')).toContainText('Plate impact');const impact=await page.locator('#live-strip').textContent();await page.locator('#step').click();await expect(page.locator('#live-strip')).toHaveText(impact);
  await page.locator('#preset').selectOption('equilibrium');for(let i=0;i<10;i++)await page.locator('#step').click();await expect(page.locator('#calculation-body')).toContainText('dynamic equilibrium');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/screenshots/equilibrium.png'});
});
