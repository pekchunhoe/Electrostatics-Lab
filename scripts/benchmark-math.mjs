import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();
try{
  const results=[];
  for(const width of [390,1280]){
    const page=await browser.newPage({viewport:{width,height:844}});await page.goto('http://127.0.0.1:5173');await page.getByRole('tab').nth(3).click();
    await page.locator('#calculations').evaluate(e=>e.open=true);
    results.push(...await page.evaluate(async width=>{
      const {makeState,loadExperiment}=await import('/src/presets.js'),{selectBalancingForce}=await import('/src/motion-state.js'),{motionAt}=await import('/src/physics.js'),{motionWorking}=await import('/src/motion-ui.js'),{patchHTML}=await import('/src/math.js'),{draw}=await import('/src/render.js');
      const panel=document.getElementById('calculation-body'),canvas=document.getElementById('scene'),rows=[];
      const fmt=(n,u='')=>Number(n.toPrecision(4))+(u?' '+u:'');
      for(const name of ['electric','gravity','crossed fields','magnetic-only']){
        const s=makeState(3);loadExperiment(s,name==='electric'?'perpendicular':'equilibrium');
        if(name==='crossed fields'||name==='magnetic-only')selectBalancingForce(s.motion,'magnetic',{initialize:true,demo:true});
        if(name==='magnetic-only')Object.assign(s.motion,{x0:.2,y0:0,q:1e-7,mass:1e-9,voltage:0,vx:1,vy:0,B:.2});
        const samples=[];let previousMath=null,stable=0;
        for(let i=0;i<120;i++){
          const start=performance.now();s.time=i*(name==='crossed fields'?1e-7:.0001);s.motionResult=motionAt(s.motion,s.time);
          patchHTML(panel,motionWorking(s,s.motionResult,fmt));draw(canvas,s,3);
          panel.getBoundingClientRect(); // Include synchronous DOM layout.
          const current=panel.querySelector('[data-governing-model] math');if(current===previousMath)stable++;previousMath=current;
          if(i>=20)samples.push(performance.now()-start);
        }
        samples.sort((a,b)=>a-b);rows.push({width,case:name,medianMs:+samples[50].toFixed(3),p95Ms:+samples[94].toFixed(3),governingNodeRetainedFrames:stable,frames:120});
      }
      return rows;
    },width));await page.close();
  }
  const report={measurement:'20 warmup and 100 measured frames per case; physics, equation generation, in-place DOM updates, canvas drawing and synchronous layout. Desktop Chromium without CPU throttling.',results};
  await writeFile('docs/math-performance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
