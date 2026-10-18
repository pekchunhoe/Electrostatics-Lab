import {motionGeometry,motionForces,kinematics} from './physics.js';
import {PARTICLE_RADIUS,accelerationGlyph} from './motion-state.js';

export function drawMotion(ctx,s,v,dark,{line,text,arrow}){
  const c=s.motion,g=motionGeometry(c),m=s.motionResult,p=v.toScreen;
  if(!m)return;
  const color={positive:dark?'#ffa78d':'#cb5438',negative:dark?'#9ac6ff':'#326db0',field:dark?'#79d6cc':'#568f89',velocity:dark?'#c7a4ff':'#7955ad',acceleration:dark?'#ffc06b':'#b25f00',external:dark?'#f0a8dc':'#ae438b',electric:dark?'#7fd3b8':'#087a6b',gravity:dark?'#e5c49a':'#916329'};
  for(const n of [-c.d/2,c.d/2]){
    const a=p(g.world(-g.L/2,n)),b=p(g.world(g.L/2,n)),positive=n*c.voltage<0,col=positive?color.positive:color.negative;
    line(a,b,col,5);
    for(let i=1;i<=5;i++){
      const z=p(g.world(g.L*(i/6-.5),n)),symbol=c.voltage===0?'0':positive?'+':'−';
      if(c.orientation==='vertical')text(symbol,z.x+(n>0?9:-19),z.y+4,col,14);
      else text(symbol,z.x-4,z.y+(n>0?-9:19),col,14);
    }
  }
  if(c.voltage!==0)for(let i=1;i<=5;i++){
    const u=g.L*(i/6-.5),n=-Math.sign(c.voltage)*c.d*.27;
    arrow(g.world(u,n),g.field,color.field,Math.min(60,c.d*v.scale*.45),1.2);
  }
  if(s.trace){
    ctx.beginPath();ctx.strokeStyle=color.velocity;ctx.lineWidth=2;ctx.setLineDash([3,3]);let begun=false;
    for(const segment of m.segments){
      const duration=segment.end-segment.start;
      const speed=Math.hypot(segment.p.vx,segment.p.vy)+Math.hypot(segment.a.x,segment.a.y)*duration;
      const count=Math.min(160,Math.max(2,Math.ceil(duration*speed*v.scale/5)));
      for(let i=0;i<=count;i++){
        const q=p(kinematics(segment.p,{x:segment.p.vx,y:segment.p.vy},segment.a,duration*i/count));
        if(!begun){ctx.moveTo(q.x,q.y);begun=true;}else ctx.lineTo(q.x,q.y);
      }
    }
    ctx.stroke();ctx.setLineDash([]);
  }
  const point=p(m);
  if(m.status!=='Canvas exit'){
    ctx.beginPath();ctx.arc(point.x,point.y,PARTICLE_RADIUS,0,2*Math.PI);ctx.fillStyle=c.q<0?color.negative:color.positive;ctx.fill();text(c.q===0?'0':c.q>0?'+':'−',point.x-5,point.y+5,'#fff',16);
    if(m.status!=='Plate impact'){
      const f=motionForces(c,m.ex!==0||m.ey!==0),max=Math.max(...[f.electric,f.gravity,f.external].map(z=>Math.hypot(z.x,z.y)),1e-300);
      for(const [vector,label,col] of [[f.electric,'Fₑ',color.electric],[f.gravity,'mg',color.gravity],[f.external,'Fext',color.external]]){
        const mag=Math.hypot(vector.x,vector.y);if(mag===0)continue;
        const length=30*mag/max;arrow(m,vector,col,length,2);
        text(label,Math.max(5,Math.min(v.w-30,point.x+vector.x/mag*length+5)),Math.max(36,Math.min(v.h-45,point.y-vector.y/mag*length-5)),col,10);
      }
    }
    const speed=Math.hypot(m.vx,m.vy);
    if(speed>0){arrow(m,{x:m.vx,y:m.vy},color.velocity,36,2);text('v',Math.max(5,Math.min(v.w-16,point.x+36*m.vx/speed+5)),Math.max(35,Math.min(v.h-40,point.y-36*m.vy/speed-5)),color.velocity,11);}
    if(s.showAcceleration){
      const glyph=accelerationGlyph(m,v),o=glyph.origin,e=glyph.end;
      if(glyph.length>0){
        line(o,e,color.acceleration,2.5,[4,2]);
        const a=Math.atan2(e.y-o.y,e.x-o.x),head=Math.min(7,glyph.length*.4);
        ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x-head*Math.cos(a-.45),e.y-head*Math.sin(a-.45));ctx.lineTo(e.x-head*Math.cos(a+.45),e.y-head*Math.sin(a+.45));ctx.closePath();ctx.fillStyle=color.acceleration;ctx.fill();
        text('a',Math.max(5,Math.min(v.w-16,e.x+5)),Math.max(35,Math.min(v.h-32,e.y-5)),color.acceleration,12);
      }else text('a = 0 m/s²',Math.max(5,Math.min(v.w-85,point.x+15)),Math.max(36,Math.min(v.h-35,point.y+28)),color.acceleration,10);
    }
  }
  text(m.status,10,20);text(`L = ${Number(g.L.toPrecision(3))} m · d = ${Number(c.d.toPrecision(3))} m · no fringing`,10,v.h-30,undefined,10);
}
