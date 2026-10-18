import {readdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='test-results/trajectory-samples';
const files=(await readdir(root)).filter(n=>/^(horizontal|vertical)-/.test(n));assert.equal(files.length,16);
const cases=[];let maxPositionError=0,maxVelocityError=0,maxPaintDisplacementError=0,maxCurvatureAreaError=0;
for(const name of files){
 const samples=JSON.parse(await readFile(root+'/'+name,'utf8'));assert.equal(samples.length,3);
 for(const a of samples){for(const k of ['x','y'])maxPositionError=Math.max(maxPositionError,Math.abs(a.state[k]-a.expected[k]));for(const k of ['vx','vy'])maxVelocityError=Math.max(maxVelocityError,Math.abs(a.state[k]-a.expected[k]));}
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i],scale=b.scale;
  maxPaintDisplacementError=Math.max(maxPaintDisplacementError,Math.abs(b.paintedParticle.x-a.paintedParticle.x-(b.expected.x-a.expected.x)*scale),Math.abs(b.paintedParticle.y-a.paintedParticle.y+(b.expected.y-a.expected.y)*scale));
 }
 const [a,b,c]=samples,area=(p,q,r)=>(q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x);
 const actualArea=area(a.paintedParticle,b.paintedParticle,c.paintedParticle),expectedArea=-area(a.expected,b.expected,c.expected)*c.scale*c.scale;
 maxCurvatureAreaError=Math.max(maxCurvatureAreaError,Math.abs(actualArea-expectedArea));
 const normal=name.startsWith('horizontal')?'y':'x',final=c.state,normalPixels=final[normal]*c.scale;
 if(!name.includes('balanced')){assert.ok(Math.abs(normalPixels)>3);assert.ok(Math.sign(actualArea)===Math.sign(expectedArea));}
 cases.push({case:name.replace('.json',''),sampleCount:samples.length,finalTime:final.time,finalPosition:{x:final.x,y:final.y},finalVelocity:{vx:final.vx,vy:final.vy},transverseDisplacementPixels:normalPixels,paintedCurvatureAreaPixelsSquared:actualArea,independentCurvatureAreaPixelsSquared:expectedArea});
}
assert.ok(maxPositionError<2e-9);assert.ok(maxVelocityError<2e-7);assert.ok(maxPaintDisplacementError<.005);assert.ok(maxCurvatureAreaError<.005);
const result={source:'48 browser animation samples from actual Play/Pause interactions. Position and velocity compared to independent E×B drift + rotation formulas. Painted disk displacements and signed curvature are measured from canvas commands and checked by actual bitmap disk pixels in the browser tests.',cases:cases.length,samples:48,maxPositionErrorMetres:maxPositionError,maxVelocityErrorMetresPerSecond:maxVelocityError,maxPaintedDisplacementErrorPixels:maxPaintDisplacementError,maxPaintedCurvatureAreaErrorPixelsSquared:maxCurvatureAreaError,results:cases};
await writeFile('docs/magnetic-trajectory-accuracy.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,results:undefined},null,2));
