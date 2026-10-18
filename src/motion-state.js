import {magneticZ} from './lorentz.js';
import {G,motionGeometry,motionForces,motionAt,validateMotion,finite} from './physics.js';

export const PARTICLE_RADIUS=9; // CSS pixels; shared drawing / full-visibility rule.
export const terminalMotion=m=>['Plate impact','Canvas exit','Stationary','Time limit'].includes(m.status);
export function resetMotionClock(s,message=''){
  delete s.motion.fieldHistory;s.time=0;s.playing=false;s.motionResult=null;s.completion=null;s.motionNotice=message;s.playbackStatus='Ready';
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
    const vx=e.y/bz,vy=-e.x/bz;
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
export function selectBalancingForce(c,mode,{initialize=false}={}){
  c.balanceMode=mode;c.gravity=mode==='gravity';delete c.externalX;delete c.externalY;
  if(initialize){
    if(mode==='magnetic'){
      const E=Math.hypot(motionGeometry(c).field.x,motionGeometry(c).field.y);
      if(c.B===0||E/c.B>1e9)c.B=.2;
      if(c.q===0){const e=motionGeometry(c).field,bz=magneticZ(c);c.vx=e.y/bz;c.vy=-e.x/bz;return;}
    }
    rebalanceMotion(c);
  }
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
  const previousB=c.B;
  if(equilibrium){
    if(orientation==='vertical')selectBalancingForce(c,'magnetic',{initialize:true});
    else selectBalancingForce(c,'gravity');
  }restoreMotionStart(c);
  return equilibrium?(orientation==='vertical'?`Vertical plates selected Magnetic automatically; initial velocity set to E × B / B².${previousB!==c.B?' B set to 0.20 T because the previous field could not support a balancing speed in range.':''}${c.q===0?' Zero charge remains a trivial zero-force case.':''}`:'Horizontal plates selected Gravity. Use Balance Forces to adjust voltage explicitly.'):'Orientation adapted. Gravity remains downward.';
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
