import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
await page.goto('http://127.0.0.1:5173');
const result=await page.evaluate(async()=>{
  const {makeState,loadPreset}=await import('/src/presets.js');const {draw}=await import('/src/render.js');const {fieldAt}=await import('/src/physics.js');
  const canvas=document.getElementById('scene'),times=[];
  for(let tab=0;tab<4;tab++){
    const s=makeState(tab);if(tab<3)loadPreset(s,'square');
    if(tab===1)s.grid=true;
    if(tab===2){s.heat=true;s.overlay=true;s.grid=true;}
    for(let i=0;i<5;i++)draw(canvas,s,tab);
    const samples=[],changed=[];for(let i=0;i<20;i++){const begin=performance.now();draw(canvas,s,tab);samples.push(performance.now()-begin);}
    for(let i=0;i<20;i++){s.charges[0].x+=.000001;const begin=performance.now();draw(canvas,s,tab);changed.push(performance.now()-begin);}
    samples.sort((a,b)=>a-b);changed.sort((a,b)=>a-b);times.push({tab:tab+1,cachedMedianMs:Number(samples[10].toFixed(2)),cachedP95Ms:Number(samples[19].toFixed(2)),changedSourceMedianMs:Number(changed[10].toFixed(2)),changedSourceP95Ms:Number(changed[19].toFixed(2))});
  }
  const s=makeState(1);loadPreset(s,'square');const start=performance.now();for(let i=0;i<10000;i++)fieldAt(s.charges,{x:.12,y:.08});
  return {viewport:'390 × 844',dpr:devicePixelRatio,renderer:times,fieldEvaluations10000Ms:Number((performance.now()-start).toFixed(2)),userAgent:navigator.userAgent};
});
await mkdir('docs',{recursive:true});await writeFile('docs/performance.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));await browser.close();
