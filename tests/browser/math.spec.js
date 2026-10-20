import {test,expect} from '@playwright/test';
const sizes=[[320,568],[360,640],[390,844],[430,932],[768,1024],[1280,800],[844,390]];
const input=async(p,id,value)=>{await p.locator('#'+id).fill(String(value));await p.locator('#'+id).dispatchEvent('change');};
async function open(p,id){if(!await p.locator('#'+id).evaluate(e=>e.open))await p.locator('#'+id+'>summary').click();}
async function motion(p){await p.goto('/');await p.getByRole('tab').nth(3).click();await open(p,'calculations');}
const model=p=>p.locator('[data-governing-model] annotation').allTextContents();
const data=p=>p.locator('#motion-status').evaluate(e=>Object.fromEntries(['ax','ay','ex','ey','vx','vy'].map(k=>[k,Number(e.dataset[k])])));
async function matching(p){
  const expected=await data(p),actual=await p.locator('#motion-math-results').evaluate(e=>({ax:Number(e.dataset.ax),ay:Number(e.dataset.ay)}));
  expect(actual.ax).toBe(expected.ax);expect(actual.ay).toBe(expected.ay);
}
for(const [width,height] of sizes)for(const theme of ['light','dark'])test(`math audit ${width}x${height} ${theme}: all tabs, expanded content, screenshots`,async({page})=>{
  test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});await page.goto('/');
  await page.locator('#help-button').click();if(theme==='dark')await page.locator('#theme-toggle').check();await page.locator('#close-help').click();
  for(let i=0;i<4;i++){
    await page.getByRole('tab').nth(i).click();await open(page,'calculations');await open(page,'guided');await open(page,'challenge-panel');await open(page,'settings');
    await page.locator('#prediction').fill('0');await page.locator('#check-answer').click();await page.locator('#hint').click();
    if(i===2)await page.locator('#guided details').evaluateAll(es=>es.forEach(e=>e.open=true));
    await expect(page.locator('.eyebrow')).toHaveText('INTERACTIVE LAB');
    const text=await page.locator('body').innerText();
    expect(text).not.toMatch(/\b(?:SP025|SP015|Semester\s*\d|Chapter\s*\d|Subtopic\s*\d|Topic\s*\d)/i);
    const headings=await page.locator('h2,h3,h4,summary,#preset option').allTextContents();expect(headings.join('\n')).not.toMatch(/(?:^|\n)\s*(?:\d+|[A-D])\s*[·.]/);
    expect(await page.locator('#calculation-body mfrac').count()).toBeGreaterThan(0);
    expect(await page.locator('#calculation-body msub').count()).toBeGreaterThan(0);
    expect(await page.locator('#calculation-body msup').count()).toBeGreaterThan(0);
    expect(await page.locator('#calculation-body mover').count()).toBeGreaterThan(0);
    expect(await page.locator('math:not([aria-label])').count()).toBe(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    const broken=await page.locator('.math-line').evaluateAll(es=>es.filter(e=>e.clientHeight<e.querySelector('math').getBoundingClientRect().height).length);expect(broken).toBe(0);
    // Long expressions scroll only inside their own equation line.
    expect(await page.locator('#calculations').evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(false);
    // Capture the actual viewport around its equations. A full-page capture can
    // resize a tall responsive canvas while Chromium is capturing its surface.
    const target=page.locator(i===3?'[data-governing-model]':'#calculation-body .equation').first();
    await target.scrollIntoViewIfNeeded();
    await page.screenshot({path:`test-results/screenshots/math/${width}-${height}-${theme}-tab${i}.png`});
    await page.locator('#calculations>summary').click();await expect(page.locator('#calculation-body')).not.toBeVisible();
    await page.evaluate(()=>scrollTo(0,0));
  }
  await expect(page.locator('h2')).toHaveText('Charge in a Uniform Electric Field');
  await page.screenshot({path:`test-results/screenshots/math/${width}-${height}-${theme}-heading.png`});
  await page.evaluate(()=>scrollTo(0,600));expect(await page.locator('.tabs').evaluate(e=>Math.abs(e.getBoundingClientRect().top))).toBeLessThan(1);
  expect(errors).toEqual([]);
});
test('electric-only reference, signed charge, polarity, parameters and field exit agree with live motion',async({page})=>{
  await motion(page);expect((await model(page)).join(' ')).toContain(String.raw`\vec a=\frac{q\vec E}{m}`);expect((await model(page)).join(' ')).not.toMatch(/vec g|ext|vec B/);
  expect((await data(page)).ay).toBeCloseTo(3.75,12);await matching(page);
  await open(page,'settings');await input(page,'m-q',-1);expect((await data(page)).ay).toBeCloseTo(-3.75,12);await matching(page);
  await page.locator('#motion-reverse').click();expect((await data(page)).ay).toBeCloseTo(3.75,12);
  await input(page,'m-mass',2);expect((await data(page)).ay).toBeCloseTo(1.875,12);await matching(page);
  await input(page,'m-d',.04);expect((await data(page)).ay).toBeCloseTo(3.75,12);
  await page.locator('#preset').selectOption('rest');await page.locator('#preset').selectOption('perpendicular');for(let i=0;i<14;i++)await page.locator('#step').dispatchEvent('click');
  await expect(page.locator('[data-force-region]')).toHaveAttribute('data-force-region','outside');
  expect((await model(page)).join(' ')).toContain(String.raw`\vec F_{\mathrm{net}}=\vec 0`);await matching(page);
  // Recover the exact prior equation content after a rejected singular probe.
  await page.getByRole('tab').nth(1).click();await open(page,'settings');
  const previous=await page.locator('#calculation-body').textContent();
  await input(page,'probe-x',0);await expect(page.locator('#calculation-body .error')).toContainText('point charge');
  await input(page,'probe-x',.2);await expect(page.locator('#calculation-body .error')).toHaveCount(0);await expect(page.locator('#calculation-body')).toHaveText(previous);
});
test('gravity and Lorentz models, B=0, changing velocity and magnetic-only exit stay synchronized',async({page})=>{
  await motion(page);await page.locator('#preset').selectOption('equilibrium');expect((await model(page)).join(' ')).toContain(String.raw`q\vec E+m\vec g`);expect((await model(page)).join(' ')).not.toContain(String.raw`\vec B`);await matching(page);
  await input(page,'m-voltage',784.8*(1+8*Number.EPSILON));expect((await data(page)).ay).not.toBe(0);await expect(page.locator('#equilibrium-status')).toHaveAttribute('data-balanced','false');await matching(page);
  await page.locator('#motion-orientation').selectOption('vertical');await page.locator('#balancing-force').selectOption('gravity');expect((await data(page)).ay).toBeCloseTo(-9.81,12);expect((await data(page)).ax).not.toBe(0);await expect(page.locator('#equilibrium-status')).toContainText('perpendicular');await matching(page);
  await page.locator('#balancing-force').selectOption('magnetic');expect((await model(page)).join(' ')).toContain(String.raw`\vec v\times\vec B`);expect((await model(page)).join(' ')).not.toContain(String.raw`\vec g`);
  await input(page,'m-B',0);await open(page,'motion-equilibrium');await expect(page.locator('#motion-equilibrium')).toContainText('unavailable when B = 0');expect((await page.locator('#motion-equilibrium annotation').allTextContents()).join(' ')).not.toContain(String.raw`\frac{E}{B}`);
  await open(page,'settings');await input(page,'m-x0',.12);await input(page,'m-y0',.2);await input(page,'m-vx',1);await input(page,'m-vy',2);await input(page,'m-B',.2);
  expect((await model(page)).join(' ')).not.toContain(String.raw`q\vec E`);expect((await model(page)).join(' ')).toContain(String.raw`q(\vec v\times\vec B)`);
  await matching(page);const before=await data(page);await page.locator('#step').dispatchEvent('click');const after=await data(page);expect(after.vx).not.toBe(before.vx);await matching(page);
  await input(page,'m-q',0);await open(page,'challenge-panel');await page.locator('#challenge-select').selectOption('2');await page.locator('#check-answer').click();await expect(page.locator('#feedback')).toContainText('Choose a nonzero particle charge');await matching(page);
});
test('stable equation nodes and keyboard disclosure focus survive live updates',async({page})=>{
  await motion(page);await page.locator('#preset').selectOption('equilibrium');await page.locator('#balancing-force').selectOption('magnetic');await open(page,'motion-equilibrium');
  await page.locator('#motion-equilibrium>summary').focus();await page.evaluate(()=>{window.savedMath=document.querySelector('[data-governing-model] math');window.savedSummary=document.querySelector('#motion-equilibrium>summary');});
  for(let i=0;i<4;i++)await page.locator('#step').dispatchEvent('click');
  expect(await page.evaluate(()=>window.savedMath===document.querySelector('[data-governing-model] math'))).toBe(true);
  expect(await page.evaluate(()=>window.savedSummary===document.activeElement)).toBe(true);await matching(page);
});
