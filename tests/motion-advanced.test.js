import {test} from 'node:test';
import assert from 'node:assert/strict';
import {G,motionAt,motionGeometry,motionForces,validateMotion} from '../src/physics.js';
import {makeState,loadExperiment} from '../src/presets.js';
import {advanceMotion,motionCanvasBounds,resetMotionClock,orientMotion,rebalanceMotion,accelerationGlyph} from '../src/motion-state.js';
import {viewport} from '../src/render.js';
import {motionChallenges} from '../src/learning.js';

// Analytical identities: relative 1e-11 or absolute 1e-12 in SI units.
const close=(actual,expected,abs=1e-12)=>assert.ok(Math.abs(actual-expected)<=Math.max(abs,1e-11*Math.abs(expected)),`${actual} != ${expected}`);
const base={orientation:'horizontal',L:.2,q:1e-9,mass:1e-6,voltage:2000,d:.2,x0:-.1,y0:0,vx:2,vy:0,gravity:false,externalX:0,externalY:0};
const rotate=c=>{const q={...c};orientMotion(q,'vertical');return q;};
const bounds={minX:-.3,maxX:.3,minY:-.3,maxY:.3};
const at=(c,t,extra={})=>motionAt(c,t,{bounds,stopStationary:true,...extra});
const make=(c={})=>{const s=makeState(3);s.motion={...base,...c};resetMotionClock(s);return s;};

for(const orientation of ['horizontal','vertical'])for(const charge of [1e-9,-1e-9,0])test(`${orientation}, q=${charge}: polarity reverses electric acceleration and preserves geometry`,()=>{
  const c=orientation==='vertical'?rotate({...base,q:charge}):{...base,q:charge},g=motionGeometry(c),a=motionAt(c,0),b=motionAt({...c,voltage:-c.voltage},0);
  close(Math.hypot(a.ex,a.ey),10000);close(Math.hypot(a.ax,a.ay),charge===0?0:10);
  close(b.ax,-a.ax);close(b.ay,-a.ay);close(g.L,.2);close(c.d,.2);
});

for(const L of [.1,.2,.3])test(`L=${L}: independent analytical transit and deflection, fixed E`,()=>{
  const c={...base,L,x0:-L/2,d:1,voltage:10000},time=L/2,m=motionAt(c,time),edge=m.events.find(e=>e.type==='edge');
  assert.ok(edge);close(edge.time,L/2);close(m.x,L/2);close(m.y,5*time*time);close(m.vy,10*time);assert.equal(m.status,'Outside field');close(m.ey,0);close(m.ay,0);
  close(Math.hypot(motionGeometry(c).field.x,motionGeometry(c).field.y),10000);
});

test('orientation rotates physical trajectories, magnitudes and event times without rotating gravity',()=>{
  const h={...base},v=rotate(h);
  for(const t of [0,.04,.1,.14]){
    const a=motionAt(h,t),b=motionAt(v,t);close(b.x,a.y);close(b.y,-a.x);close(b.vx,a.vy);close(b.vy,-a.vx);close(b.ax,a.ay);close(b.ay,-a.ax);
    assert.deepEqual(a.events,b.events);
  }
  const withGravity=motionAt({...v,gravity:true},0);close(withGravity.ax,10);close(withGravity.ay,-9.81);
});

for(const orientation of ['horizontal','vertical'])for(const key of ['rest','perpendicular','parallel','equilibrium'])test(`${key}, ${orientation}: valid initial conditions and experiment semantics`,()=>{
  const s=makeState(3);s.motion.orientation=orientation;loadExperiment(s,key);validateMotion(s.motion);
  const g=motionGeometry(s.motion),v=g.local({x:s.motion.vx,y:s.motion.vy}),m=motionAt(s.motion,0);
  if(key==='rest')assert.equal(Math.hypot(s.motion.vx,s.motion.vy),0);
  if(key==='perpendicular'){close(v.n,0);close(v.u,2);}
  if(key==='parallel'){close(v.u,0);close(v.n,-.3);}
  if(key==='equilibrium'){
    close(m.ax,0);close(m.ay,0);assert.ok(Math.hypot(m.vx,m.vy)>0);
    assert.equal('externalX' in s.motion,false);assert.equal('externalY' in s.motion,false);
    if(orientation==='vertical'){
      assert.equal(s.motion.balanceMode,'magnetic');assert.equal(motionForces(s.motion).gravity.y,0);
      const stopped=motionAt({...s.motion,vx:0,vy:0},0);assert.notEqual(stopped.ax,0);
    }else {const stopped=motionAt({...s.motion,vx:0,vy:0},1,{stopStationary:true});assert.equal(stopped.status,'Stationary');close(stopped.time,0);}
  }
});

test('explicit magnetic balancing, polarity breaking equilibrium, restoring balance and magnetism outside',()=>{
  const s=makeState(3);s.motion.orientation='vertical';loadExperiment(s,'equilibrium');const c=s.motion;
  const field=c.B,velocity=c.vy,initial=motionAt(c,0);close(initial.ax,0);close(initial.ay,0);
  c.voltage*=-1;const broken=motionAt(c,0);close(broken.ax,-2e6);close(broken.ay,0);close(c.B,field);close(c.vy,velocity);assert.equal('externalX' in c,false);
  rebalanceMotion(c);close(motionAt(c,0).ax,0);close(motionAt(c,0).ay,0);
  const outside=motionForces(c,false);close(outside.field.x,0);close(outside.acceleration.x,1e6);close(outside.acceleration.y,0);
  const h=motionAt({...base,gravity:true},0),r=motionAt({...base,gravity:true,voltage:-2000},0);close(h.ay,.19);close(r.ay,-19.81);assert.notEqual(r.ay,-h.ay);
});

for(const orientation of ['horizontal','vertical'])test(`${orientation}: field exit is nonterminal, canvas exit is later and uses 9 px radius`,()=>{
  let c={...base,q:0};if(orientation==='vertical')c=rotate(c);
  const s=make(c),view=viewport(390,360,s,3),b=motionCanvasBounds(view);
  const edge=motionAt(c,.1);assert.equal(edge.status,'Outside field');close(edge.time,.1);
  const mid=at(c,.15,{bounds:b});assert.equal(mid.status,'Outside field');close(mid.time,.15);close(mid.ax,0);close(mid.ay,0);
  const expected=orientation==='horizontal'?(b.maxX-c.x0)/2:(c.y0-b.minY)/2;
  const end=at(c,100,{bounds:b});assert.equal(end.status,'Canvas exit');close(end.time,expected);
  const screen=view.toScreen(end);close(orientation==='horizontal'?screen.x:screen.y,(orientation==='horizontal'?view.w:view.h)+9);
  close(end.vx,c.vx);close(end.vy,c.vy);
  const before=at(c,expected-1e-7,{bounds:b});assert.notEqual(before.status,'Canvas exit');
});

test('piecewise accelerated field then free-flight canvas exit has independent analytical position and time',()=>{
  const m=at(base,1,{bounds:{minX:-1,maxX:.3,minY:-1,maxY:1}});
  // Field ends at .1 s: y=.05, vy=1. Canvas x=.3 at .2 s.
  close(m.time,.2);close(m.x,.3);close(m.y,.15);close(m.vy,1);close(m.ay,0);
  close(m.events[0].time,.1);assert.equal(m.events[0].type,'edge');assert.equal(m.events.at(-1).type,'canvas');
});

for(const orientation of ['horizontal','vertical'])for(const sign of [-1,1])test(`${orientation}, sign=${sign}: exact earliest plate impact, absorbing state and no repeated event`,()=>{
  let c={...base,x0:0,y0:0,vx:0,voltage:2000*sign,d:.02};if(orientation==='vertical')c=rotate(c);
  const m=at(c,1),expected=Math.sqrt(.02/100);
  assert.equal(m.status,'Plate impact');close(m.time,expected);close(motionGeometry(c).local(m).n,sign*.01);
  close(m.vx,0);close(m.vy,0);close(m.ax,0);close(m.ay,0);assert.equal(m.plate,'negative');
  assert.deepEqual(at(c,2),m);assert.equal(m.events.filter(e=>e.type==='impact').length,1);
});

test('canvas exit precedes later plate collision and collision wins an exact simultaneous corner event',()=>{
  const first=at({...base,x0:0,vx:0},1,{bounds:{minX:-1,maxX:1,minY:-.02,maxY:.02}});assert.equal(first.status,'Canvas exit');close(first.time,Math.sqrt(.004));
  const corner=motionAt({...base,d:.1,voltage:1000},1);assert.equal(corner.status,'Plate impact');close(corner.time,.1);close(corner.x,.1);close(corner.y,.05);
});

test('stationary exact zeros stop at 0; tiny real velocity/force and reversal never falsely stop',()=>{
  const c={...base,q:0,x0:0,vx:0};assert.equal(at(c,10).status,'Stationary');close(at(c,10).time,0);
  assert.notEqual(at({...c,vx:1e-30},1).status,'Stationary');assert.notEqual(at({...c,q:1e-30},1).status,'Stationary');
  const turn={...base,x0:0,vx:0,vy:-.1};close(at(turn,.01).vy,0);assert.notEqual(at(turn,.01).status,'Stationary');assert.ok(at(turn,.02).vy>0);
});

test('moving safety timeout is distinct from a physical exit and supports tiny drift',()=>{
  const c={...base,q:0,vx:1e-15};const m=at(c,100,{maxTime:30});assert.equal(m.status,'Time limit');close(m.time,30);assert.equal(m.events.some(e=>e.type==='canvas'),false);assert.ok(m.x>c.x0);
});

test('reentry and tangential acceleration use accurate segment events rather than constant transit speed',()=>{
  const v=rotate({...base,gravity:true,q:0});const m=motionAt(v,.1);const expected=(-2+Math.sqrt(4+2*G*.2))/G;
  close(m.events[0].time,expected);close(m.vy,-2-G*.1);
  const incoming=motionAt({...base,q:0,x0:-.2,vx:2},.2);assert.equal(incoming.events.length,2);close(incoming.events[0].time,.05);close(incoming.events[1].time,.15);
});

test('playback uses one physical clock, freezes completed results, replays, and resize never rewinds time',()=>{
  const s=make({q:0}),v=viewport(390,360,s,3);s.playing=true;
  advanceMotion(s,.12,v);assert.equal(s.completion,null);close(s.time,.12);advanceMotion(s,10,v);assert.equal(s.completion,'Canvas exit');assert.equal(s.playing,false);
  const final=structuredClone(s.motionResult),time=s.time;advanceMotion(s,100,v);close(s.time,time);assert.deepEqual(s.motionResult,final);
  resetMotionClock(s);close(s.time,0);assert.equal(s.completion,null);advanceMotion(s,.15,v);
  const small={...v,w:20,h:20,toWorld:p=>({x:(p.x-10)/1000,y:(10-p.y)/1000})};advanceMotion(s,.15,small);close(s.time,.15);assert.equal(s.completion,'Canvas exit');
});

test('acceleration glyph follows net acceleration, linear scale, zero suppression and viewport fit',()=>{
  const view={w:320,h:250,toScreen:p=>({x:160+p.x*200,y:125-p.y*200})};
  for(const [ax,ay] of [[10,0],[-10,0],[0,10],[0,-10],[3,4],[0,0]]){
    const m={x:0,y:0,ax,ay},glyph=accelerationGlyph(m,view);close(glyph.length,Math.hypot(ax,ay)*6);
    close(glyph.end.x-glyph.origin.x,ax*glyph.scale);close(glyph.origin.y-glyph.end.y,ay*glyph.scale);
    const moved=accelerationGlyph({...m,x:.02},view);close(moved.origin.x-glyph.origin.x,4);
  }
  const large=accelerationGlyph({x:.7,y:0,ax:100,ay:100},view);assert.ok(large.length<=70);assert.ok(large.end.x<=312&&large.end.y>=30);
});

test('invalid geometry, nonfinite clocks, negative times and malformed viewport bounds are rejected',()=>{
  for(const c of [{L:0},{d:0},{mass:0},{orientation:'diagonal'},{externalX:NaN}])assert.throws(()=>motionAt({...base,...c},1),RangeError);
  for(const time of [-1,NaN,Infinity])assert.throws(()=>motionAt(base,time),RangeError);
  assert.throws(()=>motionAt(base,1,{bounds:{minX:0,maxX:0,minY:0,maxY:1}}),RangeError);
  assert.throws(()=>motionAt(base,1,{fromTime:2}),RangeError);
});

test('vertical challenge explains that a horizontal electric force cannot balance weight',()=>{
  const s=makeState(3);s.motion.orientation='vertical';assert.equal(motionChallenges(s)[4].answer(s),'impossible');
});
