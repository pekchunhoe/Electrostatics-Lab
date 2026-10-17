import {fieldAt,magnitude,direction} from './physics.js';

const subscripts={'1':'₁','2':'₂','3':'₃','4':'₄'};
export const fieldLabel=id=>id==='resultant'?'Eᴿ':`E${subscripts[id]??id}`;
export const fieldStyles={
  '1':{light:'#2b67b1',dark:'#90bfff',dash:[]},
  '2':{light:'#a4550b',dark:'#ffbc75',dash:[7,3]},
  '3':{light:'#7650ab',dark:'#c5abff',dash:[3,3]},
  '4':{light:'#b33383',dark:'#ff9bd7',dash:[8,3,2,3]},
  resultant:{light:'#087a6b',dark:'#7fd3b8',dash:[]}
};

// Presentation data comes directly from the existing SI engine, without rounding,
// softening, scalar addition or a second field model.
export function individualFields(charges,probe){
  const field=fieldAt(charges,probe);
  const describe=v=>({...v,magnitude:magnitude(v),direction:direction(v)});
  return {...describe(field),contributions:field.contributions.map(v=>({...describe(v),q:charges.find(c=>c.id===v.id).q}))};
}

export function fieldVectorLayout(field,probe,view){
  const origin=view.toScreen(probe);
  const vectors=[...field.contributions,{id:'resultant',x:field.x,y:field.y,magnitude:field.magnitude}];
  const largest=Math.max(...vectors.map(v=>v.magnitude));
  // A single linear px/(N/C) factor for EVERY vector, including the resultant.
  // The maximum length responds to zoom; one common reduction fits tips to view.
  let scale=largest===0?0:Math.min(140,Math.min(view.w,view.h)*.30*(view.zoom??1))/largest;
  if(origin.x>=4&&origin.x<=view.w-4&&origin.y>=4&&origin.y<=view.h-4){
    for(const v of vectors){
      if(v.x>0)scale=Math.min(scale,(view.w-4-origin.x)/v.x);
      if(v.x<0)scale=Math.min(scale,(origin.x-4)/-v.x);
      if(v.y>0)scale=Math.min(scale,(origin.y-4)/v.y);
      if(v.y<0)scale=Math.min(scale,(view.h-4-origin.y)/-v.y);
    }
  }
  return {scale,vectors:vectors.map(v=>({...v,origin:{...origin},end:{x:origin.x+v.x*scale,y:origin.y-v.y*scale},length:v.magnitude*scale}))};
}

// Overlay only: no new pointer targets, so source/probe dragging is unchanged.
export function drawIndividualFields(ctx,state,view,dark){
  let field;try{field=individualFields(state.charges,state.probe);}catch{return;}
  const {vectors}=fieldVectorLayout(field,state.probe,{...view,zoom:state.zoom});
  const focus=state.fieldFocus??'all';
  const ordered=[...vectors].sort((a,b)=>Number(a.id===focus)-Number(b.id===focus));
  ctx.save();
  for(const v of ordered){
    if(v.magnitude===0)continue;
    const style=fieldStyles[v.id],color=style[dark?'dark':'light'];
    ctx.globalAlpha=focus==='all'||focus===v.id?1:.18;
    const path=()=>{ctx.beginPath();ctx.moveTo(v.origin.x,v.origin.y);ctx.lineTo(v.end.x,v.end.y);};
    // A light/dark halo separates arrows from the existing field-line/grid layers.
    ctx.setLineDash([]);path();ctx.strokeStyle=dark?'#142e34':'#f8faf5';ctx.lineWidth=v.id==='resultant'?6:4;ctx.stroke();
    ctx.setLineDash(style.dash);path();ctx.strokeStyle=color;ctx.lineWidth=v.id==='resultant'?3.6:2.2;ctx.stroke();ctx.setLineDash([]);
    const angle=Math.atan2(v.end.y-v.origin.y,v.end.x-v.origin.x),head=Math.min(8,v.length*.4);
    ctx.beginPath();ctx.moveTo(v.end.x,v.end.y);
    ctx.lineTo(v.end.x-head*Math.cos(angle-.45),v.end.y-head*Math.sin(angle-.45));
    ctx.lineTo(v.end.x-head*Math.cos(angle+.45),v.end.y-head*Math.sin(angle+.45));
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  ctx.globalAlpha=1;ctx.font='600 12px system-ui';
  const occupied=state.charges.map(c=>{const p=view.toScreen(c);return {x:p.x-25,y:p.y-32,w:72,h:57};});
  const probe=view.toScreen(state.probe);occupied.push({x:probe.x-23,y:probe.y-23,w:46,h:46});
  const intersects=(a,b)=>a.x<b.x+b.w+3&&a.x+a.w+3>b.x&&a.y<b.y+b.h+3&&a.y+a.h+3>b.y;
  for(const v of vectors){
    const label=fieldLabel(v.id)+(v.magnitude===0?' = 0 N/C':''),width=ctx.measureText(label).width+10;
    const candidates=[];
    for(const [dx,dy] of [[7,-24],[7,8],[-width-7,-24],[-width-7,8],[7,-46],[-width/2,22]])candidates.push({x:v.end.x+dx,y:v.end.y+dy,w:width,h:21});
    const preferredCount=candidates.length;
    // Collinear/equal arrows retain their directions; only their labels move.
    for(let y=32;y<view.h-35;y+=25)for(let x=8;x<view.w-width-4;x+=Math.max(40,width+6))candidates.push({x,y,w:width,h:21});
    const fits=a=>a.x>=4&&a.x+a.w<=view.w-4&&a.y>=29&&a.y+a.h<=view.h-28&&!occupied.some(b=>intersects(a,b));
    const distance=box=>Math.hypot(box.x+box.w/2-v.end.x,box.y+box.h/2-v.end.y);
    const box=candidates.slice(0,preferredCount).find(fits)??candidates.slice(preferredCount).filter(fits).sort((a,b)=>distance(a)-distance(b))[0];
    if(!box)continue; // The accessible selector and full numerical entry always remain available.
    occupied.push(box);ctx.globalAlpha=focus==='all'||focus===v.id?1:.45;
    ctx.fillStyle=dark?'#19353a':'#ffffff';ctx.fillRect(box.x,box.y,box.w,box.h);
    ctx.fillStyle=fieldStyles[v.id][dark?'dark':'light'];ctx.fillText(label,box.x+5,box.y+15);
  }
  ctx.restore();
}
