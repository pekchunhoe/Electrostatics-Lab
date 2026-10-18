import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 await page.goto('http://127.0.0.1:5173');await page.getByRole('tab',{name:'Uniform Electric Field',exact:true}).click();
 const report=await page.evaluate(async()=>{
  const {makeState,loadExperiment}=await import('/src/presets.js');
  const {selectBalancingForce,rebalanceMotion}=await import('/src/motion-state.js');
  const {motionAt}=await import('/src/physics.js');const {draw,viewport}=await import('/src/render.js');
  const canvas=document.getElementById('scene'),results=[];
  const cases=['gravity','horizontal equilibrium','vertical equilibrium','reference unbalanced','field exit','visible orbit','maximum B and q/m','live field history'];
  for(const name of cases){
   const s=makeState(3);loadExperiment(s,'equilibrium');
   if(name!=='gravity')selectBalancingForce(s.motion,'magnetic',{initialize:true,demo:true});
   if(name==='vertical equilibrium'){s.motion.orientation='vertical';s.motion.voltage=8;s.motion.x0=0;s.motion.y0=0;rebalanceMotion(s.motion);}
   if(['field exit','visible orbit','maximum B and q/m','live field history'].includes(name))Object.assign(s.motion,{q:1e-7,mass:1e-9,L:.1,voltage:0,x0:.12,y0:0,vx:1,vy:0});
   if(name==='reference unbalanced')Object.assign(s.motion,{B:.4});
   if(name==='field exit')Object.assign(s.motion,{x0:0,vx:2,voltage:-.032});
   if(name==='maximum B and q/m')Object.assign(s.motion,{q:1e-5,B:2});
   if(name==='live field history')Object.assign(s.motion,{B:.4,fieldHistory:[{time:0,B:.2,bDirection:-1},{time:.02,B:.4,bDirection:-1}]});
   const samples=[];let segments=0;
   for(let i=0;i<120;i++){
    const t=name==='maximum B and q/m'?3600:name.includes('equilibrium')?i*1e-6:name==='reference unbalanced'?(30+i%40)*3e-6:.03+(i%40)/1000;
    const start=performance.now();s.time=t;s.motionResult=motionAt(s.motion,t,{maxTime:3600});draw(canvas,s,3);
    segments=Math.max(segments,s.motionResult.segments.length);if(i>=20)samples.push(performance.now()-start);
   }
   samples.sort((a,b)=>a-b);results.push({case:name,medianMs:+samples[50].toFixed(3),p95Ms:+samples[94].toFixed(3),maxSegments:segments});
  }
  return {viewport:'390 x 844',dpr:devicePixelRatio,canvas:{width:canvas.clientWidth,height:canvas.clientHeight},measurement:'Exact physics plus canvas rendering, 20 warmup and 100 measured frames per case. Desktop Chromium without CPU throttling; DOM calculations are excluded.',results,userAgent:navigator.userAgent};
 });
 await writeFile('docs/magnetic-performance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
