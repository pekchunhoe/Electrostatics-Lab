// SI units throughout. Ordinary 3D point-charge laws sampled in an x-y plane.
export const EPSILON_0 = 8.8541878128e-12;
export const K = 1 / (4 * Math.PI * EPSILON_0);
export const G = 9.81;
export const SINGULAR_DISTANCE = 1e-9; // Reject, never soften, singularities.
export const magnitude = v => Math.hypot(v.x, v.y);
export const direction = v => magnitude(v) === 0 ? null : Math.atan2(v.y, v.x) * 180 / Math.PI;
export function finite(...xs) { if (xs.some(x => !Number.isFinite(x))) throw new RangeError('Enter finite numerical values.'); }
export function validateCharges(charges, max = 4) {
  if (charges.length > max) throw new RangeError(`Use at most ${max} point charges.`);
  charges.forEach(c => finite(c.x,c.y,c.q));
  for(let i=0;i<charges.length;i++) for(let j=0;j<i;j++) separation(charges[i],charges[j]);
}
export function separation(a,b) {
  finite(a.x,a.y,b.x,b.y);
  const r = Math.hypot(a.x-b.x,a.y-b.y);
  if(r < SINGULAR_DISTANCE) throw new RangeError('Undefined at a point charge. Move the probe or separate coincident charges. No force softening is used.');
  return r;
}
export function fieldAt(charges,p) {
  validateCharges(charges); finite(p.x,p.y);
  let x=0,y=0;
  const contributions=charges.map(c=>{
    if(c.q===0) return {id:c.id,x:0,y:0,r:Math.hypot(p.x-c.x,p.y-c.y)};
    const r=separation(p,c), f=K*c.q/r**3;
    const v={id:c.id,x:f*(p.x-c.x),y:f*(p.y-c.y),r}; x+=v.x;y+=v.y;return v;
  });
  finite(x,y);return {x,y,contributions};
}
export function forceOn(charges,id) {
  validateCharges(charges);
  const target=charges.find(c=>c.id===id);
  if(!target) throw new RangeError('Select a target charge.');
  const e=fieldAt(charges.filter(c=>c.id!==id),target);
  const x=e.x*target.q,y=e.y*target.q;finite(x,y);
  return {x,y,contributions:e.contributions.map(v=>({...v,x:v.x*target.q,y:v.y*target.q}))};
}
export function potentialAt(charges,p) {
  validateCharges(charges);finite(p.x,p.y);
  const v=charges.reduce((v,c)=>v+(c.q===0?0:K*c.q/separation(c,p)),0);finite(v);return v;
}
// Validated immutable snapshot for dense rendering samples. Same SI inverse-square
// law; omit the per-source contribution arrays needed only by live calculations.
export function createSampler(charges){
  validateCharges(charges);const sources=charges.filter(c=>c.q!==0).map(c=>({...c}));
  return {
    field(p){finite(p.x,p.y);let x=0,y=0;for(const c of sources){const dx=p.x-c.x,dy=p.y-c.y,r=Math.hypot(dx,dy);if(r<SINGULAR_DISTANCE)throw new RangeError('Undefined at a point charge.');const a=K*c.q/r**3;x+=a*dx;y+=a*dy;}finite(x,y);return{x,y};},
    potential(p){finite(p.x,p.y);let v=0;for(const c of sources){const r=Math.hypot(p.x-c.x,p.y-c.y);if(r<SINGULAR_DISTANCE)throw new RangeError('Undefined at a point charge.');v+=K*c.q/r;}finite(v);return v;}
  };
}
export function systemEnergy(charges) {
  validateCharges(charges,3);let u=0;
  for(let i=0;i<charges.length;i++) for(let j=0;j<i;j++) u+=K*charges[i].q*charges[j].q/separation(charges[i],charges[j]);
  finite(u);return u;
}
export function energyChange(q,deltaV) {finite(q,deltaV);const u=q*deltaV;finite(u);return u;}
// signedVoltage = V_bottom - V_top. +y is upward, so Ey = signedVoltage/d.
export function uniformField(voltage,d) {finite(voltage,d);if(d<=0) throw new RangeError('Plate separation must be positive.');const e=voltage/d;finite(e);return e;}
export function kinematics(r0,v0,a,t) {
  finite(r0.x,r0.y,v0.x,v0.y,a.x,a.y,t);if(t<0)throw new RangeError('Time must be non-negative.');
  return {x:r0.x+v0.x*t+a.x*t*t/2,y:r0.y+v0.y*t+a.y*t*t/2,vx:v0.x+a.x*t,vy:v0.y+a.y*t};
}
export function validateMotion(c) {
  finite(c.q,c.mass,c.voltage,c.d,c.x0,c.y0,c.vx,c.vy);
  if(c.mass<=0)throw new RangeError('Mass must be greater than zero.');
  uniformField(c.voltage,c.d);
  if(Math.abs(c.y0)>=c.d/2 && Math.abs(c.x0)<=.15)throw new RangeError('Initial position must lie between the plates.');
}
export function rootsForPosition(p,v,a,target) {
  if(Math.abs(a)<1e-14)return Math.abs(v)<1e-14?[]:[(target-p)/v];
  const disc=v*v+2*a*(target-p);
  if(disc<0)return [];
  const s=Math.sqrt(disc), h=-.5*(v+(v>=0?s:-s));
  return h===0?[0]:[2*h/a,(p-target)/h];
}
// Exact constant-acceleration segments with event times for plate impacts / horizontal exit.
// x velocity is constant. A particle outside the plate region experiences gravity only.
export function motionAt(c,t) {
  validateMotion(c);finite(t);if(t<0)throw new RangeError('Time must be non-negative.');
  let p={x:c.x0,y:c.y0,vx:c.vx,vy:c.vy},elapsed=0,status='In field',events=[];
  const gravity=c.gravity?-G:0;
  // Sum forces first. Cancel only residuals within four machine epsilons of
  // the larger force (floating-point roundoff, not a physical force cutoff).
  const acceleration=ey=>{
    const electric=c.q*ey,weight=c.mass*gravity;finite(electric,weight);
    const net=electric+weight;finite(net);
    return Math.abs(net)<=4*Number.EPSILON*Math.max(Math.abs(electric),Math.abs(weight))?0:net/c.mass;
  };
  let horizontalInside=Math.abs(p.x)<.15 || (Math.abs(p.x)===.15 && p.x*p.vx<0);
  let inside=horizontalInside&&Math.abs(p.y)<c.d/2;
  for(let i=0;i<5;i++) {
    const ay=acceleration(inside?uniformField(c.voltage,c.d):0);
    let dt=t-elapsed,type=null;
    const boundary=horizontalInside?(p.vx>0?.15:-.15):(p.x<-.15?-.15:.15);
    const crossing=p.vx===0?Infinity:(boundary-p.x)/p.vx;
    if(crossing>1e-12 && crossing<=dt){dt=crossing;type='edge';}
    if(horizontalInside)for(const wall of [-c.d/2,c.d/2])for(const root of rootsForPosition(p.y,p.vy,ay,wall)){
      if(root>1e-12 && root<=dt){dt=root;type='impact';}
    }
    const next=kinematics(p,{x:p.vx,y:p.vy},{x:0,y:ay},dt);elapsed+=dt;p=next;
    if(type==='impact')return {...p,vx:0,vy:0,impactVx:p.vx,impactVy:p.vy,ay:0,ey:0,time:elapsed,status:'Plate impact',events:[...events,{time:elapsed,type}]};
    if(type==='edge'){
      horizontalInside=!horizontalInside;inside=horizontalInside&&Math.abs(p.y)<c.d/2;
      if(horizontalInside&&Math.abs(Math.abs(p.y)-c.d/2)<1e-12)return {...p,vx:0,vy:0,impactVx:p.vx,impactVy:p.vy,ay:0,ey:0,time:elapsed,status:'Plate impact',events:[...events,{time:elapsed,type:'impact'}]};
      status=inside?'In field':'Outside field';events.push({time:elapsed,type:'edge'});if(elapsed<t-1e-12)continue;
    }
    const ey=inside?uniformField(c.voltage,c.d):0;
    finite(p.x,p.y,p.vx,p.vy,ey,acceleration(ey));
    return {...p,ay:acceleration(ey),ey,time:t,status:inside?'In field':'Outside field',events};
  }
  throw new Error('Motion event limit exceeded.');
}
