import {equations,notation as math,quantity as Q} from './math.js';
const t=String.raw;
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
    const d=c.display;
    result.innerHTML=`<strong>${c.equal?'Same Equipotential Surface':c.sameLevel?'Equipotential alignment unverified':Math.abs(c.dv)<=c.tolerance?'Independent potential measurements':'Different Potentials'}</strong><p>Computed: ${math(t`\Delta V=${Q(d.dv,'V')}`)}; ${math(t`\Delta U=${Q(d.du,'J')}`)}; ${math(t`W_{\mathrm{field}}=${Q(d.work,'J')}`)}.</p>${c.equal?`<p class="small">${math(t`V_A=V_B`)}. Verified within numerical tolerance; raw measurements retained internally.</p>`:c.sameLevel?'<p class="small">Alignment checks failed; actual measurements shown. Reattach or match potentials again.</p>':''}`;
  }catch{result.hidden=true;}
}
export function movementWorking(s,c,fmt,open){
  const d=c.display;
  return `<details id="equipotential-working" class="equipotential-working" ${open?'open':''}><summary>Movement Along an Equipotential</summary><p>An equipotential is a set of points with the same electric potential. For ideal points on the same contour:</p>${equations(t`V_A=V_B`,t`\Delta V=V_B-V_A=0\;\mathrm V`,t`\Delta U=q_0\Delta V=0\;\mathrm J`,t`W_{\mathrm{field}}=-\Delta U=0\;\mathrm J`)}<p>The electrostatic field is perpendicular to a smooth equipotential wherever E ≠ 0. Tangential motion changes no potential. The field can be nonzero while the work along the contour is zero. Quasistatic external work equals ΔU and is also zero in this case.</p><h4>Actual Current Positions</h4><div id="equipotential-actual">${equations(t`V_A=${Q(c.va,'V')}`,t`V_B=${Q(c.vb,'V')}`,t`\Delta V=${Q(d.dv,'V')}`,t`\Delta U=${Q(d.du,'J')}`,t`W_{\mathrm{field}}=${Q(d.work,'J')}`)}${c.equal?'<p>Verified equipotential.</p>':''}</div><p class="small">${c.equal?'Both probes are attached to the same level and pass the projection checks. Only displayed differences are normalized to zero; raw measurements retain full precision.':c.sameLevel?'Equipotential alignment is unverified; actual differences are shown.':'No verified shared attachment; actual differences are shown.'} Zero display requires each level residual ≤ max(10⁻⁷ V, 10⁻¹¹|V_c|)/8 and |ΔV| ≤ ${fmt(c.tolerance,'V')}. Contour drawing is approximate; snapping refines positions using the actual potential equation.</p></details>`;
}
export function equipotentialActivity(open){
  return `<details id="zero-work-activity" ${open['zero-work-activity']?'open':''}><summary>Zero Work Along an Equipotential</summary><p><b>Objective:</b> compare energy change while B slides along a contour and after B detaches.</p><p><b>Predict first:</b> can the electric field be nonzero while moving a test charge from A to B requires zero electrostatic work?</p><button id="start-zero-work">Set up zero-work experiment</button><ol class="equipotential-steps"><li>Select Two equal positive (the setup button does this).</li><li>Enable Snap to Equipotential.</li><li>Drag A onto a visible contour.</li><li>Choose B → Same Potential as A, or attach B to the same contour.</li><li>Observe the verified potential difference.</li><li>Drag B along the highlighted contour.</li><li>Check that verified ΔV, ΔU and ${math(t`W_{\mathrm{field}}`)} display zero.</li><li>Use Detach B.</li><li>Drag B out of the capture band and to a different potential.</li><li>Compare the new ΔV, energy change and work.</li></ol><details id="zero-work-answer" ${open['zero-work-answer']?'open':''}><summary>Reveal the explanation</summary><p>Yes. Equal potential gives ΔV = 0, so ${math(t`\Delta U=q_0\Delta V=0`)} and ${math(t`W_{\mathrm{field}}`)} = −ΔU = 0. This does not require E = 0. After detaching and moving to a different potential, use the actual nonzero differences in Calculations.</p></details></details>`;
}
