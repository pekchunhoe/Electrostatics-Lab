import {finite,uniformField} from './physics.js';

export const plateDefaults=()=>({voltage:200,d:.020,reversed:false,orientation:'horizontal',halfLength:.025});
export const isPlates=s=>s.potentialModel==='plates';
export function plateModel(config){
  const c={...config};finite(c.voltage,c.d,c.halfLength);
  if(c.voltage<=0||c.d<=0||c.halfLength<=0||!['horizontal','vertical'].includes(c.orientation))throw new RangeError('Use positive voltage and separation and a valid plate orientation.');
  const horizontal=c.orientation==='horizontal',sign=c.reversed?-1:1;
  const strength=uniformField(c.voltage,c.d);
  // +y is up. The default high-potential plate is top (or left).
  const field=horizontal?{x:0,y:-sign*strength}:{x:sign*strength,y:0};
  const normal=p=>horizontal?p.y:p.x,tangent=p=>horizontal?p.x:p.y;
  const high=horizontal?sign*c.d/2:-sign*c.d/2;
  const contains=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(normal(p))<=c.d/2+1e-14&&Math.abs(tangent(p))<=c.halfLength+1e-14;
  return {field,strength,contains,
    potential(p){if(!contains(p))throw new RangeError('Probe outside the modeled central region. Keep it between the plates and inside their drawn ends.');return c.voltage/2-field.x*p.x-field.y*p.y;},
    atLevel(level,t=0){const n=high+(horizontal?-sign:sign)*c.d*(1-level/c.voltage);return horizontal?{x:t,y:n}:{x:n,y:t};},
    clamp(p){return horizontal?{x:Math.max(-c.halfLength,Math.min(c.halfLength,p.x)),y:Math.max(-c.d/2,Math.min(c.d/2,p.y))}:{x:Math.max(-c.d/2,Math.min(c.d/2,p.x)),y:Math.max(-c.halfLength,Math.min(c.halfLength,p.y))};}
  };
}

// Each model owns probes, attachments, zoom and layers. Switching cannot borrow
// a contour identifier from the other model; returning restores its own state.
export function createPotentialModels(point,initialize){
  point.potentialModel='point';point.fieldLines=false;
  const plates=structuredClone(point);
  Object.assign(plates,{potentialModel:'plates',uniform:true,uniformE:-10000,plates:plateDefaults(),probe:{x:-.012,y:.005},b:{x:.012,y:-.005},fieldLines:false,heat:false,overlay:false,grid:false,zoom:1});
  initialize(plates);return {point,plates};
}

export function updatePlates(s,changes){
  const old=s.plates,next={...old,...changes};const model=plateModel(next);
  // Preserve fractional distance across the gap and along a plate on edits.
  for(const key of ['probe','b']){
    const p=s[key],n=(old.orientation==='horizontal'?p.y:p.x)/old.d*next.d,t=old.orientation==='horizontal'?p.x:p.y;
    s[key]=model.clamp(next.orientation==='horizontal'?{x:t,y:n}:{x:n,y:t});
  }
  s.plates=next;s.uniformE=model.field.y;
}
