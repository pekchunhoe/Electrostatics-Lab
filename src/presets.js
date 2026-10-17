const c=(id,q,x,y)=>({id,q:q*1e-6,x,y});
export const chargePresets = {
  positive:{label:'Single positive',charges:[c('1',2,0,0)]},
  negative:{label:'Single negative',charges:[c('1',-2,0,0)]},
  equal:{label:'Two equal positive',charges:[c('1',1,-.1,0),c('2',1,.1,0)]},
  opposite:{label:'Opposite charges',charges:[c('1',1,-.1,0),c('2',-1,.1,0)]},
  unequal:{label:'Unequal pair',charges:[c('1',1,-.1,0),c('2',4,.1,0)]},
  triangle:{label:'Three-charge triangle',charges:[c('1',1,0,.1),c('2',2,-.1,-.1),c('3',-1,.1,-.1)]},
  square:{label:'Four-charge square',charges:[c('1',1,-.1,.1),c('2',-1,.1,.1),c('3',1,.1,-.1),c('4',-1,-.1,-.1)]}
};
export const motionPresets={
  rest:{label:'A · Initially at rest',x0:0,y0:0,vx:0,vy:0},
  perpendicular:{label:'B · Perpendicular launch',x0:-.12,y0:0,vx:2,vy:0},
  parallel:{label:'C · Parallel / reversal',x0:0,y0:.01,vx:0,vy:-.3},
  equilibrium:{label:'D · Dynamic equilibrium',x0:-.12,y0:0,vx:1,vy:0,gravity:true,voltage:784.8}
};
export const motionDefaults={voltage:300,d:.08,q:1e-9,mass:1e-6,gravity:false,x0:-.12,y0:0,vx:2,vy:0};
export function makeState(tab) {
  const preset=tab===0?'opposite':tab===1?'positive':'equal';
  return {preset,charges:structuredClone(chargePresets[preset].charges),selected:'1',probe:{x:tab===1?.2:0,y:0},b:{x:0,y:.15},testQ:2e-9,uniform:false,uniformE:15000,zoom:1,components:false,fbd:false,lines:true,arrows:true,grid:tab===1,contours:true,heat:false,overlay:false,trace:true,motion:{...motionDefaults},experiment:'perpendicular',time:0,playing:false,speed:1,challenge:0,revealed:false,prediction:'',guide:0};
}
export function loadPreset(state,key) {
  if(!chargePresets[key])throw new RangeError('Unknown preset');
  state.preset=key;state.charges=structuredClone(chargePresets[key].charges);state.selected=state.charges[0].id;
  state.probe={x:key==='positive'||key==='negative'?.2:0,y:0};state.b={x:0,y:.15};state.uniform=false;
}
export function loadExperiment(state,key) {
  state.experiment=key;state.motion={...motionDefaults,...motionPresets[key]};state.time=0;state.playing=false;
}
