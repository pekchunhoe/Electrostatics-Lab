import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();
try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await page.goto('http://127.0.0.1:5173');await page.getByRole('tab',{name:'Uniform Electric Field',exact:true}).click();
  const report=await page.evaluate(async()=>{
    const {makeState,loadExperiment}=await import('/src/presets.js');
    const {motionAt}=await import('/src/physics.js');const {draw}=await import('/src/render.js');
    const canvas=document.getElementById('scene'),results=[];
    for(const orientation of ['horizontal','vertical'])for(const experiment of ['rest','perpendicular','parallel','equilibrium']){
      const s=makeState(3);s.motion.orientation=orientation;loadExperiment(s,experiment);const samples=[];
      for(let i=0;i<120;i++){
        const start=performance.now();s.time=(i%80)/1000;s.motionResult=motionAt(s.motion,s.time);draw(canvas,s,3);
        if(i>=20)samples.push(performance.now()-start);
      }
      samples.sort((a,b)=>a-b);results.push({orientation,experiment,medianMs:+samples[50].toFixed(2),p95Ms:+samples[94].toFixed(2)});
    }
    return {viewport:'390 x 844',dpr:devicePixelRatio,canvas:{width:canvas.clientWidth,height:canvas.clientHeight},measurement:'Analytic motion evaluation plus canvas drawing; 20 warmup and 100 measured frames per case. Desktop Chromium, no CPU throttling.',results,userAgent:navigator.userAgent};
  });
  await writeFile('docs/motion-performance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
