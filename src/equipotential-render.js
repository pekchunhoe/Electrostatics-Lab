import {attachedContour} from './equipotential.js';

export function drawSnapHighlights(ctx,s,view,dark){
  if(!s.snapEnabled||!s.contours)return;
  const drawn=new Set();ctx.save();
  for(const key of ['probe','b']){
    const contour=attachedContour(s,key,view);if(!contour)continue;
    const id=`${contour.level}:${contour.id}`;if(drawn.has(id))continue;drawn.add(id);
    ctx.beginPath();for(const edge of contour.segments){ctx.moveTo(edge.a.x,edge.a.y);ctx.lineTo(edge.b.x,edge.b.y);}
    ctx.lineWidth=2.3;ctx.strokeStyle=dark?'#9de4c9':'#087a6b';ctx.globalAlpha=.85;ctx.stroke();
  }
  ctx.restore();
}
export function drawSnapBadges(ctx,s,view,dark){
  if(!s.snapEnabled)return;ctx.save();ctx.font='600 11px system-ui';
  const occupied=s.uniform?[]:s.charges.map(c=>{const p=view.toScreen(c);return {x:p.x-22,y:p.y-29,w:66,h:52};});
  for(const key of ['probe','b']){const p=view.toScreen(s[key]);occupied.push({x:p.x-16,y:p.y-16,w:32,h:32});}
  const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  for(const key of ['probe','b']){
    const held=s.attachments?.[key];if(!held)continue;
    const p=view.toScreen(s[key]);if(p.x<0||p.x>view.w||p.y<0||p.y>view.h)continue;
    const color=key==='probe'?(dark?'#9de4c9':'#087a6b'):(dark?'#cfb4ff':'#7955ad');
    ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.setLineDash([3,2]);ctx.strokeRect(p.x-15,p.y-15,30,30);ctx.setLineDash([]);
    const number=Number((Math.abs(held.level)>=1000?held.level/1000:held.level).toPrecision(4));
    const label=`${key==='probe'?'A':'B'} · ${number} ${Math.abs(held.level)>=1000?'kV':'V'}`,width=ctx.measureText(label).width+10;
    const boxes=[[20,-30],[20,10],[-width-20,-30],[-width-20,10],[-width/2,-44],[-width/2,24]].map(([x,y])=>({x:p.x+x,y:p.y+y,w:width,h:20}));
    const box=boxes.find(b=>b.x>=4&&b.x+b.w<=view.w-4&&b.y>=30&&b.y+b.h<=view.h-27&&!occupied.some(a=>intersects(a,b)));
    if(box){ctx.fillStyle=dark?'#19353a':'#fff';ctx.fillRect(box.x,box.y,box.w,box.h);ctx.fillStyle=color;ctx.fillText(label,box.x+5,box.y+14);occupied.push(box);}
  }
  ctx.restore();
}
