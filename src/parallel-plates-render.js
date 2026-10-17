import {plateModel} from './parallel-plates.js';

export function drawPlates(ctx,s,v,dark,{line,text,arrow}){
  const c=s.plates,m=plateModel(c),p=v.toScreen;
  const purple=dark?'#c7a4ff':'#7955ad',teal=dark?'#79d6cc':'#167d79';
  const start=p(m.atLevel(c.voltage,-c.halfLength)),end=p(m.atLevel(0,c.halfLength));
  ctx.fillStyle=dark?'#23413f':'#edf6ef';ctx.fillRect(Math.min(start.x,end.x),Math.min(start.y,end.y),Math.abs(end.x-start.x),Math.abs(end.y-start.y));
  if(s.contours)for(const f of [.25,.5,.75]){
    const a=p(m.atLevel(c.voltage*f,-c.halfLength)),b=p(m.atLevel(c.voltage*f,c.halfLength));
    line(a,b,purple,1.2);
    const label=c.voltage*f+' V';
    // Endpoint labels avoid the central interaction region.
    ctx.font='10px system-ui';
    if(c.orientation==='horizontal')text(label,Math.max(3,a.x-ctx.measureText(label).width-7),a.y+3,purple,10);
    else{
      // Narrow vertical gaps cannot fit three horizontal voltage labels.
      // Place a label along its own line, clear of both probe targets.
      const length=ctx.measureText(label).width,top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
      const candidates=[top+8,bottom-length-8,(top+bottom-length)/2];
      const y=candidates.find(y=>y>30&&y+length<v.h-28&&[s.probe,s.b].every(q=>{
        const z=p(q);return z.x<a.x-16||z.x>a.x+30||z.y<y-16||z.y>y+length+16;
      }));
      if(y!==undefined){ctx.save();ctx.translate(a.x+4,y+length);ctx.rotate(-Math.PI/2);text(label,0,0,purple,10);ctx.restore();}
    }
  }
  if(s.fieldLines){
    const count=v.w<420?5:7;
    for(let i=0;i<count;i++){
      const t=-c.halfLength*.78+1.56*c.halfLength*i/(count-1),a=m.atLevel(c.voltage,t),b=m.atLevel(0,t);
      line(p(a),p(b),teal,1.3);
      for(const f of [.32,.68])arrow(m.atLevel(c.voltage*f,t),m.field,teal,Math.min(10,c.d*v.scale*.12),1.4);
    }
  }
  for(const level of [c.voltage,0]){
    const a=p(m.atLevel(level,-c.halfLength)),b=p(m.atLevel(level,c.halfLength)),positive=level!==0;
    const color=positive?(dark?'#ffa78d':'#cb5438'):(dark?'#9ac6ff':'#326db0');
    line(a,b,color,5);
    if(c.orientation==='horizontal')text(`${positive?'+':'−'} ${level} V`,Math.max(6,a.x),a.y+(a.y<v.h/2?-12:23),color,11);
    else{
      text(`${positive?'+':'−'} ${level} V`,a.x+(a.x<v.w/2?-53:9),Math.max(45,Math.min(a.y,b.y)+14),color,10);
    }
  }
  // Distance marker follows the actual gap and orientation.
  const a=p(m.atLevel(c.voltage,c.halfLength+.003)),b=p(m.atLevel(0,c.halfLength+.003));
  line(a,b,dark?'#c2d4d0':'#27494e',1,[3,3]);
  const label=`d = ${Number(c.d.toPrecision(3))} m`;
  text(label,v.w-90,v.h-10,undefined,10);
}
