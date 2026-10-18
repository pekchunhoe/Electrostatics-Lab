import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test.use({hasTouch:true});
const sizes=[[320,568],[360,640],[390,844],[430,932],[768,1024],[1280,800],[844,390]];
const input=async(p,id,value)=>{await p.locator('#'+id).fill(String(value));await p.locator('#'+id).dispatchEvent('change');};
const click=(p,id)=>p.locator('#'+id).dispatchEvent('click');
const details=async(p,id)=>{if(!await p.locator('#'+id).evaluate(e=>e.open))await p.locator('#'+id+'>summary').click();};
const close=(a,b,abs=2e-10,rel=2e-10)=>expect(Math.abs(a-b)).toBeLessThanOrEqual(Math.max(abs,rel*Math.abs(b)));
async function clock(p){const t=Date.now();await p.clock.install({time:t});await p.clock.pauseAt(t+100);}
async function instrument(p){await p.evaluate(()=>{
 const ctx=document.getElementById('scene').getContext('2d');window.physicsPaint={paths:[],labels:[],particle:null};let path=[];
 for(const name of ['clearRect','beginPath','moveTo','lineTo','stroke','fillText','arc']){
  const old=ctx[name].bind(ctx);ctx[name]=(...a)=>{
   if(name==='clearRect')window.physicsPaint={paths:[],labels:[],particle:null};
   if(name==='beginPath')path=[];if(name==='moveTo'||name==='lineTo')path.push(a);
   if(name==='stroke')window.physicsPaint.paths.push({path:[...path],color:ctx.strokeStyle,dash:ctx.getLineDash()});
   if(name==='fillText')window.physicsPaint.labels.push({text:a[0],x:a[1],y:a[2]});
   if(name==='arc'&&a[2]===9)window.physicsPaint.particle={x:a[0],y:a[1]};
   return old(...a);
  };
 }
 window.dispatchEvent(new Event('resize'));
});}
async function start(p,orientation='horizontal',q=1e-9){
 await p.goto('/');await p.getByRole('tab',{name:'Uniform Electric Field',exact:true}).click();await p.locator('#preset').selectOption('equilibrium');
 if(orientation==='vertical')await p.locator('#motion-orientation').selectOption('vertical');else await p.locator('#balancing-force').selectOption('magnetic');
 if(q<0){await details(p,'settings');await input(p,'m-q',-1);}
 await instrument(p);await clock(p);await p.clock.runFor(32);
}
async function sample(p){return p.evaluate(()=>{
 const el=document.getElementById('motion-status'),c=document.getElementById('scene'),r=c.getBoundingClientRect();
 const keys=['time','x','y','vx','vy','ax','ay','ex','ey','feX','feY','fbX','fbY','netX','netY'];
 const state={...Object.fromEntries(keys.map(k=>[k,Number(el.dataset[k])])),status:el.dataset.status,playing:el.dataset.playing==='true'};
 const components=Object.fromEntries([...document.querySelectorAll('[data-motion-value]')].map(e=>[e.dataset.motionValue,Number(e.dataset.value)]));
 const particle=window.physicsPaint?.particle,ratio=c.width/r.width;
 const pixel={positive:0,negative:0};if(particle){const pixels=c.getContext('2d').getImageData(Math.round((particle.x-8)*ratio),Math.round((particle.y-8)*ratio),Math.round(16*ratio),Math.round(16*ratio)).data;for(let i=0;i<pixels.length;i+=4){if(pixels[i]===203&&pixels[i+1]===84&&pixels[i+2]===56)pixel.positive++;if(pixels[i]===50&&pixels[i+1]===109&&pixels[i+2]===176)pixel.negative++;}}
 return {state,paint:window.physicsPaint,components,canvas:{w:r.width,h:r.height},pixel};
});}
// Independent drift-and-rotation reference, without importing application code.
function flow(p,dt,{q=1e-9,mass=1e-13,B=.2,direction=-1,ex=0,ey=-100}={}){
 const w=q*B*direction/mass;
 if(w===0){const ax=q*ex/mass,ay=q*ey/mass;return {x:p.x+p.vx*dt+ax*dt*dt/2,y:p.y+p.vy*dt+ay*dt*dt/2,vx:p.vx+ax*dt,vy:p.vy+ay*dt};}
 const dx=ey/(B*direction),dy=-ex/(B*direction),ux=p.vx-dx,uy=p.vy-dy,s=Math.sin(w*dt),c=Math.cos(w*dt);
 return {x:p.x+dx*dt+(ux*s+uy*(1-c))/w,y:p.y+dy*dt+(uy*s-ux*(1-c))/w,vx:dx+ux*c+uy*s,vy:dy+uy*c-ux*s};
}
const initial=orientation=>orientation==='vertical'?{x:0,y:-.12,vx:0,vy:500}:{x:-.12,y:0,vx:500,vy:0};
const fields=(orientation,q,B,direction=-1)=>({q,mass:1e-13,B,direction,ex:orientation==='vertical'?100:0,ey:orientation==='vertical'?0:-100});
function verify(a,r,f,{orientation='horizontal',zoom=1,x0=-.12,L=.3,d=.08,arrows=true}={}){
 for(const k of ['x','y','vx','vy'])close(a.state[k],r[k],2e-9,2e-10);
 const forces={fe:{x:f.q*f.ex,y:f.q*f.ey},fb:{x:f.q*r.vy*f.B*f.direction,y:-f.q*r.vx*f.B*f.direction}};
 forces.net={x:forces.fe.x+forces.fb.x,y:forces.fe.y+forces.fb.y};const acceleration={x:forces.net.x/f.mass,y:forces.net.y/f.mass};
 for(const name of ['fe','fb','net'])for(const axis of ['x','y']){
  close(a.state[name+axis.toUpperCase()],forces[name][axis],2e-18,2e-10);close(a.components[name+'-'+axis],forces[name][axis],2e-18,2e-10);
 }
 close(a.state.ax,acceleration.x,1e-7);close(a.state.ay,acceleration.y,1e-7);
 for(const axis of ['x','y']){close(a.components['acceleration-'+axis],acceleration[axis],1e-7);close(a.components['velocity-'+axis],r['v'+axis],1e-7);}
 const spanX=Math.max(orientation==='vertical'?.25:.42,orientation==='vertical'?d*1.8:L*1.3,orientation==='vertical'?.06:Math.abs(x0)*2+.06);
 const spanY=Math.max(orientation==='vertical'?.42:.25,orientation==='vertical'?L*1.3:d*1.8,orientation==='vertical'?.30:.06);
 const scale=Math.min(a.canvas.w/spanX,a.canvas.h/spanY)*zoom;
 expect(a.paint.particle).not.toBeNull();close(a.paint.particle.x,a.canvas.w/2+r.x*scale,.005);close(a.paint.particle.y,a.canvas.h/2-r.y*scale,.005);
 // Actual bitmap pixels also confirm the disk was painted at the measured
 // centre, independently of DOM numerical values and intercepted commands.
 expect(a.pixel[f.q<0?'negative':'positive']).toBeGreaterThan(40);
 if(arrows){
  for(const [color,v] of [['#087a6b',forces.fe],['#ae438b',forces.fb],['#7955ad',{x:r.vx,y:r.vy}],['#b25f00',acceleration]]){
   const mag=Math.hypot(v.x,v.y);if(mag<1e-16||(color==='#b25f00'&&a.state.ax===0&&a.state.ay===0))continue;
   const shaft=a.paint.paths.filter(s=>s.color===color&&s.path.length===2).at(-1);expect(shaft).toBeTruthy();
   const dx=shaft.path[1][0]-shaft.path[0][0],dy=shaft.path[0][1]-shaft.path[1][1],length=Math.hypot(dx,dy);expect(length).toBeGreaterThan(0);close((dx*v.x+dy*v.y)/(length*mag),1,1e-8);
  }
 }
 return {scale,forces,acceleration};
}
async function pauseSample(p,ms){await p.clock.runFor(ms);await click(p,'play');await p.clock.runFor(32);return sample(p);}
async function saveSamples(name,values){await mkdir('test-results/trajectory-samples',{recursive:true});await writeFile(`test-results/trajectory-samples/${name}.json`,JSON.stringify(values,null,2)+'\n');}

for(const orientation of ['horizontal','vertical'])for(const q of [1e-9,-1e-9])for(const [scenario,B,direction] of [['balanced',.2,-1],['increase',.4,-1],['decrease',.1,-1],['reverse',.2,1]])test(`quantitative painted trajectory ${orientation} q=${q} ${scenario}`,async({page})=>{
 await start(page,orientation,q);if(scenario==='reverse')await click(page,'magnetic-reverse');else if(B!==.2)await input(page,'m-B',B);
 await page.clock.runFor(32);const origin=await sample(page);if(orientation==='horizontal'){close(origin.state.vx,500);close(origin.state.vy,0);}
 const f=fields(orientation,q,B,direction),samples=[];
 for(let i=0;i<3;i++){
  await click(page,'play');const a=await pauseSample(page,600),r=flow(initial(orientation),a.state.time,f);const check=verify(a,r,f,{orientation});samples.push({state:a.state,paintedParticle:a.paint.particle,expected:r,components:a.components,scale:check.scale});
  expect(a.state.time).toBeGreaterThan(0);if(scenario!=='balanced'){expect(Math.hypot(a.state.ax,a.state.ay)).toBeGreaterThan(1e4);expect(Math.abs(orientation==='horizontal'?a.state.vy:a.state.vx)).toBeGreaterThan(1);}
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/screenshots/trajectory-${orientation}-${q>0?'positive':'negative'}-${scenario}-frame${i+1}.png`});
 }
 const last=samples.at(-1),deflection=orientation==='horizontal'?last.state.y:last.state.x;
 if(scenario==='balanced')close(deflection,0);else expect(Math.abs(deflection)*last.scale).toBeGreaterThan(3);
 await saveSamples(`${orientation}-${q>0?'positive':'negative'}-${scenario}`,samples);
});

for(const [width,height] of sizes)for(const dark of [false,true])test(`rightward and visibly curved on ${width}x${height} ${dark?'dark':'light'}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height});await start(page);
 if(dark){await click(page,'help-button');await page.locator('#theme-toggle').check();await click(page,'close-help');await page.clock.runFor(32);}
 let a=await sample(page);expect(a.state.vx).toBe(500);const v=a.paint.paths.filter(p=>p.color===(dark?'#c7a4ff':'#7955ad')&&p.path.length===2).at(-1);expect(v.path[1][0]).toBeGreaterThan(v.path[0][0]);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/screenshots/trajectory-${width}-${height}-${dark?'dark':'light'}-initial.png`});
 for(const [name,B,reverse] of [['up',.4,false],['down',.1,false],['reversed',.2,true]]){
  await click(page,'motion-replay');await instrument(page);await input(page,'m-B',B);if(reverse)await click(page,'magnetic-reverse');await click(page,'play');a=await pauseSample(page,1800);
  const r=flow(initial('horizontal'),a.state.time,fields('horizontal',1e-9,B,reverse?1:-1));
  for(const k of ['x','y','vx','vy'])close(a.state[k],r[k],2e-9);
  const scale=Math.min(a.canvas.w/.42,a.canvas.h/.25);close(a.paint.particle.x,a.canvas.w/2+r.x*scale,.005);close(a.paint.particle.y,a.canvas.h/2-r.y*scale,.005);expect(Math.abs(a.state.y)*scale).toBeGreaterThan(3);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/screenshots/trajectory-${width}-${height}-${dark?'dark':'light'}-${name}.png`});
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await page.evaluate(()=>scrollTo(0,900));expect(await page.locator('.tabs').evaluate(e=>Math.abs(e.getBoundingClientRect().top))).toBeLessThan(1);expect(errors).toEqual([]);
});

for(const orientation of ['horizontal','vertical'])test(`${orientation}: actual magnetic-only curvature after field exit and exact full canvas stopping`,async({page})=>{
 await start(page,orientation);await details(page,'settings');await page.locator('#zoom').fill('0.7');await page.locator('#zoom').dispatchEvent('input');await click(page,'play');const a=await pauseSample(page,8000),exit=.00054;
 expect(a.state.time).toBeGreaterThan(exit);expect(a.state.status).toBe('Outside field');const exitState=orientation==='horizontal'?{x:.15,y:0,vx:500,vy:0}:{x:0,y:.15,vx:0,vy:500};
 const f={...fields(orientation,1e-9,.2),ex:0,ey:0},r=flow(exitState,a.state.time-exit,f);const check=verify(a,r,f,{orientation,zoom:.7});close(Math.hypot(a.state.vx,a.state.vy),500,2e-7);expect(Math.abs(orientation==='horizontal'?a.state.y:a.state.x)*check.scale).toBeGreaterThan(3);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/screenshots/trajectory-${orientation}-field-exit.png`});
 const bound=(orientation==='horizontal'?a.canvas.w:a.canvas.h)/(2*check.scale)+9/check.scale,expectedTime=exit+Math.asin((bound-.15)/.25)/2000;
 await click(page,'play');await page.clock.runFor(4000);const done=await sample(page);expect(done.state.status).toBe('Canvas exit');close(done.state.time,expectedTime,2e-10);expect(done.state.playing).toBe(false);await page.clock.runFor(2000);close((await sample(page)).state.time,done.state.time);
});
for(const orientation of ['horizontal','vertical'])test(`${orientation}: live B changes alter painted trajectory without rewriting prior position, velocity or clock`,async({page})=>{
 await start(page,orientation);await details(page,'calculations');await details(page,'motion-components');await click(page,'play');let a=await pauseSample(page,1000),origin={x:a.state.x,y:a.state.y,vx:a.state.vx,vy:a.state.vy},t0=a.state.time;
 for(const B of [.4,.1,0]){
  expect(await page.locator('#motion-components').evaluate(e=>e.open)).toBe(true);const before=a;await input(page,'m-B',B);await page.clock.runFor(32);const changed=await sample(page);for(const k of ['x','y','vx','vy','time'])close(changed.state[k],before.state[k]);
  await click(page,'play');a=await pauseSample(page,600);const f=fields(orientation,1e-9,B),r=flow(origin,a.state.time-t0,f);verify(a,r,f,{orientation});origin={x:a.state.x,y:a.state.y,vx:a.state.vx,vy:a.state.vy};t0=a.state.time;
 }
 const frozen=a.state.time;for(const B of [.2,.4,.1,.2])await input(page,'m-B',B);await page.clock.runFor(1000);close((await sample(page)).state.time,frozen);
});
test('rightward launch policy survives orientation, negative charge, Reset, Replay and incompatible Balance',async({page})=>{
 await start(page);await details(page,'settings');await input(page,'m-q',-1);expect((await sample(page)).state.vx).toBe(500);
 await click(page,'magnetic-reverse');await page.clock.runFor(32);const old=await sample(page);await click(page,'motion-rebalance');await expect(page.locator('#input-error')).toContainText('cannot balance a rightward');const failed=await sample(page);close(failed.state.vx,old.state.vx);await expect(page.locator('#magnetic-direction')).toHaveText('Out of Page (•)');
 await click(page,'motion-replay');expect((await sample(page)).state.vx).toBe(500);await expect(page.locator('#magnetic-direction')).toHaveText('Out of Page (•)');
 await click(page,'magnetic-match-direction');await click(page,'motion-rebalance');expect((await sample(page)).state.vx).toBe(500);
 await page.locator('#motion-orientation').selectOption('vertical');await page.locator('#motion-orientation').selectOption('horizontal');await expect(page.locator('#balancing-force')).toHaveValue('magnetic');expect((await sample(page)).state.vx).toBe(500);close((await sample(page)).state.vy,0);
 await click(page,'reset');await expect(page.locator('#balancing-force')).toHaveValue('magnetic');expect((await sample(page)).state.vx).toBe(500);
 await details(page,'settings');await expect(page.locator('#m-vy')).toHaveAttribute('readonly','');await input(page,'m-vx',-10);expect((await sample(page)).state.vx).toBe(500);await input(page,'m-speed',0);expect((await sample(page)).state.vx).toBe(500);
});
test('reference .25 m magnetic orbit is painted circularly with conserved speed and evolving negative vx',async({page})=>{
 await start(page);await details(page,'settings');await input(page,'m-voltage',0);await input(page,'m-x0',.5);await input(page,'m-y0',-.04);await page.locator('#motion-length').fill('0.6');await page.locator('#motion-length').dispatchEvent('input');await page.locator('#zoom').fill('0.7');await page.locator('#zoom').dispatchEvent('input');await page.locator('#speed').selectOption('2');
 const samples=[];for(let i=0;i<4;i++){
  await click(page,'play');const a=await pauseSample(page,2400),f={...fields('horizontal',1e-9,.2),ey:0},r=flow({x:.5,y:-.04,vx:500,vy:0},a.state.time,f);verify(a,r,f,{zoom:.7,x0:.5,L:.6});close(Math.hypot(a.state.vx,a.state.vy),500,2e-7);close(.5*1e-13*(a.state.vx*a.state.vx+a.state.vy*a.state.vy),1.25e-8,2e-19);samples.push(a.state);
 }
 expect(samples.some(s=>s.vx<0)).toBe(true);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/screenshots/trajectory-reference-circle.png'});await saveSamples('reference-circle',samples);
});
