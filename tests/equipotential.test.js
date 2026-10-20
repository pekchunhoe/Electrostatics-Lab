import test from 'node:test';
import assert from 'node:assert/strict';
import {potentialAt} from '../src/physics.js';
import {movementWorking} from '../src/equipotential-ui.js';
import {makeState,loadPreset} from '../src/presets.js';
import {initializeSnapping,setSnapping,releaseProbe,movePotentialProbe,reconcileAttachments,samePotential,potentialComparison,potentialTolerance,actualPotential,projectPotential,validProbePosition,validatePotentialProbes,contourGeometry} from '../src/equipotential.js';

const referenceK=8.987551792261171e9;
const view=(scale=600)=>({w:400,h:360,scale,toScreen:p=>({x:200+p.x*scale,y:180-p.y*scale}),toWorld:p=>({x:(p.x-200)/scale,y:(180-p.y)/scale})});
function state(preset='positive'){
  const s=makeState(2);loadPreset(s,preset);initializeSnapping(s);return s;
}
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol,`${a} differs from ${b}`);
function onLevel(s,key,level){close(potentialAt(s.charges,s[key]),level,potentialTolerance(level));}
function attach(s,key,point,v=view()){
  setSnapping(s,true);assert.ok(movePotentialProbe(s,key,point,v));assert.ok(s.attachments[key]);return s.attachments[key].level;
}

test('A snaps to 80 kV at the analytically correct radius of one positive charge',()=>{
  const s=state(),level=attach(s,'probe',{x:.22,y:.03});assert.equal(level,80000);
  close(Math.hypot(s.probe.x,s.probe.y),.22468879480652927,1e-10);onLevel(s,'probe',80000);
});
test('B independently snaps to the same contour and has zero energy/work within tolerance',()=>{
  const s=state();attach(s,'probe',{x:.22,y:.03});assert.ok(movePotentialProbe(s,'b',{x:-.16,y:.16},view()));
  assert.equal(s.attachments.b.level,80000);onLevel(s,'b',80000);
  const c=potentialComparison(s);assert.ok(c.equal);close(c.dv,0,c.tolerance);close(c.du,0,Math.abs(s.testQ)*c.tolerance);close(c.work,0,Math.abs(s.testQ)*c.tolerance);
  assert.equal(c.du,s.testQ*c.dv);assert.equal(c.work,-c.du);
});
test('negative point-charge projection matches an independent signed analytical reference',()=>{
  const s=state('negative');attach(s,'probe',{x:.22,y:.03});assert.equal(s.attachments.probe.level,-80000);
  close(Math.hypot(s.probe.x,s.probe.y),.22468879480652927,1e-10);onLevel(s,'probe',-80000);
});
test('equal-radius analytical examples preserve actual A potential and place B distinctly',()=>{
  for(const preset of ['positive','negative']){
    const s=state(preset),before={...s.probe},sign=preset==='positive'?1:-1;
    assert.ok(samePotential(s,view()).ok);assert.deepEqual(s.probe,before);
    close(Math.hypot(s.b.x,s.b.y),.2,1e-10);close(actualPotential(s,s.probe),sign*89875.5179226117);
    close(actualPotential(s,s.b),sign*89875.5179226117);
    assert.ok(Math.hypot(s.b.x-s.probe.x,s.b.y-s.probe.y)*600>=26);
  }
});
test('curved sliding follows one full circle without changing the assigned potential',()=>{
  const s=state();s.charges[0].q=1e-6;attach(s,'probe',{x:.115,y:0});
  const radius=referenceK*1e-6/80000;
  for(let i=1;i<=72;i++){
    const angle=i*2*Math.PI/72,target={x:(radius+.005)*Math.cos(angle),y:(radius+.005)*Math.sin(angle)};
    assert.ok(movePotentialProbe(s,'probe',target,view()));assert.equal(s.attachments.probe.level,80000);
    close(Math.hypot(s.probe.x,s.probe.y),radius,1e-10);onLevel(s,'probe',80000);
  }
});
test('sliding B leaves A unchanged and preserves actual zero-work calculations',()=>{
  const s=state();s.charges[0].q=1e-6;s.probe={x:.1,y:0};assert.ok(samePotential(s,view()).ok);const a={...s.probe};
  for(let i=0;i<15;i++){
    const t=.5+i*.08;assert.ok(movePotentialProbe(s,'b',{x:.1*Math.cos(t),y:.1*Math.sin(t)},view()));
    assert.deepEqual(s.probe,a);assert.ok(potentialComparison(s).equal);
  }
});
test('Detach A releases only A, at exactly its current position',()=>{
  const s=state();assert.ok(samePotential(s,view()).ok);const before=structuredClone({a:s.probe,b:s.b,held:s.attachments.b});
  releaseProbe(s,'probe');assert.equal(s.attachments.probe,null);assert.deepEqual(s.probe,before.a);assert.deepEqual(s.b,before.b);assert.deepEqual(s.attachments.b,before.held);
});
test('Detach B releases only B, and cannot immediately recapture while moving away',()=>{
  const s=state();s.charges[0].q=1e-6;attach(s,'b',{x:.115,y:0});const before={...s.b};releaseProbe(s,'b');assert.deepEqual(s.b,before);
  const free={x:before.x+.005,y:before.y};movePotentialProbe(s,'b',free,view());assert.equal(s.attachments.b,null);assert.deepEqual(s.b,free);
  movePotentialProbe(s,'b',{x:.2,y:.2},view());assert.equal(s.snapSuppressed.b,false);
  movePotentialProbe(s,'b',{x:.115,y:0},view());assert.equal(s.attachments.b.level,80000);
});
test('OFF clears both attachments without moving either probe, and permits free 2D motion',()=>{
  const s=state();samePotential(s,view());const before=structuredClone({a:s.probe,b:s.b});setSnapping(s,false);
  assert.equal(s.attachments.probe,null);assert.equal(s.attachments.b,null);assert.deepEqual({a:s.probe,b:s.b},before);
  const point={x:.12,y:.07};movePotentialProbe(s,'b',point,view());assert.deepEqual(s.b,point);assert.ok(!potentialComparison(s).equal);
});
test('different visible contour levels produce the independently expected nonzero difference',()=>{
  const s=state();s.charges[0].q=1e-6;attach(s,'probe',{x:.115,y:0});movePotentialProbe(s,'b',{x:0,y:.06},view());
  assert.equal(s.attachments.b.level,160000);const c=potentialComparison(s);close(c.dv,80000,2e-6);close(c.du,1.6e-4,1e-12);close(c.work,-1.6e-4,1e-12);assert.equal(c.equal,false);
});
test('two positive charges use a noncircular contour through the saddle at A',()=>{
  const s=state('equal');assert.ok(samePotential(s,view()).ok);
  close(actualPotential(s,s.probe),179751.0358452234);close(actualPotential(s,s.b),179751.0358452234,2e-6);
  const explicit=p=>referenceK*1e-6/Math.hypot(p.x+.1,p.y)+referenceK*1e-6/Math.hypot(p.x-.1,p.y);
  close(explicit(s.b),179751.0358452234,2e-6);assert.ok(potentialComparison(s).equal);
});
test('mixed-polarity open zero contour has an independent x=0 analytical solution',()=>{
  const s=state('opposite');setSnapping(s,true);movePotentialProbe(s,'probe',{x:.001,y:.08},view());
  assert.equal(s.attachments.probe.level,0);close(s.probe.x,0,1e-10);close(actualPotential(s,s.probe),0,1e-7);
  assert.ok(samePotential(s,view()).ok);close(s.b.x,0,1e-10);assert.ok(potentialComparison(s).equal);
});
test('one, two, three and four source arrangements support accurate same-potential placement',()=>{
  for(const preset of ['positive','equal','triangle','square']){const s=state(preset);assert.ok(samePotential(s,view()).ok,preset);validatePotentialProbes(s);assert.ok(potentialComparison(s).equal,preset);}
});
test('disconnected equal-level loops retain their own branch while dragging',()=>{
  const s=state('equal');s.charges[0].x=-.16;s.charges[1].x=.16;setSnapping(s,true);
  movePotentialProbe(s,'probe',{x:-.23,y:0},view());assert.equal(s.attachments.probe.level,160000);assert.ok(s.probe.x<0);
  const geometry=contourGeometry(s,view(),[160000],true);assert.ok(geometry.components.length>=2);
  movePotentialProbe(s,'probe',{x:.23,y:0},view());assert.ok(s.probe.x<0,'must not jump to the right loop');onLevel(s,'probe',160000);
});
test('small source motion preserves each assigned level at a nearby actual solution',()=>{
  const s=state();s.charges[0].q=1e-6;attach(s,'probe',{x:.115,y:0});s.charges[0].x=.003;s.charges[0].y=.002;
  assert.ok(reconcileAttachments(s,view()));assert.equal(s.attachments.probe.level,80000);onLevel(s,'probe',80000);
  close(Math.hypot(s.probe.x-.003,s.probe.y-.002),referenceK*1e-6/80000,1e-10);
});
test('unavailable assigned contour after a source polarity edit releases without a distant jump',()=>{
  const s=state();attach(s,'probe',{x:.22,y:.03});const before={...s.probe};s.charges[0].q*=-1;reconcileAttachments(s,view());
  assert.equal(s.attachments.probe,null);assert.deepEqual(s.probe,before);assert.match(s.snapMessage,/released/);
});
test('invalid/singular probe positions and nonconvergent requested levels are rejected',()=>{
  const s=state(),before={...s.probe};setSnapping(s,true);
  assert.equal(movePotentialProbe(s,'probe',{x:0,y:0},view()),false);assert.deepEqual(s.probe,before);
  assert.equal(validProbePosition(s,{x:NaN,y:0}),false);assert.equal(validProbePosition(s,{x:.3,y:0}),false);
  assert.equal(projectPotential(s,{x:0,y:0},80000),null);assert.equal(projectPotential(s,{x:.2,y:0},-80000),null);
});
test('no suitable distinct visible point reports failure without moving B or changing switches',()=>{
  const s=state();s.probe={x:.002,y:0};const before=structuredClone({b:s.b,enabled:s.snapEnabled});const result=samePotential(s,view());
  assert.equal(result.ok,false);assert.match(result.message,/No distinct point/);assert.deepEqual({b:s.b,enabled:s.snapEnabled},before);
});
test('zoom/resize changes CSS capture distance, not an attached potential or contour association',()=>{
  const s=state();s.charges[0].q=1e-6;attach(s,'probe',{x:.115,y:0});
  for(const scale of [450,800,500]){const v=view(scale);movePotentialProbe(s,'probe',{x:s.probe.x,y:s.probe.y+.005},v);assert.equal(s.attachments.probe.level,80000);onLevel(s,'probe',80000);}
});
test('uniform fields and a zero-gradient constant potential remain stable',()=>{
  const s=state();s.uniform=true;s.uniformE=15000;setSnapping(s,true);movePotentialProbe(s,'probe',{x:.04,y:.065},view());
  assert.equal(s.attachments.probe.level,-1000);close(s.probe.y,1/15,1e-12);assert.ok(samePotential(s,view()).ok);close(s.b.y,s.probe.y,1e-12);
  s.uniformE=0;s.attachments={probe:null,b:null};assert.ok(samePotential(s,view()).ok);movePotentialProbe(s,'b',{x:.1,y:.1},view());assert.ok(s.attachments.b);assert.equal(potentialComparison(s).dv,0);
});
test('control state does not modify the original potential model, constants, charges or test charge',()=>{
  const s=state('triangle'),before=structuredClone({charges:s.charges,testQ:s.testQ,a:s.probe,b:s.b});
  const va=potentialAt(s.charges,s.probe),vb=potentialAt(s.charges,s.b);setSnapping(s,true);
  assert.equal(actualPotential(s,s.probe),va);assert.equal(actualPotential(s,s.b),vb);
  assert.deepEqual({charges:s.charges,testQ:s.testQ,a:s.probe,b:s.b},before);
});

test('distant contours do not attract a probe and boundary-adjacent motion stays valid',()=>{
  const s=state();setSnapping(s,true);const far={x:.245,y:.21};movePotentialProbe(s,'probe',far,view());
  assert.equal(s.attachments.probe,null);assert.deepEqual(s.probe,far);
  const nearLimit={x:0,y:.219};movePotentialProbe(s,'probe',nearLimit,view());
  assert.ok(validProbePosition(s,s.probe));assert.ok(Math.abs(s.probe.y)<=.22);
  if(s.attachments.probe)onLevel(s,'probe',s.attachments.probe.level);
});

test('a source edit at a zero-gradient saddle finds a nearby contour seed safely',()=>{
  const s=state('equal');assert.ok(samePotential(s,view()).ok);const level=s.attachments.probe.level,before={...s.probe};
  s.charges.forEach(c=>c.q*=1.01);reconcileAttachments(s,view());assert.ok(s.attachments.probe);onLevel(s,'probe',level);
  assert.ok(Math.hypot(s.probe.x-before.x,s.probe.y-before.y)*600<=24);
});

test('a detached probe can recapture the visible custom contour constructed through A',()=>{
  const s=state();assert.ok(samePotential(s,view()).ok);const level=s.attachments.probe.level;
  assert.notEqual(level,80000);releaseProbe(s,'b');movePotentialProbe(s,'b',{x:.08,y:-.06},view());
  movePotentialProbe(s,'b',{x:-.195,y:0},view());assert.ok(s.attachments.b);assert.equal(s.attachments.b.level,level);
  onLevel(s,'b',level);assert.ok(potentialComparison(s).equal);
});

test('removing one dipole source makes its zero contour unavailable without infinite geometry',()=>{
  const s=state('opposite');assert.ok(samePotential(s,view()).ok);const before={...s.probe};s.charges.pop();
  const geometry=contourGeometry(s,view(),[0],true);assert.equal(geometry.components.length,0);assert.equal(geometry.levels.length,0);
  reconcileAttachments(s,view());assert.equal(s.attachments.probe,null);assert.deepEqual(s.probe,before);assert.ok(Number.isFinite(actualPotential(s,s.probe)));
  assert.equal(contourGeometry(s,view(),[1e-100],true).components.length,0);
});

function at160k(preset='positive'){
  const s=state(preset),level=preset==='negative'?-160000:160000;
  setSnapping(s,true);
  movePotentialProbe(s,'probe',{x:referenceK*Math.abs(s.charges[0].q)/160000,y:0},view());
  assert.equal(s.attachments.probe.level,level);assert.ok(samePotential(s,view()).ok);
  return s;
}
test('160 kV screenshot residual displays exact zeros while retaining raw engine values',()=>{
  const s=at160k();
  // A valid floating-point coordinate perturbation reproduces the screenshot's
  // ~2.037e-10 V residual without replacing the underlying potential equation.
  Object.assign(s.b,{x:0,y:referenceK*s.charges[0].q/(actualPotential(s,s.probe)+2.037e-10)});
  const before=structuredClone(s),va=potentialAt(s.charges,s.probe),vb=potentialAt(s.charges,s.b),c=potentialComparison(s);
  close(c.dv,2.037e-10,3e-11);assert.notEqual(c.dv,0);assert.equal(c.va,va);assert.equal(c.vb,vb);assert.equal(c.dv,vb-va);
  assert.equal(c.du,s.testQ*c.dv);assert.equal(c.work,-c.du);assert.equal(c.equal,true);
  assert.deepEqual(c.display,{dv:0,du:0,work:0});close(c.tolerance,4e-7,1e-18);
  assert.deepEqual(s,before);assert.equal(potentialAt(s.charges,s.b),vb);
  const working=movementWorking(s,c,(value,unit)=>`${value} ${unit}`,true);
  for(const text of ['Verified equipotential.',String.raw`\Delta V=0\;\mathrm{V}`,String.raw`\Delta U=0\;\mathrm{J}`,String.raw`W_{\mathrm{field}}=0\;\mathrm{J}`])assert.ok(working.includes(text));
  assert.ok(!working.includes(String(c.dv)));
});
test('negative 160 kV equality and either test-charge sign yield positive display zeros',()=>{
  for(const preset of ['positive','negative'])for(const q of [-2e-9,0,2e-9]){
    const s=at160k(preset);s.testQ=q;const c=potentialComparison(s);assert.equal(c.equal,true);
    assert.deepEqual(c.display,{dv:0,du:0,work:0});assert.equal(c.du,q*c.dv);assert.equal(c.work,-c.du);
  }
});
test('verified zero display survives a full circle of independently projected sliding positions',()=>{
  const s=at160k(),radius=referenceK*s.charges[0].q/160000;
  for(let i=0;i<=72;i++){
    const t=i*2*Math.PI/72;assert.ok(movePotentialProbe(s,'b',{x:radius*Math.cos(t),y:radius*Math.sin(t)},view()));
    const c=potentialComparison(s);assert.equal(c.equal,true);assert.deepEqual(c.display,{dv:0,du:0,work:0});
    assert.equal(c.dv,potentialAt(s.charges,s.b)-potentialAt(s.charges,s.probe));
  }
});
test('either detachment invalidates zero display immediately, including a genuine tiny difference',()=>{
  for(const key of ['probe','b']){
    const s=at160k();Object.assign(s.b,{x:0,y:referenceK*s.charges[0].q/(160000+2.037e-10)});
    assert.equal(potentialComparison(s).equal,true);releaseProbe(s,key);
    const c=potentialComparison(s);assert.equal(c.equal,false);assert.notEqual(c.dv,0);assert.deepEqual(c.display,{dv:c.dv,du:c.du,work:c.work});
    s[key].x+=.01;const moved=potentialComparison(s);assert.equal(moved.equal,false);assert.equal(moved.display.dv,moved.dv);assert.ok(Math.abs(moved.dv)>1);
  }
});
test('different attached levels retain signed 80 kV differences, energy and field work',()=>{
  for(const reverse of [false,true]){
    const s=at160k();releaseProbe(s,'b');s.snapSuppressed.b=false;movePotentialProbe(s,'b',{x:referenceK*s.charges[0].q/80000,y:0},view());
    if(reverse){[s.probe,s.b]=[s.b,s.probe];[s.attachments.probe,s.attachments.b]=[s.attachments.b,s.attachments.probe];}
    const c=potentialComparison(s);assert.equal(c.equal,false);close(c.display.dv,reverse?80000:-80000,1e-7);
    assert.equal(c.display.du,s.testQ*c.dv);assert.equal(c.display.work,-s.testQ*c.dv);
  }
});
test('unattached tiny signed physical differences are never tolerance-clamped',()=>{
  for(const sign of [-1,1]){
    const s=state();s.uniform=true;s.uniformE=15000;s.probe={x:0,y:.01};s.b={x:.1,y:.01+sign*1e-14};
    s.samePotentialDemo=true;const c=potentialComparison(s);assert.ok(Math.abs(c.dv)<c.tolerance);assert.notEqual(c.dv,0);
    assert.equal(Math.sign(c.dv),-sign);assert.equal(c.equal,false);assert.equal(c.display.dv,c.dv);assert.equal(c.display.du,s.testQ*c.dv);assert.equal(c.display.work,-c.du);
  }
});
test('out-of-tolerance projection and shared off-contour drift cannot authorize display zero',()=>{
  for(const commonDrift of [false,true]){
    const s=at160k(),shift=1e-5;
    s.b={x:0,y:referenceK*s.charges[0].q/(160000+shift)};
    if(commonDrift)s.probe={x:referenceK*s.charges[0].q/(160000+shift+2e-10),y:0};
    const c=potentialComparison(s);assert.equal(c.sameLevel,true);assert.equal(c.equal,false);assert.notEqual(c.dv,0);assert.equal(c.display.dv,c.dv);
    if(commonDrift)assert.ok(Math.abs(c.dv)<c.tolerance);else assert.ok(Math.abs(c.dv)>c.tolerance);
    assert.ok(movementWorking(s,c,String,true).includes('alignment is unverified'));
  }
});
test('stale field associations, hidden contours, OFF and different assigned levels invalidate display zero',()=>{
  for(const invalidate of [s=>s.charges[0].q*=1.000001,s=>s.contours=false,s=>s.snapEnabled=false,s=>s.attachments.b.level+=1e-9]){
    const s=at160k();invalidate(s);const c=potentialComparison(s);assert.equal(c.equal,false);assert.equal(c.display.dv,c.dv);
  }
});
test('mixed polarity and three/four-source same-potential demonstrations use verified display zeros',()=>{
  for(const preset of ['opposite','equal','triangle','square']){
    const s=state(preset);assert.ok(samePotential(s,view()).ok);const c=potentialComparison(s);assert.equal(c.equal,true,preset);
    assert.deepEqual(c.display,{dv:0,du:0,work:0});assert.equal(c.dv,potentialAt(s.charges,s.b)-potentialAt(s.charges,s.probe));
  }
});
