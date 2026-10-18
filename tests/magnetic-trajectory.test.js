import {test} from 'node:test';
import assert from 'node:assert/strict';
import {motionAt,motionForces} from '../src/physics.js';
import {makeState,loadExperiment} from '../src/presets.js';
import {selectBalancingForce,rebalanceMotion,matchRightwardField,resetMotionClock,orientMotion,setMagneticSpeed,changeMagneticField,advanceMotion} from '../src/motion-state.js';

const close=(a,b,abs=2e-11,rel=2e-11)=>assert.ok(Math.abs(a-b)<=Math.max(abs,rel*Math.abs(b)),`${a} != ${b}`);
const base={balanceMode:'magnetic',orientation:'horizontal',q:1e-9,mass:1e-13,voltage:-100,d:1,L:2,x0:-.12,y0:0,vx:500,vy:0,B:.2,bDirection:-1};
// Independent drift + rotation solution, separate from the acceleration-series
// propagator in production. It does not import lorentzStep or the renderer.
function reference(c,t){
 const bz=c.B*c.bDirection,w=c.q*bz/c.mass,e=c.voltage/c.d,drift=e/bz,u=500-drift;
 const h={x:-.12+drift*t+u*Math.sin(w*t)/w,y:u*(Math.cos(w*t)-1)/w,vx:drift+u*Math.cos(w*t),vy:-u*Math.sin(w*t)};
 return c.orientation==='vertical'?{x:-h.y,y:h.x,vx:-h.vy,vy:h.vx}:h;
}
for(const [name,B,direction,fe,fb,ay] of [['balanced',.2,-1,-1e-7,1e-7,0],['increase',.4,-1,-1e-7,2e-7,1e6],['decrease',.1,-1,-1e-7,5e-8,-5e5],['reverse',.2,1,-1e-7,-1e-7,-2e6]])test(`supplied reference ${name}: signed initial forces and actual positions/velocities at multiple times`,()=>{
 const c={...base,B,bDirection:direction},f=motionForces(c);close(f.electric.y,fe,1e-20);close(f.magnetic.y,fb,1e-20);close(f.acceleration.y,ay,1e-8);
 for(const t of [0,2e-5,6e-5,1.2e-4,2e-4,3e-4]){
  const m=motionAt(c,t),r=reference(c,t);for(const key of ['x','y','vx','vy'])close(m[key],r[key]);
  const ex=0,ey=-100,fbx=c.q*m.vy*c.B*direction,fby=-c.q*m.vx*c.B*direction;
  close(m.forces.magnetic.x,fbx,1e-20);close(m.forces.magnetic.y,fby,1e-20);close(m.ax,(c.q*ex+fbx)/c.mass,1e-7);close(m.ay,(c.q*ey+fby)/c.mass,1e-7);
  if(t>0&&name!=='balanced'){assert.notEqual(m.vy,0);assert.notEqual(m.forces.magnetic.x,0);assert.notEqual(m.y,0);}
 }
});
for(const orientation of ['horizontal','vertical'])for(const q of [-1e-9,1e-9])test(`independent unbalanced trajectory / force components: ${orientation}, q=${q}`,()=>{
 const c={...base,orientation,q,B:.4};if(orientation==='vertical')Object.assign(c,{voltage:100,x0:0,y0:-.12,vx:0,vy:500});
 for(const t of [4e-5,1e-4,2e-4]){
  const m=motionAt(c,t),r=reference({...c,voltage:-100},t);for(const key of ['x','y','vx','vy'])close(m[key],r[key]);
  const E=orientation==='vertical'?{x:100,y:0}:{x:0,y:-100};
  close(m.ax,(q*E.x+q*m.vy*(-.4))/c.mass,1e-7);close(m.ay,(q*E.y-q*m.vx*(-.4))/c.mass,1e-7);
 }
});
test('reference magnetic-only orbit: radius .25 m, omega 2000, speed/energy conservation and negative evolving vx',()=>{
 const c={...base,voltage:0,L:.1,x0:.6},period=2*Math.PI/2000;
 for(const t of [period/4,period/2,period,100*period+.0002]){
  const m=motionAt(c,t);close(m.x,.6+.25*Math.sin(2000*t));close(m.y,.25*(1-Math.cos(2000*t)));close(Math.hypot(m.x-.6,m.y-.25),.25);close(Math.hypot(m.vx,m.vy),500,2e-8);close(.5*c.mass*(m.vx*m.vx+m.vy*m.vy),1.25e-8,2e-19);close(m.ax*m.vx+m.ay*m.vy,0,1e-4);
 }
 assert.ok(motionAt(c,period/2).vx<0);
});
test('fresh UI-mode initialization, signs, Replay, Reset and orientation return all give rightward initial motion',()=>{
 for(const q of [-1e-9,1e-9]){
  const s=makeState(3);loadExperiment(s,'equilibrium');s.motion.q=q;selectBalancingForce(s.motion,'magnetic',{demo:true});const c=s.motion;
  close(c.vx,500);close(c.vy,0);assert.ok(c.x0<0);close(c.mass,1e-13);close(c.voltage/c.d,-100);assert.equal(c.bDirection,-1);close(motionAt(c,0).ay,0);
  c.bDirection=1;resetMotionClock(s);close(c.vx,500);close(motionAt(c,0).ay,-2e6*Math.sign(q));
  loadExperiment(s,'equilibrium');assert.equal(s.motion.balanceMode,'magnetic');close(s.motion.vx,500);close(s.motion.vy,0);
  orientMotion(s.motion,'vertical',{equilibrium:true});assert.equal(s.motion.balanceMode,'magnetic');close(s.motion.vx,0);assert.notEqual(s.motion.vy,0);close(motionAt(s.motion,0).ax,0);
  orientMotion(s.motion,'horizontal',{equilibrium:true});assert.equal(s.motion.balanceMode,'magnetic');assert.ok(s.motion.vx>0);close(s.motion.vy,0);close(motionAt(s.motion,0).ay,0);
 }
});
test('incompatible Balance preserves fields and rightward launch; corrective direction action is explicit',()=>{
 const c={...base,bDirection:1};const original={...c};assert.throws(()=>rebalanceMotion(c),/cannot balance a rightward/);assert.deepEqual(c,original);
 matchRightwardField(c);assert.equal(c.bDirection,-1);close(c.B,.2);close(c.vx,500);rebalanceMotion(c);close(motionAt(c,0).ay,0);
 for(const B of [.1,.4]){c.B=B;setMagneticSpeed(c,500);close(c.vx,500);close(c.vy,0);assert.notEqual(motionAt(c,0).ay,0);}
 assert.throws(()=>setMagneticSpeed(c,0),/positive/);
});
test('live B history bends actual motion after the change and preserves its pre-change solution',()=>{
 const s=makeState(3);s.motion={...base,L:.3,d:.08,voltage:-8};s.playing=true;
 const view={w:1000,h:1000,toWorld:p=>({x:(p.x-500)/1000,y:(500-p.y)/1000})};
 advanceMotion(s,1e-4,view);const before=structuredClone(s.motionResult);changeMagneticField(s,{B:.4});advanceMotion(s,1e-4,view);
 for(const key of ['x','y','vx','vy','time'])close(s.motionResult[key],before[key]);
 advanceMotion(s,2e-4,view);const expected=reference({...base,B:.4},1e-4);close(s.motionResult.x,expected.x+500e-4);close(s.motionResult.y,expected.y);close(s.motionResult.vx,expected.vx);close(s.motionResult.vy,expected.vy);assert.ok(s.motionResult.y>.004);
});
test('clock subdivision / frame rate does not change the Lorentz solution',()=>{
 const view={w:1000,h:1000,toWorld:p=>({x:(p.x-500)/1000,y:(500-p.y)/1000})},states=[];
 for(const frames of [12,30,60,144]){const s=makeState(3);s.motion={...base,B:.4};for(let i=1;i<=frames;i++)advanceMotion(s,i*2e-4/frames,view);states.push(s.motionResult);}
 for(const state of states)for(const key of ['x','y','vx','vy','ax','ay'])close(state[key],states[0][key]);
});

test('live field reversal at a tangent electric-region start never rewrites historical entry',()=>{
 const c={...base,q:1e-7,mass:1e-9,voltage:-.004,d:.2,L:.2,x0:.1,y0:0,vx:0,vy:2};
 const before=motionAt(c,.001),after=motionAt({...c,bDirection:1,fieldHistory:[{time:0,B:.2,bDirection:-1},{time:.001,B:.2,bDirection:1}]},.001);
 for(const key of ['x','y','vx','vy'])close(after[key],before[key]);
 close(after.forces.magnetic.x,-before.forces.magnetic.x,1e-20);close(after.forces.magnetic.y,-before.forces.magnetic.y,1e-20);
});

test('zero electric field cannot be falsely balanced by a positive horizontal speed; orientation remains usable',()=>{
 const s=makeState(3);loadExperiment(s,'equilibrium');selectBalancingForce(s.motion,'magnetic',{demo:true});s.motion.voltage=0;
 const before={...s.motion};assert.throws(()=>rebalanceMotion(s.motion),/No positive rightward speed/);assert.deepEqual(s.motion,before);
 orientMotion(s.motion,'vertical',{equilibrium:true});orientMotion(s.motion,'horizontal',{equilibrium:true});assert.ok(s.motion.vx>0);close(s.motion.vy,0);assert.notEqual(motionAt(s.motion,0).ay,0);
});

test('zero-E / zero-B straight grazing paths still collide with a finite plate end corner',()=>{
 for(const orientation of ['horizontal','vertical']){
  const c={...base,orientation,voltage:0,B:0,L:.2,d:.2,x0:-.2,y0:.1};
  if(orientation==='vertical')Object.assign(c,{x0:.1,y0:-.2,vx:0,vy:500});
  const m=motionAt(c,.001);assert.equal(m.status,'Plate impact');close(m.time,.0002);close(m.vx,0);close(m.vy,0);
 }
});
