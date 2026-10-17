import {isPlates,plateModel} from './parallel-plates.js';
import {forceOn,fieldAt,potentialAt,systemEnergy,energyChange,magnitude,motionAt,uniformField,G} from './physics.js';
// Every answer is evaluated from the current state, after any learner edits.
export const investigations=[
  [
    ['Distance and inverse square','equal','Predict what doubling the separation will do. Move charge 2 from x = 0.10 m to 0.30 m (keep charge 1 at −0.10 m). Compare the force before and after.'],
    ['Polarity and force direction','opposite','Predict attraction or repulsion. Reverse the selected charge’s sign, then inspect the force diagram.'],
    ['Build a resultant','square','Select a target. Predict the resultant direction, enable components, and compare the individual vectors with their sum.']
  ],[
    ['A field is force per charge','positive','Keep the probe fixed. Change the test charge from +2 nC to −2 nC. Observe that E is unchanged while F reverses.'],
    ['Find the Zero-Field Point','equal','Move probe A to the midpoint. Success means |E| ≤ 1,000 N/C inside the workspace. Use precise x/y inputs to refine your position.'],
    ['Superposition in 2D','square','Predict the direction of E at A. Move a source and compare the individual contributions with the resultant.']
  ],[
    ['Zero field, nonzero potential','equal','Place A at (0, 0). Compare E and V. The field vectors cancel; the two positive scalar potentials add.'],
    ['Follow an equipotential','positive','Put A at (0.15, 0) and B at (0, 0.15). Predict ΔV and the work needed to move a test charge between them.'],
    ['Uniform-field cross-section','uniform','Switch on the ideal uniform field. Move B upward. Observe parallel contours and the signed relationship ΔV = −EᵧΔy.']
  ],[
    ['From rest to motion','rest','Predict the initial force and acceleration. Play or step forward; a nonzero resultant force changes the velocity.'],
    ['Launch across the field','perpendicular','Predict the deflection. Compare constant vₓ with changing vᵧ. The trajectory is parabolic inside the plates and straight after exit when gravity is off.'],
    ['Moving equilibrium','equilibrium','Compare upward qE with downward mg. The balanced particle moves at nonzero constant velocity inside the field. Outside the plates gravity acts alone.']
  ]
];
const task=(title,question,unit,answer,hint,explain)=>({title,question,unit,answer,hint,explain});
export const challenges=[
  [
    task('Attraction or repulsion','For the first two charges, predict “attract”, “repel” or “zero”.','',s=>s.charges.length<2?'zero':s.charges[0].q*s.charges[1].q>0?'repel':s.charges[0].q*s.charges[1].q<0?'attract':'zero','Compare the charge signs.','Like signs repel; opposite signs attract. A zero charge has no electrostatic force.'),
    task('Resultant force','What is the magnitude of the force on the selected target?','N',s=>magnitude(forceOn(s.charges,s.selected)),'Add x and y components before finding the magnitude.','F = √(Fₓ² + Fᵧ²). Each source contributes kqᵢqⱼ(rᵢ − rⱼ)/r³.'),
    task('Double every separation','Imagine scaling all positions relative to the target by 2. What is the new resultant magnitude?','N',s=>magnitude(forceOn(s.charges,s.selected))/4,'Every force changes by the same inverse-square factor.','F′ = F/2² = F/4. The direction is preserved unless the original resultant is zero.'),
    task('Reverse the target','If only the target polarity reverses, what is the new Fₓ?','N',s=>-forceOn(s.charges,s.selected).x,'The force is proportional to the signed target charge.','Fₓ′ = −Fₓ. All individual forces and the resultant reverse.'),
    task('Direction by components','What is the current vertical resultant component Fᵧ?','N',s=>forceOn(s.charges,s.selected).y,'Upward is positive.','Fᵧ = Σ kqᵢqⱼ(yᵢ − yⱼ)/rᵢⱼ³. Use its sign to predict the vertical direction.')
  ],[
    task('Measure the field','Predict the magnitude of E at probe A.','N/C',s=>magnitude(fieldAt(s.charges,s.probe)),'Field points away from a positive source.','E = √(Eₓ² + Eᵧ²); add the source components first.'),
    task('Test-charge force','What is the magnitude of the force on the test charge at A?','N',s=>Math.abs(s.testQ)*magnitude(fieldAt(s.charges,s.probe)),'Convert nC into C.','|F| = |q₀| |E|. Negative q₀ reverses the force direction; it does not reverse E.'),
    task('Individual contribution','Predict Eₓ at A due to source 1 only.','N/C',s=>fieldAt(s.charges.slice(0,1),s.probe).x,'Use the horizontal displacement from source 1.','Eₓ₁ = kq₁(xA − x₁)/r₁³. Compare with the full resultant in Calculations.'),
    task('Vector superposition','Predict the vertical resultant Eᵧ.','N/C',s=>fieldAt(s.charges,s.probe).y,'Use signed components.','Eᵧ = Σ Eᵧⱼ. Equal and opposite components cancel even though their magnitudes are nonzero.')
  ],[
    task('Potential and its sign','Predict the potential at A, including its sign.','V',s=>getPotential(s,s.probe),'Add scalar terms with their charge signs.','V = Σ kqⱼ/rⱼ; for the uniform example V = −Eᵧy, with V = 0 at y = 0.'),
    task('Potential difference','Predict ΔV from A to B.','V',s=>getPotential(s,s.b)-getPotential(s,s.probe),'Final minus initial.','ΔV = V_B − V_A. Equal-potential points give zero difference.'),
    task('Energy and external work','Predict the test charge’s ΔU when moving from A to B.','J',s=>energyChange(s.testQ,getPotential(s,s.b)-getPotential(s,s.probe)),'Retain both the sign of q and ΔV.','ΔU = qΔV = W_ext for quasistatic motion. The field does W_field = −ΔU.'),
    task('Field versus potential','Predict |E| at A. Compare your answer with the potential.','N/C',s=>isPlates(s)?plateModel(s.plates).strength:s.uniform?Math.abs(s.uniformE):magnitude(fieldAt(s.charges,s.probe)),'Potential is a scalar; E is a vector.','For equal positive sources at the midpoint, E = 0 but V = 2kQ/r > 0.'),
    task('System energy','For up to three sources, predict their total system energy.','J',s=>systemEnergy(s.charges),'Use a single, pair or triangle preset.','U = Σᵢ<ⱼ kqᵢqⱼ/rᵢⱼ. Each distinct pair is counted once; this exercise is restricted to three sources.')
  ],[
    task('Deflection','Predict the initial signed vertical acceleration.','m/s²',s=>motionAt(s.motion,0).ay,'Calculate the resultant force first.','aᵧ = qEᵧ/m − g when gravity is enabled. The sign gives the initial deflection.'),
    task('Plate field','Predict the signed vertical electric field between the plates.','V/m',s=>uniformField(s.motion.voltage,s.motion.d),'Voltage is V_bottom − V_top.','Eᵧ = (V_bottom − V_top)/d, from higher to lower potential.'),
    task('Velocity at the clock','Predict the vertical velocity at the current simulation time.','m/s',s=>motionAt(s.motion,s.time).vy,'Use each constant-acceleration segment, stopping at an impact.','vᵧ = vᵧ₀ + aᵧt within each segment. After an absorbing plate impact the particle is at rest.'),
    task('Displacement at the clock','Predict the vertical displacement from launch at the current time.','m',s=>motionAt(s.motion,s.time).y-s.motion.y0,'The position is measured from the launch point.','Δy = vᵧ₀t + ½aᵧt² within a segment. Segments are joined continuously at the field boundary.'),
    task('Balance gravity','For nonzero q, what signed Eᵧ balances gravity?','V/m',s=>{if(s.motion.q===0)throw new RangeError('Choose a nonzero particle charge for equilibrium.');return s.motion.mass*G/s.motion.q;},'Gravity points down; the electric force must point up.','qEᵧ = mg, so Eᵧ = mg/q. Enable gravity and use nonzero velocity for dynamic equilibrium.'),
    task('Reverse the particle','What would the initial electric force Fᵧ be after reversing q?','N',s=>-s.motion.q*uniformField(s.motion.voltage,s.motion.d),'Electric force reverses; gravity does not.','F_eᵧ′ = −qEᵧ. Dynamic equilibrium is lost if q reverses without also reversing E.')
  ]
];
export function getPotential(s,p){return isPlates(s)?plateModel(s.plates).potential(p):s.uniform?-s.uniformE*p.y:potentialAt(s.charges,p);}
export function checkAnswer(input,answer){
  if(typeof answer==='string')return input.trim().toLowerCase()===answer;
  if(!input.trim()||!Number.isFinite(Number(input)))return false;
  return Math.abs(Number(input)-answer)<=Math.max(1e-10,Math.abs(answer)*.02);
}
