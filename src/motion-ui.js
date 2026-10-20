import {motionCalculations} from './motion-math.js';
import {notation as math,patchHTML,plainQuantity} from './math.js';
import {motionGeometry,magnitude,motionForces} from './physics.js';

function legacyLegend(s){return `<span>+ / − plate</span><span class="result">→ electric force</span>${s.motion.gravity?'<span>→ gravity</span>':''}${s.motion.externalX||s.motion.externalY?'<span>→ external force</span>':''}<span class="purple">→ v</span><span class="motion-acceleration-key">⇢ a (net)</span><span>⋯ trajectory</span>`;}
export function syncMotionControls(s){
  const c=s.motion,g=motionGeometry(c),v=g.local({x:c.vx,y:c.vy});
  for(const [key,value] of Object.entries({L:c.L,x0:c.x0,y0:c.y0,vx:c.vx,vy:c.vy,q:c.q*1e9,mass:c.mass*1e6,externalX:(c.externalX??0)*1e6,externalY:(c.externalY??0)*1e6,B:c.B??0,speed:Math.hypot(c.vx,c.vy),'entry-speed':s.experiment==='parallel'?v.n:v.u})){
    const el=document.getElementById('m-'+key);if(el&&document.activeElement!==el)el.value=Number(value.toPrecision(10));
  }
  const slider=document.getElementById('magnetic-strength');if(slider)slider.value=c.B;
  const output=document.getElementById('magnetic-strength-output');if(output)output.textContent=plainQuantity(c.B,'T',6);
  const step=document.getElementById('step');if(step&&c.balanceMode==='magnetic'){const dt=Math.min(.01,.015*c.L/Math.max(Math.hypot(c.vx,c.vy),1e-30));step.textContent='Step +'+Number(dt.toPrecision(3))+' s';}
  const launch=document.getElementById('motion-launch-direction');if(launch)launch.textContent='Initial motion: '+(c.vx===0&&c.vy===0?'stationary':Math.abs(c.vx)>=Math.abs(c.vy)?c.vx>0?'rightward':'leftward':c.vy>0?'upward':'downward')+'.';
  const rate=document.getElementById('motion-clock-scale');if(rate)rate.textContent='Playback 1×: '+Number(Math.min(.1,.15*c.L/Math.max(Math.hypot(c.vx,c.vy),1e-30)).toPrecision(3))+' simulated s per real s.';
  const direction=document.getElementById('magnetic-direction');if(direction)direction.textContent=c.bDirection<0?'Into Page (×)':'Out of Page (•)';
  document.getElementById('motion-length').value=c.L;document.getElementById('motion-length-output').textContent=c.L.toFixed(3)+' m';
  document.getElementById('zoom').value=s.zoom;document.getElementById('zoom-output').textContent=s.zoom.toFixed(1)+'×';
}
export function motionPlateControls(s,num){
  const c=s.motion;
  return `<div class="motion-plates"><div class="motion-orientation"><label class="select-label" for="motion-orientation">Plate Orientation<select id="motion-orientation"><option value="horizontal" ${c.orientation!=='vertical'?'selected':''}>Horizontal</option><option value="vertical" ${c.orientation==='vertical'?'selected':''}>Vertical</option></select></label><button id="motion-reverse">Reverse Polarity</button></div><div class="number-grid">${num('m-voltage',c.orientation==='vertical'?'Vleft − Vright (V)':'Vbottom − Vtop (V)',c.voltage,-2000,2000)}${num('m-d','Separation d (m)',c.d,.005,.2)}</div><label class="range-label" for="motion-length">Plate Length, L <output id="motion-length-output">${c.L.toFixed(3)} m</output><input id="motion-length" type="range" min=".1" max=".6" step=".01" value="${c.L}" aria-label="Plate Length, L"></label></div>`;
}
function legacySettings(s,num){
  const c=s.motion,g=motionGeometry(c),v=g.local({x:c.vx,y:c.vy}),parallel=s.experiment==='parallel';
  const rounded=(id,label,value,...limits)=>num(id,label,Number(value.toPrecision(12)),...limits);
  return `<div class="number-grid">${rounded('m-q','Particle q (nC)',c.q*1e9,-100,100)}${rounded('m-mass','Mass (mg)',c.mass*1e6,.001,1000)}${rounded('m-entry-speed',parallel?'Initial normal speed (m/s)':'Entry Speed ⟂ E (m/s)',parallel?v.n:v.u,-10,10)}${num('m-L','Plate Length L (m)',c.L,.1,.6,.01)}${num('m-x0','Initial x (m)',c.x0,-.5,.5)}${num('m-y0','Initial y (m)',c.y0,-.5,.5)}${num('m-vx','Initial vₓ (m/s)',c.vx,-10,10)}${num('m-vy','Initial vᵧ (m/s)',c.vy,-10,10)}</div><label class="check"><input id="gravity" type="checkbox" ${c.gravity?'checked':''}>Include gravity (downward, 9.81 m/s²)</label><details id="motion-advanced"><summary>External force & time limit</summary><div class="number-grid">${rounded('m-externalX','External Fₓ (μN)',c.externalX*1e6,-1e6,1e6)}${rounded('m-externalY','External Fᵧ (μN)',c.externalY*1e6,-1e6,1e6)}${num('motion-limit','Time limit (s)',s.timeLimit,1,3600)}</div><p class="small">External force is constant in world coordinates, inside and outside the plates. The time limit pauses very slow motion without claiming a physical exit.</p></details><button id="motion-rebalance">Rebalance Forces</button><p class="small">Rebalance explicitly sets a constant external force opposite the enabled electric force and weight. A horizontal electric force cannot balance vertical weight. Geometry, polarity and particle edits pause and reset the clock. Orientation rotates initial position and velocity. Dynamic Equilibrium offers gravitational or magnetic balancing.</p>`;
}
export function motionStatusMarkup(){return `<div id="motion-status" class="motion-status" role="status" aria-live="polite"><div id="motion-event"></div><p id="motion-final" class="small"></p><button id="motion-replay" hidden>Replay</button></div>`;}
export function updateMotionStatus(s,m,fmt){
  const panel=document.getElementById('motion-status');if(!panel)return;
  const messages={'Canvas exit':'Particle exited the simulation area','Plate impact':'Particle hit the plate','Stationary':'Particle remains stationary','Time limit':'Simulation time limit reached'};
  const event=document.getElementById('motion-event');event.textContent=messages[m.status]??`${s.playing?'Playing':s.time===0?'Ready':'Paused'} · ${m.status}`;
  const equilibrium=document.getElementById('equilibrium-status');if(equilibrium){const state=equilibriumState(s.motion,m);equilibrium.textContent=state.text;equilibrium.dataset.balanced=String(state.balanced);}
  const legend=document.querySelector('.workspace .legend');if(legend)patchHTML(legend,motionLegend(s));
  panel.dataset.status=m.status;panel.dataset.time=String(s.time);panel.dataset.playing=String(s.playing);
  for(const key of ['x','y','vx','vy','ax','ay','ex','ey'])panel.dataset[key]=String(m[key]);
  if(m.forces){for(const [name,vector] of Object.entries({fe:m.forces.electric,fb:m.forces.magnetic,net:m.forces.net})){panel.dataset[name+'X']=String(vector.x);panel.dataset[name+'Y']=String(vector.y);}}
  const final=document.getElementById('motion-final');
  final.textContent=s.completion?`Final time ${fmt(m.time,'s')} · v = ${fmt(Math.hypot(m.vx,m.vy),'m/s')} · a = ${fmt(Math.hypot(m.ax,m.ay),'m/s²')}${m.status==='Plate impact'?` · ${m.plate} plate; speed before contact ${fmt(Math.hypot(m.impactVx,m.impactVy),'m/s')}`:''}${m.status==='Time limit'?'. Moving particle paused at the configured time limit.':''}`:s.motionNotice??'';
  document.getElementById('motion-replay').hidden=!s.completion;
  document.getElementById('play').textContent=s.playing?'Ⅱ Pause':'▶ Play';
}
export function motionLegend(s){
  if(!s.motion.balanceMode)return legacyLegend(s);
  const c=s.motion;
  return `<span>+ / − plate</span><span class="result">→ electric force</span><span>${c.balanceMode==='gravity'?'→ weight '+math(String.raw`\vec F_g`):'→ magnetic force '+math(String.raw`\vec F_B`)}</span>${c.balanceMode==='magnetic'?`<span class="magnetic-key">${c.bDirection<0?'× Into page':'• Out of page'} · B = ${plainQuantity(c.B,'T',5)}${c.B===0?' (zero field)':''}</span>`:''}<span class="purple">→ v</span><span class="motion-acceleration-key">⇢ a (net)</span><span>⋯ trajectory</span>`;
}
export function balancingControls(s,num){
  const c=s.motion;if(!c.balanceMode)return '';
  return `<div class="balancing-controls"><label class="select-label" for="balancing-force">Balancing Force<select id="balancing-force"><option value="gravity" ${c.balanceMode==='gravity'?'selected':''}>Gravity (weight)</option><option value="magnetic" ${c.balanceMode==='magnetic'?'selected':''}>Magnetic (Lorentz force)</option></select></label><p id="equilibrium-status" class="small" role="status"></p>${c.balanceMode==='magnetic'?`<details id="magnetic-settings" open><summary>Magnetic field · advanced extension</summary><label class="range-label" for="magnetic-strength">Magnetic Field Strength, B <output id="magnetic-strength-output">${plainQuantity(c.B,'T',6)}</output><input id="magnetic-strength" type="range" min="0" max="2" step="any" value="${c.B}" aria-label="Magnetic Field Strength slider (T)"></label><div class="number-grid">${num('m-B','Magnetic Field Strength, B (T)',c.B,0,2)}${num('m-speed','Particle Speed, v (m/s)',Math.hypot(c.vx,c.vy),c.orientation==='vertical'?0:1e-12,1e9)}</div><p id="motion-launch-direction" class="small"></p><p id="motion-clock-scale" class="small"></p><p id="magnetic-direction" class="small">${c.bDirection<0?'Into Page (×)':'Out of Page (•)'}</p><button id="magnetic-reverse">Reverse Magnetic Field</button><button id="motion-rebalance">Balance with Magnetic Force</button>${c.orientation!=='vertical'?'<button id="magnetic-match-direction">Match B to Rightward Launch</button>':''}<p class="small">B changes apply at the current instant, preserving position, velocity, elapsed time and past trajectory. Balance explicitly sets initial velocity and resets time. Magnetic force alone does no work. Gravity is neglected.</p></details>`:`<button id="motion-rebalance">Balance Forces (adjust voltage)</button><p class="small">Electric force + weight only. Balance explicitly adjusts plate voltage; it is unavailable with vertical plates.</p>`}</div>`;
}
export function motionSettings(s,num){
  if(!s.motion.balanceMode)return legacySettings(s,num);
  const c=s.motion;
  return `<div class="number-grid">${num('m-q','Particle q (nC)',c.q*1e9,-10000,10000)}${num('m-mass','Mass (mg)',c.mass*1e6,1e-7,1000)}${num('m-x0','Initial x (m)',c.x0,-.5,.5)}${num('m-y0','Initial y (m)',c.y0,-.5,.5)}${num('m-vx','Initial vₓ (m/s)',c.vx,c.balanceMode==='magnetic'&&c.orientation!=='vertical'?1e-12:-1e9,1e9)}${c.balanceMode==='magnetic'&&c.orientation!=='vertical'?num('m-vy','Initial vᵧ (m/s), fixed 0',0,0,0).replace('<input ','<input readonly '):num('m-vy','Initial vᵧ (m/s)',c.vy,-1e9,1e9)}</div><details id="motion-advanced"><summary>Simulation time limit</summary>${num('motion-limit','Time limit (s)',s.timeLimit,1,3600)}<p class="small">Circular motion may remain visible indefinitely. This safeguard is separate from physical canvas exit.</p></details>`;
}
export function equilibriumState(c,m){
  const f=m.forces??motionForces(c,m.ex!==0||m.ey!==0,{x:m.vx,y:m.vy});
  // The solver already handles force-summation roundoff. Do not apply a wider
  // presentation tolerance that calls a real nonzero acceleration balanced.
  const zero=m.ax===0&&m.ay===0;
  if(m.status==='Plate impact')return {balanced:false,text:'Plate contact — the two-force flight model has stopped.'};
  if(c.balanceMode==='magnetic'&&c.q===0)return {balanced:false,text:'Zero charge — zero Lorentz force; this is not electric–magnetic force balancing.'};
  if(c.balanceMode==='gravity'&&c.orientation==='vertical'&&magnitude(f.electric)>0)return {balanced:false,text:'Not in equilibrium — electric force and gravity are perpendicular.'};
  if(c.balanceMode==='magnetic'&&c.B===0&&magnitude(f.electric)>0)return {balanced:false,text:'Magnetic balancing unavailable when B = 0. Unbalanced — Particle Accelerating.'};
  if(zero)return {balanced:true,text:Math.hypot(m.vx,m.vy)>0?c.balanceMode==='magnetic'?'Balanced — Constant Velocity':'Balanced — Dynamic Equilibrium':'Balanced — Stationary Equilibrium'};
  return {balanced:false,text:c.balanceMode==='magnetic'?'Unbalanced — Particle Accelerating. '+(magnitude(f.field)>0?'Magnetic and electric forces do not cancel.':'Magnetic force changes the velocity direction.'):'Unbalanced — Net Force Nonzero.'};
}
export function motionWorking(s,m,fmt){
  const f=m.forces??motionForces(s.motion,m.ex!==0||m.ey!==0,{x:m.vx,y:m.vy});
  return motionCalculations(s,m,equilibriumState(s.motion,m),s.motion.balanceMode==='magnetic'?motionComponents(s,m,f,fmt):'');
}

function motionComponents(s,m,f,fmt){
  const rows=[['fe','Electric force '+math(String.raw`\vec F_E`),f.electric,'N'],['fb','Magnetic force '+math(String.raw`\vec F_B`),f.magnetic,'N'],['net','Resultant '+math(String.raw`\vec F_{\mathrm{net}}`),f.net,'N'],['acceleration','Acceleration a',{x:m.ax,y:m.ay},'m/s²'],['velocity','Velocity v',{x:m.vx,y:m.vy},'m/s']];
  return `<details id="motion-components" ${s.motionComponentsOpen?'open':''}><summary>Live force and motion components</summary><p class="small">Current world components: +x right, +y up. These values and the vectors use the same instantaneous particle state.</p><dl class="field-values">${rows.map(([key,label,v,unit])=>`<div><dt>${label}, x</dt><dd data-motion-value="${key}-x" data-value="${v.x}">${fmt(v.x,unit)}</dd></div><div><dt>${label}, y</dt><dd data-motion-value="${key}-y" data-value="${v.y}">${fmt(v.y,unit)}</dd></div><div><dt>|${label}|</dt><dd data-motion-value="${key}-magnitude" data-value="${Math.hypot(v.x,v.y)}">${fmt(Math.hypot(v.x,v.y),unit)}</dd></div>`).join('')}</dl></details>`;
}
