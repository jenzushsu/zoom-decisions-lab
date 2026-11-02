const $=id=>document.getElementById(id);
const modes=['text','image','combined'];
const titles={text:'Text only',image:'Image only',combined:'Text + image'};
const labels={routine:'Routine support',inspect:'Request inspection',priority:'Priority review'};
const explanations={routine:'The selected route sends this case to routine support. This is a display explanation of the route, not a model-generated rationale.',inspect:'The selected route asks a person to inspect the parcel or request more evidence. No refund or final damage determination is made.',priority:'The selected route prioritizes this case for human damage review. It does not establish the condition of unseen contents.'};
const defaultText=$('customerText').value;
let source='sample',image=null,imageName='Illustrative sample',busy=0,results={},configured=false;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=p=>typeof p==='number'?`${(p*100).toFixed(1)}%`:'Not returned';
function sampleImage(){
  const c=document.createElement('canvas');c.width=800;c.height=440;const x=c.getContext('2d');
  x.fillStyle='#e5eaf0';x.fillRect(0,0,800,440);x.fillStyle='#d4dce5';x.beginPath();x.ellipse(420,363,255,33,0,0,Math.PI*2);x.fill();
  function poly(points,color){x.fillStyle=color;x.beginPath();points.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fill();}
  poly([[170,130],[440,70],[642,149],[383,218]],'#c7a375');poly([[170,130],[383,218],[383,366],[171,275]],'#b38b5d');poly([[383,218],[642,149],[625,207],[650,246],[620,314],[383,366]],'#987047');
  poly([[278,106],[310,99],[518,180],[485,189]],'#e6d4ac');poly([[485,189],[518,180],[510,332],[480,339]],'#cfba8e');
  poly([[568,174],[642,149],[613,206],[650,246],[591,228],[604,269],[559,245]],'#674a32');poly([[568,174],[613,206],[581,217]],'#ba9466');
  x.strokeStyle='#493b31';x.lineWidth=4;x.beginPath();x.moveTo(547,240);x.lineTo(572,260);x.lineTo(552,282);x.lineTo(579,299);x.stroke();
  poly([[211,170],[313,210],[313,264],[211,222]],'#f3eee2');x.fillStyle='#5c594f';for(let i=0;i<13;i++)x.fillRect(222+i*6,198+i*2.1,2+(i%2),20);
  x.fillStyle='#627186';x.font='16px sans-serif';x.fillText('Illustration · exterior damage, contents unknown',26,410);
  return c.toDataURL('image/png');
}
function updateImage(){ $('preview').src=image||'';$('preview').alt=imageName==='Illustrative sample'?'Illustrative parcel with a crushed corner and torn side':'Uploaded parcel evidence';$('preview').hidden=!image;$('imageTag').textContent=image?imageName:'No picture selected'; }
function clear(){results={};render();$('summary').textContent='Run the three modes to compare their selected routes and uncertainty.';}
function controls(){for(const id of ['sample','live','model','customerText','upload','remove','reset','runAll'])$(id).disabled=busy>0;document.querySelectorAll('[data-run]').forEach(b=>b.disabled=busy>0);$('export').disabled=busy>0||!Object.keys(results).length;}
function render(){
 $('cards').innerHTML=modes.map(mode=>`<article class="result"><div class="cardHead"><span class="modeIcon" aria-hidden="true">${{text:'T',image:'▧',combined:'⊕'}[mode]}</span><h3>${titles[mode]}</h3><p>${{text:'Only the customer’s account',image:'Only the parcel picture',combined:'Both sources, one request'}[mode]}</p><button data-run="${mode}">Run ${titles[mode].toLowerCase()}</button></div><div class="cardBody" id="body-${mode}" aria-live="polite">${body(mode)}</div></article>`).join('');
 document.querySelectorAll('[data-run]').forEach(b=>b.onclick=()=>runModes([b.dataset.run]));controls();
}
function body(mode){
 const r=results[mode];if(!r)return '<div class="empty"><b>A different view of the same case</b>Run this mode to see its decision,<br>probabilities and evidence signals.</div>';
 if(r.loading)return '<div class="empty loading" role="status"><b>Evaluating evidence…</b>Waiting for a complete response.</div>';
 if(r.error)return `<div class="error" role="alert"><strong>This run did not complete</strong><p>${esc(r.error)}</p><small>Retry using the run button above.</small></div>`;
 const n=r.comparison,a=n.route;
 const bars=a.type==='choice'?`<div class="bars">${a.probabilities.map(p=>`<div class="${p.value===a.choice?'winner':''}"><div class="barLabel"><span>${esc(labels[p.value])}</span><b>${pct(p.probability)}</b></div><progress max="1" value="${p.probability}" aria-label="${esc(labels[p.value])} probability"></progress></div>`).join('')}</div>`:'<p class="muted">The route question was refused. No decision or probability is available.</p>';
 return `<span class="badge">${r.source==='sample'?'Illustrative fixture · not Zoom output':'Live Zoom response'}</span><h4 class="decision">${a.type==='refusal'?'Decision refused':esc(labels[a.choice])}</h4><div class="minor">${a.type==='refusal'?'Returned type: refusal':'Display label for returned choice: '+esc(a.choice)}</div>${bars}<div class="metrics"><div><b>${n.uncertainty===null?'—':pct(n.uncertainty)}</b><span class="minor">Uncertainty · app calculated</span></div><div><b>${r.latencyMs===null?'—':r.latencyMs+' ms'}</b><span class="minor">${r.latencyMs===null?'API latency unavailable':'Server HTTP round trip'}</span></div></div><div class="explanation"><strong>Rationale · app explanation</strong>${a.type==='refusal'?'No route rationale is available.':esc(explanations[a.choice])}<strong>Evidence supplied · app record</strong>${esc(mode==='text'?'Customer text only':mode==='image'?'Picture only; no customer text':'Customer text and picture')}. ${r.source==='sample'?'Fixed fixture; these inputs were not analyzed.':''}<strong>Independent evidence questions</strong>${n.predicates.map(p=>`<div class="pred"><span>${p.name==='damage_supported'?'Damage supported':'Incomplete / conflicting'}</span><b>${p.type==='refusal'?'Refused':pct(p.probability)}</b></div>`).join('')}<strong>Confidence</strong>${typeof a.confidence==='number'?esc(a.confidence)+' (returned by API)':'No separate confidence field returned.'} Selected-choice probability: ${pct(n.selectedProbability)}.</div><details class="raw"><summary>${r.source==='sample'?'View fixture JSON':'View raw API response'}</summary><pre>${esc(JSON.stringify(r.raw,null,2))}</pre><small>App reference: ${esc(r.referenceId)}</small></details>`;
}
async function runModes(selected){
 if(busy)return;
 const snapshot={text:$('customerText').value,image,model:$('model').value,source};
 busy++;selected.forEach(m=>results[m]={loading:true});render();
 await Promise.all(selected.map(async mode=>{
  try{
   if(mode!=='image'&&!snapshot.text.trim())throw new Error('Enter customer text before running this mode.');
   if(mode!=='text'&&!snapshot.image)throw new Error('Upload a picture before running this mode.');
   const response=await fetch('/api/decide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...snapshot,mode}),signal:AbortSignal.timeout(50000)});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed.');
   results[mode]={...data,snapshot:{...snapshot,image:snapshot.image?`[${imageName}]`:null},completedAt:new Date().toISOString()};
  }catch(e){results[mode]={error:e.name==='TimeoutError'?'The request timed out. Please retry.':e.message};}
  render();
 }));busy--;controls();summarize();
}
function summarize(){const complete=modes.filter(m=>results[m]?.comparison);if(!complete.length){$('summary').textContent='No completed results yet. Check the messages above and retry.';return;}const routes=complete.map(m=>`${titles[m]}: ${results[m].comparison.route.type==='refusal'?'refused':labels[results[m].comparison.route.choice]}`);$('summary').textContent=(source==='sample'?'Illustrative comparison (not measured API behavior). ':'Live comparison. ')+routes.join(' · ')+'. '+(complete.length===3?'A different route reflects different supplied evidence; combined input is not guaranteed to be more accurate.':'Run the remaining modes to complete the comparison.');}
for(const s of ['sample','live'])$(s).onclick=()=>{source=s;for(const b of ['sample','live']){$(b).classList.toggle('selected',s===b);$(b).setAttribute('aria-pressed',String(s===b));}$('sourceNotice').textContent=s==='sample'?'Sample walkthrough uses fixed, illustrative results. It does not analyze your inputs or call Zoom.':configured?'Live mode sends your selected evidence to Zoom. Run all makes three independent API requests.':'Live API is not configured. Open API setup, add server credentials, and restart. Sample mode remains available.';clear();};
$('customerText').oninput=()=>{$('count').textContent=`${$('customerText').value.length} / 12,000`;clear();};
$('model').onchange=clear;
$('reset').onclick=()=>{$('customerText').value=defaultText;image=sampleImage();imageName='Illustrative sample';$('upload').value='';$('uploadError').textContent='';updateImage();$('customerText').oninput();};
$('remove').onclick=()=>{image=null;imageName='';$('upload').value='';updateImage();clear();};
$('upload').onchange=async()=>{const file=$('upload').files[0];if(!file)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PNG, JPEG or WebP image.');if(file.size>4*1024*1024)throw new Error('Choose an image smaller than 4 MB.');busy++;controls();const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Unable to read this file.'));r.readAsDataURL(file);});const img=new Image();img.src=data;await img.decode();image=data;imageName=file.name;$('uploadError').textContent='';updateImage();clear();}catch(e){$('uploadError').textContent=e.message;$('upload').value='';}finally{busy=Math.max(0,busy-1);controls();}};
$('runAll').onclick=()=>runModes(modes);
$('setupButton').onclick=()=>$('setup').showModal();$('closeSetup').onclick=()=>$('setup').close();
$('export').onclick=()=>{const data={exportedAt:new Date().toISOString(),notes:'Rationale is app text; uncertainty is 1-selected probability; latency is server HTTP round trip. Sample data is fixed and not analyzed.',results};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='decisions-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('reset').click();
fetch('/api/config').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(c=>{configured=c.configured;$('connection').textContent=configured?'Live credentials configured':'Sample ready · live setup needed';}).catch(()=>{$('connection').textContent='Server unavailable · restart the app';});
