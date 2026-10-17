import {createSampler,magnitude} from './physics.js';

const caches=new WeakMap();
// Shared by Electric Field and Electric Potential. Trajectories integrate
// dr/ds = ±E/|E| with RK4. Every stored arrow vector is the physical +E.
export function fieldLinePaths(s,view,{adaptive=false}={}){
  const key=JSON.stringify([s.charges,view.w,view.h,view.scale,adaptive]);
  const cached=caches.get(s);if(cached?.key===key)return cached.paths;
  const sampler=createSampler(s.charges),sources=s.charges.filter(c=>c.q!==0),paths=[],occupied=new Set();
  const safeField=p=>{try{return sampler.field(p);}catch{return {x:0,y:0};}};
  const unit=(p,sign)=>{const e=safeField(p),m=magnitude(e);return m<1e-6?null:{x:sign*e.x/m,y:sign*e.y/m};};
  const density=adaptive?(view.w<420?8:12):12;
  for(const source of sources)for(let seed=0;seed<density;seed++){
    const sign=Math.sign(source.q),angle=seed*2*Math.PI/density;
    const radius=adaptive?Math.max(16/view.scale,.002):.016;
    let world={x:source.x+radius*Math.cos(angle),y:source.y+radius*Math.sin(angle)},points=[];
    for(let n=0;n<(adaptive?1100:350);n++){
      const screen=view.toScreen(world),near=Math.min(...sources.map(c=>Math.hypot(c.x-world.x,c.y-world.y)));
      if(screen.x<0||screen.x>view.w||screen.y<0||screen.y>view.h||near<(adaptive?14/view.scale:.012))break;
      const ds=adaptive?Math.min(.0035,2/view.scale,near*.08):.0035;
      const k1=unit(world,sign);if(!k1)break;
      const k2=unit({x:world.x+ds*k1.x/2,y:world.y+ds*k1.y/2},sign);if(!k2)break;
      const k3=unit({x:world.x+ds*k2.x/2,y:world.y+ds*k2.y/2},sign);if(!k3)break;
      const k4=unit({x:world.x+ds*k3.x,y:world.y+ds*k3.y},sign);if(!k4)break;
      if(k1.x*k4.x+k1.y*k4.y<(adaptive?.95:0))break; // Stop before unresolved nulls / sharp reversals.
      const cell=`${Math.round(screen.x/3)},${Math.round(screen.y/3)}`;
      if((adaptive||n>8)&&occupied.has(cell))break;
      points.push({world:{...world},e:safeField(world)});
      world={x:world.x+ds*(k1.x+2*k2.x+2*k3.x+k4.x)/6,y:world.y+ds*(k1.y+2*k2.y+2*k3.y+k4.y)/6};
    }
    if(points.length>2){for(const point of points){const p=view.toScreen(point.world);const x=Math.round(p.x/3),y=Math.round(p.y/3);for(let dx=adaptive?-1:0;dx<=(adaptive?1:0);dx++)for(let dy=adaptive?-1:0;dy<=(adaptive?1:0);dy++)occupied.add(`${x+dx},${y+dy}`);}paths.push(points);}
  }
  caches.set(s,{key,paths});return paths;
}
