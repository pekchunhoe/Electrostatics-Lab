import {motionGeometry,motionForces,kinematics,finite} from './physics.js';

export const magneticZ=c=>c.B*(c.bDirection??-1);
// Exact uniform E,B flow, expressed through the initial acceleration to avoid
// subtracting large E/B drift velocities as B approaches zero.
export function lorentzStep(p,field,qm,bz,t){
  const w=qm*bz,z=w*t,az={x:qm*(field.x+p.vy*bz),y:qm*(field.y-p.vx*bz)};
  if(w===0)return kinematics(p,{x:p.vx,y:p.vy},az,t);
  const z2=z*z,small=Math.abs(z)<1e-3;
  const sinc=small?1-z2/6+z2*z2/120-z2*z2*z2/5040:Math.sin(z)/z;
  const cosc=small?.5-z2/24+z2*z2/720-z2*z2*z2/40320:2*Math.sin(z/2)**2/z2;
  const sincc=small?1/6-z2/120+z2*z2/5040-z2*z2*z2/362880:(z-Math.sin(z))/(z*z2);
  return {x:p.x+p.vx*t+az.x*t*t*cosc+az.y*w*t*t*t*sincc,
    y:p.y+p.vy*t+az.y*t*t*cosc-az.x*w*t*t*t*sincc,
    vx:p.vx+az.x*t*sinc+az.y*w*t*t*cosc,
    vy:p.vy+az.y*t*sinc-az.x*w*t*t*cosc};
}
export function sampleMotionSegment(segment,t){
  return segment.bz===undefined?kinematics(segment.p,{x:segment.p.vx,y:segment.p.vy},segment.a,t):lorentzStep(segment.p,segment.field,segment.qm,segment.bz,t);
}
// Split each coordinate into monotone intervals at its exact velocity zeros.
// This catches arbitrarily shallow turning crossings and grazing plate contact.
function turningTimes(p,field,qm,bz,axis,dt){
  const w=qm*bz;
  if(w===0){const a=qm*field[axis],t=-p['v'+axis]/a;return t>0&&t<dt?[t]:[];}
  // Velocity is monotone between acceleration zeros. Unlike the E/B drift
  // formula, these coefficients remain well conditioned even for tiny B.
  const ax=qm*(field.x+p.vy*bz),ay=qm*(field.y-p.vx*bz);
  const a=axis==='x'?ax:ay,b=axis==='x'?ay:-ax;
  if(a===0&&b===0)return [];
  const phase=Math.atan2(-a,b),loAngle=Math.min(0,w*dt),hiAngle=Math.max(0,w*dt),points=[0,dt],out=[];
  for(let k=Math.ceil((loAngle-phase)/Math.PI);k<=Math.floor((hiAngle-phase)/Math.PI);k++){
    const t=(phase+Math.PI*k)/w;if(t>0&&t<dt)points.push(t);
  }
  points.sort((a,b)=>a-b);
  for(let i=1;i<points.length;i++){
    let lo=points[i-1],hi=points[i];
    const v0=lorentzStep(p,field,qm,bz,lo)['v'+axis],v1=lorentzStep(p,field,qm,bz,hi)['v'+axis];
    if(v0===0&&lo>0)out.push(lo);
    if(v0*v1>=0)continue;
    for(let n=0;n<52;n++){const mid=(lo+hi)/2;if(v0*lorentzStep(p,field,qm,bz,mid)['v'+axis]<=0)hi=mid;else lo=mid;}
    out.push((lo+hi)/2);
  }
  return out.sort((a,b)=>a-b);
}
function coordinateRoots(p,field,qm,bz,axis,wall,dt){
  const flow=t=>lorentzStep(p,field,qm,bz,t),points=[0,...turningTimes(p,field,qm,bz,axis,dt),dt],out=[];
  const eps=2e-13*Math.max(1,Math.abs(wall));
  for(let i=1;i<points.length;i++){
    let lo=points[i-1],hi=points[i],a=flow(lo)[axis]-wall,b=flow(hi)[axis]-wall;
    if(Math.abs(b)<=eps&&hi>0)out.push(hi);
    if(a*b>=0)continue;
    for(let n=0;n<52;n++){const mid=(lo+hi)/2,v=flow(mid)[axis]-wall;if(a*v<=0)hi=mid;else {lo=mid;a=v;}}
    out.push((lo+hi)/2);
  }
  return out;
}
export function magneticMotionAt(c,t,{bounds,fromTime=0,maxTime=Infinity,stopStationary=false}={}){
  const g=motionGeometry(c),qm=c.q/c.mass,end=Math.min(t,Math.max(fromTime,maxTime)),history=c.fieldHistory??[{time:0,B:c.B,bDirection:c.bDirection}];
  let p={x:c.x0,y:c.y0,vx:c.vx,vy:c.vy},elapsed=0,events=[],segments=[],epoch=0;
  const hasElectric=c.voltage!==0;
  const axisU=c.orientation==='vertical'?'y':'x',axisN=c.orientation==='vertical'?'x':'y';
  const initialA=motionForces(c,false,{x:p.vx,y:p.vy}).acceleration;
  let along=Math.abs(p[axisU])<g.L/2||(Math.abs(p[axisU])===g.L/2&&(p[axisU]*p['v'+axisU]<0||(p['v'+axisU]===0&&p[axisU]*initialA[axisU]<0)));
  const result=(status,extra={})=>{
    const inside=(hasElectric?along:Math.abs(p[axisU])<g.L/2)&&Math.abs(p[axisN])<c.d/2,f=motionForces({...c,B:history[epoch].B,bDirection:history[epoch].bDirection},inside,{x:p.vx,y:p.vy});
    finite(p.x,p.y,p.vx,p.vy,elapsed);
    return {...p,ax:f.acceleration.x,ay:f.acceleration.y,ex:f.field.x,ey:f.field.y,time:elapsed,status,events,segments,...extra};
  };
  for(let iteration=0;iteration<200000;iteration++){
    while(epoch+1<history.length&&history[epoch+1].time<=elapsed)epoch++;
    const bz=magneticZ(history[epoch]),inside=(hasElectric?along:Math.abs(p[axisU])<g.L/2)&&Math.abs(p[axisN])<c.d/2,field=inside?g.field:{x:0,y:0};
    const f=motionForces({...c,B:history[epoch].B,bDirection:history[epoch].bDirection},inside,{x:p.vx,y:p.vy});
    if(bounds&&elapsed>=fromTime){
      const outside=p.x<bounds.minX||p.x>bounds.maxX||p.y<bounds.minY||p.y>bounds.maxY;
      const outward=[['x',bounds.minX,-1],['x',bounds.maxX,1],['y',bounds.minY,-1],['y',bounds.maxY,1]].some(([axis,wall,sign])=>p[axis]===wall&&(sign*p['v'+axis]>0||(p['v'+axis]===0&&sign*f.acceleration[axis]>0)));
      if(outside||outward){events.push({time:elapsed,type:'canvas'});return result('Canvas exit');}
    }
    if(stopStationary&&elapsed>=fromTime&&p.vx===0&&p.vy===0&&f.acceleration.x===0&&f.acceleration.y===0)return result('Stationary');
    if(elapsed>=end)return result(elapsed>=maxTime?'Time limit':inside?'In field':'Outside field');
    // At most a quarter turn per search. Propagation itself is exact; this is
    // an event-search and trace-density limit, not an Euler integration step.
    const horizon=Math.min(end-elapsed,epoch+1<history.length?history[epoch+1].time-elapsed:Infinity);
    let dt=Math.min(horizon,Math.abs(qm*bz)>0?Math.PI/(2*Math.abs(qm*bz)):Infinity);
    // Skip safe stretches with an exact drift-plus-orbit envelope. This keeps
    // tightly confined high-frequency orbits fast, even over long time limits.
    if(qm*bz!==0){
      const drift={x:field.y/bz,y:-field.x/bz},radius=Math.hypot(p.vx-drift.x,p.vy-drift.y)/Math.abs(qm*bz);
      const walls={x:[],y:[]};if(hasElectric)walls[axisU].push(-g.L/2,g.L/2);walls[axisN].push(-c.d/2,c.d/2);
      if(bounds){walls.x.push(bounds.minX,bounds.maxX);walls.y.push(bounds.minY,bounds.maxY);}
      let safe=horizon;
      for(const axis of ['x','y'])for(const wall of walls[axis]){
        const distance=wall-p[axis],clearance=Math.abs(distance)-2*radius;
        if(clearance<=0){safe=0;break;}
        if(distance*drift[axis]>0)safe=Math.min(safe,clearance/Math.abs(drift[axis]));
      }
      if(safe>dt)dt=safe<horizon?safe*.9:safe;
    }
    const safeSearch=dt>Math.PI/(2*Math.abs(qm*bz));
    if(elapsed<fromTime)dt=Math.min(dt,fromTime-elapsed);
    let type=null,side=null,rank=10;
    const offer=(time,kind,priority,wall)=>{
      const tolerance=32*Number.EPSILON*Math.max(dt,time,1e-300);
      if(time>0&&elapsed+time>elapsed&&time<=dt&&(time<dt-tolerance||priority<rank)){dt=time;type=kind;rank=priority;side=wall;}
    };
    if(hasElectric&&!safeSearch)for(const wall of [-g.L/2,g.L/2])for(const root of coordinateRoots(p,field,qm,bz,axisU,wall,dt)){
      const at=lorentzStep(p,field,qm,bz,root);if(Math.abs(at['v'+axisU])>1e-13)offer(root,'edge',2,wall);
    }
    if(!safeSearch)for(const wall of [-c.d/2,c.d/2])for(const root of coordinateRoots(p,field,qm,bz,axisN,wall,dt)){
      if(Math.abs(lorentzStep(p,field,qm,bz,root)[axisU])<=g.L/2+2e-12)offer(root,'impact',0,wall);
    }
    if(!safeSearch&&bounds&&elapsed>=fromTime)for(const [axis,min,max] of [['x',bounds.minX,bounds.maxX],['y',bounds.minY,bounds.maxY]])for(const [wall,sign] of [[min,-1],[max,1]])for(const root of coordinateRoots(p,field,qm,bz,axis,wall,dt)){
      if(sign*lorentzStep(p,field,qm,bz,root)['v'+axis]>0)offer(root,'canvas',1,wall);
    }
    const start={...p};p=lorentzStep(p,field,qm,bz,dt);
    segments.push({start:elapsed,end:elapsed+dt,p:start,a:f.acceleration,inside,field,bz,qm});elapsed+=dt;
    if(type==='impact'){
      p[axisN]=side;events.push({time:elapsed,type:'impact',side:Math.sign(side)});
      const impactVx=p.vx,impactVy=p.vy;p.vx=0;p.vy=0;
      return result('Plate impact',{ax:0,ay:0,ex:0,ey:0,impactVx,impactVy,plate:c.voltage===0?'uncharged':Math.sign(side)===Math.sign(c.voltage)?'negative':'positive'});
    }
    if(type==='canvas'){events.push({time:elapsed,type:'canvas'});return result('Canvas exit');}
    if(type==='edge'){
      p[axisU]=side;along=side*p['v'+axisU]<0;
      events.push({time:elapsed,type:'edge',entering:along&&Math.abs(p[axisN])<c.d/2});
    }
  }
  throw new RangeError('Too many cyclotron turns. Reduce the simulation time limit or magnetic field.');
}
