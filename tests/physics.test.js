import test from 'node:test';
import assert from 'node:assert/strict';
import {K,EPSILON_0,G,forceOn,fieldAt,potentialAt,systemEnergy,energyChange,uniformField,kinematics,motionAt,validateCharges,validateMotion,magnitude,direction,rootsForPosition,createSampler} from '../src/physics.js';
const c=(id,q,x,y=0)=>({id:String(id),q,x,y});
// Rounded supplied references: relative 2e-6, absolute 1e-12.
// Independent analytical identities: relative 1e-11, absolute 1e-12.
function close(actual,expected,relative=1e-11,absolute=1e-12){assert.ok(Math.abs(actual-expected)<=Math.max(absolute,relative*Math.abs(expected)),`${actual} ≠ ${expected}`);}
const base={q:1e-9,mass:1e-6,voltage:300,d:.02,x0:0,y0:0,vx:2,vy:0,gravity:false};
test('SI constant definition',()=>{close(K,8.987551792261171e9);close(EPSILON_0,8.8541878128e-12);});
test('A: unlike 1 μC charges 0.10 m apart attract equally and oppositely',()=>{const cs=[c(1,1e-6,0),c(2,-1e-6,.1)];const f=forceOn(cs,'1'),other=forceOn(cs,'2');close(magnitude(f),.898755,2e-6);assert.ok(f.x>0);close(f.x,-other.x);close(f.y,0);});
test('B: +2 μC at 0.20 m gives outward 4.49378e5 N/C',()=>{const e=fieldAt([c(1,2e-6,0)],{x:.2,y:0});close(e.x,449378,2e-6);close(e.y,0);});
test('C: midpoint E cancels but potentials add',()=>{const cs=[c(1,1e-6,-.1),c(2,1e-6,.1)],p={x:0,y:0};close(magnitude(fieldAt(cs,p)),0);close(potentialAt(cs,p),179751,2e-6);});
test('D: pair system energy is negative',()=>close(systemEnergy([c(1,2e-6,0),c(2,-3e-6,.2)]),-.269627,2e-6));
test('E: potential-energy change preserves work signs',()=>{close(energyChange(2e-9,-300),-6e-7);close(energyChange(-2e-9,-300),6e-7);});
test('F: 300 V over .020 m gives upward field for bottom-positive plates',()=>{close(uniformField(300,.02),15000);close(uniformField(-300,.02),-15000);});
test('G: perpendicular launch analytic reference at .010 s',()=>{const m=motionAt(base,.01);close(m.ay,15);close(m.x,.02);close(m.y,.00075);close(m.vy,.15);close(m.vx,2);});
test('sign reversal and inverse-square separation',()=>{const cs=[c(1,1e-6,0),c(2,1e-6,.1)],f=forceOn(cs,'1');assert.ok(f.x<0);cs[1].q*=-1;close(forceOn(cs,'1').x,-f.x);cs[1].x=.2;close(forceOn(cs,'1').x,-f.x/4);});
test('non-axis aligned pair has independent 3-4-5 components',()=>{const cs=[c(1,2e-6,0),c(2,3e-6,.3,.4)],f=forceOn(cs,'1');const referenceMagnitude=8.987551792261171e9*6e-12/.25;close(f.x,-referenceMagnitude*.6);close(f.y,-referenceMagnitude*.8);});
test('three-charge vector sum uses signs independently',()=>{const cs=[c(1,1e-6,0),c(2,1e-6,.1),c(3,-2e-6,0,.2)],f=forceOn(cs,'1');close(f.x,-.8987551792261171);close(f.y,.44937758961305855);});
test('four-charge resultant and field symmetry',()=>{const cs=[c(1,1e-6,0),c(2,1e-6,.1),c(3,1e-6,-.1),c(4,-1e-6,0,.1)],f=forceOn(cs,'1');close(f.x,0);close(f.y,.8987551792261171);const symmetrical=[c(1,1e-6,.1),c(2,1e-6,-.1),c(3,1e-6,0,.1),c(4,1e-6,0,-.1)];close(magnitude(fieldAt(symmetrical,{x:0,y:0})),0);});
test('negative potential and equipotential difference',()=>{const cs=[c(1,-2e-6,0)];close(potentialAt(cs,{x:.2,y:0}),-89875.5179226117);close(potentialAt(cs,{x:.2,y:0})-potentialAt(cs,{x:0,y:.2}),0);});
test('triangle energy counts each of three pairs once',()=>{const cs=[c(1,1e-6,0),c(2,2e-6,.3),c(3,-3e-6,0,.4)];const expected=8.987551792261171e9*(2e-12/.3-3e-12/.4-6e-12/.5);close(systemEnergy(cs),expected);assert.throws(()=>systemEnergy([...cs,c(4,1e-6,1)]),/at most 3/);});
test('zero charge creates neither force nor potential, and never divides by test q',()=>{const cs=[c(1,0,0),c(2,1e-6,.1)];close(magnitude(forceOn(cs,'1')),0);close(potentialAt([c(1,0,0)],{x:0,y:0}),0);const m=motionAt({...base,q:0},.02);close(m.ay,0);close(m.y,0);});
test('antiparallel velocity slows, stops and reverses',()=>{const cfg={...base,d:2,voltage:30000,vx:0,y0:0,vy:-.15};close(motionAt(cfg,.01).vy,0);assert.ok(motionAt(cfg,.02).vy>0);close(motionAt(cfg,.02).y,0);});
test('dynamic equilibrium: nonzero constant velocity before exit',()=>{const m=motionAt({...base,gravity:true,voltage:196.2,vx:1},.1);close(m.ay,0);close(m.vx,1);close(m.vy,0);close(m.x,.1);close(m.y,0);});
test('plate collision is located analytically and absorbs the particle',()=>{const cfg={...base,vx:0},m=motionAt(cfg,1),hit=Math.sqrt(.02/15);assert.equal(m.status,'Plate impact');close(m.time,hit);close(m.y,.01);close(m.vy,0);close(m.impactVy,15*hit);assert.deepEqual(motionAt(cfg,2),m);});
test('exit removes electric force and preserves continuous position and velocity',()=>{const cfg={...base,d:2,voltage:30000},exit=.075,m=motionAt(cfg,.1);assert.equal(m.status,'Outside field');close(m.ay,0);close(m.ey,0);close(m.vy,15*exit);close(m.y,7.5*exit**2+15*exit*(.1-exit));close(motionAt(cfg,exit).y,7.5*exit**2);});
test('gravity continues outside plates',()=>{const cfg={...base,d:2,voltage:19620,gravity:true};const m=motionAt(cfg,.1);close(m.ay,-9.81);close(m.vy,-9.81*.025);});
test('a particle may enter the active field from outside',()=>{const cfg={...base,x0:-.2,d:2,voltage:30000},m=motionAt(cfg,.05);close(m.ay,15);close(m.y,7.5*.025**2);});
test('boundary initial conditions and signed travel',()=>{const cfg={...base,x0:.15,vx:-2,d:2,voltage:30000};close(motionAt(cfg,0).ay,15);assert.equal(motionAt({...cfg,vx:2},0).status,'Outside field');});
test('coincidence and singular probes are rejected, never softened',()=>{assert.throws(()=>validateCharges([c(1,1,0),c(2,-1,0)]),/Undefined/);assert.throws(()=>fieldAt([c(1,1,0)],{x:0,y:0}),/Undefined/);assert.throws(()=>potentialAt([c(1,1,0)],{x:0,y:0}),/Undefined/);});
test('invalid values, mass, distance, time and counts are rejected',()=>{for(const mass of [0,-1,NaN,Infinity])assert.throws(()=>motionAt({...base,mass},1),RangeError);assert.throws(()=>uniformField(300,0));assert.throws(()=>motionAt(base,-1));assert.throws(()=>fieldAt([c(1,NaN,0)],{x:1,y:0}));assert.throws(()=>validateCharges([1,2,3,4,5].map(i=>c(i,1,i))));assert.throws(()=>validateMotion({...base,y0:.02}));});
test('directions, roots and general kinematics',()=>{close(direction({x:-1,y:0}),180);assert.equal(direction({x:0,y:0}),null);close(rootsForPosition(0,0,2,1).find(t=>t>0),1);close(kinematics({x:0,y:0},{x:2,y:3},{x:0,y:-2},2).y,2);});
test('dense sampler matches independent reference values and snapshots input',()=>{const charges=[c(1,2e-6,0)];const sample=createSampler(charges);close(sample.field({x:.2,y:0}).x,449378,2e-6);close(sample.potential({x:.2,y:0}),89875.5179226117);charges[0].q=0;assert.ok(sample.field({x:.2,y:0}).x>0);assert.throws(()=>sample.field({x:0,y:0}));});
test('passing above the plates does not enter the rectangular active field',()=>{const cfg={...base,x0:-.2,y0:0,vx:2,vy:1};const m=motionAt(cfg,.1);assert.equal(m.status,'Outside field');close(m.ay,0);close(m.y,.1);close(m.vy,1);});
test('a particle approaching the plate from outside the gap is absorbed',()=>{const cfg={...base,x0:-.2,y0:.04,vx:2,vy:-1};const m=motionAt(cfg,.05);assert.equal(m.status,'Plate impact');close(m.time,.03);close(m.y,.01);});
test('overflow is rejected instead of returned as an infinite physical value',()=>{assert.throws(()=>potentialAt([c(1,1e308,0)],{x:1,y:0}),RangeError);assert.throws(()=>energyChange(1e308,1e308),RangeError);assert.throws(()=>uniformField(1e308,1e-20),RangeError);});
