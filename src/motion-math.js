import {G,motionGeometry,motionForces,magnitude} from './physics.js';
import {notation as math,equations as eq,quantity as Q,vectorValue as V,scientific as N} from './math.js';
const t=String.raw;

// Select terms from the actual enabled model AND the particle's current region.
// The flight model is replaced by the absorbing constraint after contact.
export function activeForceModel(c,m){
  const f=m.forces??motionForces(c,m.ex!==0||m.ey!==0,{x:m.vx,y:m.vy});
  const electric=m.ex!==0||m.ey!==0,gravity=c.balanceMode==='gravity'||(!c.balanceMode&&c.gravity),magnetic=c.balanceMode==='magnetic',external=!c.balanceMode&&!!(c.externalX||c.externalY),contact=m.status==='Plate impact';
  const terms=[electric?t`q\vec E`:null,gravity?t`m\vec g`:null,magnetic?t`q(\vec v\times\vec B)`:null,external?t`\vec F_{\mathrm{ext}}`:null].filter(Boolean);
  const numerator=terms.join('+');
  const force=contact?t`\vec F_{\mathrm{net}}=\vec 0`:t`\vec F_{\mathrm{net}}=`+(numerator||t`\vec 0`);
  const acceleration=contact||!terms.length?t`\vec a=\vec 0`:gravity&&!electric&&!magnetic&&!external?t`\vec a=\vec g`:magnetic&&!gravity&&!external?t`\vec a=\frac{q(`+(electric?t`\vec E+`:'')+t`\vec v\times\vec B)}{m}`:t`\vec a=\frac{`+numerator+'}{m}';
  return {f,electric,gravity,magnetic,external,contact,force,acceleration};
}

export function motionCalculations(s,m,status,components){
  const c=s.motion,g=motionGeometry(c),model=activeForceModel(c,m),{f,electric,gravity,magnetic,external,contact}=model;
  const E=magnitude(g.field),speed=Math.hypot(m.vx,m.vy),acc=Math.hypot(m.ax,m.ay),zero=acc===0;
  const currentForce={x:c.mass*m.ax,y:c.mass*m.ay};
  const given=[t`q=${Q(c.q,'C')}`,t`m=${Q(c.mass,'kg')}`,t`|\Delta V|=${Q(Math.abs(c.voltage),'V')}`,t`d=${Q(c.d,'m')}`,t`L=${Q(c.L,'m')}`];
  let html=`<h4>Given Quantities</h4><div class="given-math">${given.map(math).join('')}</div><p class="small">${c.orientation==='vertical'?'Vertical':'Horizontal'} plates; +x right, +y upward. q is particle charge, m is mass, and arrows denote vectors. Separation d is across the plates; length L is along them.</p>`;
  html+=`<h4>Field, Forces and Net Acceleration</h4><p data-force-region="${contact?'contact':electric?'inside':'outside'}">${contact?'Plate contact: flight has stopped.':electric?'Inside the electric field.':'Outside the active electric field.'}</p><div data-governing-model="${magnetic?'magnetic':gravity?'gravity':'electric'}">${eq(t`E_{\mathrm{plates}}=\frac{|\Delta V|}{d}`,model.force,model.acceleration,...(!electric?[t`\vec E=\vec 0`]:[]))}</div>`;
  if(contact)html+=`<p>Absorbing plate contact removes the incident momentum and supplies a reaction that cancels the remaining applied forces. The particle and timer stop. The following results include that constraint.</p>`;
  else if(electric&&!gravity&&!magnetic&&!external)html+=eq(t`F_E=|q|E`,t`a=\frac{|q|E}{m}`);
  if(gravity&&!contact)html+=eq(t`\vec F_g=m\vec g`,t`\vec g=(0,-${Q(G,'m/s²')})`);
  if(magnetic&&!contact)html+=eq(t`\vec F_B=q(\vec v\times\vec B)`,t`F_B=|q|vB\sin\theta`,t`a_x=\frac{q}{m}(E_x+v_y B_z)`,t`a_y=\frac{q}{m}(E_y-v_x B_z)`)+`<p class="small">θ is the angle between velocity and B. Velocity lies in the screen plane and B is normal to it, so sin θ = 1 when speed and B are nonzero. Magnetic force uses instantaneous velocity. Gravity is neglected.</p>`;
  html+=`<h4>Substitution</h4>${eq(t`E_{\mathrm{plates}}=\frac{${N(Math.abs(c.voltage))}}{${N(c.d)}}=${Q(E,'N/C')}`)}`;
  if(electric&&!contact)html+=eq(t`F_E=(${N(Math.abs(c.q))})(${N(magnitude(f.field))})`,t`F_E=${Q(magnitude(f.electric),'N')}`);
  html+=eq(t`\vec E_{\mathrm{particle}}=${V({x:m.ex,y:m.ey},'N/C')}`);
  if(electric&&!contact)html+=eq(t`\vec F_E=${V(f.electric,'N')}`);
  if(gravity&&!contact)html+=eq(t`\vec F_g=${V(f.gravity,'N')}`);
  if(magnetic&&!contact)html+=eq(t`B=${Q(c.B,'T')}`,t`\vec v=${V({x:m.vx,y:m.vy},'m/s')}`,t`\vec F_B=${V(f.magnetic,'N')}`)+`<p class="small">B points ${c.bDirection<0?'into':'out of'} the page.</p>`;
  if(external&&!contact)html+=eq(t`\vec F_{\mathrm{ext}}=${V(f.external,'N')}`);
  html+=eq(t`\vec a=\frac{(${N(currentForce.x)},${N(currentForce.y)})}{${N(c.mass)}}\;${t`\mathrm{m}\,\mathrm{s}^{-2}`}`);
  if(electric&&!gravity&&!magnetic&&!external&&!contact)html+=eq(t`a=\frac{${N(magnitude(f.electric))}}{${N(c.mass)}}=${Q(acc,'m/s²')}`);
  html+=`<h4>Calculated Results</h4><div id="motion-math-results" data-ax="${m.ax}" data-ay="${m.ay}" data-fx="${currentForce.x}" data-fy="${currentForce.y}">${eq(t`\vec F_{\mathrm{net}}=${V(currentForce,'N')}`,t`\vec a=${V({x:m.ax,y:m.ay},'m/s²')}`,t`a=|\vec a|=${Q(acc,'m/s²')}`,...(zero?[t`\vec a=\vec 0`]:[]))}</div>`;
  html+=`<h4>Physical Interpretation</h4><p>${contact?`Plate impact at the ${m.plate} plate; the pre-contact speed was ${math(Q(Math.hypot(m.impactVx,m.impactVy),'m/s'))}.`:status.text} ${!contact&&zero&&speed>0?'Zero net acceleration with nonzero velocity gives dynamic equilibrium in this region.':''} ${!zero?'The signed force components set the acceleration direction. Negative acceleration means a component points against the positive axis; speed decreases only when velocity and acceleration oppose one another.':''}</p><p class="small">The electric force follows E for positive charge and opposes E for negative charge. Force arrows, acceleration and the values above use the same particle state.</p>`;
  if(c.balanceMode==='gravity'){
    html+=`<details id="motion-equilibrium" ${s.motionEquilibriumOpen?'open':''}><summary>Gravitational Equilibrium</summary><p>Cancellation requires equal, opposite vectors. The electric force must point upward to oppose weight. Vertical plates give perpendicular electric force and weight, so their magnitudes cannot cancel.</p>${eq(t`|q|E=mg`)}<p class="small">The scalar equality is a condition for opposing vertical forces, not a claim that the current configuration is balanced.</p>${!contact&&zero?eq(t`\sum\vec F=\vec 0`,t`\vec a=\vec 0`):''}</details>`;
  }
  if(magnetic){
    html+=`<details id="motion-equilibrium" ${s.motionEquilibriumOpen?'open':''}><summary>Crossed-field Equilibrium</summary><p>For nonzero charge, electric and magnetic forces cancel only at the required velocity and direction inside the electric field.</p>`;
    if(c.B>0&&c.q!==0&&electric&&!contact)html+=eq(t`\vec E+\vec v\times\vec B=\vec 0`,t`\vec v_{\mathrm{balance}}=\frac{\vec E\times\vec B}{B^2}`,t`v_{\mathrm{required}}=\frac{E}{B}=${Q(E/c.B,'m/s')}`)+`<p>The required velocity points along E × B. This is a balancing condition; the current velocity is shown above.</p>`;
    else html+=`<p>${c.B===0?'Magnetic balancing unavailable when B = 0.':c.q===0?'Zero charge gives no Lorentz force; a balancing speed is not selected.':'No active crossed electric field at the particle; use the magnetic-only model.'}</p>`;
    if(!contact&&zero)html+=eq(t`\sum\vec F=\vec 0`,t`\vec a=\vec 0`);
    html+=`</details><details id="motion-orbit" ${s.motionOrbitOpen?'open':''}><summary>Magnetic-only Motion Outside Plates</summary><p>B continues throughout the canvas. Magnetic force is perpendicular to velocity and does no work. Radius and angular frequency below apply where only B acts.</p>`;
    if(c.B>0&&c.q!==0)html+=eq(t`r=\frac{mv}{|q|B}=${Q(c.mass*speed/Math.abs(c.q)/c.B,'m')}`,t`|\omega|=\frac{|q|B}{m}=${Q(Math.abs(c.q)*c.B/c.mass,'rad/s')}`);
    else html+=`<p>Zero B or zero charge gives straight-line free motion outside the electric field.</p>`;
    html+=`</details>${components}`;
  }else{
    const stationaryStart=c.vx===0&&c.vy===0;
    html+=`<details id="motion-kinematics" ${s.motionKinematicsOpen?'open':''}><summary>Motion and Boundaries</summary><p>These equations apply separately to each constant-acceleration flight segment, using the position and velocity at that segment’s start and its elapsed time τ. Join segments continuously at field entry or exit.</p>${eq(t`\vec v=\vec v_s+\vec a\tau`,t`\vec r=\vec r_s+\vec v_s\tau+\frac{1}{2}\vec a\tau^2`)}${s.experiment==='rest'&&stationaryStart?`<p>On the initial constant-acceleration segment, before any boundary:</p>${eq(t`\vec v_0=\vec 0`,t`\vec v(t)=\vec a t`,t`\vec r(t)=\vec r_0+\frac{1}{2}\vec a t^2`)}`:''}${s.experiment==='parallel'?`<p>Along +normal (${c.orientation==='vertical'?'rightward':'upward'}), u, v, a and displacement s are signed components within one segment:</p>${eq('v=u+a\\tau',t`s=u\tau+\frac{1}{2}a\tau^2`,'v^2=u^2+2as')}`:''}<p class="small">The field ends at tangential distance ±L/2; plate surfaces are at normal distance ±d/2. Only enabled non-electric forces continue outside the electric field. A plate impact stops the particle.</p></details>`;
  }
  html+=`<details id="motion-initial" ${s.motionInitialOpen?'open':''}><summary>Initial Position and Velocity</summary>${eq(t`\vec r_0=${V({x:c.x0,y:c.y0},'m')}`,t`\vec v_0=${V({x:c.vx,y:c.vy},'m/s')}`)}</details><h4>Instant Measurements</h4><p>${math(t`t=${Q(m.time,'s')}`)} · ${m.status}</p>${eq(t`\vec r=${V({x:m.x,y:m.y},'m')}`,t`\Delta\vec r=${V({x:m.x-c.x0,y:m.y-c.y0},'m')}`,t`\vec v=${V({x:m.vx,y:m.vy},'m/s')}`,t`v=|\vec v|=${Q(speed,'m/s')}`)}<p class="small">Fringing is neglected. Field exit and full canvas exit are separate events; full exit includes the particle radius. The ${math(Q(s.timeLimit,'s'))} safeguard is labelled Time limit. Replay uses the current controls.</p>`;
  return html;
}
