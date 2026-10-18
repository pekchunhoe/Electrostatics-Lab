import {test,expect} from '@playwright/test';
test.use({hasTouch:true});
const sizes=[[320,568],[360,640],[390,844],[430,932],[768,1024],[1280,800],[844,390]];
const frames=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function start(page){await page.goto('/');await page.getByRole('tab',{name:'Uniform Electric Field',exact:true}).click();await frames(page);}
async function details(page,id){if(!await page.locator('#'+id).evaluate(e=>e.open))await page.locator('#'+id+'>summary').click();}
async function input(page,id,value){await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('change');}
const data=page=>page.locator('#motion-status').evaluate(el=>({...Object.fromEntries(['time','x','y','vx','vy','ax','ay','ex','ey'].map(k=>[k,Number(el.dataset[k])])),status:el.dataset.status,playing:el.dataset.playing==='true'}));
const close=(a,b,t=1e-9)=>expect(Math.abs(a-b)).toBeLessThanOrEqual(t);
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);}
async function fakeClock(page){const stamp=Date.now();await page.clock.install({time:stamp});await page.clock.pauseAt(stamp+100);}
const click=(page,id)=>page.locator('#'+id).dispatchEvent('click');
async function capture(page){await page.evaluate(()=>{
  const ctx=document.getElementById('scene').getContext('2d');window.motionStrokes=[];window.motionLabels=[];let path=[];
  for(const name of ['beginPath','moveTo','lineTo','stroke','fillText']){const original=ctx[name].bind(ctx);ctx[name]=(...args)=>{if(name==='beginPath')path=[];if(name==='moveTo'||name==='lineTo')path.push(args);if(name==='stroke')window.motionStrokes.push({path:[...path],color:ctx.strokeStyle,dash:ctx.getLineDash()});if(name==='fillText')window.motionLabels.push({text:args[0],x:args[1],y:args[2],color:ctx.fillStyle});return original(...args);};}
});}

for(const [width,height] of sizes)for(const dark of [false,true])test(`advanced motion ${width}×${height} ${dark?'dark':'light'}: all experiments, orientations and screenshots`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});await start(page);
  if(dark){await page.locator('#help-button').click();await page.locator('#theme-toggle').check();await page.locator('#close-help').click();}
  for(const orientation of ['horizontal','vertical']){
    await page.locator('#motion-orientation').selectOption(orientation);
    for(const preset of ['rest','perpendicular','parallel','equilibrium']){
      await page.locator('#preset').selectOption(preset);const m=await data(page);
      await expect(page.locator('#live-strip')).not.toContainText(/NaN|Infinity|Undefined/);close(m.time,0);
      if(preset==='rest'){close(m.vx,0);close(m.vy,0);}
      if(preset==='equilibrium'){close(m.ax,0);close(m.ay,0);}
      if(preset==='perpendicular'){
        for(let i=0;i<6;i++)await page.locator('#step').click();await page.evaluate(()=>scrollTo(0,0));await frames(page);
        await page.screenshot({path:`test-results/screenshots/motion-${orientation}-${width}-${height}-${dark?'dark':'light'}.png`});
      }
    }
    await noOverflow(page);expect(await page.locator('#motion-reverse').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    const box=await page.locator('#scene').boundingBox();expect(box.y).toBeLessThan(260);
  }
  await details(page,'settings');await details(page,'motion-advanced');await noOverflow(page);
  await page.evaluate(()=>scrollTo(0,800));expect(await page.locator('.tabs').evaluate(e=>Math.abs(e.getBoundingClientRect().top))).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('Reverse Polarity pauses, resets, preserves magnitude/geometry and reverses acceleration in both orientations',async({page})=>{
  await start(page);
  for(const orientation of ['horizontal','vertical']){
    await page.locator('#motion-orientation').selectOption(orientation);await page.locator('#preset').selectOption('perpendicular');
    await input(page,'m-voltage',800);await input(page,'m-d',.08);const before=await data(page),L=await page.locator('#motion-length').inputValue();
    await page.locator('#play').click();await page.waitForTimeout(80);await page.locator('#motion-reverse').click();const after=await data(page);
    close(after.ax,-before.ax);close(after.ay,-before.ay);close(after.time,0);expect(after.playing).toBe(false);
    await expect(page.locator('#m-voltage')).toHaveValue('-800');await expect(page.locator('#m-d')).toHaveValue('0.08');await expect(page.locator('#motion-length')).toHaveValue(L);await expect(page.locator('#motion-orientation')).toHaveValue(orientation);
  }
});

test('acceleration shaft follows the particle, uses actual vector direction, toggles and has no zero-direction arrow',async({page})=>{
  await start(page);await details(page,'settings');await expect(page.locator('[data-toggle="showAcceleration"]')).toBeChecked();await capture(page);
  await page.locator('#step').click();await frames(page);let strokes=await page.evaluate(()=>window.motionStrokes.filter(s=>s.color==='#b25f00'&&s.path.length===2));
  expect(strokes.length).toBeGreaterThan(0);let shaft=strokes.at(-1);expect(shaft.path[1][1]).toBeLessThan(shaft.path[0][1]);close(shaft.path[1][0],shaft.path[0][0]);
  const old=shaft;await page.evaluate(()=>{window.motionStrokes=[];});await page.locator('#step').click();await frames(page);
  shaft=await page.evaluate(()=>window.motionStrokes.filter(s=>s.color==='#b25f00'&&s.path.length===2).at(-1));expect(shaft.path[0][0]).toBeGreaterThan(old.path[0][0]);
  await page.evaluate(()=>{window.motionStrokes=[];});await page.locator('[data-toggle="showAcceleration"]').uncheck();await frames(page);expect(await page.evaluate(()=>window.motionStrokes.some(s=>s.color==='#b25f00'))).toBe(false);
  await page.locator('[data-toggle="showAcceleration"]').check();await page.locator('#preset').selectOption('equilibrium');await capture(page);await page.locator('#step').click();await frames(page);
  expect(await page.evaluate(()=>window.motionStrokes.some(s=>s.color==='#b25f00'))).toBe(false);expect(await page.evaluate(()=>window.motionLabels.some(s=>s.text==='a = 0 m/s²'))).toBe(true);
});

test('length slider and exact input alter geometry and transit independently of d and E; long plates fit',async({page})=>{
  await page.setViewportSize({width:320,height:568});await start(page);await details(page,'settings');const before=await data(page);
  await page.locator('#motion-length').fill('0.6');await page.locator('#motion-length').dispatchEvent('input');await expect(page.locator('#m-L')).toHaveValue('0.6');await expect(page.locator('#m-d')).toHaveValue('0.08');close((await data(page)).ey,before.ey);
  await capture(page);await page.locator('[data-toggle="trace"]').uncheck();await frames(page);
  const bounds=await page.locator('#scene').boundingBox(),plates=await page.evaluate(()=>window.motionStrokes.filter(s=>['#cb5438','#326db0'].includes(s.color)&&s.path.length===2));
  expect(plates.length).toBe(2);for(const line of plates)for(const p of line.path){expect(p[0]).toBeGreaterThanOrEqual(0);expect(p[0]).toBeLessThanOrEqual(bounds.width);}
  await input(page,'m-L',.2);await expect(page.locator('#motion-length')).toHaveValue('0.2');await noOverflow(page);
  await page.locator('#motion-orientation').selectOption('vertical');await expect(page.locator('#m-L')).toHaveValue('0.2');await expect(page.locator('#m-d')).toHaveValue('0.08');
});

for(const orientation of ['horizontal','vertical'])test(`${orientation}: timer continues after field exit, stops at full canvas exit, freezes and replays`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await start(page);await page.locator('#motion-orientation').selectOption(orientation);await details(page,'settings');await input(page,'m-q',0);await frames(page);
  const box=await page.locator('#scene').boundingBox(),zoom=Number(await page.locator('#zoom').inputValue());
  const scale=Math.min(box.width/(orientation==='horizontal'?.42:.25),box.height/(orientation==='horizontal'?.25:.42))*zoom;
  const boundary=(orientation==='horizontal'?box.width:box.height)/2+9,expected=(boundary/scale+.12)/2;
  await fakeClock(page);await click(page,'play');await page.clock.runFor(1450);let m=await data(page);expect(m.status).toBe('Outside field');expect(m.playing).toBe(true);expect(m.time).toBeGreaterThan(.135);close(m.ax,0);close(m.ay,0);
  await page.clock.runFor(3000);m=await data(page);expect(m.status).toBe('Canvas exit');expect(m.playing).toBe(false);close(m.time,expected,1e-10);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/screenshots/motion-completed-${orientation}.png`});
  const final=await page.locator('#motion-status').innerText();await page.clock.runFor(10000);expect(await page.locator('#motion-status').innerText()).toBe(final);close((await data(page)).time,m.time);
  await click(page,'step');close((await data(page)).time,m.time);await expect(page.locator('#motion-event')).toHaveText('Particle exited the simulation area');
  await click(page,'motion-replay');close((await data(page)).time,0);expect((await data(page)).playing).toBe(false);await click(page,'play');await page.clock.runFor(300);expect((await data(page)).time).toBeGreaterThan(0);
});

for(const orientation of ['horizontal','vertical'])test(`${orientation}: collision stops at analytic contact time and has distinct completion`,async({page})=>{
  await start(page);await page.locator('#motion-orientation').selectOption(orientation);await page.locator('#preset').selectOption('rest');await fakeClock(page);
  await click(page,'play');await page.clock.runFor(4000);const m=await data(page);expect(m.status).toBe('Plate impact');expect(m.playing).toBe(false);close(m.time,Math.sqrt(.08/3.75));close(m.vx,0);close(m.vy,0);close(m.ax,0);close(m.ay,0);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/screenshots/motion-impact-${orientation}.png`});
  await expect(page.locator('#motion-event')).toHaveText('Particle hit the plate');await page.clock.runFor(1000);close((await data(page)).time,m.time);await click(page,'motion-replay');close((await data(page)).time,0);
});

test('vertical magnetic equilibrium, reversal and explicit balancing replace external force',async({page})=>{
  await start(page);await page.locator('#motion-orientation').selectOption('vertical');await page.locator('#preset').selectOption('equilibrium');
  await expect(page.locator('#balancing-force')).toHaveValue('magnetic');await expect(page.locator('#m-externalX')).toHaveCount(0);close((await data(page)).ax,0);close((await data(page)).ay,0);
  await page.locator('#motion-reverse').click();close((await data(page)).ax,-19.62);close((await data(page)).ay,0);
  await page.locator('#motion-rebalance').click();close((await data(page)).ax,0);close((await data(page)).ay,0);
  await details(page,'calculations');await expect(page.locator('#calculation-body')).not.toContainText('External force');await expect(page.locator('#calculation-body')).toContainText('dynamic equilibrium');
});

test('stationary gravity equilibrium retains electric and weight arrows and suppresses acceleration',async({page})=>{
  await start(page);await page.locator('#preset').selectOption('equilibrium');await details(page,'settings');await input(page,'m-vx',0);await input(page,'m-vy',0);await capture(page);
  await page.locator('[data-toggle="trace"]').uncheck();await frames(page);expect((await data(page)).status).toBe('Stationary');
  const colors=await page.evaluate(()=>window.motionStrokes.map(s=>s.color));for(const color of ['#087a6b','#916329'])expect(colors).toContain(color);expect(colors).not.toContain('#b25f00');expect(colors).not.toContain('#ae438b');
});

test('stationary states stop at zero, slow motion reaches the named safeguard, and reversal remains active',async({page})=>{
  await start(page);await page.locator('#preset').selectOption('rest');await details(page,'settings');await input(page,'m-q',0);await page.locator('#play').click();await expect(page.locator('#motion-event')).toHaveText('Particle remains stationary');close((await data(page)).time,0);
  await input(page,'m-vx',1e-12);await details(page,'motion-advanced');await input(page,'motion-limit',1);await frames(page);await fakeClock(page);await click(page,'play');await page.clock.runFor(11000);expect((await data(page)).status).toBe('Time limit');close((await data(page)).time,1);await expect(page.locator('#motion-event')).toHaveText('Simulation time limit reached');
  await page.locator('#preset').selectOption('parallel');await click(page,'play');await page.clock.runFor(850);const m=await data(page);expect(m.status).not.toBe('Stationary');expect(m.time).toBeGreaterThan(.08);expect(m.vy).toBeGreaterThan(0);
});

test('Play/Pause/Step/speed and rapid clicks use one clock; tab changes and hidden pages freeze it',async({page})=>{
  await start(page);await details(page,'settings');await input(page,'m-q',0);await input(page,'m-vx',.1);await frames(page);await fakeClock(page);
  for(let i=0;i<10;i++){await click(page,'play');await click(page,'play');}await page.clock.runFor(2000);close((await data(page)).time,0);
  await click(page,'play');await page.clock.runFor(1000);await click(page,'play');const normal=(await data(page)).time;expect(normal).toBeGreaterThan(.09);expect(normal).toBeLessThan(.11);
  await page.clock.runFor(1000);close((await data(page)).time,normal);await click(page,'step');close((await data(page)).time,normal+.01);
  await page.locator('#speed').selectOption('.25');await click(page,'play');await page.clock.runFor(1000);await click(page,'play');close((await data(page)).time-normal-.01,normal/4,.001);
  const slowTime=(await data(page)).time;await page.locator('#speed').selectOption('2');await click(page,'play');await page.clock.runFor(1000);await click(page,'play');close((await data(page)).time-slowTime,normal*2,.0033); // One 16 ms RAF at 2x is 0.0032 simulated seconds.
  await click(page,'play');await page.getByRole('tab',{name:'Coulomb Force',exact:true}).dispatchEvent('click');await page.clock.runFor(1000);await page.getByRole('tab',{name:'Uniform Electric Field',exact:true}).dispatchEvent('click');const tabTime=(await data(page)).time;expect((await data(page)).playing).toBe(false);await page.clock.runFor(1000);close((await data(page)).time,tabTime);
  await click(page,'play');await page.clock.runFor(100);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});const hidden=(await data(page)).time;expect((await data(page)).playing).toBe(false);await page.clock.runFor(1000);close((await data(page)).time,hidden);
});

test('resize updates canvas boundary at current physical time without rewinding; Reset preserves selected geometry',async({page})=>{
  await page.setViewportSize({width:390,height:844});await start(page);await details(page,'settings');await input(page,'m-q',0);for(let i=0;i<15;i++)await page.locator('#step').click();const before=(await data(page)).time;
  await page.setViewportSize({width:844,height:390});close((await data(page)).time,before);await page.locator('#step').click();expect((await data(page)).time).toBeGreaterThanOrEqual(before);
  await page.locator('#motion-orientation').selectOption('vertical');await page.locator('#motion-length').fill('0.4');await page.locator('#motion-length').dispatchEvent('input');await page.locator('#reset').click();close((await data(page)).time,0);await expect(page.locator('#motion-orientation')).toHaveValue('vertical');await expect(page.locator('#motion-length')).toHaveValue('0.4');
});
