import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch();
try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await page.goto('http://127.0.0.1:5173');
  const result=await page.evaluate(async()=>{
    const {makeState,loadPreset}=await import('/src/presets.js');
    const {draw}=await import('/src/render.js');
    const {initializeSnapping}=await import('/src/equipotential.js');
    const {createPotentialModels,updatePlates}=await import('/src/parallel-plates.js');
    const canvas=document.getElementById('scene'),results=[];
    const stats=a=>{a.sort((x,y)=>x-y);return {medianMs:+a[Math.floor(a.length/2)].toFixed(2),p95Ms:+a[Math.ceil(a.length*.95)-1].toFixed(2)};};
    for(const key of ['positive','opposite','square','plates']){
      let s=makeState(2);initializeSnapping(s);
      if(key==='plates')s=createPotentialModels(s,initializeSnapping).plates;else loadPreset(s,key);
      s.fieldLines=true;for(let i=0;i<5;i++)draw(canvas,s,2);
      const cached=[],changed=[];
      for(let i=0;i<30;i++){const begin=performance.now();draw(canvas,s,2);cached.push(performance.now()-begin);}
      for(let i=0;i<30;i++){
        if(key==='plates')updatePlates(s,{voltage:200+i});else s.charges[0].x+=.00001;
        const begin=performance.now();draw(canvas,s,2);changed.push(performance.now()-begin);
      }
      results.push({model:key,cached:stats(cached),parameterChanged:stats(changed)});
    }
    return {viewport:'390 x 844',dpr:devicePixelRatio,canvas:{width:canvas.clientWidth,height:canvas.clientHeight},results,userAgent:navigator.userAgent};
  });
  await mkdir('docs',{recursive:true});await writeFile('docs/potential-performance.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
