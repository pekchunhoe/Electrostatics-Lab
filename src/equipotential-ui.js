import {potentialComparison} from './equipotential.js';

export function snapControls(s){
  return `<div class="snap-controls"><label class="check" for="snap-equipotential"><input id="snap-equipotential" type="checkbox" aria-controls="snap-attachments" ${s.snapEnabled?'checked':''}>Snap to Equipotential <span id="snap-mode" aria-hidden="true">${s.snapEnabled?'ON':'OFF'}</span></label><button id="same-potential" class="accent">B → Same Potential as A</button><div id="snap-attachments"><span id="snap-a-state"></span><button id="detach-a" aria-label="Detach A" hidden>Detach A</button><span id="snap-b-state"></span><button id="detach-b" aria-label="Detach B" hidden>Detach B</button></div><p id="snap-status" class="snap-status" role="status" aria-live="polite"></p><div id="snap-comparison" class="snap-comparison" hidden></div></div>`;
}
export function updateSnapControls(s,fmt){
  const toggle=document.getElementById('snap-equipotential');if(!toggle)return;
  toggle.checked=s.snapEnabled;document.getElementById('snap-mode').textContent=s.snapEnabled?'ON':'OFF';
  const contours=document.querySelector('[data-toggle="contours"]');if(contours)contours.checked=s.contours;
  for(const [key,label] of [['probe','a'],['b','b']]){
    const held=s.attachments[key],state=document.getElementById(`snap-${label}-state`),button=document.getElementById(`detach-${label}`);
    state.textContent=held?`${label.toUpperCase()}: ${fmt(held.level,'V')}`:'';
    state.dataset.attachment=held?'attached':'free';
    if(held)state.dataset.level=String(held.level);else delete state.dataset.level;
    state.hidden=!held;button.hidden=!held;
  }
  const status=document.getElementById('snap-status');if(status.textContent!==s.snapMessage)status.textContent=s.snapMessage;
  // Keep the comparison live after a manual two-probe demonstration, including
  // after detachment, so students see the transition to nonzero work.
  if(s.attachments.probe&&s.attachments.b)s.samePotentialDemo=true;
  const result=document.getElementById('snap-comparison');result.hidden=!s.samePotentialDemo;
  if(result.hidden)return;
  try{
    const c=potentialComparison(s);for(const key of ['va','vb','dv','du','work','tolerance'])result.dataset[key]=String(c[key]);
    result.dataset.equal=String(c.equal);
    result.innerHTML=`<strong>${c.equal?'Same Equipotential Surface':'Different Potentials'}</strong><p>${c.equal?'ΔV ≈ 0 V; ΔU ≈ 0 J; W_field ≈ 0 J.':'ΔV = '+fmt(c.dv,'V')+'; W_field = '+fmt(c.work,'J')+'.'}</p><p class="small">Computed ΔV = ${fmt(c.dv,'V')}; ΔU = ${fmt(c.du,'J')}; W_field = ${fmt(c.work,'J')}. ${c.equal?'Numerical equality tolerance: '+fmt(c.tolerance,'V')+'.':''}</p>`;
  }catch{result.hidden=true;}
}
export function movementWorking(s,c,fmt,open){
  return `<details id="equipotential-working" class="equipotential-working" ${open?'open':''}><summary>Movement Along an Equipotential</summary><p>An equipotential is a set of points with the same electric potential. For ideal points on the same contour:</p><div class="equation">V_A = V_B<br>ΔV = V_B − V_A = 0 V<br>ΔU = q₀ΔV = 0 J<br>W_field = −ΔU = 0 J</div><p>The electrostatic field is perpendicular to a smooth equipotential wherever E ≠ 0. Tangential motion changes no potential. The field can be nonzero while the work along the contour is zero. Quasistatic external work equals ΔU and is also zero in this case.</p><h4>Actual current positions</h4><p>V_A = ${fmt(c.va,'V')}<br>V_B = ${fmt(c.vb,'V')}<br>ΔV = ${fmt(c.dv,'V')}<br>ΔU = ${fmt(c.du,'J')}<br>W_field = ${fmt(c.work,'J')}</p><p class="small">${c.equal?'The actual positions agree within the numerical tolerance; any residual above is retained, not forced to zero.':'These positions are at different potentials; the nonzero values above apply.'} Each projection is accepted at |V − V_c| ≤ max(10⁻⁷ V, 10⁻¹¹|V_c|), with a stricter solver stopping target. The comparison tolerance is ${fmt(c.tolerance,'V')}. Contour drawing is approximate; snapping refines positions using the actual potential equation.</p></details>`;
}
export function equipotentialActivity(open){
  return `<details id="zero-work-activity" ${open['zero-work-activity']?'open':''}><summary>Zero Work Along an Equipotential</summary><p><b>Objective:</b> compare energy change while B slides along a contour and after B detaches.</p><p><b>Predict first:</b> can the electric field be nonzero while moving a test charge from A to B requires zero electrostatic work?</p><button id="start-zero-work">Set up zero-work experiment</button><ol class="equipotential-steps"><li>Select Two equal positive (the setup button does this).</li><li>Enable Snap to Equipotential.</li><li>Drag A onto a visible contour.</li><li>Choose B → Same Potential as A, or attach B to the same contour.</li><li>Observe the actual potential difference.</li><li>Drag B along the highlighted contour.</li><li>Check that ΔV remains within numerical tolerance.</li><li>Use Detach B.</li><li>Drag B out of the capture band and to a different potential.</li><li>Compare the new ΔV, energy change and work.</li></ol><details id="zero-work-answer" ${open['zero-work-answer']?'open':''}><summary>Reveal the explanation</summary><p>Yes. Equal potential gives ΔV = 0, so ΔU = q₀ΔV = 0 and W_field = −ΔU = 0. This does not require E = 0. After detaching and moving to a different potential, use the actual nonzero differences in Calculations.</p></details></details>`;
}
