import {test} from 'node:test';
import assert from 'node:assert/strict';
import {motionAt,motionForces,motionGeometry,validateMotion} from '../src/physics.js';
import {lorentzStep} from '../src/lorentz.js';
import {makeState,loadExperiment} from '../src/presets.js';
import {selectBalancingForce,orientMotion,rebalanceMotion,matchRightwardField,changeMagneticField,advanceMotion,resetMotionClock} from '../src/motion-state.js';
import {equilibriumState} from '../src/motion-ui.js';

// Independent SI references: relative 2e-10 / absolute 2e-12 unless stated.
const close=(a,b,abs=2e-12,rel=2e-10)=>assert.ok(Math.abs(a-b)<=Math.max(abs,rel*Math.abs(b)),`${a} != ${b}`);
const base={balanceMode:'magnetic',orientation:'horizontal',B:.2,bDirection:-1,L:10000,d:10000,voltage:-1e6,q:1e-6,mass:2e-6,x0:0,y0:0,vx:500,vy:0};
const view={w:800,h:600,toWorld:p=>({x:(p.x-400)/1000,y:(300-p.y)/1000})};

test('A: gravity reference E=9810, FE=+9.81 μN, Fg=-9.81 μN, two forces only',()=>{
 const c={...base,balanceMode:'gravity',q:1e-9,mass:1e-6,voltage:981,d:.1,externalX:99,externalY:99,gravity:false};
 const f=motionForces(c);close(f.field.y,9810);close(f.electric.y,9.81e-6);close(f.gravity.y,-9.81e-6);close(f.magnetic.y,0);close(f.external.x,0);close(f.external.y,0);assert.deepEqual(f.acceleration,{x:0,y:0});
 const m=motionAt(c,.1);close(m.x,50);close(m.vx,500);close(m.y,0);
});
test('B: vertical gravity resultant independently equals (9.81,-9.81) m/s²',()=>{
 const c={...base,balanceMode:'gravity',orientation:'vertical',q:1e-9,mass:1e-6,voltage:981,d:.1,vx:0,vy:0};
 const m=motionAt(c,0);close(m.ax,9.81);close(m.ay,-9.81);close(Math.hypot(m.ax,m.ay),Math.sqrt(2)*9.81);assert.match(equilibriumState(c,m).text,/perpendicular/);
});
for(const orientation of ['horizontal','vertical'])for(const direction of [-1,1])for(const q of [-1e-6,1e-6])test(`C: E=100, B=.2, v=500 equilibrium ${orientation}, B sign ${direction}, q=${q}`,()=>{
 const c={...base,orientation,bDirection:direction,q,voltage:orientation==='horizontal'?direction*1e6:base.voltage};rebalanceMotion(c);const f=motionForces(c);
 close(Math.hypot(c.vx,c.vy),500);close(Math.hypot(f.electric.x,f.electric.y),1e-4);close(Math.hypot(f.magnetic.x,f.magnetic.y),1e-4);close(f.net.x,0);close(f.net.y,0);close(f.gravity.y,0);
 const m=motionAt(c,.1);close(m.x,c.vx*.1);close(m.y,c.vy*.1);close(m.ax,0);close(m.ay,0);assert.equal(equilibriumState(c,m).balanced,true);
});
for(const [B,FB,ay] of [[.1,5e-5,-25],[.4,2e-4,50],[0,0,-50]])test(`D: changing B to ${B} keeps E and velocity; FB=${FB}`,()=>{
 const c={...base,B},f=motionForces(c);close(f.magnetic.y,FB);close(f.acceleration.y,ay);assert.equal(c.vx,500);assert.equal(equilibriumState(c,motionAt(c,0)).balanced,false);
});
test('E: reversing B reverses FB, preserves FE and velocity; explicit rebalance changes only velocity',()=>{
 const c={...base},before=motionForces(c);c.bDirection=1;const after=motionForces(c);close(after.magnetic.y,-before.magnetic.y);close(after.electric.y,before.electric.y);close(after.acceleration.y,-100);close(c.vx,500);
 assert.throws(()=>rebalanceMotion(c),/rightward/);close(c.vx,500);matchRightwardField(c);rebalanceMotion(c);close(c.vx,500);close(c.B,.2);assert.equal(c.bDirection,-1);close(motionForces(c).acceleration.y,0);
});
for(const [B,radius] of [[.2,2500],[.4,1250]])test(`F: independent orbit radius ${radius} m, B=${B}, speed and energy conserved`,()=>{
 const c={...base,voltage:0,B,mass:1e-6,L:1,x0:10000},w=B,period=2*Math.PI/w;
 for(const t of [period/4,period/2,period,period*100+.7]){
  const m=motionAt(c,t),theta=w*t;
  close(m.x,10000+radius*Math.sin(theta),2e-7,0);close(m.y,radius*(1-Math.cos(theta)),2e-7,0);
  close(Math.hypot(m.vx,m.vy),500,2e-8,0);close(.5*c.mass*(m.vx*m.vx+m.vy*m.vy),.125,2e-11,0);
  close(Math.hypot(m.x-10000,m.y-radius),radius,2e-7,0);close(m.ax*m.vx+m.ay*m.vy,0,2e-8);
 }
});
test('viewport orbit: r=.1 m, omega=20; charge and B reversal reverse curvature',()=>{
 for(const q of [-1e-7,1e-7])for(const direction of [-1,1]){
  const c={...base,q,mass:1e-9,B:.2,bDirection:direction,voltage:0,L:.1,d:.08,x0:.2,vx:2},sign=-Math.sign(q)*direction;
  const m=motionAt(c,Math.PI/40);close(m.x,.3);close(m.y,sign*.1);close(m.vx,0);close(m.vy,sign*2);close(Math.hypot(m.ax,m.ay),40);
 }
});
test('minimum, maximum and tiny B: stable exact flow, no artificial spirals',()=>{
 for(const B of [0,1e-18,.01,2]){
  const c={...base,B,voltage:0,mass:1e-9,q:1e-5,x0:20000,L:1},m=motionAt(c,3600,{maxTime:3600});
  close(Math.hypot(m.vx,m.vy),500,2e-7);assert.equal(m.status,'Time limit');for(const k of ['x','y','vx','vy','ax','ay'])assert.ok(Number.isFinite(m[k]));
 }
 const p={x:0,y:0,vx:2,vy:3},f={x:4,y:5},a=lorentzStep(p,f,1,0,.1),b=lorentzStep(p,f,1,1e-15,.1);for(const k of Object.keys(a))close(a[k],b[k]);
});
test('zero speed, zero charge, zero B, negative charge and velocity cross product',()=>{
 const c={...base,vx:0,vy:0};close(motionForces(c).magnetic.x,0);close(motionForces(c).magnetic.y,0);assert.notEqual(motionAt(c,.01).vy,0);
 const z={...base,q:0};close(motionAt(z,.1).vx,500);assert.equal(equilibriumState(z,motionAt(z,0)).balanced,false);
 const f=motionForces({...base,vx:3,vy:4,q:-2e-6,bDirection:1,B:.5});close(f.magnetic.x,-4e-6);close(f.magnetic.y,3e-6);close(3*f.magnetic.x+4*f.magnetic.y,0);
 assert.throws(()=>rebalanceMotion({...base,B:0}),/B = 0/);
});
test('invalid B input cannot enter the engine',()=>{
 for(const B of [-1,2.01,NaN,Infinity])assert.throws(()=>validateMotion({...base,B}),RangeError);
 assert.throws(()=>validateMotion({...base,bDirection:0}),RangeError);
});
test('orientation automatically selects Magnetic; manual Gravity persists; A–C retain prior force model',()=>{
 const s=makeState(3);loadExperiment(s,'equilibrium');assert.equal(s.motion.balanceMode,'gravity');
 const preserved={q:s.motion.q,mass:s.motion.mass,voltage:s.motion.voltage,d:s.motion.d,B:s.motion.B};
 orientMotion(s.motion,'vertical',{equilibrium:true});assert.equal(s.motion.balanceMode,'magnetic');close(motionAt(s.motion,0).ax,0);
 for(const key of ['d','B'])close(s.motion[key],preserved[key]);close(s.motion.mass,1e-13);close(s.motion.voltage/s.motion.d,100);close(s.motion.vy,500);
 selectBalancingForce(s.motion,'gravity');for(let i=0;i<4;i++)assert.notEqual(motionAt(s.motion,i*1e-5).ay,0);assert.equal(s.motion.balanceMode,'gravity');
 for(const key of ['rest','perpendicular','parallel']){loadExperiment(s,key);assert.equal(s.motion.balanceMode,undefined);close(s.motion.externalX,0);close(s.motion.externalY,0);}
});
test('electric exit preserves velocity, then B acts outside; curved reentry is localized',()=>{
 const c={...base,q:1e-7,mass:1e-9,B:.2,voltage:-1e-12,L:.1,d:1,x0:0,vx:2};
 const m=motionAt(c,.2),edges=m.events.filter(e=>e.type==='edge');assert.ok(edges.length>=2);close(edges[0].time,Math.PI/120,3e-8);close(edges[1].time,5*Math.PI/120,3e-8);
});
test('balanced straight field exit, external circular arc, exact canvas event',()=>{
 const c={...base,q:1e-7,mass:1e-9,B:.2,L:.2,d:.2,voltage:-.08,x0:0,vx:2},edge=.05;
 const m=motionAt(c,.1);close(m.events[0].time,edge);assert.equal(m.status,'Outside field');close(m.ex,0);close(m.ey,0);assert.ok(m.ay>0);close(Math.hypot(m.vx,m.vy),2);
 const b={minX:-1,maxX:.15,minY:-1,maxY:1},end=motionAt(c,1,{bounds:b});assert.equal(end.status,'Canvas exit');close(end.time,.05+Math.asin(.5)/20);close(end.x,.15);
});
test('curved plate collision independently solves y=r(1-cos wt), and absorbs',()=>{
 const c={...base,voltage:0,L:1,d:.08,x0:0,q:1e-7,mass:1e-9,vx:2},m=motionAt(c,1);
 close(m.time,Math.acos(.6)/20);close(m.y,.04);assert.equal(m.status,'Plate impact');close(m.vx,0);close(m.vy,0);close(m.ax,0);close(m.ay,0);close(Math.hypot(m.impactVx,m.impactVy),2);
});
test('visible closed orbit reaches a time limit, clock freezes, Replay and Reset clear histories',()=>{
 const s=makeState(3);s.motion={...base,voltage:0,L:.1,d:.08,x0:.2,q:1e-7,mass:1e-9,vx:2};s.timeLimit=1;s.playing=true;
 advanceMotion(s,5,view);assert.equal(s.completion,'Time limit');close(s.time,1);assert.equal(s.playing,false);const saved=structuredClone(s.motionResult);advanceMotion(s,10,view);assert.deepEqual(s.motionResult,saved);resetMotionClock(s);close(s.time,0);assert.equal(s.completion,null);
});
test('live field changes preserve position, velocity, clock, past segments and subsequent analytical orbit',()=>{
 const s=makeState(3);s.motion={...base,voltage:0,L:.1,d:.08,x0:.2,q:1e-7,mass:1e-9,vx:2};s.playing=true;
 advanceMotion(s,.03,view);const old=structuredClone(s.motionResult);changeMagneticField(s,{B:.4});advanceMotion(s,.03,view);
 for(const k of ['x','y','vx','vy','time'])close(s.motionResult[k],old[k]);close(s.motionResult.ax,2*old.ax);close(s.motionResult.ay,2*old.ay);assert.equal(s.playing,true);
 const next=lorentzStep(old,{x:0,y:0},100,-.4,.02);advanceMotion(s,.05,view);for(const k of ['x','y','vx','vy'])close(s.motionResult[k],next[k]);
 close(s.motionResult.segments[0].bz,-.2);assert.equal(s.motion.fieldHistory.length,2);
 for(const B of [.1,.3,.5,.2])changeMagneticField(s,{B});assert.equal(s.motion.fieldHistory.length,3);advanceMotion(s,.05,view);close(s.time,.05);close(Math.hypot(s.motionResult.vx,s.motionResult.vy),2);
 resetMotionClock(s);assert.equal(s.motion.fieldHistory,undefined);close(s.time,0);
});

test('nonzero E exit and reentry agree with an independent small-step RK4 reference',()=>{
 const c={...base,q:1e-7,mass:1e-9,B:.2,voltage:-.02,L:.1,d:1,x0:0,vx:2};
 // Independent component equations, direct field rectangle, RK4 dt=1 μs.
 const derivative=p=>{const E=Math.abs(p[0])<.05&&Math.abs(p[1])<.5?-.02:0;return [p[2],p[3],-20*p[3],100*E+20*p[2]];};
 let p=[0,0,2,0];const dt=1e-6;
 for(let i=1;i<=250000;i++){
  const a=derivative(p),b=derivative(p.map((v,j)=>v+a[j]*dt/2)),d=derivative(p.map((v,j)=>v+b[j]*dt/2)),e=derivative(p.map((v,j)=>v+d[j]*dt));
  p=p.map((v,j)=>v+dt*(a[j]+2*b[j]+2*d[j]+e[j])/6);
  if([50000,150000,250000].includes(i)){const m=motionAt(c,i*dt);close(m.x,p[0],5e-7);close(m.y,p[1],5e-7);close(m.vx,p[2],1e-5);close(m.vy,p[3],1e-5);}
 }
 const events=motionAt(c,.25).events;assert.ok(events.some(e=>e.entering===true));assert.ok(events.some(e=>e.entering===false));
});
test('curved tangent contacts and exact outward canvas-boundary states are detected',()=>{
 const c={...base,voltage:0,L:1,d:.4,x0:0,q:1e-7,mass:1e-9,vx:2},m=motionAt(c,1);
 assert.equal(m.status,'Plate impact');close(m.time,Math.PI/20,1e-9);close(m.y,.2);
 const outward=motionAt({...c,L:.1,x0:.2},.1,{bounds:{minX:-1,maxX:.2,minY:-1,maxY:1}});assert.equal(outward.status,'Canvas exit');close(outward.time,0);
});
test('invalid live field changes leave state and history unchanged',()=>{
 const s=makeState(3);loadExperiment(s,'equilibrium');selectBalancingForce(s.motion,'magnetic',{initialize:true});const before=structuredClone(s);
 for(const B of [-1,NaN,Infinity,3])assert.throws(()=>changeMagneticField(s,{B}),RangeError);assert.deepEqual(s,before);
});

test('safe envelope acceleration does not skip the electric-field exit at high gyrofrequency',()=>{
 const c={...base,mass:1e-9,q:1e-6,B:.2,L:.2,d:.2,voltage:-.2,x0:0,vx:5};
 const m=motionAt(c,.021);close(m.events[0].time,.02);assert.equal(m.status,'Outside field');close(m.ey,0);close(Math.hypot(m.vx,m.vy),5);assert.ok(m.ay>0);
});

test('high-frequency zero-E circle straddling a former field edge has no spurious boundary work or solver exhaustion',()=>{
 const c={...base,voltage:0,B:2,mass:1e-9,q:1e-5,L:.1,d:.2,x0:.05,vx:1};
 const m=motionAt(c,3600,{maxTime:3600});assert.equal(m.status,'Time limit');close(Math.hypot(m.vx,m.vy),1,1e-8);
});

test('balancing actions reject out-of-range results without corrupting parameters; zero-charge orientation stays usable',()=>{
 const c={...base,B:1e-320},before={...c};assert.throws(()=>rebalanceMotion(c),/supported/);assert.deepEqual(c,before);
 const g={...base,balanceMode:'gravity',mass:1,q:1e-9};assert.throws(()=>rebalanceMotion(g),/2000/);assert.equal(g.voltage,base.voltage);
 const s=makeState(3);loadExperiment(s,'equilibrium');s.motion.q=0;orientMotion(s.motion,'vertical',{equilibrium:true});assert.equal(s.motion.balanceMode,'magnetic');assert.equal(equilibriumState(s.motion,motionAt(s.motion,0)).balanced,false);
});
test('magnetic force scales with initial speed and excludes stale gravity and external values',()=>{
 const c={...base,gravity:true,externalX:100,externalY:200};const a=motionForces(c),b=motionForces({...c,vx:1000});close(b.magnetic.y,2*a.magnetic.y);close(a.gravity.y,0);close(a.external.x,0);close(a.external.y,0);
});
