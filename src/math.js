// Local, deliberately small authored-notation renderer. No remote scripts/fonts,
// eval, or HTML from equation input. Native MathML supplies layout and accessibility.
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const symbols={Delta:'Δ',theta:'θ',omega:'ω',epsilon:'ε',pi:'π',times:'×',cdot:'·',sum:'∑',ne:'≠',neq:'≠',le:'≤',ge:'≥',infty:'∞',perp:'⊥',pm:'±',to:'→',leftarrow:'←'};
const cache=new Map();
function spoken(source){
  let i=0;
  function group(){while(source[i]===' ')i++;if(source[i]==='{'){i++;return parse('}');}return token();}
  function token(){
    const ch=source[i++];if(ch===undefined)return '';
    if(ch==='{')return parse('}');
    if(ch==='_'||ch==='^')return (ch==='_'?' subscript ':' to the power ')+group()+' ';
    if(ch!=='\\')return ch==='-'?' negative ':ch;
    const command=source.slice(i).match(/^[A-Za-z]+/)?.[0];
    if(!command){i++;return ' ';}i+=command.length;
    if(command==='frac')return '('+group()+') divided by ('+group()+')';
    if(command==='vec')return 'vector '+group();
    if(command==='sqrt')return 'square root of ('+group()+')';
    if(command==='mathrm'||command==='text')return group();
    return ({Delta:'delta ',theta:'theta',omega:'omega',epsilon:'epsilon',pi:'pi',times:' times ',cdot:' dot ',sum:'sum ',ne:' is not ',neq:' is not ',quad:' ',left:'',right:''})[command]??command;
  }
  function parse(end){let text='';while(i<source.length){if(end&&source[i]===end){i++;break;}text+=token();}return text;}
  return parse().replace(/\s+/g,' ').trim();
}
export function notation(source){
  if(cache.has(source))return cache.get(source);
  let i=0;
  const row=x=>`<mrow>${x}</mrow>`;
  function group(){
    while(source[i]===' ')i++;
    if(source[i]==='{'){i++;return parse('}');}
    return atom();
  }
  function atom(){
    let ch=source[i++];if(ch===undefined)return '';
    if(ch==='{')return parse('}');
    if(ch==='\\'){
      const command=source.slice(i).match(/^[A-Za-z]+/)?.[0]??source[i++]??'';i+=/^[A-Za-z]+$/.test(command)?command.length:0;
      if(command==='frac')return `<mfrac>${row(group())}${row(group())}</mfrac>`;
      if(command==='sqrt')return `<msqrt>${group()}</msqrt>`;
      if(command==='vec')return `<mover accent="true">${row(group())}<mo>→</mo></mover>`;
      if(command==='mathrm'||command==='text'){
        while(source[i]===' ')i++;
        let text='';if(source[i]==='{'){i++;while(i<source.length&&source[i]!=='}')text+=source[i++];i++;}else text=source[i++]??'';
        return `<${command==='text'?'mtext':'mi'} mathvariant="normal">${escape(text)}</${command==='text'?'mtext':'mi'}>`;
      }
      if(command===','||command===';')return '<mspace width="0.2em"/>';
      if(command==='quad')return '<mspace width="1em"/>';
      if(command==='left'||command==='right')return '';
      const symbol=symbols[command]??command;
      return `<${['Delta','theta','omega','epsilon','pi'].includes(command)?'mi':'mo'}>${escape(symbol)}</${['Delta','theta','omega','epsilon','pi'].includes(command)?'mi':'mo'}>`;
    }
    if(/[0-9.]/.test(ch)){
      while(i<source.length&&/[0-9.]/.test(source[i]))ch+=source[i++];
      return `<mn>${ch}</mn>`;
    }
    if(/[A-Za-zα-ωΑ-Ω]/u.test(ch))return `<mi>${escape(ch)}</mi>`;
    return `<mo>${escape(ch==='-'?'−':ch)}</mo>`;
  }
  function parse(end){
    let out='';
    while(i<source.length){
      if(end&&source[i]===end){i++;break;}
      if(source[i]===' '){i++;continue;}
      let base=atom(),lo=null,hi=null;
      while(source[i]==='_'||source[i]==='^'){
        const kind=source[i++],value=group();if(kind==='_')lo=value;else hi=value;
      }
      if(lo!==null&&hi!==null)base=`<msubsup>${row(base)}${row(lo)}${row(hi)}</msubsup>`;
      else if(lo!==null)base=`<msub>${row(base)}${row(lo)}</msub>`;
      else if(hi!==null)base=`<msup>${row(base)}${row(hi)}</msup>`;
      out+=base;
    }
    return row(out);
  }
  const body=parse();
  const label=spoken(source);
  const result=`<math xmlns="http://www.w3.org/1998/Math/MathML" aria-label="${escape(label)}"><semantics>${body}<annotation encoding="application/x-tex">${escape(source)}</annotation></semantics></math><span class="math-fallback">${escape(label)}</span>`;
  if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(source,result);
  return result;
}
export const equations=(...lines)=>`<div class="equation">${lines.map(line=>`<div class="math-line">${notation(line).replace('<math ','<math displaystyle="true" ')}</div>`).join('')}</div>`;
export function scientific(n,precision=4){
  if(!Number.isFinite(n))return '\\text{Undefined}';
  if(n===0)return '0';
  if(Math.abs(n)>=1e4||Math.abs(n)<.001){const [base,exp]=n.toExponential(precision-1).split('e');return `${base}\\times10^{${Number(exp)}}`;}
  return String(Number(n.toPrecision(precision)));
}
export function plainQuantity(n,unit='',precision=4){
  if(!Number.isFinite(n))return 'Undefined';
  const scripts={'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
  return scientific(n,precision).replace(/\\times10\^\{([^}]+)\}/g,(_,exp)=>' × 10'+[...exp].map(c=>scripts[c]).join(''))+(unit?' '+unit:'');
}
const units={'m/s':'m\\,s^{-1}','m/s²':'m\\,s^{-2}','N/C':'N\\,C^{-1}','V/m':'V\\,m^{-1}','rad/s':'rad\\,s^{-1}'};
export const si=unit=>(units[unit]??unit).split(/(\\,|\^\{[^}]+\})/).map(p=>p.startsWith('\\')||p.startsWith('^')?p:p?`\\mathrm{${p}}`:'').join('');
export const quantity=(n,unit='')=>scientific(n)+(unit?'\\;'+si(unit):'');
export const vectorValue=(v,unit='')=>`(${scientific(v.x)},\\,${scientific(v.y)})${unit?'\\;'+si(unit):''}`;

// Update text and attributes in place. In particular stable MathML and focused
// details/summary nodes survive animation frames and keyboard interaction.
export function patchHTML(element,html){
  if(element._markup===html)return;
  const template=document.createElement('template');template.innerHTML=html;
  function patch(parent,next){
    let old=parent.firstChild;
    for(const node of [...next.childNodes]){
      if(!old){parent.append(node);continue;}
      const following=old.nextSibling;
      if(old.nodeType!==node.nodeType||old.nodeName!==node.nodeName){old.replaceWith(node);}
      else if(old.nodeType===3){if(old.nodeValue!==node.nodeValue)old.nodeValue=node.nodeValue;}
      else if(!old.isEqualNode(node)){
        for(const a of [...old.attributes])if(!node.hasAttribute(a.name))old.removeAttribute(a.name);
        for(const a of [...node.attributes])if(old.getAttribute(a.name)!==a.value)old.setAttribute(a.name,a.value);
        patch(old,node);
      }
      old=following;
    }
    while(old){const following=old.nextSibling;old.remove();old=following;}
  }
  patch(element,template.content);element._markup=html;
}
