import {magneticZ,magneticMotionAt} from './lorentz.js';
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
// Plate-local tangent u and normal n rotate together; gravity stays in world y.
export function motionGeometry(c){
  const vertical=(c.orientation??'horizontal')==='vertical',L=c.L??.3;
  const tangent=vertical?{x:0,y:-1}:{x:1,y:0},normal=vertical?{x:1,y:0}:{x:0,y:1};
  const local=p=>({u:p.x*tangent.x+p.y*tangent.y,n:p.x*normal.x+p.y*normal.y});
  const world=(u,n)=>({x:tangent.x*u+normal.x*n,y:tangent.y*u+normal.y*n});
  const E=uniformField(c.voltage,c.d);
  return {L,tangent,normal,local,world,field:world(0,E)};
}
export function motionForces(c,inside=true,velocity={x:c.vx,y:c.vy}){
  const field=inside?motionGeometry(c).field:{x:0,y:0};
  const magneticMode=c.balanceMode==='magnetic';
  const electric={x:c.q*field.x,y:c.q*field.y},gravity={x:0,y:(c.balanceMode==='gravity'||(!c.balanceMode&&c.gravity))?-c.mass*G:0};
  const magnetic=magneticMode?{x:c.q*velocity.y*magneticZ(c),y:-c.q*velocity.x*magneticZ(c)}:{x:0,y:0};
  // Legacy external forces remain available only to non-D experiments.
  const external=c.balanceMode?{x:0,y:0}:{x:c.externalX??0,y:c.externalY??0};
  const net={},acceleration={};
  for(const axis of ['x','y']){
    const total=electric[axis]+gravity[axis]+magnetic[axis]+external[axis],scale=Math.max(Math.abs(electric[axis]),Math.abs(gravity[axis]),Math.abs(magnetic[axis]),Math.abs(external[axis]));
    finite(total,scale);
    // Only cancel roundoff from summing forces, never small physical forces.
    net[axis]=Math.abs(total)<=4*Number.EPSILON*scale?0:total;
    acceleration[axis]=net[axis]/c.mass;finite(acceleration[axis]);
  }
  return {field,electric,gravity,magnetic,external,net,acceleration};
}
export function validateMotion(c){
  finite(c.q,c.mass,c.voltage,c.d,c.x0,c.y0,c.vx,c.vy,c.L??.3,c.externalX??0,c.externalY??0);
  if(c.balanceMode&&!['gravity','magnetic'].includes(c.balanceMode))throw new RangeError('Choose Gravity or Magnetic.');
  if(c.balanceMode==='magnetic'){finite(c.B);if(c.B<0||c.B>2)throw new RangeError('Use B from 0 to 2 T.');if(![-1,1].includes(c.bDirection))throw new RangeError('Choose a magnetic field direction.');}
  if(c.mass<=0)throw new RangeError('Mass must be greater than zero.');
  if((c.L??.3)<=0)throw new RangeError('Plate length must be positive.');
  if(!['horizontal','vertical'].includes(c.orientation??'horizontal'))throw new RangeError('Choose a valid plate orientation.');
  const g=motionGeometry(c),p=g.local({x:c.x0,y:c.y0});
  if(Math.abs(p.n)>=c.d/2&&Math.abs(p.u)<=g.L/2)throw new RangeError('Initial position must lie between the plates or beyond an open end.');
}
export function rootsForPosition(p,v,a,target){
  if(a===0)return v===0?[]:[(target-p)/v];
  const disc=v*v+2*a*(target-p);if(disc<0)return [];
  const s=Math.sqrt(disc),h=-.5*(v+(v>=0?s:-s));
  return h===0?[0]:[2*h/a,(p-target)/h];
}
// Analytic piecewise motion. Field-edge transitions, impacts and optional
// viewport terminals all use roots of the SAME constant-acceleration segments.
// bounds already includes the particle's rendered radius in world coordinates.
// fromTime prevents a resize from retroactively changing elapsed physical time.
export function motionAt(c,t,{bounds,fromTime=0,maxTime=Infinity,stopStationary=false}={}){
  validateMotion(c);finite(t,fromTime);
  if(t<0||fromTime<0||fromTime>t||!(maxTime>0))throw new RangeError('Use non-negative elapsed time and a positive time limit.');
  if(bounds){finite(bounds.minX,bounds.maxX,bounds.minY,bounds.maxY);if(bounds.minX>=bounds.maxX||bounds.minY>=bounds.maxY)throw new RangeError('Invalid canvas bounds.');}
  if(c.balanceMode==='magnetic')return magneticMotionAt(c,t,{bounds,fromTime,maxTime,stopStationary});
  const g=motionGeometry(c),half=g.L/2,end=Math.min(t,Math.max(fromTime,maxTime));
  let p={x:c.x0,y:c.y0,vx:c.vx,vy:c.vy},elapsed=0,events=[],segments=[];
  const tangentAcceleration=g.local(motionForces(c,false).acceleration).u;
  const tangentInside=()=>{
    const u=g.local(p).u,v=g.local({x:p.vx,y:p.vy}).u;
    return Math.abs(u)<half||(Math.abs(u)===half&&(u*v<0||(v===0&&u*tangentAcceleration<0)));
  };
  let along=tangentInside();
  const result=(status,forces,extra={})=>{
    finite(p.x,p.y,p.vx,p.vy,elapsed);
    return {...p,ax:forces.acceleration.x,ay:forces.acceleration.y,ex:forces.field.x,ey:forces.field.y,time:elapsed,status,events,segments,...extra};
  };
  for(let iteration=0;iteration<256;iteration++){
    const local=g.local(p),inside=along&&Math.abs(local.n)<c.d/2,forces=motionForces(c,inside),a=forces.acceleration;
    const velocity=g.local({x:p.vx,y:p.vy}),acceleration=g.local(a);
    let dt=end-elapsed,type=null,side=null,priority=10;
    const offer=(time,kind,rank,which=null)=>{
      if(time>=0&&time<=dt&&(time<dt||rank<priority)){dt=time;type=kind;priority=rank;side=which;}
    };
    for(const wall of [-half,half])for(const root of rootsForPosition(local.u,velocity.u,acceleration.u,wall)){
      const speed=velocity.u+acceleration.u*root;
      if(root>0&&Math.abs(speed)>32*Number.EPSILON*Math.max(Math.abs(velocity.u),Math.abs(acceleration.u*root)))offer(root,'edge',2,wall);
    }
    for(const wall of [-c.d/2,c.d/2])for(const root of rootsForPosition(local.n,velocity.n,acceleration.n,wall)){
      const u=local.u+velocity.u*root+.5*acceleration.u*root*root;
      if(root>0&&Math.abs(u)<=half+16*Number.EPSILON*Math.max(1,half))offer(root,'impact',0,wall);
    }
    if(bounds&&elapsed+dt>=fromTime){
      const begin=Math.max(0,fromTime-elapsed),at=kinematics(p,{x:p.vx,y:p.vy},a,begin);
      if(at.x<bounds.minX||at.x>bounds.maxX||at.y<bounds.minY||at.y>bounds.maxY)offer(begin,'canvas',1);
      for(const [axis,min,max] of [['x',bounds.minX,bounds.maxX],['y',bounds.minY,bounds.maxY]]){
        for(const [wall,sign] of [[min,-1],[max,1]]){
          if(at[axis]===wall&&(sign*at['v'+axis]>0||(at['v'+axis]===0&&sign*a[axis]>0)))offer(begin,'canvas',1);
          for(const root of rootsForPosition(p[axis],p['v'+axis],a[axis],wall))if(root>0&&root>=begin&&sign*(p['v'+axis]+a[axis]*root)>0)offer(root,'canvas',1);
        }
      }
    }
    if(stopStationary&&p.vx===0&&p.vy===0&&a.x===0&&a.y===0&&elapsed>=fromTime)return result('Stationary',forces);
    if(stopStationary&&p.vx===0&&p.vy===0&&a.x===0&&a.y===0&&elapsed<fromTime&&elapsed+dt>=fromTime)offer(fromTime-elapsed,'stationary',3);
    const start={...p};p=kinematics(p,{x:p.vx,y:p.vy},a,dt);
    if(dt>0)segments.push({start:elapsed,end:elapsed+dt,p:start,a:{...a},inside});
    elapsed+=dt;
    if(type==='impact'){
      const contact=g.local(p);Object.assign(p,g.world(contact.u,side));
      events.push({time:elapsed,type:'impact',side:Math.sign(side)});
      const impactVx=p.vx,impactVy=p.vy;p.vx=0;p.vy=0;
      return result('Plate impact',{field:{x:0,y:0},acceleration:{x:0,y:0}},{impactVx,impactVy,plate:c.voltage===0?'uncharged':Math.sign(side)===Math.sign(c.voltage)?'negative':'positive'});
    }
    if(type==='canvas'){events.push({time:elapsed,type:'canvas'});return result('Canvas exit',forces);}
    if(type==='stationary')return result('Stationary',forces);
    if(type==='edge'){
      const at=g.local(p);Object.assign(p,g.world(side,at.n));
      const speed=g.local({x:p.vx,y:p.vy}).u;along=side*speed<0;
      events.push({time:elapsed,type:'edge',entering:along&&Math.abs(at.n)<c.d/2});
      if(Math.abs(Math.abs(at.n)-c.d/2)<=16*Number.EPSILON*Math.max(1,c.d)){
        const impactVx=p.vx,impactVy=p.vy;p.vx=0;p.vy=0;
        events.push({time:elapsed,type:'impact',side:Math.sign(at.n)});
        return result('Plate impact',{field:{x:0,y:0},acceleration:{x:0,y:0}},{impactVx,impactVy,plate:Math.sign(at.n)===Math.sign(c.voltage)?'negative':'positive'});
      }
      if(elapsed<end)continue;
      const active=along&&Math.abs(at.n)<c.d/2;
      return result(elapsed>=maxTime?'Time limit':active?'In field':'Outside field',motionForces(c,active));
    }
    return result(elapsed>=maxTime?'Time limit':inside?'In field':'Outside field',forces);
  }
  throw new RangeError('Too many boundary events; reduce the simulated time interval.');
}
