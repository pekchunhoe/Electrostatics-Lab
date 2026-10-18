import {motionPlateControls,motionSettings,motionStatusMarkup,updateMotionStatus,motionWorking,motionLegend,syncMotionControls} from './motion-ui.js';
import {resetMotionClock,restoreMotionStart,orientMotion,rebalanceMotion,advanceMotion} from './motion-state.js';
import {motionGeometry} from './physics.js';
import {isPlates,plateModel,createPotentialModels,updatePlates,plateDefaults} from './parallel-plates.js';
import {potentialLayers,potentialLegend,plateChallenges,plateControls,plateWorking,fieldEquipotentialActivity} from './potential-model-ui.js';
import {K,EPSILON_0,G,forceOn,fieldAt,potentialAt,systemEnergy,magnitude,direction,uniformField,motionAt,validateCharges,validateMotion} from './physics.js';
import {makeState,loadPreset,loadExperiment,chargePresets,motionPresets} from './presets.js';
import {investigations,challenges,motionChallenges,getPotential,checkAnswer} from './learning.js';
import {draw,viewport} from './render.js';
import {individualFields,fieldLabel} from './field-vectors.js';
import {initializeSnapping,setSnapping,clearAttachments,releaseProbe,movePotentialProbe,reconcileAttachments,validatePotentialProbes,samePotential,potentialComparison} from './equipotential.js';
import {snapControls,updateSnapControls,movementWorking,equipotentialActivity} from './equipotential-ui.js';
const names=['Coulomb Force','Electric Field','Electric Potential','Uniform Electric Field'];
const headings=["Coulomb’s Law",'Fields and superposition','Potential and energy','Charge in a Uniform Electric Field'];
const subtitles=['Explore how charges push and pull.','Measure the influence of a charge.','Explore energy, potential and equipotentials.','Follow a particle between charged plates.'];
const states=names.map((_,i)=>makeState(i));let tab=0,raf=0,framePending=false,lastTime=0,help=false;
states[1].individualFields=false;states[1].fieldFocus='all';
initializeSnapping(states[2]);
const potentialModels=createPotentialModels(states[2],initializeSnapping);
function switchPotentialModel(key){states[2]=potentialModels[key];render();}
const app=document.querySelector('#app'),nav=document.querySelector('.tabs');
// Numeric tab IDs preserve the curriculum mapping and each topic's simulation state.
nav.innerHTML=names.map((n,i)=>`<button role="tab" id="tab-${i}" aria-controls="lab-panel" aria-selected="${i===tab}" tabindex="${i===tab?0:-1}" data-tab="${i}">${n}</button>`).join('');
function revealActiveTab(){
  const active=document.getElementById('tab-'+tab),bar=nav.getBoundingClientRect(),item=active.getBoundingClientRect();
  // Scroll only the horizontal tab strip; scrollIntoView could move the page vertically.
  if(item.left<bar.left+4)nav.scrollTo({left:nav.scrollLeft+item.left-bar.left-4,behavior:'instant'});
  else if(item.right>bar.right-4)nav.scrollTo({left:nav.scrollLeft+item.right-bar.right+4,behavior:'instant'});
}
function selectTab(index){
  // Replacing the panel can temporarily shorten the document before live calculations fill it.
  const pageY=window.scrollY;
  tab=index;render();document.getElementById('tab-'+tab).focus({preventScroll:true});
  window.scrollTo({top:pageY,behavior:'instant'});revealActiveTab();
}
const superscript=n=>String(n).split('').map(x=>({'-':'⁻','+':'','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'}[x])).join('');
const fmt=(n,unit='')=>{if(!Number.isFinite(n))return 'Undefined';const a=Math.abs(n);let value=Number(n.toPrecision(4)).toString();if(a!==0&&(a>=1e4||a<.001)){const [base,exp]=n.toExponential(3).split('e');value=base+' × 10'+superscript(Number(exp));}return value+(unit?' '+unit:'');};
const angle=v=>direction(v)===null?'No resultant direction':`${fmt(direction(v))}° from +x`;
const num=(id,label,value,min,max,step='any')=>`<label class="number-control" for="${id}"><span>${label}</span><input id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" inputmode="decimal"></label>`;
const check=(key,label,s)=>`<label class="check"><input type="checkbox" data-toggle="${key}" ${s[key]?'checked':''}>${label}</label>`;
const options=(items,key)=>Object.entries(items).map(([id,item])=>`<option value="${id}" ${id===key?'selected':''}>${item.label}</option>`).join('');
const stat=(label,value)=>`<div><span>${label}</span><strong>${value}</strong></div>`;
const signed=n=>(n>0?'+':'')+fmt(n);
const fieldAngle=v=>v.direction===null?'No direction (zero field)':`${fmt(v.direction)}° from +x`;
const vectorMath=id=>`<msub><mover><mi>E</mi><mo>→</mo></mover><${id==='R'?'mi':'mn'}>${id}</${id==='R'?'mi':'mn'}></msub>`;
const fieldSum=s=>`<math aria-label="Resultant electric field equals ${s.charges.map(c=>'field from q'+c.id).join(' plus ')}"><mrow>${vectorMath('R')}<mo>=</mo>${s.charges.map(c=>vectorMath(c.id)).join('<mo>+</mo>')}</mrow></math>`;
function fieldControls(s){
  return `<div class="field-controls"><label class="check" for="individual-fields"><input id="individual-fields" type="checkbox" aria-controls="field-vector-key individual-field-panel" ${s.individualFields?'checked':''}>Show Individual Fields</label><div id="field-vector-key" class="field-vector-key" role="group" aria-label="Emphasize a field vector" ${s.individualFields?'':'hidden'}><button data-field-vector="all" aria-pressed="true">Show All</button>${s.charges.map(c=>`<button data-field-vector="${c.id}" aria-pressed="false" aria-label="Emphasize ${fieldLabel(c.id)} from q${c.id}"><span class="field-swatch" aria-hidden="true"></span>${fieldLabel(c.id)}</button>`).join('')}<button data-field-vector="resultant" aria-pressed="false" aria-label="Emphasize resultant Eᴿ"><span class="field-swatch" aria-hidden="true"></span>Eᴿ</button></div><p id="field-vector-note" class="field-scale-note" ${s.individualFields?'':'hidden'}>Arrows at A share one length scale. Tap a vector to emphasize it.</p></div>`;
}
function updateIndividualFields(s,field,error){
  const panel=document.getElementById('individual-field-panel');if(!panel)return;
  panel.hidden=!s.individualFields;
  document.getElementById('field-vector-key').hidden=!s.individualFields;
  document.getElementById('field-vector-note').hidden=!s.individualFields;
  if(!['all','resultant',...s.charges.map(c=>c.id)].includes(s.fieldFocus))s.fieldFocus='all';
  for(const button of document.querySelectorAll('[data-field-vector]'))button.setAttribute('aria-pressed',String(button.dataset.fieldVector===s.fieldFocus));
  const canvas=document.getElementById('scene');
  if(s.individualFields)canvas.setAttribute('aria-describedby','field-vector-note');else canvas.removeAttribute('aria-describedby');
  const body=document.getElementById('individual-field-body');
  if(!s.individualFields){body.innerHTML='';return;}
  if(error){body.innerHTML=`<p class="error">${error}</p>`;return;}
  const row=(key,label,value,text)=>`<div><dt>${label}</dt><dd data-value-key="${key}" ${typeof value==='number'?`data-value="${value}"`:''}>${text}</dd></div>`;
  body.innerHTML=`<p class="small">Each Eᵢ is the field from source qᵢ at A, not an x/y component. Select its button below the diagram to identify overlapping arrows.</p>`+field.contributions.map(v=>`<section class="field-entry" data-field-source="${v.id}" aria-label="${fieldLabel(v.id)} from q${v.id}"><h4>${fieldLabel(v.id)} · source q${v.id}</h4><dl class="field-values">${row('charge','Signed charge',v.q,signed(v.q*1e6)+' μC')}${row('distance','Distance to A',v.r,fmt(v.r,'m'))}${row('magnitude','Magnitude',v.magnitude,fmt(v.magnitude,'N/C'))}${row('direction','Direction',v.direction,fieldAngle(v))}${row('x',fieldLabel(v.id)+'ₓ',v.x,signed(v.x)+' N/C')}${row('y',fieldLabel(v.id)+'ᵧ',v.y,signed(v.y)+' N/C')}</dl></section>`).join('')+`<section class="field-entry field-resultant" data-field-source="resultant"><h4>Resultant Eᴿ</h4><div class="equation">${fieldSum(s)}</div><p class="small">Eᴿₓ = ${field.contributions.map(v=>fieldLabel(v.id)+'ₓ').join(' + ')}<br>Eᴿᵧ = ${field.contributions.map(v=>fieldLabel(v.id)+'ᵧ').join(' + ')}</p><dl class="field-values">${row('x','Eᴿₓ',field.x,signed(field.x)+' N/C')}${row('y','Eᴿᵧ',field.y,signed(field.y)+' N/C')}${row('magnitude','Magnitude',field.magnitude,fmt(field.magnitude,'N/C'))}${row('direction','Direction',field.direction,fieldAngle(field))}</dl></section><p class="small">Arrow length = field magnitude × one common scale, refitted to the viewport and zoom. Very small arrows may be subpixel. Read the values above for exact magnitudes; zero fields have no direction arrow.</p>`;
}
function fieldExplanation(s,e){
  return `<h4>Superposition at A</h4><div class="equation">${fieldSum(s)}</div><p>${s.charges.map(c=>fieldLabel(c.id)).join(", ")} identify the current source contributions at A. They are vectors, not the Cartesian x/y components. Add signed components, not magnitudes.</p><ol class="field-method"><li>Identify each source: ${s.charges.map(c=>'q'+c.id).join(', ')}.</li><li>Find each distance rᵢ = |𝐫_A − 𝐫ᵢ|.</li><li>Calculate each magnitude |𝐄ᵢ| = k|qᵢ|/rᵢ².</li><li>At A, point away from positive sources and toward negative sources. A zero contribution has no direction.</li><li>Resolve each vector: 𝐄ᵢ = kqᵢ(𝐫_A − 𝐫ᵢ)/rᵢ³.</li><li>Add x components: Eᴿₓ = ${e.contributions.map(v=>'('+signed(v.x)+')').join(' + ')} = ${fmt(e.x,'N/C')}.</li><li>Add y components: Eᴿᵧ = ${e.contributions.map(v=>'('+signed(v.y)+')').join(' + ')} = ${fmt(e.y,'N/C')}.</li><li>Find |𝐄ᴿ| = √(Eᴿₓ² + Eᴿᵧ²) and θᴿ = atan2(Eᴿᵧ, Eᴿₓ). ${e.magnitude===0?'Eᴿ = 0 N/C; there is no resultant direction.':`${fmt(e.magnitude,'N/C')}, ${fieldAngle(e)}.`}</li></ol>`;
}
function render(){
  states[3].playing=false;lastTime=0;cancelAnimationFrame(raf);raf=0;states.forEach((s,i)=>{if(i!==tab)s.playing=false;});
  const s=states[tab],c=s.charges.find(x=>x.id===s.selected),open=Object.fromEntries([...app.querySelectorAll('details[id]')].map(x=>[x.id,x.open]));
  if(tab===2&&open['equipotential-working']!==undefined)s.equipotentialWorkingOpen=open['equipotential-working'];
  if(innerWidth>=1120&&open.calculations===undefined)open.calculations=true;
  for(const button of nav.children){const selected=Number(button.dataset.tab)===tab;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}
  app.innerHTML=`<section id="help-panel" class="help card" ${help?'':'hidden'}><b>Your pocket physics laboratory</b><p>Drag a charge or probe. Select objects to edit exact values. Arrow keys move a focused object by 0.005 m; Shift gives 0.001 m. Pinch the workspace or use Zoom. The coordinate axes use metres, +x right and +y up.</p><p>Charges are point sources in ordinary 3D electrostatics. No artificial softening is applied. Diagram arrows are scaled for visibility; use Calculations for true magnitudes. Combined Learning Mode is active in every tab.</p><label class="check"><input id="theme-toggle" type="checkbox" ${document.documentElement.dataset.theme==='dark'?'checked':''}>Dark theme</label><button id="close-help">Close help</button></section>
    <div id="lab-panel" role="tabpanel" aria-labelledby="tab-${tab}" tabindex="0">
    <div class="section-title"><div><span class="eyebrow">CHAPTER 01 <span class="dot">·</span> INTERACTIVE LAB</span><h2>${headings[tab]}</h2><p>${subtitles[tab]}</p></div><span class="mode-badge"><i></i> Combined learning</span></div>
    <div class="lab-grid">
      <section class="workspace card" aria-label="Interactive simulation">
        <div class="canvas-bar"><span><i class="status-dot"></i> LIVE WORKSPACE</span><button id="reset" title="Restore current preset">↺ <span>Reset</span></button></div>
        <div class="canvas-wrap"><canvas id="scene" aria-label="${names[tab]} diagram; use the object buttons or exact coordinate controls to move charges and probes."></canvas><div id="object-targets"></div></div>${tab===2?potentialLayers(s):''}
        <div class="legend">${tab===3?motionLegend(s):tab===2?potentialLegend(s):tab===0?'<span class="positive">● + charge</span><span class="negative">● − charge</span><span class="result">➜ resultant</span><span>➜ individual</span>':tab===3?'<span class="result">➜ electric force</span><span>➜ gravity (if on)</span><span>⋯ trajectory</span>':'<span class="positive">● + source</span><span class="negative">● − source</span><span class="result">⊕ probe A</span>'+(tab===2?'<span class="purple">⊕ probe B</span>':'')}</div>
        <div id="live-strip" class="live-strip" role="status" aria-live="polite" aria-atomic="true"></div>${tab===3?motionStatusMarkup():''}<div id="quick-controls"></div>${tab===1?fieldControls(s):tab===2?snapControls(s):''}
        <p class="canvas-note">${tab===2?'Contours in volts · 2D cross-sections of 3D equipotential surfaces.':'Arrow lengths are scaled for visibility; numerical magnitudes are exact.'}</p>
      </section>
      <aside class="controls card" aria-label="Simulation controls"><div class="panel-heading"><h3>Experiment controls</h3><span>ADJUST & OBSERVE</span></div>
      ${tab===2&&isPlates(s)?plateControls(s,num,fmt):`<label class="select-label" for="preset">${tab===3?'Experiment':'Arrangement'}<select id="preset">${options(tab===3?motionPresets:chargePresets,tab===3?s.experiment:s.preset)}</select></label>`}
      ${tab===2&&isPlates(s)?'':tab===3?`<div class="playback"><button id="play" class="primary">${s.playing?'Ⅱ Pause':'▶ Play'}</button><button id="step">Step +0.01 s</button></div><label class="select-label" for="speed">Playback speed<select id="speed"><option value=".25" ${s.speed===.25?'selected':''}>0.25× · slow</option><option value="1" ${s.speed===1?'selected':''}>1×</option><option value="2" ${s.speed===2?'selected':''}>2×</option></select></label>`:`<label class="select-label" for="selected">Selected ${tab===0?'force target':'source'}<select id="selected">${s.charges.map(x=>`<option value="${x.id}" ${s.selected===x.id?'selected':''}>q${x.id} · ${fmt(x.q*1e6)} μC</option>`).join('')}</select></label><label class="range-label" for="charge-range">Charge <output id="charge-output">${fmt(c.q*1e6)} μC</output><input id="charge-range" type="range" min="-5" max="5" step="0.1" value="${c.q*1e6}"></label><div class="button-row"><button id="add" ${s.charges.length>=4?'disabled':''}>＋ Add charge</button><button id="remove" ${s.charges.length<=1?'disabled':''}>− Remove</button></div>`}
      ${tab===3?motionPlateControls(s,num):''}<div id="primary-control-home"></div><div class="mobile-actions"><button data-open="calculations">Calculations</button><button class="accent" data-open="challenge-panel">Challenge ↗</button></div>
      <details id="settings" ${open.settings?'open':''}><summary>Settings & precise values</summary><div class="detail-body">
      ${tab===2&&isPlates(s)?'':tab===3?motionSettings(s,num):`<div class="number-grid">${num('charge-number','Charge (μC)',c.q*1e6,-5,5)}${num('charge-x','Source x (m)',c.x,-.25,.25)}${num('charge-y','Source y (m)',c.y,-.22,.22)}</div><button id="reset-selected">Reset selected source</button><button id="clear">Keep selected source only</button>`}
      ${tab===1||tab===2?`<div class="number-grid">${num('probe-x','Probe A x (m)',s.probe.x,-.25,.25)}${num('probe-y','Probe A y (m)',s.probe.y,-.22,.22)}${tab===2?num('b-x','Probe B x (m)',s.b.x,-.25,.25)+num('b-y','Probe B y (m)',s.b.y,-.22,.22):''}${num('test-charge','Test charge (nC)',s.testQ*1e9,-100,100)}</div>`:''}
      ${tab===2&&!isPlates(s)?`<label class="select-label" for="potential-mode">Potential example<select id="potential-mode"><option value="point" ${!s.uniform?'selected':''}>Point charges</option><option value="uniform" ${s.uniform?'selected':''}>Ideal uniform field</option></select></label>${num('uniform-e','Uniform Eᵧ (V/m)',s.uniformE,-50000,50000)}`:''}
      <fieldset><legend>Diagram layers</legend>${tab===0?check('components','Vector components',s)+check('fbd','Free-body diagram at origin',s):tab===1?check('lines','Field lines',s)+check('arrows','Field-line direction arrows',s)+check('grid','Vector grid',s):tab===2?(isPlates(s)?'<p class="small">Use the line toggles below the diagram.</p>':check('heat','Potential colour map',s)+check('overlay','Electric field at A',s)+check('grid','Field vector grid (with overlay)',s)):check('showAcceleration','Show Acceleration Vector',s)+check('trace','Trajectory trace',s)}</fieldset>
      <label class="range-label" for="zoom">Zoom <output id="zoom-output">${s.zoom.toFixed(1)}×</output><input id="zoom" type="range" min=".7" max="2" step=".1" value="${s.zoom}"></label></div></details><p id="input-error" class="error" role="alert"></p>
      <details id="guided" ${open.guided?'open':''}><summary>Guided investigations <span class="count">3</span></summary><div class="detail-body"><label for="guide">Choose an investigation</label><select id="guide">${investigations[tab].map((g,i)=>`<option value="${i}" ${s.guide===i?'selected':''}>${g[0]}</option>`).join('')}</select><p id="guide-text">${investigations[tab][s.guide][2]}</p><p class="workflow">Predict → Simulate → Observe → Explain</p><button id="load-guide">Load investigation</button><div id="zero-status"></div>${tab===2?equipotentialActivity(open)+fieldEquipotentialActivity(open):''}</div></details>
      </aside>
      <aside class="learning" aria-label="Calculations and challenges"><details id="calculations" class="card" ${open.calculations?'open':''}><summary>Calculations <span class="summary-tag">LIVE</span></summary><div id="calculation-body" class="detail-body"></div></details>
      ${tab===1?`<details id="individual-field-panel" class="card field-breakdown" ${s.individualFields?'':'hidden'} ${open['individual-field-panel']?'open':''}><summary>Individual Electric Fields</summary><div id="individual-field-body" class="detail-body"></div></details>`:''}
      <details id="challenge-panel" class="card" ${open['challenge-panel']?'open':''}><summary>Challenge <span class="summary-tag">PREDICT FIRST</span></summary><div class="detail-body"><label for="challenge-select">Choose a question</label><select id="challenge-select">${(tab===2&&isPlates(s)?plateChallenges:tab===3?motionChallenges(s):challenges[tab]).map((q,i)=>`<option value="${i}" ${s.challenge===i?'selected':''}>${q.title}</option>`).join('')}</select><p id="challenge-question"></p><label for="prediction">Your prediction <span id="answer-unit"></span></label><input id="prediction" type="text" autocomplete="off" placeholder="Predict before revealing" value="${s.prediction.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')}"><div class="button-row"><button id="check-answer" class="primary">Check & explain</button><button id="hint">Hint</button></div><p id="hint-text" class="hint" hidden></p><div id="feedback" role="status"></div><p class="small">Numbers: enter the displayed unit, e.g. 4.49e5. Tolerance: ±2% or 10⁻¹⁰ near zero. Answers update when you edit the experiment.</p><button class="close-panel" data-close="challenge-panel">Close challenge</button></div></details>
      <div class="learning-note"><span>THE PHYSICS NOTE</span><p>${['Forces add as vectors. A zero resultant can hide several nonzero individual forces.','The field describes the sources. Changing the test charge changes its force, not the field.','Potential adds as a scalar. Zero field does not imply zero potential.','A balanced particle can keep moving. Dynamic equilibrium requires nonzero constant velocity.'][tab]}</p></div></aside>
    </div></div>`;
  const primary=tab===2&&isPlates(s)?null:document.querySelector('.controls '+(tab===3?'.playback':'.range-label'));
  if(primary){primary.id='primary-adjustment';placeQuickControls();}
  bind();update();
}
function placeQuickControls(){const el=document.getElementById('primary-adjustment');if(el)document.getElementById(innerWidth<1120?'quick-controls':'primary-control-home').append(el);}
function bind(){
  const s=states[tab];const on=(id,event,fn)=>document.getElementById(id)?.addEventListener(event,fn);
  on('preset','change',e=>{if(tab===2){clearAttachments(s);s.samePotentialDemo=false;}tab===3?loadExperiment(s,e.target.value):loadPreset(s,e.target.value);s.revealed=false;render();});
  on('field-model','change',e=>switchPotentialModel(e.target.value));
  for(const [id,key] of [['plate-voltage','voltage'],['plate-separation','d']])on(id,'change',e=>{
    const n=Number(e.target.value);
    if(!e.target.value.trim()||!Number.isFinite(n)||n<Number(e.target.min)||n>Number(e.target.max)){showError(`Enter a value from ${e.target.min} to ${e.target.max}.`);e.target.setAttribute('aria-invalid','true');return;}
    updatePlates(s,{[key]:n});clearAttachments(s,'Plate settings changed. Probes released; approach a contour to attach again.');
    e.target.removeAttribute('aria-invalid');showError('');syncControls();s.revealed=false;update();
  });
  on('reverse-polarity','click',()=>{updatePlates(s,{reversed:!s.plates.reversed});clearAttachments(s,'Polarity reversed. Probes released.');render();});
  on('plate-orientation','change',e=>{updatePlates(s,{orientation:e.target.value});clearAttachments(s,'Orientation changed. Probes released.');render();});
  on('start-field-point','click',()=>{states[2]=potentialModels.point;loadPreset(states[2],'positive');clearAttachments(states[2]);states[2].fieldLines=true;states[2].contours=true;render();});
  on('start-field-plates','click',()=>{states[2]=potentialModels.plates;const p=states[2];Object.assign(p,{plates:plateDefaults(),uniformE:-10000,probe:{x:-.012,y:.005},b:{x:.012,y:-.005},fieldLines:true,contours:true,zoom:1});clearAttachments(p);p.samePotentialDemo=false;render();});
  on('selected','change',e=>{s.selected=e.target.value;render();});
  on('reset','click',()=>{if(tab===2&&isPlates(s)){Object.assign(potentialModels.plates,{plates:plateDefaults(),uniformE:-10000,probe:{x:-.012,y:.005},b:{x:.012,y:-.005},zoom:1});clearAttachments(s);s.samePotentialDemo=false;render();return;}if(tab===2){clearAttachments(s);s.samePotentialDemo=false;}tab===3?loadExperiment(s,s.experiment):loadPreset(s,s.preset);s.zoom=1;s.revealed=false;render();});
  on('add','click',()=>{if(s.charges.length>=4)return;const id=String([1,2,3,4].find(x=>!s.charges.some(c=>c.id===String(x))));const positions=[{x:0,y:.15},{x:0,y:-.15},{x:.2,y:.1},{x:-.2,y:-.1}];if(tab===2){positions.push({x:-.18,y:.16},{x:.18,y:-.16},{x:0,y:.2},{x:0,y:-.2});for(const x of [-.2,-.1,0,.1,.2])for(const y of [-.18,-.09,0,.09,.18])positions.push({x,y});}const pos=positions.find(p=>s.charges.every(c=>Math.hypot(c.x-p.x,c.y-p.y)>.025)&&(tab!==2||s.uniform||[s.probe,s.b].every(probe=>Math.hypot(probe.x-p.x,probe.y-p.y)>.025)));s.charges.push({id,q:1e-6,...pos});s.selected=id;render();});
  on('remove','click',()=>{if(s.charges.length<=1)return;s.charges=s.charges.filter(c=>c.id!==s.selected);s.selected=s.charges[0].id;render();});
  on('clear','click',()=>{s.charges=s.charges.filter(c=>c.id===s.selected);render();});
  on('reset-selected','click',()=>{const original=chargePresets[s.preset].charges.find(c=>c.id===s.selected);if(!original){showError('This source was added after the preset. Use Reset to restore the arrangement.');return;}const clone=structuredClone(s.charges);Object.assign(clone.find(c=>c.id===s.selected),original);try{validateCharges(clone);if(tab===2)validatePotentialProbes({...s,charges:clone});s.charges=clone;render();}catch(e){showError(e.message);}});
  for(const id of ['charge-range','charge-number','charge-x','charge-y','probe-x','probe-y','b-x','b-y','test-charge','uniform-e',...['voltage','d','L','q','mass','x0','y0','vx','vy','externalX','externalY','entry-speed'].map(x=>'m-'+x)]){
    on(id,id==='charge-range'?'input':'change',e=>{
      const input=e.target,n=Number(input.value),old=structuredClone(s);
      try{
        if(input.value.trim()===''||!Number.isFinite(n)||n<Number(input.min)||n>Number(input.max))throw new RangeError(`Enter a value from ${input.min} to ${input.max}.`);
        const c=s.charges.find(x=>x.id===s.selected);
        if(id==='charge-range'||id==='charge-number')c.q=n*1e-6;
        else if(id==='charge-x'||id==='charge-y')c[id.slice(-1)]=n;
        else if(id.startsWith('probe-'))s.probe[id.slice(-1)]=n;
        else if(id.startsWith('b-'))s.b[id.slice(-1)]=n;
        else if(id==='test-charge')s.testQ=n*1e-9;
        else if(id==='uniform-e')s.uniformE=n;
        else if(id.startsWith('m-')){
          const key=id.slice(2);
          if(key==='entry-speed'){
            const g=motionGeometry(s.motion),v=g.local({x:s.motion.vx,y:s.motion.vy});
            const next=g.world(s.experiment==='parallel'?v.u:n,s.experiment==='parallel'?n:v.n);s.motion.vx=next.x;s.motion.vy=next.y;
          }else s.motion[key]=n*(key==='q'?1e-9:key==='mass'||key.startsWith('external')?1e-6:1);
          if(key==='d'||key==='L')restoreMotionStart(s.motion);
          validateMotion(s.motion);cancelAnimationFrame(raf);raf=0;lastTime=0;resetMotionClock(s,'Parameters changed. Press Play to start.');
          if(key==='L')s.zoom=1;
        }
        validateCharges(s.charges);if(tab===2){if(id.startsWith('probe-')||id.startsWith('b-'))releaseProbe(s,id.startsWith('probe-')?'probe':'b',false);reconcileAttachments(s,potentialView());validatePotentialProbes(s);}showError('');input.removeAttribute('aria-invalid');syncControls();s.revealed=false;update();
      }catch(err){Object.assign(s,old);showError(err.message);input.setAttribute('aria-invalid','true');}
    });
  }
  document.querySelectorAll('[data-toggle]').forEach(el=>el.addEventListener('change',()=>{s[el.dataset.toggle]=el.checked;update();}));
  on('individual-fields','change',e=>{s.individualFields=e.target.checked;update();});
  on('field-vector-key','click',e=>{const button=e.target.closest('[data-field-vector]');if(!button)return;s.fieldFocus=button.dataset.fieldVector;for(const el of button.parentElement.children)el.setAttribute('aria-pressed',String(el===button));scheduleDraw();});
  on('potential-mode','change',e=>{const previous=s.uniform;s.uniform=e.target.value==='uniform';try{validatePotentialProbes(s);}catch(error){s.uniform=previous;e.target.value=previous?'uniform':'point';showError(error.message);return;}clearAttachments(s,'Potential model changed. Probes released.');s.revealed=false;update();});
  on('gravity','change',e=>{s.motion.gravity=e.target.checked;resetMotionClock(s,'Gravity changed; external forces are unchanged.');render();});
  on('zoom','input',e=>{s.zoom=Number(e.target.value);document.getElementById('zoom-output').textContent=s.zoom.toFixed(1)+'×';scheduleDraw();});
  on('speed','change',e=>s.speed=Number(e.target.value));
  on('motion-reverse','click',()=>{s.motion.voltage=-s.motion.voltage;restoreMotionStart(s.motion);resetMotionClock(s,'Polarity reversed. External force unchanged; press Play to restart.');render();});
  on('motion-orientation','change',e=>{orientMotion(s.motion,e.target.value,{equilibrium:s.experiment==='equilibrium'});s.zoom=1;resetMotionClock(s,s.experiment==='equilibrium'?'Orientation adapted. The displayed external force balances the electric force and weight.':'Orientation adapted. Gravity remains downward.');render();});
  on('motion-length','input',e=>{s.motion.L=Number(e.target.value);restoreMotionStart(s.motion);s.zoom=1;resetMotionClock(s,'Plate length changed. Field magnitude is unchanged.');cancelAnimationFrame(raf);raf=0;lastTime=0;syncMotionControls(s);update();});
  on('motion-rebalance','click',()=>{rebalanceMotion(s.motion);resetMotionClock(s,'External force explicitly set to balance the electric force and weight.');render();});
  on('motion-limit','change',e=>{const value=Number(e.target.value);if(!e.target.value.trim()||!Number.isFinite(value)||value<1||value>3600){showError('Enter a time limit from 1 to 3600 s.');return;}s.timeLimit=value;resetMotionClock(s,'Time limit changed.');render();});
  on('motion-replay','click',()=>{resetMotionClock(s);render();});
  on('play','click',()=>{
    cancelAnimationFrame(raf);raf=0;lastTime=0;
    if(s.playing){s.playing=false;s.playbackStatus='Paused';update();return;}
    if(s.completion)resetMotionClock(s);
    s.playing=true;advanceMotion(s,s.time,motionView());update();
    if(s.playing)raf=requestAnimationFrame(animate);
  });
  on('step','click',()=>{s.playing=false;cancelAnimationFrame(raf);raf=0;lastTime=0;advanceMotion(s,s.time+.01,motionView());s.revealed=false;update();});
  on('guide','change',e=>{s.guide=Number(e.target.value);document.getElementById('guide-text').textContent=investigations[tab][s.guide][2];update();});
  on('load-guide','click',()=>{if(tab===2&&isPlates(s)){const guide=s.guide;states[2]=potentialModels.point;states[2].guide=guide;render();document.getElementById('load-guide').click();return;}if(tab===2){clearAttachments(s);s.samePotentialDemo=false;}const key=investigations[tab][s.guide][1];if(tab===3)loadExperiment(s,key);else if(key==='uniform'){s.uniform=true;s.probe={x:0,y:0};s.b={x:0,y:.1};}else loadPreset(s,key);s.revealed=false;render();});
  on('challenge-select','change',e=>{s.challenge=Number(e.target.value);s.revealed=false;s.prediction='';document.getElementById('prediction').value='';document.getElementById('hint-text').hidden=true;updateChallenge();});
  on('prediction','input',e=>{s.prediction=e.target.value;s.revealed=false;document.getElementById('feedback').innerHTML='';});
  on('check-answer','click',()=>{s.revealed=true;updateChallenge();});
  on('hint','click',()=>{const p=document.getElementById('hint-text');p.textContent=(tab===2&&isPlates(s)?plateChallenges:tab===3?motionChallenges(s):challenges[tab])[s.challenge].hint;p.hidden=!p.hidden;});
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{const el=document.getElementById(b.dataset.open);el.open=!el.open;if(el.open)el.scrollIntoView({block:'nearest',behavior:'instant'});}));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{document.getElementById(b.dataset.close).open=false;document.querySelector(`[data-open="${b.dataset.close}"]`)?.focus();}));
  on('theme-toggle','change',e=>{document.documentElement.dataset.theme=e.target.checked?'dark':'light';scheduleDraw();});
  on('close-help','click',()=>{help=false;document.getElementById('help-panel').hidden=true;document.getElementById('help-button').setAttribute('aria-expanded','false');});
  on('snap-equipotential','change',e=>{setSnapping(s,e.target.checked);update();});
  on('detach-a','click',()=>{releaseProbe(s,'probe');update();});
  on('detach-b','click',()=>{releaseProbe(s,'b');update();});
  on('same-potential','click',()=>{const result=samePotential(s,potentialView());if(!result.ok)s.snapMessage=result.message;else document.getElementById('calculations').open=true;update();syncControls();});
  on('start-zero-work','click',()=>{if(isPlates(s)){states[2]=potentialModels.point;render();document.getElementById('start-zero-work').click();return;}loadPreset(s,'equal');clearAttachments(s);s.samePotentialDemo=false;setSnapping(s,true);render();});
  setupPointers();
}
function showError(message){const e=document.getElementById('input-error');if(e)e.textContent=message;}
function syncControls(){const s=states[tab],c=s.charges.find(c=>c.id===s.selected);for(const [id,value] of Object.entries({'charge-range':c.q*1e6,'charge-number':c.q*1e6,'charge-x':c.x,'charge-y':c.y,'probe-x':s.probe.x,'probe-y':s.probe.y,'b-x':s.b.x,'b-y':s.b.y})){const el=document.getElementById(id);if(el&&document.activeElement!==el)el.value=tab===2&&/^(probe|b|charge)-(x|y)$/.test(id)?value:Number(value.toPrecision(8));}const out=document.getElementById('charge-output');if(out)out.textContent=fmt(c.q*1e6)+' μC';if(tab===3)syncMotionControls(s);}
function scheduleDraw(){if(framePending)return;framePending=true;requestAnimationFrame(()=>{framePending=false;drawScene();});}
function drawScene(){const canvas=document.getElementById('scene');if(!canvas)return;const objects=draw(canvas,states[tab],tab),host=document.getElementById('object-targets');
  // Retain focused buttons while moving them; canvas provides the visible symbols.
  const keys=new Set(objects.map(o=>o.key));for(const el of host.children)if(!keys.has(el.dataset.key))el.remove();
  for(const o of objects){let el=[...host.children].find(x=>x.dataset.key===o.key);if(!el){el=document.createElement('button');el.className='object-target';el.dataset.key=o.key;el.addEventListener('click',()=>{if(!['probe','b'].includes(o.key)&&states[tab].selected!==o.key){states[tab].selected=o.key;render();}});el.addEventListener('keydown',e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];if(!d)return;e.preventDefault();const s=states[tab],point=['probe','b'].includes(o.key)?s[o.key]:s.charges.find(c=>c.id===o.key);movePoint(point,point.x+d[0]*(e.shiftKey?.001:.005),point.y+d[1]*(e.shiftKey?.001:.005));});host.append(el);}el.style.left=o.x+'px';el.style.top=o.y+'px';el.setAttribute('aria-label',`${o.label}, x ${o.point.x.toFixed(3)} metres, y ${o.point.y.toFixed(3)} metres. Use arrow keys to move.`);}
}
function motionView(){const rect=document.getElementById('scene').getBoundingClientRect();return viewport(rect.width,rect.height,states[3],3);}
function potentialView(){const rect=document.getElementById('scene').getBoundingClientRect();return viewport(rect.width,rect.height,states[2],2);}
function movePoint(point,x,y){
  const s=states[tab],old={x:point.x,y:point.y},target={x:Math.max(-.25,Math.min(.25,x)),y:Math.max(-.22,Math.min(.22,y))};
  const saved=tab===2?structuredClone({probe:s.probe,b:s.b,attachments:s.attachments,snapSuppressed:s.snapSuppressed,snapMessage:s.snapMessage}):null;
  try{
    const key=tab===2?(point===s.probe?'probe':point===s.b?'b':null):null;
    if(key){if(isPlates(s))Object.assign(target,plateModel(s.plates).clamp(target));if(!movePotentialProbe(s,key,target,potentialView()))throw new RangeError('Keep probes clear of point charges.');}
    else Object.assign(point,target);
    validateCharges(s.charges);
    if(tab===2){reconcileAttachments(s,potentialView());validatePotentialProbes(s);}
    showError('');s.revealed=false;syncControls();update();
  }catch(e){Object.assign(point,old);if(saved){Object.assign(s.probe,saved.probe);Object.assign(s.b,saved.b);s.attachments=saved.attachments;s.snapSuppressed=saved.snapSuppressed;s.snapMessage=saved.snapMessage;}showError(e.message);}
}
function setupPointers(){const wrap=document.querySelector('.canvas-wrap'),canvas=document.getElementById('scene'),s=states[tab],contacts=new Map();let dragged=null,offset={x:0,y:0},pinch=null;
  const local=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  const view=()=>tab===2?potentialView():viewport(canvas.clientWidth,canvas.clientHeight,s,tab);
  wrap.addEventListener('pointerdown',e=>{if(tab===3)return;const p=local(e);contacts.set(e.pointerId,p);wrap.setPointerCapture(e.pointerId);if(contacts.size===2){const [a,b]=[...contacts.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:s.zoom};dragged=null;return;}
    const key=e.target.closest('[data-key]')?.dataset.key;let objects=[...s.charges.map(c=>({key:c.id,point:c})),...(tab===1||tab===2?[{key:'probe',point:s.probe}]:[]),...(tab===2?[{key:'b',point:s.b}]:[])];if(tab===2&&s.uniform)objects=objects.filter(o=>['probe','b'].includes(o.key));
    const nearest=tab===2?objects.map(o=>({...o,distance:Math.hypot(view().toScreen(o.point).x-p.x,view().toScreen(o.point).y-p.y)})).filter(o=>o.distance<24).sort((a,b)=>a.distance-b.distance)[0]:null;
    const chosen=nearest??(key?objects.find(o=>o.key===key):objects.reverse().find(o=>{const a=view().toScreen(o.point);return Math.hypot(a.x-p.x,a.y-p.y)<24;}));
    if(chosen){dragged=chosen.point;const world=view().toWorld(p);offset={x:dragged.x-world.x,y:dragged.y-world.y};if(!['probe','b'].includes(chosen.key)){s.selected=chosen.key;const select=document.getElementById('selected');if(select)select.value=chosen.key;syncControls();scheduleDraw();}}
  });
  wrap.addEventListener('pointermove',e=>{if(!contacts.has(e.pointerId))return;contacts.set(e.pointerId,local(e));if(contacts.size===2&&pinch){const [a,b]=[...contacts.values()];s.zoom=Math.max(.7,Math.min(2,pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance));document.getElementById('zoom').value=s.zoom;document.getElementById('zoom-output').textContent=s.zoom.toFixed(1)+'×';scheduleDraw();return;}if(dragged){const world=view().toWorld(local(e));movePoint(dragged,world.x+offset.x,world.y+offset.y);}});
  const end=e=>{contacts.delete(e.pointerId);dragged=null;pinch=null;};wrap.addEventListener('pointerup',end);wrap.addEventListener('pointercancel',end);
}
function update(){
  const s=states[tab],strip=document.getElementById('live-strip'),body=document.getElementById('calculation-body');
  if(tab===2){if(isPlates(s)){const m=plateModel(s.plates);document.getElementById('plate-readout').textContent=`E = ${fmt(m.strength,'V/m')} = ${fmt(m.strength,'N/C')} | ${s.plates.voltage} V / ${s.plates.d} m`;}if(reconcileAttachments(s,potentialView()))syncControls();updateSnapControls(s,fmt);}
  const selected=document.getElementById('selected');if(selected)for(const option of selected.options){const source=s.charges.find(c=>c.id===option.value);option.textContent=`q${source.id} · ${fmt(source.q*1e6)} μC`;}
  try{
    let html='';
    const equation=(title,eq,working)=>`<h4>${title}</h4><div class="equation">${eq}</div><p>${working}</p>`;
    const constants=`<p class="small">SI constants: ε₀ = ${fmt(EPSILON_0)} F/m; k = 1/(4πε₀) = ${fmt(K)} N·m²/C². Coordinates use +x right, +y up. Direction is counterclockwise from +x.</p>`;
    if(tab===0){const target=s.charges.find(c=>c.id===s.selected),f=forceOn(s.charges,s.selected);
      strip.innerHTML=stat('Resultant force',fmt(magnitude(f),'N'))+stat('Direction',angle(f));
      html=`<h4>1 · Given quantities</h4><p>Target q${target.id} = ${fmt(target.q,'C')} at (${fmt(target.x)}, ${fmt(target.y)}) m. ${s.charges.length} point charges.</p>`+equation('2 · Coulomb’s law','F = k |Qq| / r²<br>𝐅ᵢ←ⱼ = kqᵢqⱼ(𝐫ᵢ − 𝐫ⱼ) / rᵢⱼ³','For each pair, the force acts along their joining line. Like charges repel; unlike charges attract.')+`<h4>3 · Substitute each source</h4>${contributionTable(f,'F','N',s,target)}<h4>4 · Vector sum</h4><p>Fₓ = ${f.contributions.map(c=>fmt(c.x)).join(' + ')||'0'} = <b>${fmt(f.x,'N')}</b><br>Fᵧ = ${f.contributions.map(c=>fmt(c.y)).join(' + ')||'0'} = <b>${fmt(f.y,'N')}</b></p>`+equation('5 · Final answer','|𝐅| = √(Fₓ² + Fᵧ²)',`${fmt(magnitude(f),'N')} · ${angle(f)}. Components and individual arrows share one scale; the scale changes to fit the diagram.`);
    }else if(tab===1){const e=individualFields(s.charges,s.probe),f={x:e.x*s.testQ,y:e.y*s.testQ};
      strip.innerHTML=stat('Field at A',fmt(magnitude(e),'N/C'))+stat('Direction',angle(e));
      html=`<h4>1 · Given quantities</h4><p>A = (${fmt(s.probe.x)}, ${fmt(s.probe.y)}) m; q₀ = ${fmt(s.testQ,'C')}.</p>`+equation('2 · Field definition','𝐄 = 𝐅 / q₀ (q₀ ≠ 0)<br>𝐄 = Σ kqⱼ(𝐫 − 𝐫ⱼ) / rⱼ³','The field is defined by the force per unit positive test charge. It exists independently of the test charge.')+`<h4>3 · Source contributions</h4>${contributionTable(e,'E','N/C',s,s.probe)}<h4>4 · Vector sum</h4><p>Eₓ = ${fmt(e.x,'N/C')}<br>Eᵧ = ${fmt(e.y,'N/C')}</p>`+equation('5 · Result and interpretation','E = √(Eₓ² + Eᵧ²)<br>𝐅 = q₀𝐄',`E = ${fmt(magnitude(e),'N/C')} · ${angle(e)}.<br>Fₓ = ${fmt(f.x,'N')}; Fᵧ = ${fmt(f.y,'N')}. ${s.testQ===0?'Zero test charge: F = 0; E remains defined by the sources.':s.testQ<0?'Negative test charge: force opposes E.':'Positive test charge: force follows E.'}`)+`<p class="small">Field lines follow E with adaptive stopping near sources and nulls; line count is illustrative, not a quantitative charge-density scale. Grid arrows use normalized lengths.</p>`;
      html+=fieldExplanation(s,e);updateIndividualFields(s,e);
      const zero=document.getElementById('zero-status');if(zero)zero.innerHTML=`<p class="${magnitude(e)<=1000?'success':'small'}">Zero-field hunt: ${magnitude(e)<=1000?'within tolerance ✓':'keep moving A'} · |E| ${fmt(magnitude(e),'N/C')} (target ≤ 1,000 N/C).</p>`;
    }else if(tab===2){const c=potentialComparison(s),{va,vb}=c,{dv,du,work}=c.display,e=isPlates(s)?plateModel(s.plates).field:s.uniform?{x:0,y:s.uniformE}:fieldAt(s.charges,s.probe);
      strip.innerHTML=stat('Potential at A',fmt(va,'V'))+stat('B − A',fmt(dv,'V'));
      html=`<h4>1 · Given quantities</h4><p>A = (${fmt(s.probe.x)}, ${fmt(s.probe.y)}) m; B = (${fmt(s.b.x)}, ${fmt(s.b.y)}) m; test q = ${fmt(s.testQ,'C')}.</p>`+equation('2 · Potential and work','V = W_ext / q₀<br>V = Σ kqⱼ/rⱼ<br>ΔV = V_B − V_A',s.uniform?`Uniform field: V(y) = −Eᵧy with V(0) = 0; Eᵧ = ${fmt(s.uniformE,'V/m')}. ΔV = −Eᵧ(yB − yA).`:'Point-source reference: V = 0 at infinity. Potential is the quasistatic external work per unit positive test charge brought from the reference.')+`<h4>3 · Substitution</h4>${s.uniform?`<p>V_A = −(${fmt(s.uniformE)})(${fmt(s.probe.y)}) V<br>V_B = −(${fmt(s.uniformE)})(${fmt(s.b.y)}) V</p>`:`<p>V_A = ${s.charges.map(c=>c.q===0?'0':`k(${fmt(c.q)})/${fmt(Math.hypot(s.probe.x-c.x,s.probe.y-c.y))}`).join(' + ')} V</p>`}<h4>4 · Calculation</h4><p>V_A = ${fmt(va,'V')}<br>V_B = ${fmt(vb,'V')}<br>ΔV = ${fmt(vb)} − (${fmt(va)}) = <b>${fmt(dv,'V')}</b></p>`+equation('5 · Energy and work','ΔU = qΔV = W_ext<br>W_field = −qΔV',`ΔU = (${fmt(s.testQ)})(${fmt(dv)}) = <b>${fmt(du,'J')}</b><br>W_field = ${fmt(work,'J')}. External-work signs assume a quasistatic move.`)+`<h4>Field versus potential</h4><p>|E_A| = ${fmt(magnitude(e),'N/C')}; V_A = ${fmt(va,'V')}. Field vectors may cancel while scalar potentials add.</p><h4>System energy (maximum 3 sources)</h4>`+(s.uniform?'<p>Not applicable to the ideal uniform-field example.</p>':s.charges.length>3?'<p>Use up to three charges for this syllabus calculation. The potential map still supports four.</p>':`<div class="equation">U = Σᵢ&lt;ⱼ kqᵢqⱼ/rᵢⱼ</div><p>${s.charges.flatMap((c,i)=>s.charges.slice(0,i).map(d=>`U${d.id}${c.id} = k(${fmt(c.q)})(${fmt(d.q)})/${fmt(Math.hypot(c.x-d.x,c.y-d.y))} = ${fmt(K*c.q*d.q/Math.hypot(c.x-d.x,c.y-d.y),'J')}`)).join('<br>')||'A single source has no distinct pairs.'}<br><b>U = ${fmt(systemEnergy(s.charges),'J')}</b></p>`)+`<p class="small">Equipotentials connect equal V, so work along one is zero. Isolated-charge circles are cross-sections of spheres; uniform-field lines are cross-sections of parallel planes, perpendicular to E. Sampled contours use ${s.fieldLines?8:12} px cells.</p>`;
      if(isPlates(s))html=plateWorking(s,c,fmt);
      else html+=`<h4>Resultant electric field</h4><div class="equation">E = &Sigma; kq&#x2C7C;(r &minus; r&#x2C7C;)/r&#x2C7C;&sup3;</div><p>E_x = ${fmt(e.x,'N/C')}; E_y = ${fmt(e.y,'N/C')}. Continuous field lines follow the resultant field from higher to lower potential. They cross smooth equipotentials at 90&deg; wherever E is nonzero; at an exact field null there is no field direction.</p>`;
      const workingOpen=body.querySelector('#equipotential-working')?.open??s.equipotentialWorkingOpen??false;
      html+=movementWorking(s,c,fmt,workingOpen);
    }else{
      const m=s.motionResult??advanceMotion(s,s.time,motionView());
      if(s.completion){cancelAnimationFrame(raf);raf=0;lastTime=0;}
      strip.innerHTML=stat('Time',fmt(m.time,'s'))+stat('Acceleration |a|',fmt(Math.hypot(m.ax,m.ay),'m/s²'));
      html=motionWorking(s,m,fmt);updateMotionStatus(s,m,fmt);

    }
    body.innerHTML=html+constants;
  }catch(e){if(tab===1)updateIndividualFields(s,null,e.message);strip.innerHTML=`<p class="error">${e.message}</p>`;body.innerHTML=`<p class="error">${e.message}</p>`;}
  updateChallenge();scheduleDraw();
}
function contributionTable(v,symbol,unit,s,target){return `<table><caption>Component values in ${unit}; r in m</caption><thead><tr><th>Source</th><th>r</th><th>${symbol}ₓ</th><th>${symbol}ᵧ</th></tr></thead><tbody>${v.contributions.map(part=>`<tr><td>q${part.id}</td><td>${fmt(part.r)}</td><td>${fmt(part.x)}</td><td>${fmt(part.y)}</td></tr>`).join('')}</tbody></table>`+v.contributions.map(part=>{const source=s.charges.find(c=>c.id===part.id);return `<p class="small">q${source.id} = ${fmt(source.q,'C')} at (${fmt(source.x)}, ${fmt(source.y)}) m.<br>${symbol}ₓ${source.id} = k${symbol==='F'?'('+fmt(target.q)+')':''}(${fmt(source.q)})(${fmt(target.x-source.x)}) / (${fmt(part.r)})³ = ${fmt(part.x,unit)}.<br>${symbol}ᵧ${source.id} uses Δy = ${fmt(target.y-source.y,'m')}, giving ${fmt(part.y,unit)}.</p>`;}).join('');}
function updateChallenge(){const s=states[tab],q=(tab===2&&isPlates(s)?plateChallenges:tab===3?motionChallenges(s):challenges[tab])[s.challenge];document.getElementById('challenge-question').textContent=q.question;document.getElementById('answer-unit').textContent=q.unit?'('+q.unit+')':'';const f=document.getElementById('feedback');if(!s.revealed){f.innerHTML='';return;}try{const answer=q.answer(s),passed=checkAnswer(s.prediction,answer);f.className=passed?'feedback success':'feedback';f.innerHTML=`<b>${passed?'Correct prediction.':'Compare your prediction.'}</b><p>Current answer: <strong>${typeof answer==='string'?answer:fmt(answer,q.unit)}</strong></p><p>${q.explain}</p><p class="small">Use the live Calculations panel for the numerical substitution and working.</p>`;}catch(e){f.className='feedback';f.textContent=e.message;}}
function animate(now){
  raf=0;const s=states[3];if(!s.playing||tab!==3||document.hidden)return;
  if(lastTime)advanceMotion(s,s.time+Math.min((now-lastTime)/1000,.05)*.1*s.speed,motionView());
  lastTime=now;s.revealed=false;update();if(s.playing)raf=requestAnimationFrame(animate);
}
nav.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)selectTab(Number(b.dataset.tab));});
nav.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();selectTab(e.key==='Home'?0:e.key==='End'?3:(tab+(e.key==='ArrowRight'?1:3))%4);});
document.getElementById('help-button').addEventListener('click',()=>{help=!help;document.getElementById('help-button').setAttribute('aria-expanded',String(help));document.getElementById('help-panel').hidden=!help;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){states[3].playing=false;states[3].playbackStatus='Paused';cancelAnimationFrame(raf);raf=0;lastTime=0;const b=document.getElementById('play');if(b)b.textContent='▶ Play';if(tab===3)update();}});
window.addEventListener('resize',()=>{placeQuickControls();if(tab===3&&states[3].playing){advanceMotion(states[3],states[3].time,motionView());update();}scheduleDraw();revealActiveTab();});
render();
