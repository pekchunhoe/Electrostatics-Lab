import {motionGeometry,motionForces,motionAt,validateMotion,finite} from './physics.js';

export const PARTICLE_RADIUS=9; // CSS pixels; shared drawing / full-visibility rule.
export const terminalMotion=m=>['Plate impact','Canvas exit','Stationary','Time limit'].includes(m.status);
export function resetMotionClock(s,message=''){
  s.time=0;s.playing=false;s.motionResult=null;s.completion=null;s.motionNotice=message;s.playbackStatus='Ready';
}
export function restoreMotionStart(c){
  const g=motionGeometry(c),p=g.local({x:c.x0,y:c.y0});
  if(Math.abs(p.u)<=g.L/2&&Math.abs(p.n)>=c.d/2){const q=g.world(p.u,Math.sign(p.n)*c.d*.4);c.x0=q.x;c.y0=q.y;}
  validateMotion(c);
}
export function rebalanceMotion(c){
  c.externalX=0;c.externalY=0;const f=motionForces(c,true);
  c.externalX=-(f.electric.x+f.gravity.x);c.externalY=-(f.electric.y+f.gravity.y);
}
export function orientMotion(c,orientation,{equilibrium=false}={}){
  const old=motionGeometry(c),position=old.local({x:c.x0,y:c.y0}),velocity=old.local({x:c.vx,y:c.vy});
  c.orientation=orientation;const g=motionGeometry(c),p=g.world(position.u,position.n),v=g.world(velocity.u,velocity.n);
  c.x0=p.x;c.y0=p.y;c.vx=v.x;c.vy=v.y;
  if(equilibrium)rebalanceMotion(c);restoreMotionStart(c);
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
