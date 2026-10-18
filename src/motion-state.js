import {magneticZ} from './lorentz.js';
import {G,motionGeometry,motionForces,motionAt,validateMotion,finite} from './physics.js';

export const PARTICLE_RADIUS=9; // CSS pixels; shared drawing / full-visibility rule.
export const terminalMotion=m=>['Plate impact','Canvas exit','Stationary','Time limit'].includes(m.status);
export function resetMotionClock(s,message=''){
  normalizeMagneticLaunch(s.motion);delete s.motion.fieldHistory;s.time=0;s.playing=false;s.motionResult=null;s.completion=null;s.motionNotice=message;s.playbackStatus='Ready';
}
export function restoreMotionStart(c){
  const g=motionGeometry(c),p=g.local({x:c.x0,y:c.y0});
  if(Math.abs(p.u)<=g.L/2&&Math.abs(p.n)>=c.d/2){const q=g.world(p.u,Math.sign(p.n)*c.d*.4);c.x0=q.x;c.y0=q.y;}
  validateMotion(c);
}
export function rebalanceMotion(c){
  if(c.balanceMode==='magnetic'){
    if(c.B===0)throw new RangeError('Magnetic balancing unavailable when B = 0.');
    if(c.q===0)throw new RangeError('Choose a nonzero charge to demonstrate force balancing.');
    const e=motionGeometry(c).field,bz=magneticZ(c);
    if(c.orientation!=='vertical'&&e.x===0&&e.y===0)throw new RangeError('No positive rightward speed balances a nonzero B when E = 0. Set a nonzero electric field explicitly.');
    const vx=e.y/bz,vy=-e.x/bz;
    if(c.orientation!=='vertical'&&vx<0)throw new RangeError('This magnetic direction cannot balance a rightward launch. Use Match B to Rightward Launch to reverse B explicitly.');
    if(!Number.isFinite(vx)||!Number.isFinite(vy)||Math.hypot(vx,vy)>1e9)throw new RangeError('Required balancing speed exceeds the supported 1e9 m/s range. Increase B explicitly.');
    c.vx=vx;c.vy=vy;
    return 'Initial velocity explicitly set to E × B / B². B, direction and plate settings preserved.';
  }
  if(c.balanceMode==='gravity'){
    if(c.orientation==='vertical')throw new RangeError('Not in equilibrium — electric force and gravity are perpendicular.');
    if(c.q===0)throw new RangeError('Choose a nonzero charge to balance weight.');
    const voltage=c.mass*G*c.d/c.q;
    if(!Number.isFinite(voltage)||Math.abs(voltage)>2000)throw new RangeError('Required balancing voltage exceeds ±2000 V. Change mass, charge or separation explicitly.');
    c.voltage=voltage;
    return 'Plate voltage explicitly set to mgd/q to balance weight.';
  }
  c.externalX=0;c.externalY=0;const f=motionForces(c,true);
  c.externalX=-(f.electric.x+f.gravity.x);c.externalY=-(f.electric.y+f.gravity.y);
  return 'External force explicitly set to balance the electric force and weight.';
}
export function normalizeMagneticLaunch(c){
  if(c.balanceMode==='magnetic'&&c.orientation!=='vertical'&&c.rightwardLaunch){
    const speed=Math.hypot(c.vx,c.vy);c.vx=speed>0?speed:500;c.vy=0;
  }
}
export function setMagneticSpeed(c,speed){
  finite(speed);
  if(speed<0||(c.orientation!=='vertical'&&speed===0))throw new RangeError('Horizontal magnetic launches require a positive rightward speed.');
  if(c.orientation!=='vertical'){c.vx=speed;c.vy=0;return;}
  const sign=Math.sign(c.vy)||-Math.sign(c.voltage||1)*(c.bDirection??-1);
  c.vx=0;c.vy=sign*speed;
}
export function matchRightwardField(c){
  if(c.orientation==='vertical')throw new RangeError('This action is for horizontal rightward launches.');
  const e=motionGeometry(c).field;
  if(e.y===0)throw new RangeError('A nonzero electric field is needed for crossed-field balancing.');
  c.bDirection=Math.sign(e.y);
  return 'Magnetic direction explicitly matched to rightward motion. Speed and B magnitude preserved; use Balance to set the required speed.';
}
export function magneticDemo(c){
  Object.assign(c,{q:c.q===0?0:Math.sign(c.q)*1e-9,mass:1e-13,voltage:(c.orientation==='vertical'?1:-1)*100*c.d,B:.2,bDirection:-1,magneticInitialized:true});
  if(c.orientation==='vertical'){c.x0=0;c.y0=-.4*c.L;c.vx=0;c.vy=500;}
  else {c.x0=-.4*c.L;c.y0=0;c.vx=500;c.vy=0;}
  return `Magnetic example: q = ${c.q*1e9} nC, m = 1e−13 kg, |E| = 100 N/C, B = 0.20 T, v₀ = 500 m/s. Parameters set to show physical curvature.`;
}
export function selectBalancingForce(c,mode,{initialize=false,demo=false}={}){
  c.balanceMode=mode;c.gravity=mode==='gravity';delete c.externalX;delete c.externalY;
  if(mode!=='magnetic')return 'Gravity selected; particle and plate parameters preserved.';
  c.rightwardLaunch=true;
  if(demo&&!c.magneticInitialized)return magneticDemo(c);
  c.magneticInitialized=true;normalizeMagneticLaunch(c);
  if(initialize){
    const E=Math.hypot(motionGeometry(c).field.x,motionGeometry(c).field.y),oldB=c.B,oldDirection=c.bDirection;
    if(c.B===0||E/c.B>1e9)c.B=.2;
    if(E===0){const speed=Math.hypot(c.vx,c.vy)||500;if(c.orientation==='vertical'){c.vx=0;c.vy=speed;}else {c.vx=speed;c.vy=0;}return 'Zero electric field: tangent launch preserved; magnetic-only motion is generally curved, not a force balance.';}
    if(c.orientation!=='vertical')c.bDirection=Math.sign(c.voltage);
    const e=motionGeometry(c).field,bz=magneticZ(c);
    if(c.q===0){c.vx=e.y/bz;c.vy=-e.x/bz;normalizeMagneticLaunch(c);}
    else rebalanceMotion(c);
    return `Magnetic orientation preset: tangent launch at E/B.${oldB!==c.B?' B set explicitly to 0.20 T for a supported starting speed.':''}${oldDirection!==c.bDirection?' B direction matched to the rightward launch.':''}`;
  }
  return 'Magnetic selected. Horizontal initial motion is rightward; field polarity, B and speed are preserved. Use Balance explicitly if needed.';
}
export function changeMagneticField(s,changes){
  const c=s.motion;validateMotion({...c,...changes});
  const completed=!!s.completion;if(completed)resetMotionClock(s);
  if(s.time>0){
    c.fieldHistory??=[{time:0,B:c.B,bDirection:c.bDirection}];
    c.fieldHistory=c.fieldHistory.filter(e=>e.time<s.time);
    c.fieldHistory.push({time:s.time,B:changes.B??c.B,bDirection:changes.bDirection??c.bDirection});
  }
  Object.assign(c,changes);s.motionResult=null;
  s.motionNotice=completed?'Completed flight restarted with the selected field. Press Play to start.':'Magnetic field changed at the current simulated instant. Position, velocity and prior trajectory preserved; no automatic balancing.';
}
export function motionClockRate(c){
  return c.balanceMode==='magnetic'?Math.min(.1,.15*c.L/Math.max(Math.hypot(c.vx,c.vy),1e-30)): .1;
}
export function orientMotion(c,orientation,{equilibrium=false}={}){
  const old=motionGeometry(c),position=old.local({x:c.x0,y:c.y0}),velocity=old.local({x:c.vx,y:c.vy});
  c.orientation=orientation;const g=motionGeometry(c),p=g.world(position.u,position.n),v=g.world(velocity.u,velocity.n);
  c.x0=p.x;c.y0=p.y;c.vx=v.x;c.vy=v.y;
  let notice='Orientation adapted. Gravity remains downward.';
  if(equilibrium){
    if(orientation==='vertical')notice=selectBalancingForce(c,'magnetic',{initialize:true,demo:true});
    else if(c.balanceMode==='magnetic'){
      c.x0=-.4*c.L;c.y0=0;notice=selectBalancingForce(c,'magnetic',{initialize:true});
    }else notice='Horizontal plates selected Gravity. Use Balance Forces to adjust voltage explicitly.';
  }
  restoreMotionStart(c);return notice;
}

export function motionCanvasBounds(view,radius=PARTICLE_RADIUS){
  const lower=view.toWorld({x:-radius,y:view.h+radius}),upper=view.toWorld({x:view.w+radius,y:-radius});
  return {minX:lower.x,maxX:upper.x,minY:lower.y,maxY:upper.y};
}
export function advanceMotion(s,target,view){
  finite(target);if(target<s.time)throw new RangeError('The simulation clock cannot run backward.');
  if(s.completion)return s.motionResult;
  const m=motionAt(s.motion,target,{bounds:motionCanvasBounds(view),fromTime:s.time,maxTime:s.timeLimit??30,stopStationary:true});
  s.time=m.time;s.motionResult=m;
  if(terminalMotion(m)){s.playing=false;s.completion=m.status;s.playbackStatus=m.status==='Stationary'?'Stationary':'Completed';}
  else s.playbackStatus=s.playing?'Playing':'Paused';
  return m;
}

// a uses 6 CSS px per m/s², reduced uniformly if its 70 px cap or viewport
// margin requires it. No arbitrary minimum length and no direction at a = 0.
export function accelerationGlyph(m,view){
  const p=view.toScreen(m),mag=Math.hypot(m.ax,m.ay),origin={x:Math.max(12,Math.min(view.w-12,p.x+14)),y:Math.max(34,Math.min(view.h-30,p.y+14))};
  if(mag===0)return {origin,length:0,scale:0,end:{...origin}};
  const dx=m.ax/mag,dy=-m.ay/mag;
  const available=Math.min(dx>0?(view.w-8-origin.x)/dx:dx<0?(8-origin.x)/dx:Infinity,dy>0?(view.h-26-origin.y)/dy:dy<0?(30-origin.y)/dy:Infinity);
  const scale=Math.max(0,Math.min(6,70/mag,available/mag));
  return {origin,scale,length:mag*scale,end:{x:origin.x+m.ax*scale,y:origin.y-m.ay*scale}};
}
