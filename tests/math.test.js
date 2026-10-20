import test from 'node:test';
import assert from 'node:assert/strict';
import {notation,quantity,scientific,plainQuantity} from '../src/math.js';
import {activeForceModel,motionCalculations} from '../src/motion-math.js';
import {equilibriumState} from '../src/motion-ui.js';
import {makeState,loadExperiment} from '../src/presets.js';
import {motionAt,G} from '../src/physics.js';
import {educationalText} from '../src/educational-math.js';
import {motionChallenges} from '../src/learning.js';
const t=String.raw;
const state=key=>{const s=makeState(3);loadExperiment(s,key);return s;};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=Math.max(1e-20,Math.abs(expected)*1e-12),`${actual} vs ${expected}`);
function panel(s,time=0){const m=motionAt(s.motion,time);return {m,model:activeForceModel(s.motion,m),html:motionCalculations(s,m,equilibriumState(s.motion,m),'')};}
test('native math structures: nested fractions, scripts, vectors, sum, cross/dot products and SI units',()=>{
  const result=notation(t`\vec F_{\mathrm{net}}=\sum_i\frac{q_i\vec E_i}{m}\cdot\vec v\times\vec B`);
  for(const tag of ['mfrac','msub','mover','semantics','annotation'])assert.ok(result.includes('<'+tag));
  assert.match(result,/∑/);assert.match(result,/×/);assert.match(result,/·/);
  const speed=notation(quantity(-1e-9,'m/s²'));
  assert.match(speed,/<msup>/);assert.match(speed,/<mo>−<\/mo><mn>9/);assert.match(speed,/<mo>−<\/mo><mn>2/);assert.match(speed,/mathvariant="normal">s/);
  assert.equal(scientific(0),'0');assert.equal(scientific(1e100),'1.000\\times10^{100}');assert.equal(scientific(-1e-100),'-1.000\\times10^{-100}');
  assert.equal(plainQuantity(1e-9,'T',6),'1.00000 × 10⁻⁹ T');assert.equal(plainQuantity(.2,'T',6),'0.2 T');
  assert.ok(!notation(t`\text{<script>}`).includes('<script>'));
  assert.match(educationalText('v = E/B and W_field = −ΔU'),/<mfrac>/);
});
test('screenshot regression: 300 V / .080 m, electric-only launch yields 3750 N/C, 3.75 μN, 3.75 m/s²',()=>{
  const s=state('perpendicular'),{m,model,html}=panel(s);
  near(m.ey,3750);near(s.motion.q*m.ey,3.75e-6);near(m.ay,3.75);near(m.ax,0);
  assert.equal(model.force,t`\vec F_{\mathrm{net}}=q\vec E`);
  assert.equal(model.acceleration,t`\vec a=\frac{q\vec E}{m}`);
  assert.doesNotMatch(html,/F_external|Fext|\\vec F_g|\\vec F_B|m\\vec g|\\mathrm\{ext\}/);
  near(Number(html.match(/data-ay="([^"]+)"/)[1]),3.75);assert.match(html,/3750/);assert.match(html,/3.750/);
});
test('negative q and reversed polarity independently reverse signed electric acceleration',()=>{
  const s=state('perpendicular');s.motion.q=-1e-9;near(panel(s).m.ay,-3.75);s.motion.voltage=-300;near(panel(s).m.ay,3.75);
});
test('non-D controls retain legitimate enabled gravity and external terms only',()=>{
  const s=state('perpendicular');s.motion.gravity=true;s.motion.externalX=2e-6;
  const {model,m}=panel(s);assert.match(model.force,/m\\vec g/);assert.match(model.force,/F_\{\\mathrm\{ext\}\}/);
  near(m.ax,2);near(m.ay,3.75-G);
});
test('gravity balance and vertical nonbalance have correct independent vector results',()=>{
  const s=state('equilibrium');let p=panel(s);near(p.m.ax,0);near(p.m.ay,0);
  assert.equal(p.model.force,t`\vec F_{\mathrm{net}}=q\vec E+m\vec g`);assert.doesNotMatch(p.html,/\\vec F_B|\\mathrm\{ext\}/);
  s.motion.orientation='vertical';s.motion.x0=0;s.motion.y0=0;p=panel(s);near(p.m.ax,G);near(p.m.ay,-G);assert.match(p.html,/perpendicular/);
});
test('a small real solver acceleration is never relabelled as equilibrium by a wider display tolerance',()=>{
  const s=state('equilibrium');s.motion.voltage*=1+8*Number.EPSILON;
  const {m,html}=panel(s);assert.notEqual(m.ay,0);assert.equal(equilibriumState(s.motion,m).balanced,false);
  assert.doesNotMatch(html,/\\sum\\vec F=\\vec 0/);
});
test('electric-only exit removes electric contribution; gravity-only exit retains weight',()=>{
  const s=state('perpendicular');let p=panel(s,.14);assert.equal(p.m.status,'Outside field');assert.equal(p.model.acceleration,t`\vec a=\vec 0`);assert.equal(p.model.force,t`\vec F_{\mathrm{net}}=\vec 0`);
  s.motion.gravity=true;s.motion.x0=.2;s.motion.vx=0;s.motion.vy=0;p=panel(s);near(p.m.ay,-G);assert.equal(p.model.force,t`\vec F_{\mathrm{net}}=m\vec g`);
});
test('magnetic equations track instantaneous velocity, zero B, field exit and plate contact',()=>{
  const s=state('equilibrium');Object.assign(s.motion,{balanceMode:'magnetic',gravity:false,voltage:8,q:1e-6,mass:1e-6,B:.2,bDirection:1,vx:500,vy:0});
  let p=panel(s);near(p.m.ay,0);assert.equal(p.model.acceleration,t`\vec a=\frac{q(\vec E+\vec v\times\vec B)}{m}`);assert.doesNotMatch(p.html,/\\vec F_g|m\\vec g|F_external/);
  s.motion.vx=400;p=panel(s);near(p.m.ay,20);s.motion.B=0;p=panel(s);near(p.m.ay,100);assert.doesNotMatch(p.html,/v_\{\\mathrm\{required\}\}=\\frac/);assert.match(p.html,/unavailable when B = 0/);
  Object.assign(s.motion,{x0:.2,y0:0,B:.2,vx:1,vy:2});p=panel(s);assert.equal(p.model.force,t`\vec F_{\mathrm{net}}=q(\vec v\times\vec B)`);near(p.m.ax,.4);near(p.m.ay,-.2);
  const atContact={...p.m,status:'Plate impact',ax:0,ay:0,vx:0,vy:0};assert.equal(activeForceModel(s.motion,atContact).force,t`\vec F_{\mathrm{net}}=\vec 0`);
  s.motion.q=0;assert.throws(()=>motionChallenges(s)[2].answer(s),/nonzero particle charge/);
});
test('rest/parallel kinematics are explicitly limited to constant-acceleration segments',()=>{
  for(const key of ['rest','parallel']){const {html}=panel(state(key));assert.match(html,/each constant-acceleration flight segment/);assert.match(html,/Join segments continuously/);assert.doesNotMatch(html,/<h4>\d/);}
});
