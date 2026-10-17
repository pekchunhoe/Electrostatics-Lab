import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeState,loadPreset} from '../src/presets.js';
import {K,fieldAt,potentialAt,energyChange} from '../src/physics.js';
import {plateDefaults,plateModel,createPotentialModels,updatePlates} from '../src/parallel-plates.js';
import {fieldLinePaths} from '../src/field-lines.js';
import {viewport} from '../src/render.js';
import {initializeSnapping,actualPotential,contourGeometry,contourLevels,setSnapping,movePotentialProbe,releaseProbe,samePotential,potentialComparison,validProbePosition,reconcileAttachments} from '../src/equipotential.js';

const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} ≠ ${b}`);
const state=(key='positive')=>{const s=makeState(2);loadPreset(s,key);initializeSnapping(s);s.fieldLines=true;return s;};
const plates=()=>createPotentialModels(state(),initializeSnapping).plates;
const norm=p=>Math.hypot(p.x,p.y);
// Independent numerical derivative of the scalar potential; no E-based tangent.
function numericalGradient(s,p){const h=1e-7;return {x:(potentialAt(s.charges,{x:p.x+h,y:p.y})-potentialAt(s.charges,{x:p.x-h,y:p.y}))/(2*h),y:(potentialAt(s.charges,{x:p.x,y:p.y+h})-potentialAt(s.charges,{x:p.x,y:p.y-h}))/(2*h)};}

for(const preset of ['positive','negative','equal','opposite','unequal','triangle','square']){
  test(`${preset}: numerical equipotential tangents are perpendicular to E`,()=>{
    const s=state(preset);
    for(const p of [{x:.17,y:.13},{x:-.16,y:.07},{x:.03,y:-.14}]){
      const e=fieldAt(s.charges,p),g=numericalGradient(s,p),t={x:-g.y,y:g.x};
      assert.ok((e.x*g.x+e.y*g.y)<0);
      assert.ok(Math.abs(e.x*t.x+e.y*t.y)/(norm(e)*norm(t))<1e-7);
    }
  });
  test(`${preset}: continuous trajectories follow true E, decrease V, remain finite and stop before singularities`,()=>{
    const s=state(preset),v=viewport(390,360,s,2),paths=fieldLinePaths(s,v,{adaptive:true});
    assert.ok(paths.length>=6);assert.equal(fieldLinePaths(s,v,{adaptive:true}),paths,'unchanged geometry cached');
    for(const path of paths)for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],delta={x:b.world.x-a.world.x,y:b.world.y-a.world.y};
      assert.ok(Number.isFinite(b.world.x)&&Number.isFinite(b.e.y));
      const alignment=(a.e.x*delta.x+a.e.y*delta.y)/(norm(a.e)*norm(delta));
      assert.ok(Math.abs(alignment)>.99,`trajectory tangent alignment ${alignment}`);
      const dv=potentialAt(s.charges,b.world)-potentialAt(s.charges,a.world);
      assert.ok(dv*alignment<=0,'V decreases along physical E');
      assert.ok(s.charges.every(c=>Math.hypot(c.x-b.world.x,c.y-b.world.y)*v.scale>=14-1e-9));
    }
  });
}

test('independent radial and dipole directions, superposition, zero midpoint and singular exclusions',()=>{
  for(const sign of [-1,1]){const s=state(sign>0?'positive':'negative'),e=fieldAt(s.charges,{x:.2,y:0});close(e.x,sign*K*2e-6/.2**2,1e-8);close(e.y,0);}
  const dipole=state('opposite');assert.ok(fieldAt(dipole.charges,{x:0,y:0}).x>0);
  const s=state('triangle'),p={x:.19,y:.16};let x=0,y=0;
  for(const c of s.charges){const dx=p.x-c.x,dy=p.y-c.y,r=Math.hypot(dx,dy);x+=8.987551792261171e9*c.q*dx/r**3;y+=8.987551792261171e9*c.q*dy/r**3;}
  const e=fieldAt(s.charges,p);close(e.x,x,1e-7);close(e.y,y,1e-7);
  const equal=state('equal');assert.equal(norm(fieldAt(equal.charges,{x:0,y:0})),0);
  assert.equal(validProbePosition(s,s.charges[0]),false);
  assert.throws(()=>fieldAt(s.charges,s.charges[0]),RangeError);
  for(const path of fieldLinePaths(equal,viewport(390,360,equal,2),{adaptive:true}))assert.ok(path.every(p=>Math.hypot(p.world.x,p.world.y)>1e-8));
});

test('rendered contour chord tangents agree with E away from sources and nulls (8 px sampling)',()=>{
  const errors=[];
  for(const key of ['equal','opposite','unequal','triangle','square']){
    const s=state(key),v=viewport(390,360,s,2);
    for(const level of contourGeometry(s,v).levels)for(const edge of level.segments){
      const p=v.toWorld({x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2});
      if(s.charges.some(c=>Math.hypot(p.x-c.x,p.y-c.y)*v.scale<40))continue;
      const e=fieldAt(s.charges,p),g=numericalGradient(s,p),t={x:edge.b.x-edge.a.x,y:edge.a.y-edge.b.y};
      if(norm(e)<1e4||norm(t)<.01)continue;
      errors.push(Math.abs(e.x*t.x+e.y*t.y)/(norm(e)*norm(t)));
      assert.ok(Math.abs(e.x*(-g.y)+e.y*g.x)/(norm(e)*norm(g))<1e-7);
    }
  }
  errors.sort((a,b)=>a-b);assert.ok(errors.length>500);
  // A chord is not an exact tangent; 95% must be within 0.02 (~1.15°).
  assert.ok(errors[Math.floor(errors.length*.95)]<.02);assert.ok(errors.at(-1)<.08);
});

function intersects(a,b,c,d){
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  return cross(a,b,c)*cross(a,b,d)<-1e-20&&cross(c,d,a)*cross(c,d,b)<-1e-20;
}
for(const key of ['positive','negative','equal','opposite','unequal','triangle','square'])test(`${key}: no proper crossings between rendered trajectories`,()=>{
  const s=state(key),paths=fieldLinePaths(s,viewport(390,360,s,2),{adaptive:true});let crossings=0;
  for(let i=0;i<paths.length;i++)for(let j=0;j<i;j++)for(let a=1;a<paths[i].length;a++)for(let b=1;b<paths[j].length;b++)if(intersects(paths[i][a-1].world,paths[i][a].world,paths[j][b-1].world,paths[j][b].world))crossings++;
  assert.equal(crossings,0);
});

test('default plates: 200 V / 0.020 m, direction, gradient, voltage and distance scaling',()=>{
  const c=plateDefaults(),m=plateModel(c);close(m.strength,10000);close(m.field.x,0);close(m.field.y,-10000);
  close(m.potential({x:0,y:.01}),200);close(m.potential({x:0,y:-.01}),0);
  close((m.potential({x:0,y:.001})-m.potential({x:0,y:-.001}))/.002,10000);
  close(plateModel({...c,d:.04}).strength,5000);close(plateModel({...c,voltage:400}).strength,20000);
  const reversed=plateModel({...c,reversed:true});close(reversed.field.y,10000);close(reversed.potential({x:0,y:-.01}),200);
});

for(const orientation of ['horizontal','vertical'])for(const reversed of [false,true]){
  test(`plates ${orientation}, reversed=${reversed}: equal spacing and perpendicular geometry`,()=>{
    const s=plates();updatePlates(s,{orientation,reversed});const v=viewport(390,360,s,2),m=plateModel(s.plates),levels=contourLevels(s);
    const geometry=contourGeometry(s,v);assert.equal(geometry.levels.length,5);
    const axis=orientation==='horizontal'?'y':'x',positions=levels.map(l=>m.atLevel(l)[axis]);
    for(let i=1;i<positions.length;i++)close(Math.abs(positions[i]-positions[i-1]),.005);
    for(const row of geometry.levels)for(const edge of row.segments){
      const t={x:edge.b.x-edge.a.x,y:edge.a.y-edge.b.y};close(t.x*m.field.x+t.y*m.field.y,0,1e-7);
      close(actualPotential(s,v.toWorld(edge.a)),row.level,1e-10);
    }
  });
}

test('0.005 m along E: −50 V, −1e−7 J energy and +1e−7 J field work',()=>{
  const s=plates();s.probe={x:0,y:.005};s.b={x:0,y:0};const c=potentialComparison(s);
  close(c.dv,-50);close(c.du,-1e-7,1e-20);close(c.work,1e-7,1e-20);close(energyChange(2e-9,-50),-1e-7,1e-20);
});

for(const orientation of ['horizontal','vertical'])test(`plates ${orientation}: snap, slide, same potential, independent detach and reattach`,()=>{
  const s=plates();updatePlates(s,{orientation});const v=viewport(390,360,s,2),m=plateModel(s.plates);setSnapping(s,true);
  assert.ok(movePotentialProbe(s,'probe',m.atLevel(150,-.012),v));assert.ok(s.attachments.probe);close(actualPotential(s,s.probe),150);
  s.b=m.atLevel(50,-.012); // Same tangential coordinate still finds a DISTINCT match.
  assert.ok(samePotential(s,v).ok);let c=potentialComparison(s);assert.equal(c.equal,true);assert.deepEqual(c.display,{dv:0,du:0,work:0});
  const saved={...s.probe};for(let i=0;i<8;i++){const target=m.atLevel(150,.012-i*.002);assert.ok(movePotentialProbe(s,'b',target,v));assert.equal(potentialComparison(s).equal,true);}
  assert.deepEqual(s.probe,saved);releaseProbe(s,'b');assert.ok(s.attachments.probe);assert.equal(s.attachments.b,null);assert.equal(potentialComparison(s).equal,false);
  movePotentialProbe(s,'b',m.atLevel(10,.012),v);movePotentialProbe(s,'b',m.atLevel(50,.012),v);assert.ok(s.attachments.b);close(actualPotential(s,s.b),50);
  setSnapping(s,false);movePotentialProbe(s,'b',m.atLevel(73,.009),v);close(actualPotential(s,s.b),73);assert.equal(s.attachments.probe,null);
});

test('mode states, bounds, invalid settings, source cache invalidation and stale plate associations',()=>{
  const s=state('square'),models=createPotentialModels(s,initializeSnapping),p=models.plates;
  assert.ok(samePotential(s,viewport(390,360,s,2)).ok);const original=structuredClone(s);
  assert.ok(samePotential(p,viewport(390,360,p,2)).ok);const old=fieldLinePaths(s,viewport(390,360,s,2),{adaptive:true});
  updatePlates(p,{voltage:400,d:.04});assert.equal(potentialComparison(p).equal,false);reconcileAttachments(p,viewport(390,360,p,2));
  assert.deepEqual(models.point,original);assert.notEqual(p.attachments,s.attachments);
  assert.equal(validProbePosition(p,{x:.1,y:0}),false);assert.throws(()=>actualPotential(p,{x:.1,y:0}),/outside/);
  assert.throws(()=>plateModel({...plateDefaults(),d:0}),RangeError);assert.throws(()=>plateModel({...plateDefaults(),voltage:NaN}),RangeError);
  s.charges[0].q*=-1;assert.notEqual(fieldLinePaths(s,viewport(390,360,s,2),{adaptive:true}),old);
});
