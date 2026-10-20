import {notation} from './math.js';
const t=String.raw;
// Explicit translations of authored learning content, not a general-purpose
// parser. Longest expressions win, so signed work and vector meaning survive.
const expressions=new Map([
  ['F = √(Fₓ² + Fᵧ²)',t`F=\sqrt{F_x^2+F_y^2}`],
  ['kqᵢqⱼ(rᵢ − rⱼ)/r³',t`kq_iq_j\frac{\vec r_i-\vec r_j}{r^3}`],
  ['F′ = F/2² = F/4',t`F'=\frac{F}{2^2}=\frac{F}{4}`],
  ['Fₓ′ = −Fₓ',t`F_x'=-F_x`],
  ['Fᵧ = Σ kqᵢqⱼ(yᵢ − yⱼ)/rᵢⱼ³',t`F_y=\sum_j\frac{kq_iq_j(y_i-y_j)}{r_{ij}^3}`],
  ['E = √(Eₓ² + Eᵧ²)',t`E=\sqrt{E_x^2+E_y^2}`],
  ['|F| = |q₀| |E|',t`F=|q_0|E`],
  ['Eₓ₁ = kq₁(xA − x₁)/r₁³',t`E_{x1}=\frac{kq_1(x_A-x_1)}{r_1^3}`],
  ['Eᵧ = Σ Eᵧⱼ',t`E_y=\sum_j E_{yj}`],
  ['V = Σ kqⱼ/rⱼ',t`V=\sum_j\frac{kq_j}{r_j}`],
  ['V = −Eᵧy',t`V=-E_y y`],
  ['ΔV = −EᵧΔy',t`\Delta V=-E_y\Delta y`],
  ['ΔV = V_B − V_A',t`\Delta V=V_B-V_A`],
  ['ΔU = qΔV = W_ext',t`\Delta U=q\Delta V=W_{\mathrm{ext}}`],
  ['W_field = −ΔU',t`W_{\mathrm{field}}=-\Delta U`],
  ['V = 2kQ/r > 0',t`V=\frac{2kQ}{r}>0`],
  ['U = Σᵢ<ⱼ kqᵢqⱼ/rᵢⱼ',t`U=\sum_{i<j}\frac{kq_iq_j}{r_{ij}}`],
  ['aᵧ = qEᵧ/m − g',t`a_y=\frac{qE_y}{m}-g`],
  ['Eᵧ = (V_bottom − V_top)/d',t`E_y=\frac{V_{\mathrm{bottom}}-V_{\mathrm{top}}}{d}`],
  ['vᵧ = vᵧ₀ + aᵧt',t`v_y=v_{y0}+a_y t`],
  ['Δy = vᵧ₀t + ½aᵧt²',t`\Delta y=v_{y0}t+\frac{1}{2}a_y t^2`],
  ['Eᵧ = mg/q',t`E_y=\frac{mg}{q}`],
  ['qEᵧ = mg',t`qE_y=mg`],
  ['F_eᵧ′ = −qEᵧ',t`F_{Ey}'=-qE_y`],
  ['FE + q(v × B)',t`\vec F_E+q(\vec v\times\vec B)`],
  ['q(v × B)',t`q(\vec v\times\vec B)`],
  ['|FB| = |q|vB',t`F_B=|q|vB`],
  ['v = E/B',t`v=\frac{E}{B}`],
  ['E = |ΔV|/d',t`E=\frac{|\Delta V|}{d}`],
  ['|q|B/m',t`\frac{|q|B}{m}`],
  ['E × B',t`\vec E\times\vec B`],
  ['ΔU = q₀ΔV_AB',t`\Delta U=q_0\Delta V_{AB}`],
  ['ΔU = q₀ΔV = 0',t`\Delta U=q_0\Delta V=0`],
  ['E = 200/0.020 = 10,000 V/m',t`E=\frac{200}{0.020}=10000\;\mathrm V\,\mathrm m^{-1}`],
  ['ΔV = 0 V',t`\Delta V=0\;\mathrm V`],
  ['ΔU = 0 J',t`\Delta U=0\;\mathrm J`],
  ['FE',t`\vec F_E`],['FB',t`\vec F_B`],
  ['W_field',t`W_{\mathrm{field}}`],['W_ext',t`W_{\mathrm{ext}}`],
  ['V_A',t`V_A`],['V_B',t`V_B`],['ΔV_AB',t`\Delta V_{AB}`],
]);
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const keys=[...expressions.keys()].sort((a,b)=>b.length-a.length);
const pattern=new RegExp(keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gu');
export function educationalText(text){
  let out='',last=0;
  for(const match of text.matchAll(pattern)){
    out+=escape(text.slice(last,match.index))+notation(expressions.get(match[0]));last=match.index+match[0].length;
  }
  return out+escape(text.slice(last));
}
