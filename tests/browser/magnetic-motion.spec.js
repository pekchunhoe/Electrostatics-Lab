import {test,expect} from '@playwright/test';
test.use({hasTouch:true});
const sizes=[[320,568],[360,640],[390,844],[430,932],[768,1024],[1280,800],[844,390]];
const frames=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const click=(p,id)=>p.locator('#'+id).dispatchEvent('click');
const input=async(p,id,value)=>{await p.locator('#'+id).fill(String(value));await p.locator('#'+id).dispatchEvent('change');};
const details=async(p,id)=>{if(!await p.locator('#'+id).evaluate(e=>e.open))await p.locator('#'+id+'>summary').click();};
const data=p=>p.locator('#motion-status').evaluate(e=>({...Object.fromEntries(['time','x','y','vx','vy','ax','ay','ex','ey'].map(k=>[k,Number(e.dataset[k])])),status:e.dataset.status,playing:e.dataset.playing==='true'}));
const close=(a,b,t=1e-9)=>expect(Math.abs(a-b)).toBeLessThanOrEqual(t);
async function start(p){await p.goto('/');await p.getByRole('tab',{name:'Uniform Electric Field',exact:true}).click();await p.locator('#preset').selectOption('equilibrium');}
async function magnetic(p){await p.locator('#balancing-force').selectOption('magnetic');}
async function fakeClock(p){const stamp=Date.now();await p.clock.install({time:stamp});await p.clock.pauseAt(stamp+100);}
async function capture(p){await p.evaluate(()=>{
 const ctx=document.getElementById('scene').getContext('2d');window.draws=[];let path=[];
 for(const name of ['beginPath','moveTo','lineTo','stroke','fillText','arc']){const old=ctx[name].bind(ctx);ctx[name]=(...args)=>{if(name==='beginPath')path=[];if(name==='moveTo'||name==='lineTo')path.push(args);if(name==='stroke')window.draws.push({kind:'stroke',path:[...path],color:ctx.strokeStyle});if(name==='fillText')window.draws.push({kind:'text',text:args[0],x:args[1],y:args[2]});if(name==='arc')window.draws.push({kind:'particle',x:args[0],y:args[1]});return old(...args);};}
 });}
async function orbit(p,{voltage=0,x=.12,speed=1}={}){
 await magnetic(p);await details(p,'settings');await input(p,'m-q',100);await input(p,'m-mass',.001);await input(p,'m-voltage',voltage);await input(p,'m-x0',x);await input(p,'m-y0',0);await input(p,'m-vx',speed);await expect(p.locator('#m-vy')).toHaveValue('0');
 await p.locator('#motion-length').fill('0.1');await p.locator('#motion-length').dispatchEvent('input');
}

for(const [width,height] of sizes)for(const dark of [false,true])test(`magnetic responsive ${width}x${height} ${dark?'dark':'light'}: symbols, controls, touch and screenshots`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});await start(page);await magnetic(page);
 if(dark){await page.locator('#help-button').click();await page.locator('#theme-toggle').check();await page.locator('#close-help').click();}
 await details(page,'settings');await capture(page);await page.locator('[data-toggle="trace"]').uncheck();await frames(page);
 let draws=await page.evaluate(()=>window.draws),cross=draws.filter(d=>d.text==='×');expect(cross.length).toBeGreaterThan(12);
 const box=await page.locator('#scene').boundingBox();expect(Math.min(...cross.map(d=>d.x))).toBeLessThan(30);expect(Math.max(...cross.map(d=>d.x))).toBeGreaterThan(box.width-50);expect(Math.max(...cross.map(d=>d.y))).toBeGreaterThan(box.height-50);
 expect(draws.findIndex(d=>d.text==='×')).toBeLessThan(draws.findIndex(d=>d.kind==='particle'));
 expect(draws.some(d=>d.text==='FB')).toBe(true);expect(draws.some(d=>d.text==='mg'||d.text==='Fext')).toBe(false);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/screenshots/magnetic-${width}-${height}-${dark?'dark':'light'}-cross.png`});
 await page.locator('#magnetic-reverse').tap();await frames(page);await expect(page.locator('#magnetic-direction')).toHaveText('Out of Page (•)');await expect(page.locator('#equilibrium-status')).toHaveAttribute('data-balanced','false');
 await page.evaluate(()=>{window.draws=[];});await page.locator('[data-toggle="trace"]').check();await frames(page);draws=await page.evaluate(()=>window.draws);expect(draws.filter(d=>d.text==='•').length).toBeGreaterThan(12);expect(draws.filter(d=>d.text==='×').length).toBe(0);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/screenshots/magnetic-${width}-${height}-${dark?'dark':'light'}-dot.png`});
 await page.evaluate(()=>{const r=document.querySelector('.balancing-controls').getBoundingClientRect();scrollTo(0,r.top+scrollY-70);});await page.screenshot({path:`test-results/screenshots/magnetic-controls-${width}-${height}-${dark?'dark':'light'}.png`});
 for(const id of ['magnetic-strength','m-B','magnetic-reverse','motion-rebalance'])expect(await page.locator('#'+id).evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
 await page.evaluate(()=>scrollTo(0,900));expect(await page.locator('.tabs').evaluate(e=>Math.abs(e.getBoundingClientRect().top))).toBeLessThan(1);
 await expect(page.locator('#live-strip')).not.toContainText(/NaN|Infinity|Undefined/);expect(errors).toEqual([]);
});

test('orientation defaults, manual vertical Gravity, horizontal Gravity balance, tab state and no external force',async({page})=>{
 await start(page);await expect(page.locator('#balancing-force')).toHaveValue('gravity');close((await data(page)).ay,0);await expect(page.locator('#magnetic-strength')).toHaveCount(0);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/screenshots/gravity-horizontal-balanced.png'});
 await page.locator('#motion-orientation').selectOption('vertical');await expect(page.locator('#balancing-force')).toHaveValue('magnetic');close((await data(page)).ax,0);close((await data(page)).ay,0);expect((await data(page)).vy).toBeGreaterThan(0);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/screenshots/magnetic-vertical-balanced.png'});
 await page.locator('#balancing-force').selectOption('gravity');let m=await data(page);close(m.ax,1e6);close(m.ay,-9.81);await expect(page.locator('#equilibrium-status')).toContainText('perpendicular');await expect(page.locator('#m-externalX')).toHaveCount(0);await expect(page.locator('#gravity')).toHaveCount(0);await expect(page.locator('#magnetic-strength')).toHaveCount(0);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/screenshots/gravity-vertical-unbalanced.png'});
 await page.locator('#motion-reverse').click();await expect(page.locator('#balancing-force')).toHaveValue('gravity');close((await data(page)).ax,-1e6);
 await page.getByRole('tab',{name:'Electric Field',exact:true}).dispatchEvent('click');await page.getByRole('tab',{name:'Uniform Electric Field',exact:true}).dispatchEvent('click');await expect(page.locator('#balancing-force')).toHaveValue('gravity');
 await page.locator('#motion-rebalance').click();await expect(page.locator('#input-error')).toContainText('perpendicular');
 await page.locator('#motion-orientation').selectOption('horizontal');await page.locator('#motion-rebalance').click();close((await data(page)).ay,0);
 await details(page,'calculations');await expect(page.locator('#calculation-body')).not.toContainText('External force');
});
test('B slider and precise numeric input synchronize, break equilibrium, preserve speed; zero and invalid B',async({page})=>{
 await start(page);await magnetic(page);const before=await data(page);
 await page.locator('#magnetic-strength').fill('0.4');await page.locator('#magnetic-strength').dispatchEvent('input');await expect(page.locator('#m-B')).toHaveValue('0.4');close((await data(page)).ay,1e6);close((await data(page)).vx,before.vx);
 await expect(page.locator('#equilibrium-status')).toHaveAttribute('data-balanced','false');await input(page,'m-B',.12345);await expect(page.locator('#magnetic-strength-output')).toHaveText('0.12345 T');close(Number(await page.locator('#magnetic-strength').inputValue()),.12345);
 await input(page,'m-B',0);close((await data(page)).ay,-1e6);await expect(page.locator('#equilibrium-status')).toContainText('B = 0');await page.locator('#motion-rebalance').click();await expect(page.locator('#input-error')).toContainText('B = 0');
 for(const value of [-.1,2.1,'']){await input(page,'m-B',value);await expect(page.locator('#m-B')).toHaveAttribute('aria-invalid','true');close((await data(page)).ay,-1e6);}
 await input(page,'m-B','2e-1');close(Number(await page.locator('#magnetic-strength').inputValue()),.2);await expect(page.locator('#magnetic-strength-output')).toHaveText('0.2 T');
 await input(page,'m-B',2);await expect(page.locator('#magnetic-strength')).toHaveValue('2');await page.locator('#motion-rebalance').click();close((await data(page)).ax,0);close((await data(page)).ay,0);close((await data(page)).time,0);
 const speedBefore=(await data(page)).vx;await input(page,'m-speed',0);close((await data(page)).vx,speedBefore);await expect(page.locator('#input-error')).not.toBeEmpty();await page.locator('#motion-orientation').selectOption('vertical');await input(page,'m-speed',0);close((await data(page)).vx,0);close((await data(page)).vy,0);close((await data(page)).ax,-1e6);
 await details(page,'settings');await input(page,'m-q',0);await expect(page.locator('#equilibrium-status')).toContainText('Zero charge');await expect(page.locator('#equilibrium-status')).toHaveAttribute('data-balanced','false');
});
test('reversal flips magnetic force arrow and acceleration; explicit balance preserves B and direction',async({page})=>{
 await start(page);await magnetic(page);await details(page,'settings');await capture(page);await page.locator('[data-toggle="trace"]').uncheck();await frames(page);
 const shaft=async color=>page.evaluate(col=>window.draws.filter(d=>d.kind==='stroke'&&d.color===col&&d.path.length===2).at(-1).path,color);
 const before=await shaft('#ae438b'),old=await data(page);expect(before[1][1]).toBeLessThan(before[0][1]);
 await page.evaluate(()=>{window.draws=[];});await page.locator('#magnetic-reverse').click();await frames(page);const after=await shaft('#ae438b');expect(after[1][1]).toBeGreaterThan(after[0][1]);close((await data(page)).ay,-2e6);close((await data(page)).vx,old.vx);
 const electric=await shaft('#087a6b'),accel=await shaft('#b25f00');expect(electric[1][1]).toBeGreaterThan(electric[0][1]);expect(accel[1][1]).toBeGreaterThan(accel[0][1]);
 await page.locator('#motion-rebalance').click();await expect(page.locator('#input-error')).toContainText('cannot balance a rightward');close((await data(page)).vx,500);await page.locator('#magnetic-match-direction').click();await page.locator('#motion-rebalance').click();close((await data(page)).ay,0);await expect(page.locator('#magnetic-direction')).toHaveText('Into Page (×)');await expect(page.locator('#m-B')).toHaveValue('0.2');await expect(page.locator('#equilibrium-status')).toHaveAttribute('data-balanced','true');
});
test('live B changes preserve state and clock, keep playback running and retain past trajectory',async({page})=>{
 await start(page);await orbit(page);for(let i=0;i<20;i++)await click(page,'step');const before=await data(page);
 await input(page,'m-B',.4);const after=await data(page);for(const k of ['x','y','vx','vy','time'])close(after[k],before[k]);close(after.ax,2*before.ax);close(after.ay,2*before.ay);
 await fakeClock(page);await click(page,'play');await page.clock.runFor(400);const during=await data(page);expect(during.playing).toBe(true);await input(page,'m-B',.1);const changed=await data(page);for(const k of ['x','y','vx','vy','time'])close(changed[k],during[k]);expect(changed.playing).toBe(true);
 await page.clock.runFor(400);expect((await data(page)).time).toBeGreaterThan(changed.time);await click(page,'play');const paused=await data(page);await page.clock.runFor(1000);close((await data(page)).time,paused.time);
 for(const value of [.15,.6,.3,.2]){await input(page,'m-B',value);close((await data(page)).time,paused.time);}await expect(page.locator('#live-strip')).not.toContainText(/NaN|Infinity/);
});
test('magnetic-only visible circle: rendered curvature, speed, time-limit freeze and Replay',async({page})=>{
 await page.setViewportSize({width:1280,height:800});await start(page);await orbit(page);await capture(page);
 for(let i=0;i<100;i++)await click(page,'step');await frames(page);let m=await data(page);close(Math.hypot(m.vx,m.vy),1,1e-7);expect(m.y).toBeGreaterThan(.001);close(m.ex,0);close(m.ey,0);expect(Math.hypot(m.ax,m.ay)).toBeGreaterThan(19.99);
 const trace=await page.evaluate(()=>window.draws.filter(d=>d.kind==='stroke'&&d.color==='#7955ad'&&d.path.length>2).at(-1));expect(trace.path.length).toBeGreaterThan(5);expect(new Set(trace.path.map(p=>Math.round(p[1]))).size).toBeGreaterThan(3);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/screenshots/magnetic-visible-orbit.png'});
 await details(page,'motion-advanced');await input(page,'motion-limit',1);await fakeClock(page);await click(page,'play');await page.locator('#speed').selectOption('2');await page.clock.runFor(36000);m=await data(page);expect(m.status).toBe('Time limit');close(m.time,1);expect(m.playing).toBe(false);await page.clock.runFor(5000);close((await data(page)).time,1);await click(page,'motion-replay');close((await data(page)).time,0);
});
test('magnetic plate contact and canvas exit freeze accurate physical timers',async({page})=>{
 await start(page);await orbit(page,{x:0,speed:2});await page.locator('#motion-length').fill('0.3');await page.locator('#motion-length').dispatchEvent('input');await fakeClock(page);await click(page,'play');await page.clock.runFor(3000);let m=await data(page);expect(m.status).toBe('Plate impact');close(m.time,Math.acos(.6)/20,1e-10);close(m.y,.04);await page.clock.runFor(1000);close((await data(page)).time,m.time);
 await click(page,'motion-replay');await input(page,'m-q',0);await input(page,'m-vx',2);await click(page,'play');await page.clock.runFor(20000);m=await data(page);expect(m.status).toBe('Canvas exit');expect(m.playing).toBe(false);await page.clock.runFor(2000);close((await data(page)).time,m.time);await click(page,'motion-replay');close((await data(page)).time,0);
});

test('nonzero electric field exit retains B, speed, curved motion and a running timer',async({page})=>{
 await start(page);await orbit(page,{x:0,speed:2,voltage:-.032});await fakeClock(page);await click(page,'play');await page.clock.runFor(8000);const m=await data(page);
 expect(m.time).toBeGreaterThan(.025);expect(m.status).toBe('Outside field');expect(m.playing).toBe(true);close(m.ex,0);close(m.ey,0);close(Math.hypot(m.vx,m.vy),2,1e-7);
 const theta=20*(m.time-.025);close(m.x,.05+.1*Math.sin(theta));close(m.y,.1*(1-Math.cos(theta)));close(m.ax,-20*m.vy);close(m.ay,20*m.vx);
 await click(page,'play');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/screenshots/magnetic-field-exit.png'});
});
