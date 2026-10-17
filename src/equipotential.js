import {isPlates,plateModel} from './parallel-plates.js';
import {K,SINGULAR_DISTANCE,createSampler,energyChange} from './physics.js';

export const SNAP_DISTANCE=24; // CSS pixels, independent of device pixel ratio.
export const potentialTolerance=level=>Math.max(1e-7,Math.abs(level)*1e-11); // volts
// Two independently projected points each stop at T/8. Their difference has
// a T/4 error budget. This is a display rule, never a solver or physics clamp.
export const potentialDisplayTolerance=(va,vb)=>Math.max(2.5e-8,2.5e-12*Math.max(Math.abs(va),Math.abs(vb)));
const caches=new WeakMap();
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fieldKey=s=>JSON.stringify([s.charges,s.uniform,s.uniformE,s.potentialModel,s.plates]);
export function initializeSnapping(s){
  s.snapEnabled=false;s.attachments={probe:null,b:null};s.snapSuppressed={probe:false,b:false};s.snapMessage='';s.samePotentialDemo=false;
}
function cache(s){
  const key=fieldKey(s);let entry=caches.get(s);
  if(entry?.key!==key){
    const sampler=createSampler(s.charges);
    const uniform=s.uniform,E=s.uniformE;
    const plates=isPlates(s)?plateModel(s.plates):null;
    entry={key,geometry:new Map(),potential:p=>plates?plates.potential(p):uniform?-E*p.y:sampler.potential(p),gradient:p=>{
      if(plates)return {x:-plates.field.x,y:-plates.field.y};if(uniform)return {x:0,y:-E};const e=sampler.field(p);return {x:-e.x,y:-e.y};
    }};caches.set(s,entry);
  }
  return entry;
}
export function actualPotential(s,p){return cache(s).potential(p);}
export function validProbePosition(s,p){
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>.25+1e-12||Math.abs(p.y)>.22+1e-12)return false;
  if(isPlates(s)&&!plateModel(s.plates).contains(p))return false;
  if(!s.uniform&&s.charges.some(c=>c.q!==0&&distance(c,p)<SINGULAR_DISTANCE*4))return false;
  try{return Number.isFinite(actualPotential(s,p));}catch{return false;}
}
export function validatePotentialProbes(s){
  if(!validProbePosition(s,s.probe)||!validProbePosition(s,s.b))throw new RangeError(isPlates(s)?'Keep probes inside the modeled central region, between the plates and their drawn ends.':'Keep probes clear of point charges and inside the coordinate limits.');
}
function inView(p,view,padding=3){const a=view.toScreen(p);return a.x>=padding&&a.x<=view.w-padding&&a.y>=padding&&a.y<=view.h-padding;}

// Damped Newton projection along ∇V = −E. A trust region and backtracking
// reject singularities, nonconvergence and jumps; physical values stay unchanged.
export function projectPotential(s,start,level,{maxDistance=.04,stepLimit=.01,view,maxIterations=40}={}){
  if(!Number.isFinite(level)||!validProbePosition(s,start)||(view&&!inView(start,view)))return null;
  const model=cache(s),tolerance=potentialTolerance(level)/8;let p={...start};
  for(let iteration=0;iteration<maxIterations;iteration++){
    const error=model.potential(p)-level;
    if(Math.abs(error)<=tolerance)return {...p,residual:error,iterations:iteration};
    const gradient=model.gradient(p),norm=Math.hypot(gradient.x,gradient.y);
    if(!Number.isFinite(norm)||norm<1e-18)return null;
    const step=Math.max(-stepLimit,Math.min(stepLimit,error/norm));let accepted=false;
    for(let factor=1;factor>=1/1024;factor/=2){
      const next={x:p.x-factor*step*gradient.x/norm,y:p.y-factor*step*gradient.y/norm};
      if(distance(start,next)>maxDistance||!validProbePosition(s,next)||(view&&!inView(next,view)))continue;
      if(Math.abs(model.potential(next)-level)<Math.abs(error)){p=next;accepted=true;break;}
    }
    if(!accepted)return null;
  }
  return null;
}

export function contourLevels(s){
  if(isPlates(s))return [0,.25,.5,.75,1].map(f=>f*s.plates.voltage);
  const active=s.charges.filter(c=>c.q!==0);
  if(!s.uniform&&active.length===1)return [10000,20000,40000,80000,160000,320000,640000].map(v=>v*Math.sign(active[0].q));
  return s.uniform?[-3000,-2000,-1000,0,1000,2000,3000]:[-320000,-160000,-80000,-40000,-20000,-10000,0,10000,20000,40000,80000,160000,320000];
}
const nodeKey=p=>`${Math.round(p.x*1e5)},${Math.round(p.y*1e5)}`;
function connectSegments(segments,level){
  const nodes=new Map();
  segments.forEach((edge,index)=>{for(const p of [edge.a,edge.b]){const key=nodeKey(p);if(!nodes.has(key))nodes.set(key,[]);nodes.get(key).push(index);}});
  const visited=new Set(),components=[];
  for(let index=0;index<segments.length;index++){
    if(visited.has(index))continue;const pending=[index],edges=[];
    while(pending.length){const i=pending.pop();if(visited.has(i))continue;visited.add(i);const edge=segments[i];edges.push(edge);for(const p of [edge.a,edge.b])for(const next of nodes.get(nodeKey(p)))if(!visited.has(next))pending.push(next);}
    components.push({id:components.length,level,segments:edges});
  }
  return components;
}

// The renderer and interaction use the SAME contour geometry. Its chords are
// search seeds only; every attachment is refined against the real potential.
export function contourGeometry(s,view,levels=contourLevels(s),custom=false){
  const model=cache(s),key=JSON.stringify([view.w,view.h,view.scale,levels,custom,!!s.fieldLines]);
  if(model.geometry.has(key))return model.geometry.get(key);
  const active=s.charges.filter(c=>c.q!==0),single=!s.uniform&&active.length===1?active[0]:null;
  const result={key:model.key+key,levels:[],components:[]};
  if(isPlates(s)){
    const plates=plateModel(s.plates);
    for(const level of levels){
      if(level<0||level>s.plates.voltage)continue;
      const segments=[],count=Math.max(8,Math.ceil(2*s.plates.halfLength*view.scale/5));
      for(let i=0;i<count;i++)segments.push({a:view.toScreen(plates.atLevel(level,s.plates.halfLength*(2*i/count-1))),b:view.toScreen(plates.atLevel(level,s.plates.halfLength*(2*(i+1)/count-1)))});
      result.levels.push({level,segments});result.components.push({id:result.components.length,level,segments});
    }
    if(model.geometry.size>=6)model.geometry.delete(model.geometry.keys().next().value);
    model.geometry.set(key,result);return result;
  }
  let samples,nx,ny;
  if(!single){
    const cell=s.fieldLines?8:12;nx=Math.ceil(view.w/cell);ny=Math.ceil(view.h/cell);samples=[];
    for(let j=0;j<=ny;j++){samples[j]=[];for(let i=0;i<=nx;i++){try{samples[j][i]=model.potential(view.toWorld({x:i*cell,y:j*cell}));}catch{samples[j][i]=null;}}}
  }
  for(const level of levels){
    const segments=[],crossings=s.fieldLines?new Map():null;let circle=null;
    if(single){
      const radius=K*single.q/level,screenRadius=radius*view.scale;
      if(!Number.isFinite(screenRadius)||!(radius>0)||(!custom&&(screenRadius<20||screenRadius>Math.hypot(view.w,view.h))))continue;
      circle={center:view.toScreen(single),radius:screenRadius};
      if(custom){
        const {x,y}=circle.center,near=Math.hypot(Math.max(0,-x,x-view.w),Math.max(0,-y,y-view.h));
        const far=Math.max(...[{x:0,y:0},{x:view.w,y:0},{x:0,y:view.h},{x:view.w,y:view.h}].map(p=>distance(p,circle.center)));
        if(screenRadius<near||screenRadius>far)continue;
      }
      const count=Math.min(4096,Math.max(48,Math.ceil(2*Math.PI*screenRadius/5)));
      for(let i=0;i<count;i++){
        const point=t=>({x:circle.center.x+screenRadius*Math.cos(t),y:circle.center.y+screenRadius*Math.sin(t)});
        segments.push({a:point(i*2*Math.PI/count),b:point((i+1)*2*Math.PI/count)});
      }
    }else{
      const cell=s.fieldLines?8:12;
      for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
        const values=[samples[j][i],samples[j][i+1],samples[j+1][i+1],samples[j+1][i]];
        if(values.every(v=>v!==null)&&(Math.min(...values)>level||Math.max(...values)<level))continue;
        const points=[{x:i*cell,y:j*cell,z:values[0]},{x:(i+1)*cell,y:j*cell,z:values[1]},{x:(i+1)*cell,y:(j+1)*cell,z:values[2]},{x:i*cell,y:(j+1)*cell,z:values[3]}];
        for(const ids of [[0,1,2],[0,2,3]]){
          const hits=[];
          for(let k=0;k<3;k++){
            const a=points[ids[k]],b=points[ids[(k+1)%3]];
            if(a.z===null||b.z===null)continue;
            if((a.z<level)!==(b.z<level)){
              const edgeKey=crossings?`${Math.min(a.x,b.x)},${Math.min(a.y,b.y)},${Math.max(a.x,b.x)},${Math.max(a.y,b.y)}`:null;
              if(crossings?.has(edgeKey)){hits.push(crossings.get(edgeKey));continue;}
              let t=(level-a.z)/(b.z-a.z);
              if(s.fieldLines){
                // Refine crossings on the grid edge using the SAME scalar V.
                // Linear interpolation alone visibly tilts short contour chords.
                let low=0,high=1;
                for(let n=0;n<20;n++){
                  const world=view.toWorld({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});
                  try{
                    const residual=model.potential(world)-level;
                    if(Math.abs(residual)<=potentialTolerance(level))break;
                    if((residual<0)===(a.z<level))low=t;else high=t;
                    const g=model.gradient(world),derivative=(g.x*(b.x-a.x)-g.y*(b.y-a.y))/view.scale,next=t-residual/derivative;
                    t=Number.isFinite(next)&&next>low&&next<high?next:(low+high)/2;
                  }catch{break;}
                }
              }
              const hit={x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)};if(crossings)crossings.set(edgeKey,hit);hits.push(hit);
            }
          }
          if(hits.length===2&&distance(hits[0],hits[1])>1e-8)segments.push({a:hits[0],b:hits[1]});
        }
      }
    }
    const components=connectSegments(segments,level);
    result.levels.push({level,segments,circle});result.components.push(...components);
  }
  if(model.geometry.size>=6)model.geometry.delete(model.geometry.keys().next().value);
  model.geometry.set(key,result);return result;
}

function nearestPoint(edge,p){
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,den=dx*dx+dy*dy;
  const t=den===0?0:Math.max(0,Math.min(1,((p.x-edge.a.x)*dx+(p.y-edge.a.y)*dy)/den));
  return {x:edge.a.x+t*dx,y:edge.a.y+t*dy};
}
function candidates(geometry,world,view,{componentId,previous,maxTravel=Infinity,exclude,minSeparation=0}={}){
  const screen=view.toScreen(world),old=previous?view.toScreen(previous):null,out=[];
  for(const component of geometry.components){
    if(componentId!==undefined&&component.id!==componentId)continue;
    for(const edge of component.segments){
      const point=nearestPoint(edge,screen);
      if(old&&distance(point,old)>maxTravel)continue;
      if(exclude&&distance(point,view.toScreen(exclude))<minSeparation)continue;
      const physical=view.toWorld(point);if(!inView(physical,view))continue;
      out.push({point:physical,distance:distance(point,screen),component,edge});
    }
  }
  return out.sort((a,b)=>a.distance-b.distance);
}
function refinedCandidate(s,geometry,target,view,options={}){
  let best=null;const tried=new Map();
  for(const candidate of candidates(geometry,target,view,options).slice(0,80)){
    if(candidate.distance>(options.maxCapture??Infinity))break;
    if(best&&candidate.distance>best.distance+8)break;
    const branch=`${candidate.component.level}:${candidate.component.id}`;
    if((tried.get(branch)??0)>=3)continue;
    const point=projectPotential(s,candidate.point,candidate.component.level,{maxDistance:8/view.scale,stepLimit:4/view.scale,view});
    if(!point||distance(point,target)*view.scale>(options.maxCapture??Infinity))continue;
    if(options.exclude&&distance(point,options.exclude)*view.scale<options.minSeparation)continue;
    tried.set(branch,(tried.get(branch)??0)+1);
    const actualDistance=distance(point,target)*view.scale;
    if(!best||actualDistance<best.distance)best={...candidate,point,distance:actualDistance};
  }
  return best;
}
function attachment(s,key,level,geometry,component){
  s.attachments[key]={level,geometryKey:geometry.key,componentId:component?.id,fieldKey:fieldKey(s)};
}
export function releaseProbe(s,key,message=true){
  const previous=s.attachments[key],wasAttached=!!previous;s.attachments[key]=null;s.snapSuppressed[key]=previous?{level:previous.level}:false;
  if(message&&wasAttached)s.snapMessage=`${key==='probe'?'A':'B'} detached. Drag out of the 24 px capture band before approaching a contour again.`;
}
export function clearAttachments(s,message=''){
  for(const key of ['probe','b']){s.attachments[key]=null;s.snapSuppressed[key]=false;}
  s.snapMessage=message;
}
export function setSnapping(s,enabled){s.snapEnabled=enabled;if(enabled)s.contours=true;clearAttachments(s,enabled?'Drag A or B within 24 px of a visible contour.':'Snapping OFF. Both probes move freely.');}

function captureGeometry(s,view){
  const base=contourGeometry(s,view),components=[...base.components];let key=base.key;
  // A demonstration can add a non-preset potential level. Its highlighted branch
  // is visible too, so a detached probe must be able to magnetically rejoin it.
  for(const probe of ['probe','b']){
    const contour=attachedContour(s,probe,view);if(!contour)continue;
    if(!components.some(c=>c.level===contour.level&&c.id===contour.id)){components.push(contour);key+=`:${contour.level}:${contour.id}`;}
  }
  return {key,components};
}

export function movePotentialProbe(s,key,target,view){
  if(!validProbePosition(s,target))return false;
  if(!s.snapEnabled||!s.contours){Object.assign(s[key],target);return true;}
  const held=s.attachments[key];
  if(held){
    if((s.uniform&&!isPlates(s)&&s.uniformE===0)||(!s.uniform&&s.charges.every(c=>c.q===0))){Object.assign(s[key],target);return true;}
    const geometry=contourGeometry(s,view,[held.level],true);
    let branch=held.componentId;
    if(held.geometryKey!==geometry.key){const near=candidates(geometry,s[key],view)[0];branch=near&&near.distance<=8?near.component.id:undefined;}
    const hit=branch===undefined?null:refinedCandidate(s,geometry,target,view,{componentId:branch,previous:s[key],maxTravel:60});
    if(hit){Object.assign(s[key],{x:hit.point.x,y:hit.point.y});attachment(s,key,held.level,geometry,hit.component);return true;}
    releaseProbe(s,key,false);s.snapMessage=`${key==='probe'?'A':'B'} released: no stable nearby point on its contour. Move freely or approach another contour.`;
    Object.assign(s[key],target);return true;
  }
  const geometry=captureGeometry(s,view);
  if(s.snapSuppressed[key]){
    // Detachment inhibits only the released contour, not every nearby level.
    const released=contourGeometry(s,view,[s.snapSuppressed[key].level],true);
    const nearest=candidates(released,target,view)[0];
    if(!nearest||nearest.distance>SNAP_DISTANCE+4)s.snapSuppressed[key]=false;
    Object.assign(s[key],target);return true;
  }
  const hit=refinedCandidate(s,geometry,target,view,{maxCapture:SNAP_DISTANCE});
  Object.assign(s[key],hit?{x:hit.point.x,y:hit.point.y}:target);
  if(hit){attachment(s,key,hit.component.level,geometry,hit.component);s.snapMessage=`${key==='probe'?'A':'B'} attached. Slide along this contour, or use Detach.`;}
  return true;
}

// Reconcile assigned levels after source edits, with a strict 24 px locality
// limit. A missing contour releases the probe instead of jumping to another loop.
export function reconcileAttachments(s,view){
  if(!s.attachments)return false;let changed=false;
  if(!s.snapEnabled||!s.contours){if(Object.values(s.attachments).some(Boolean))clearAttachments(s,'Contours hidden or snapping OFF. Probes released.');return false;}
  for(const key of ['probe','b']){
    const held=s.attachments[key];if(!held||held.fieldKey===fieldKey(s))continue;
    const geometry=contourGeometry(s,view,[held.level],true);
    // A source edit can leave the old position at a saddle (∇V = 0).
    // Use local contour seeds if Newton cannot start there, still within 24 px.
    const projected=projectPotential(s,s[key],held.level,{maxDistance:SNAP_DISTANCE/view.scale,stepLimit:4/view.scale,view})??refinedCandidate(s,geometry,s[key],view,{maxCapture:SNAP_DISTANCE})?.point;
    if(projected){
      const near=candidates(geometry,projected,view)[0];
      if(near&&near.distance<=8){Object.assign(s[key],{x:projected.x,y:projected.y});attachment(s,key,held.level,geometry,near.component);changed=true;continue;}
    }
    releaseProbe(s,key,false);s.snapMessage=`${key==='probe'?'A':'B'} released: its assigned contour no longer has a stable solution within 24 px.`;
  }
  return changed;
}

export function samePotential(s,view){
  if(!validProbePosition(s,s.probe))return {ok:false,message:'Move A clear of the sources before matching potentials.'};
  const level=s.attachments.probe?.level??actualPotential(s,s.probe);
  const geometry=contourGeometry(s,view,[level],true),near=candidates(geometry,s.probe,view)[0];
  let hit;
  if(near&&near.distance<=8)hit=refinedCandidate(s,geometry,s.b,view,{componentId:near.component.id,exclude:s.probe,minSeparation:26});
  // A constant potential fills the workspace; no distinguished contour curve exists.
  if(!hit&&((s.uniform&&!isPlates(s)&&s.uniformE===0)||(!s.uniform&&s.charges.every(c=>c.q===0)))){
    const options=[s.b,...[1,-1].map(sign=>({x:s.probe.x+sign*32/view.scale,y:s.probe.y}))];
    const point=options.find(p=>validProbePosition(s,p)&&inView(p,view)&&distance(p,s.probe)*view.scale>=26);
    if(point)hit={point,component:null};
  }
  if(!hit)return {ok:false,message:'No distinct point on A’s equipotential is available in this view. Zoom out, move A, or choose another arrangement.'};
  const comparisonError=Math.abs(actualPotential(s,hit.point)-actualPotential(s,s.probe));
  if(comparisonError>2*potentialTolerance(level))return {ok:false,message:'The projection did not meet the potential tolerance. Move A or zoom out and try again.'};
  s.snapEnabled=true;s.contours=true;s.samePotentialDemo=true;s.snapSuppressed.probe=false;s.snapSuppressed.b=false;
  Object.assign(s.b,{x:hit.point.x,y:hit.point.y});
  attachment(s,'probe',level,geometry,near?.component);attachment(s,'b',level,geometry,hit.component);
  s.snapMessage='A and B share an equipotential. Slide either probe or detach independently.';
  return {ok:true,level};
}
export function potentialComparison(s){
  const va=actualPotential(s,s.probe),vb=actualPotential(s,s.b),dv=vb-va,du=energyChange(s.testQ,dv);
  const tolerance=potentialDisplayTolerance(va,vb),a=s.attachments?.probe,b=s.attachments?.b;
  const sameLevel=!!(a&&b&&Number.isFinite(a.level)&&a.level===b.level);
  const current=sameLevel&&s.snapEnabled&&s.contours&&a.fieldKey===fieldKey(s)&&b.fieldKey===fieldKey(s);
  const aligned=current&&validProbePosition(s,s.probe)&&validProbePosition(s,s.b)
    &&Math.abs(va-a.level)<=potentialTolerance(a.level)/8
    &&Math.abs(vb-b.level)<=potentialTolerance(b.level)/8;
  const equal=!!(aligned&&Number.isFinite(dv)&&Math.abs(dv)<=tolerance);
  // Raw measurements remain available for validation and diagnostics. No cached
  // demonstration flag can authorize zero after a detach, source edit or failure.
  return {va,vb,dv,du,work:-du,tolerance,sameLevel,equal,
    display:equal?{dv:0,du:0,work:0}:{dv,du,work:-du}};
}
export function attachedContour(s,key,view){
  const held=s.attachments?.[key];if(!held)return null;
  const geometry=contourGeometry(s,view,[held.level],true);
  if(held.geometryKey===geometry.key)return geometry.components.find(c=>c.id===held.componentId)??null;
  const near=candidates(geometry,s[key],view)[0];return near&&near.distance<=8?near.component:null;
}
