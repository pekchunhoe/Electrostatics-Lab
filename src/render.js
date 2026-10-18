import {drawMotion} from './motion-render.js';
import {fieldLinePaths} from './field-lines.js';
import {isPlates,plateModel} from './parallel-plates.js';
import {drawPlates} from './parallel-plates-render.js';
import {K,forceOn,magnitude,motionAt,uniformField,createSampler} from './physics.js';
import {drawIndividualFields} from './field-vectors.js';
import {contourGeometry} from './equipotential.js';
import {drawSnapHighlights,drawSnapBadges} from './equipotential-render.js';
export const colors={positive:'#cb5438',negative:'#326db0',field:'#568f89',result:'#087a6b',individual:'#aa7437',text:'#27494e',grid:'#d9e3df',purple:'#7955ad'};
const layerCache=new WeakMap();
export function viewport(w,h,s,tab){
  if(tab===3){
    const c=s.motion,vertical=c.orientation==='vertical',L=c.L??.3;
    const spanX=Math.max(vertical?.25:.42,vertical?c.d*1.8:L*1.3,Math.abs(c.x0)*2+.06),spanY=Math.max(vertical?.42:.25,vertical?L*1.3:c.d*1.8,Math.abs(c.y0)*2+.06);
    const scale=Math.min(w/spanX,h/spanY)*s.zoom;
    return {w,h,scale,toScreen:p=>({x:w/2+p.x*scale,y:h/2-p.y*scale}),toWorld:p=>({x:(p.x-w/2)/scale,y:(h/2-p.y)/scale})};
  }
  if(tab===2&&isPlates(s)){
    const horizontal=s.plates.orientation==='horizontal',scale=Math.min(w/(horizontal?.065:.055),h/(horizontal?.060:.070))*s.zoom;
    return {w,h,scale,toScreen:p=>({x:w/2+p.x*scale,y:h/2-p.y*scale}),toWorld:p=>({x:(p.x-w/2)/scale,y:(h/2-p.y)/scale})};
  }
  const scale=Math.min(w/(tab===3?.42:.60),h/(tab===3?.25:.50))*s.zoom;return {w,h,scale,toScreen:p=>({x:w/2+p.x*scale,y:h/2-p.y*scale}),toWorld:p=>({x:(p.x-w/2)/scale,y:(h/2-p.y)/scale})};}
export function draw(canvas,s,tab){
  const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const v=viewport(w,h,s,tab),p=v.toScreen;const dark=document.documentElement.dataset.theme==='dark';
  const layerKey=JSON.stringify([tab,w,h,dpr,dark,s.charges,s.zoom,s.heat,s.grid,s.contours,s.overlay,s.lines,s.arrows,s.uniform,s.uniformE,s.fieldLines,s.potentialModel,s.plates]);
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
  if(!cacheHit&&tab===2&&s.heat&&!isPlates(s)){for(let y=0;y<h;y+=14)for(let x=0;x<w;x+=14){try{const val=sampleV(v.toWorld({x:x+7,y:y+7}));const alpha=Math.min(.3,Math.abs(val)/(Math.abs(val)+50000)*.3);ctx.fillStyle=val>=0?`rgba(203,84,56,${alpha})`:`rgba(50,109,176,${alpha})`;ctx.fillRect(x,y,14,14);}catch{}}}
  const step=tab===2&&isPlates(s)?.01:.05;
  const lo=v.toWorld({x:0,y:h}),hi=v.toWorld({x:w,y:0});
  if(!cacheHit){
  for(let x=Math.ceil(lo.x/step)*step;x<=hi.x;x+=step)line(p({x,y:lo.y}),p({x,y:hi.y}),dark?'#233e43':colors.grid,.6);
  for(let y=Math.ceil(lo.y/step)*step;y<=hi.y;y+=step)line(p({x:lo.x,y}),p({x:hi.x,y}),dark?'#233e43':colors.grid,.6);
  line({x:0,y:h/2},{x:w,y:h/2},dark?'#416067':'#b6cac4',1);line({x:w/2,y:0},{x:w/2,y:h},dark?'#416067':'#b6cac4',1);
  text('+x',w-22,h/2-7);text('+y',w/2+6,43);
  }
  if(tab===3){
    if(!s.motionResult)s.motionResult=motionAt(s.motion,s.time);
    drawMotion(ctx,s,v,dark,{line,text,arrow});
  } else {
    if(!cacheHit&&tab===2&&s.contours&&!isPlates(s)){
      const geometry=contourGeometry(s,v),placedLabels=[];
      for(const {level,segments,circle} of geometry.levels){
        if(circle){
          ctx.beginPath();ctx.arc(circle.center.x,circle.center.y,circle.radius,0,Math.PI*2);ctx.strokeStyle=(dark?'#c7a4ff':colors.purple);ctx.lineWidth=.9;ctx.stroke();
          const label={x:circle.center.x-circle.radius*.7,y:circle.center.y-circle.radius*.7};
          if(circle.radius>55&&label.x>12&&label.x<w-50&&label.y>55&&label.y<h-40)text(level/1000+' kV',label.x,label.y,(dark?'#c7a4ff':colors.purple),10);
        }else{
          let labelled=false;ctx.beginPath();
          for(const {a,b} of segments){
            ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
            if(!labelled&&a.x>20&&a.x<w-75&&a.y>54&&a.y<h-45&&[...s.charges,s.probe,s.b].every(o=>{const q=p(o);return Math.hypot(q.x-a.x,q.y-a.y)>42;})&&placedLabels.every(q=>Math.hypot(q.x-a.x,q.y-a.y)>44)){
              text(level/1000+' kV',a.x+3,a.y-3,(dark?'#c7a4ff':colors.purple),10);placedLabels.push(a);labelled=true;
            }
          }
          ctx.strokeStyle=(dark?'#c7a4ff':colors.purple);ctx.lineWidth=.9;ctx.globalAlpha=.7;ctx.stroke();ctx.globalAlpha=1;
        }
      }
    }
    const showField=tab===1||(tab===2&&s.overlay);
    if(!cacheHit&&showField&&s.grid){for(let y=30;y<h-20;y+=40)for(let x=25;x<w-15;x+=40){const world=v.toWorld({x,y});if(s.charges.some(c=>Math.hypot(c.x-world.x,c.y-world.y)*v.scale<28)&&!s.uniform)continue;arrow(world,s.uniform?{x:0,y:s.uniformE}:safeField(world),colors.field,17,1);}}
    if(!cacheHit&&((tab===1&&s.lines)||(tab===2&&s.fieldLines&&!s.uniform))){
      for(const points of fieldLinePaths(s,v,{adaptive:tab===2})){
        ctx.beginPath();for(let i=0;i<points.length;i++){const q=p(points[i].world);if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);}
        const color=tab===2?(dark?'#79d6cc':'#167d79'):colors.field;
        ctx.strokeStyle=color;ctx.globalAlpha=tab===2?.9:.65;ctx.lineWidth=tab===2?1.3:1;ctx.stroke();ctx.globalAlpha=1;
        if(tab===2||s.arrows)for(let n=15;n<points.length;n+=tab===2?45:38)arrow(points[n].world,points[n].e,color,8,1);
      }
    }
    if(!cacheHit&&tab===2&&isPlates(s))drawPlates(ctx,s,v,dark,{line,text,arrow});
    if(!cacheHit&&tab===2&&s.uniform&&!isPlates(s)&&s.uniformE!==0&&s.fieldLines){
      for(let x=28;x<w-20;x+=48){line({x,y:30},{x,y:h-30},dark?'#79d6cc':'#167d79',1.2);for(let y=70;y<h-30;y+=65)arrow(v.toWorld({x,y}),{x:0,y:s.uniformE},dark?'#79d6cc':'#167d79',9,1);}
    }
    if(!cacheHit&&(tab===1||tab===2)){const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);layerCache.set(canvas,{key:layerKey,canvas:copy});}
    if(tab===2)drawSnapHighlights(ctx,s,v,dark);
    if(tab===0){try{
      const target=s.charges.find(c=>c.id===s.selected),f=forceOn(s.charges,s.selected),max=Math.max(magnitude(f),...f.contributions.map(magnitude),1e-15),origin=s.fbd?{x:0,y:0}:target;
      for(const part of f.contributions){const other=s.charges.find(c=>c.id===part.id),a=p(target),b=p(other);line(a,b,colors.individual,.8,[3,4]);const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;text(`${part.r.toFixed(3)} m`,mx+5,my-7);arrow(origin,part,colors.individual,75*magnitude(part)/max,2);}
      arrow(origin,f,colors.result,75*magnitude(f)/max,3);
      if(s.components){arrow(origin,{x:f.x,y:0},colors.purple,75*Math.abs(f.x)/max,1.6);arrow(origin,{x:0,y:f.y},colors.purple,75*Math.abs(f.y)/max,1.6);}
      if(s.fbd)text(`Free-body: target q${target.id}`,10,40);
    }catch{}}
    if(tab===1&&s.individualFields)drawIndividualFields(ctx,s,v,dark);
    else if((tab===1||tab===2)&&!isPlates(s)){const e=s.uniform?{x:0,y:s.uniformE}:safeField(s.probe);if(tab===1||s.overlay)arrow(s.probe,e,colors.result,55,3);}
    if(!(tab===2&&s.uniform))for(const charge of s.charges){const a=p(charge);if(charge.id===s.selected){ctx.beginPath();ctx.arc(a.x,a.y,21,0,Math.PI*2);ctx.strokeStyle=colors.result;ctx.lineWidth=2;ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([]);}ctx.beginPath();ctx.arc(a.x,a.y,14,0,Math.PI*2);ctx.fillStyle=charge.q<0?colors.negative:colors.positive;ctx.fill();text(charge.q===0?'0':charge.q>0?'+':'−',a.x-6,a.y+6,'#fff',21);text(`q${charge.id}`,a.x+18,a.y-13);}
    if(tab===1||tab===2)for(const [label,world] of tab===2?[['A',s.probe],['B',s.b]]:[['A',s.probe]]){const a=p(world);ctx.beginPath();ctx.arc(a.x,a.y,10,0,Math.PI*2);ctx.fillStyle=label==='A'?colors.result:colors.purple;ctx.fill();text(label,a.x-4,a.y+4,'#fff',11);line({x:a.x-15,y:a.y},{x:a.x+15,y:a.y},label==='A'?colors.result:colors.purple,1);line({x:a.x,y:a.y-15},{x:a.x,y:a.y+15},label==='A'?colors.result:colors.purple,1);}
    if(tab===2)drawSnapBadges(ctx,s,v,dark);
    text(tab===2&&isPlates(s)?'Ideal central region | drag probes A and B':tab===0?'Drag a charge · select the force target':tab===1?'Drag sources or probe A':'Drag probes A and B to compare potential',10,20);
  }
  const scaleLength=tab===2&&isPlates(s)?.01:.05,sy=h-13;line({x:12,y:sy},{x:12+scaleLength*v.scale,y:sy},dark?'#c2d4d0':colors.text,2);text(scaleLength+' m',18+scaleLength*v.scale,sy+4);
  return tab===3?[]:[...(!(tab===2&&s.uniform)?s.charges.map(c=>({key:c.id,label:`Charge ${c.id}`,point:c})):[]),...(tab===1||tab===2?[{key:'probe',label:'Probe A',point:s.probe}]:[]),...(tab===2?[{key:'b',label:'Probe B',point:s.b}]:[])].map(o=>({...o,...p(o.point)}));
}
