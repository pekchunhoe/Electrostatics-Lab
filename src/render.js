import {K,forceOn,magnitude,motionAt,uniformField,createSampler} from './physics.js';
import {drawIndividualFields} from './field-vectors.js';
export const colors={positive:'#cb5438',negative:'#326db0',field:'#568f89',result:'#087a6b',individual:'#aa7437',text:'#27494e',grid:'#d9e3df',purple:'#7955ad'};
const layerCache=new WeakMap();
export function viewport(w,h,s,tab){const scale=Math.min(w/(tab===3?.42:.60),h/(tab===3?.25:.50))*s.zoom;return {w,h,scale,toScreen:p=>({x:w/2+p.x*scale,y:h/2-p.y*scale}),toWorld:p=>({x:(p.x-w/2)/scale,y:(h/2-p.y)/scale})};}
export function draw(canvas,s,tab){
  const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const v=viewport(w,h,s,tab),p=v.toScreen;const dark=document.documentElement.dataset.theme==='dark';
  const layerKey=JSON.stringify([tab,w,h,dpr,dark,s.charges,s.zoom,s.heat,s.grid,s.contours,s.overlay,s.lines,s.arrows,s.uniform,s.uniformE]);
  const cached=layerCache.get(canvas),cacheHit=(tab===1||tab===2)&&cached?.key===layerKey;
  if(cacheHit)ctx.drawImage(cached.canvas,0,0,w,h);
  else{ctx.fillStyle=dark?'#142e34':'#f8faf5';ctx.fillRect(0,0,w,h);}
  const text=(str,x,y,color=dark?'#c2d4d0':colors.text,size=11)=>{ctx.fillStyle=color;ctx.font=`${size}px system-ui`;ctx.fillText(str,x,y);};
  const line=(a,b,color,width=1,dash=[])=>{ctx.beginPath();ctx.setLineDash(dash);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);};
  const arrow=(origin,vec,color,length=45,width=2)=>{
    const mag=magnitude(vec);if(mag===0)return;const a=p(origin),dx=vec.x/mag*length,dy=-vec.y/mag*length,b={x:a.x+dx,y:a.y+dy},angle=Math.atan2(dy,dx);
    line(a,b,color,width);ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-8*Math.cos(angle-.45),b.y-8*Math.sin(angle-.45));ctx.lineTo(b.x-8*Math.cos(angle+.45),b.y-8*Math.sin(angle+.45));ctx.closePath();ctx.fillStyle=color;ctx.fill();
  };
  const sampler=createSampler(s.charges),sampleV=point=>s.uniform?-s.uniformE*point.y:sampler.potential(point);
  const safeField=point=>{try{return sampler.field(point);}catch{return {x:0,y:0};}};
  // Background potential samples affect visual colour only, never the numerical engine.
  if(!cacheHit&&tab===2&&s.heat){for(let y=0;y<h;y+=14)for(let x=0;x<w;x+=14){try{const val=sampleV(v.toWorld({x:x+7,y:y+7}));const alpha=Math.min(.3,Math.abs(val)/(Math.abs(val)+50000)*.3);ctx.fillStyle=val>=0?`rgba(203,84,56,${alpha})`:`rgba(50,109,176,${alpha})`;ctx.fillRect(x,y,14,14);}catch{}}}
  const step=.05;
  const lo=v.toWorld({x:0,y:h}),hi=v.toWorld({x:w,y:0});
  if(!cacheHit){
  for(let x=Math.ceil(lo.x/step)*step;x<=hi.x;x+=step)line(p({x,y:lo.y}),p({x,y:hi.y}),dark?'#233e43':colors.grid,.6);
  for(let y=Math.ceil(lo.y/step)*step;y<=hi.y;y+=step)line(p({x:lo.x,y}),p({x:hi.x,y}),dark?'#233e43':colors.grid,.6);
  line({x:0,y:h/2},{x:w,y:h/2},dark?'#416067':'#b6cac4',1);line({x:w/2,y:0},{x:w/2,y:h},dark?'#416067':'#b6cac4',1);
  text('+x',w-22,h/2-7);text('+y',w/2+6,43);
  }
  if(tab===3){
    const c=s.motion,E=uniformField(c.voltage,c.d);let m;try{m=motionAt(c,s.time);}catch{return [];}
    for(const y of [-c.d/2,c.d/2]){const a=p({x:-.15,y}),b=p({x:.15,y});line(a,b,(y<0?E>=0:E<0)?colors.positive:colors.negative,5);for(let x=-.13;x<=.13;x+=.052){const z=p({x,y});text(E===0?'0':((y<0?E>0:E<0)?'+':'−'),z.x-4,z.y+(y>0?-8:18),dark?'#d9e6e1':colors.text,14);}}
    for(let x=-.11;x<.14;x+=.055)arrow({x,y:-Math.sign(E)*c.d*.28},{x:0,y:E},colors.field,c.d*v.scale*.42,1.4);
    if(s.trace){ctx.beginPath();ctx.strokeStyle=colors.purple;ctx.lineWidth=2;ctx.setLineDash([3,3]);for(let i=0;i<=100;i++){const a=p(motionAt(c,s.time*i/100));if(i===0)ctx.moveTo(a.x,a.y);else ctx.lineTo(a.x,a.y);}ctx.stroke();ctx.setLineDash([]);}
    const point=p(m);ctx.beginPath();ctx.arc(point.x,point.y,9,0,Math.PI*2);ctx.fillStyle=c.q<0?colors.negative:colors.positive;ctx.fill();text(c.q===0?'0':c.q>0?'+':'−',point.x-5,point.y+5,'#fff',16);
    const fe=c.q*m.ey,fg=c.gravity?-c.mass*9.81:0,maxForce=Math.max(Math.abs(fe),Math.abs(fg),1e-30);
    arrow(m,{x:0,y:fe},colors.result,35*Math.abs(fe)/maxForce,2.5);if(c.gravity)arrow(m,{x:0,y:fg},colors.individual,35*Math.abs(fg)/maxForce,2);
    arrow(m,{x:m.vx,y:m.vy},colors.purple,38,2);
    if(Math.hypot(m.vx,m.vy)>1e-10)text('v',point.x+38*m.vx/Math.hypot(m.vx,m.vy)+5,point.y-38*m.vy/Math.hypot(m.vx,m.vy)-5,colors.purple,12);
    if(Math.abs(fe)>1e-12)text('Fₑ',point.x+5,point.y-Math.sign(fe)*36,colors.result,11);
    if(c.gravity)text('mg',point.x+5,point.y+43,colors.individual,11);
    const eLabel=p({x:.125,y:.006});text(m.status,10,20);text('E',eLabel.x,eLabel.y,colors.field,12);text('Plate length = 0.300 m · fringing neglected',10,h-30);
  } else {
    const singleSource=!s.uniform&&s.charges.filter(c=>c.q!==0).length===1?s.charges.find(c=>c.q!==0):null;
    if(!cacheHit&&tab===2&&s.contours&&singleSource){
      const center=p(singleSource);
      for(const absV of [10000,20000,40000,80000,160000,320000,640000]){const radius=K*Math.abs(singleSource.q)/absV*v.scale;if(radius<20||radius>Math.hypot(w,h))continue;ctx.beginPath();ctx.arc(center.x,center.y,radius,0,Math.PI*2);ctx.strokeStyle=colors.purple;ctx.lineWidth=.9;ctx.stroke();const label={x:center.x-radius*.7,y:center.y-radius*.7};if(radius>55&&label.x>12&&label.x<w-50&&label.y>55&&label.y<h-40)text(`${Math.sign(singleSource.q)*absV/1000} kV`,label.x,label.y,colors.purple,10);}
    }
    if(!cacheHit&&tab===2&&s.contours&&!singleSource){
      // Marching triangles: linear interpolation on a sampled scalar potential.
      // A shared diagonal resolves saddle ambiguities consistently.
      const cell=12,nx=Math.ceil(w/cell),ny=Math.ceil(h/cell),samples=[];
      for(let j=0;j<=ny;j++){samples[j]=[];for(let i=0;i<=nx;i++){try{samples[j][i]=sampleV(v.toWorld({x:i*cell,y:j*cell}));}catch{samples[j][i]=null;}}}
      const levels=s.uniform?[-3000,-2000,-1000,0,1000,2000,3000]:[-320000,-160000,-80000,-40000,-20000,-10000,0,10000,20000,40000,80000,160000,320000];
      const placedLabels=[];
      for(const level of levels){let labelled=false;ctx.beginPath();for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
        const z00=samples[j][i],z10=samples[j][i+1],z11=samples[j+1][i+1],z01=samples[j+1][i];
        if(z00!==null&&z10!==null&&z11!==null&&z01!==null&&(Math.min(z00,z10,z11,z01)>level||Math.max(z00,z10,z11,z01)<level))continue;
        const pts=[{x:i*cell,y:j*cell,z:samples[j][i]},{x:(i+1)*cell,y:j*cell,z:samples[j][i+1]},{x:(i+1)*cell,y:(j+1)*cell,z:samples[j+1][i+1]},{x:i*cell,y:(j+1)*cell,z:samples[j+1][i]}];
        for(const ids of [[0,1,2],[0,2,3]]){const hits=[];for(let k=0;k<3;k++){const a=pts[ids[k]],b=pts[ids[(k+1)%3]];if(a.z===null||b.z===null)continue;if((a.z<level)!==(b.z<level)){const t=(level-a.z)/(b.z-a.z);hits.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}}if(hits.length===2){ctx.moveTo(hits[0].x,hits[0].y);ctx.lineTo(hits[1].x,hits[1].y);if(!labelled&&hits[0].x>20&&hits[0].x<w-75&&hits[0].y>54&&hits[0].y<h-45&&[...s.charges,s.probe,s.b].every(o=>{const a=p(o);return Math.hypot(a.x-hits[0].x,a.y-hits[0].y)>42;})&&placedLabels.every(a=>Math.hypot(a.x-hits[0].x,a.y-hits[0].y)>44)){text(`${level/1000} kV`,hits[0].x+3,hits[0].y-3,colors.purple,10);placedLabels.push(hits[0]);labelled=true;}}}
      }ctx.strokeStyle=colors.purple;ctx.lineWidth=.9;ctx.globalAlpha=.7;ctx.stroke();ctx.globalAlpha=1;}
    }
    const showField=tab===1||(tab===2&&s.overlay);
    if(!cacheHit&&showField&&s.grid){for(let y=30;y<h-20;y+=40)for(let x=25;x<w-15;x+=40){const world=v.toWorld({x,y});if(s.charges.some(c=>Math.hypot(c.x-world.x,c.y-world.y)*v.scale<28)&&!s.uniform)continue;arrow(world,s.uniform?{x:0,y:s.uniformE}:safeField(world),colors.field,17,1);}}
    if(!cacheHit&&tab===1&&s.lines){
      // RK4 integration of dr/ds = ±E/|E|, always arrowed along physical E.
      // Seed each nonzero source; stop at source boundaries or near a null.
      const ds=.0035,unit=(point,sign)=>{const e=safeField(point),m=magnitude(e);return m<1e-6?null:{x:sign*e.x/m,y:sign*e.y/m};};
      const occupied=new Set();
      for(const source of s.charges.filter(c=>c.q!==0))for(let seed=0;seed<12;seed++){
        const sign=Math.sign(source.q),angle=seed*Math.PI/6;let world={x:source.x+.016*Math.cos(angle),y:source.y+.016*Math.sin(angle)},points=[];
        for(let n=0;n<350;n++){
          const screen=p(world);if(screen.x<0||screen.x>w||screen.y<0||screen.y>h)break;
          if(s.charges.some(c=>Math.hypot(c.x-world.x,c.y-world.y)<.012))break;
          const k1=unit(world,sign);if(!k1)break;const k2=unit({x:world.x+ds*k1.x/2,y:world.y+ds*k1.y/2},sign);if(!k2)break;const k3=unit({x:world.x+ds*k2.x/2,y:world.y+ds*k2.y/2},sign);if(!k3)break;const k4=unit({x:world.x+ds*k3.x,y:world.y+ds*k3.y},sign);if(!k4)break;
          if(k1.x*k4.x+k1.y*k4.y<0)break; // Do not step across a field null and reverse.
          const key=`${Math.round(screen.x/3)},${Math.round(screen.y/3)}`;if(n>8&&occupied.has(key))break;
          points.push({world:{...world},e:safeField(world)});world={x:world.x+ds*(k1.x+2*k2.x+2*k3.x+k4.x)/6,y:world.y+ds*(k1.y+2*k2.y+2*k3.y+k4.y)/6};
        }
        if(points.length>2){ctx.beginPath();for(let i=0;i<points.length;i++){const screen=p(points[i].world);occupied.add(`${Math.round(screen.x/3)},${Math.round(screen.y/3)}`);if(i===0)ctx.moveTo(screen.x,screen.y);else ctx.lineTo(screen.x,screen.y);}ctx.strokeStyle=colors.field;ctx.globalAlpha=.65;ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;if(s.arrows)for(let n=15;n<points.length;n+=38)arrow(points[n].world,points[n].e,colors.field,8,1);}
      }
    }
    if(!cacheHit&&(tab===1||tab===2)){const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);layerCache.set(canvas,{key:layerKey,canvas:copy});}
    if(tab===0){try{
      const target=s.charges.find(c=>c.id===s.selected),f=forceOn(s.charges,s.selected),max=Math.max(magnitude(f),...f.contributions.map(magnitude),1e-15),origin=s.fbd?{x:0,y:0}:target;
      for(const part of f.contributions){const other=s.charges.find(c=>c.id===part.id),a=p(target),b=p(other);line(a,b,colors.individual,.8,[3,4]);const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;text(`${part.r.toFixed(3)} m`,mx+5,my-7);arrow(origin,part,colors.individual,75*magnitude(part)/max,2);}
      arrow(origin,f,colors.result,75*magnitude(f)/max,3);
      if(s.components){arrow(origin,{x:f.x,y:0},colors.purple,75*Math.abs(f.x)/max,1.6);arrow(origin,{x:0,y:f.y},colors.purple,75*Math.abs(f.y)/max,1.6);}
      if(s.fbd)text(`Free-body: target q${target.id}`,10,40);
    }catch{}}
    if(tab===1&&s.individualFields)drawIndividualFields(ctx,s,v,dark);
    else if(tab===1||tab===2){const e=s.uniform?{x:0,y:s.uniformE}:safeField(s.probe);if(tab===1||s.overlay)arrow(s.probe,e,colors.result,55,3);}
    if(!(tab===2&&s.uniform))for(const charge of s.charges){const a=p(charge);if(charge.id===s.selected){ctx.beginPath();ctx.arc(a.x,a.y,21,0,Math.PI*2);ctx.strokeStyle=colors.result;ctx.lineWidth=2;ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([]);}ctx.beginPath();ctx.arc(a.x,a.y,14,0,Math.PI*2);ctx.fillStyle=charge.q<0?colors.negative:colors.positive;ctx.fill();text(charge.q===0?'0':charge.q>0?'+':'−',a.x-6,a.y+6,'#fff',21);text(`q${charge.id}`,a.x+18,a.y-13);}
    if(tab===1||tab===2)for(const [label,world] of tab===2?[['A',s.probe],['B',s.b]]:[['A',s.probe]]){const a=p(world);ctx.beginPath();ctx.arc(a.x,a.y,10,0,Math.PI*2);ctx.fillStyle=label==='A'?colors.result:colors.purple;ctx.fill();text(label,a.x-4,a.y+4,'#fff',11);line({x:a.x-15,y:a.y},{x:a.x+15,y:a.y},label==='A'?colors.result:colors.purple,1);line({x:a.x,y:a.y-15},{x:a.x,y:a.y+15},label==='A'?colors.result:colors.purple,1);}
    text(tab===0?'Drag a charge · select the force target':tab===1?'Drag sources or probe A':'Drag probes A and B to compare potential',10,20);
  }
  const scaleLength=.05,sy=h-13;line({x:12,y:sy},{x:12+scaleLength*v.scale,y:sy},dark?'#c2d4d0':colors.text,2);text('0.05 m',18+scaleLength*v.scale,sy+4);
  return tab===3?[]:[...(!(tab===2&&s.uniform)?s.charges.map(c=>({key:c.id,label:`Charge ${c.id}`,point:c})):[]),...(tab===1||tab===2?[{key:'probe',label:'Probe A',point:s.probe}]:[]),...(tab===2?[{key:'b',label:'Probe B',point:s.b}]:[])].map(o=>({...o,...p(o.point)}));
}
