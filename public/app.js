import {workflows,learningLenses} from '/workflows.js';
const $=id=>document.getElementById(id);
const modes=['text','image','combined'];
const titles={text:'Text only',image:'Image only',combined:'Text + image'};
let labels={routine:'Routine support',inspect:'Request inspection',priority:'Priority review'};
let explanations={routine:'The selected route sends this case to routine support. This is a display explanation of the route, not a model-generated rationale.',inspect:'The selected route asks a person to inspect the parcel or request more evidence. No refund or final damage determination is made.',priority:'The selected route prioritizes this case for human damage review. It does not establish the condition of unseen contents.'};
const scenarios = {
 conflict: {title:'Conflicting damage evidence',code:'PKG-2048',text:$('customerText').value,image:'damaged',alt:'Illustrative parcel with a crushed corner and torn side',prompt:'Try a contradiction',hint:'The note says “looks fine.” The sample illustration shows damage. Will the combined input change the route?'},
 limited: {title:'Label close-up, limited context',code:'PKG-2051',text:'I received this parcel, but I have not checked the box or opened it. I only took a close-up of the shipping label. Can you tell whether anything is damaged?',image:'label',alt:'Illustrative close-up shipping label; the parcel edges and contents are outside the frame',prompt:'Test insufficient evidence',hint:'Neither source establishes the condition of the contents. Compare how the API handles missing visual context.'}
};
const parcelLabels=labels,parcelExplanations=explanations;
for(const [id,w] of Object.entries(workflows))scenarios[id]={title:w.title,code:w.code,text:w.text,image:w.image||'screen',alt:w.image==='damaged'?'Illustrative parcel with a crushed corner and torn side':`Synthetic ${w.category.toLowerCase()} example: ${w.screen.join('. ')}`,prompt:'Compare the supplied evidence',hint:w.hint};
let scenarioId='conflict';
const predicateRows=()=>workflows[scenarioId]?.predicates.map(([id,label])=>[id,label,`${id} · predicate`])||[['damage_supported','Damage supported','damage_supported · predicate'],['evidence_incomplete','Evidence incomplete','evidence_incomplete · predicate']];


let sharedQuestions=null;
const source='live';
let image=null,imageName='Illustrative sample',busy=0,results={},configured=false;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=p=>typeof p==='number'?`${(p*100).toFixed(1)}%`:'Not returned';
function sampleImage(variant){
  const c=document.createElement('canvas');c.width=800;c.height=440;const x=c.getContext('2d');
  if(variant==='screen'){
    c.width=1000;c.height=600;
    x.fillStyle='#f1f4f8';x.fillRect(0,0,1000,600);
    x.fillStyle='#fff';x.fillRect(32,32,936,536);
    x.fillStyle='#223248';x.fillRect(32,32,936,90);
    const lines=workflows[scenarioId].screen;
    x.fillStyle='#fff';x.font='bold 28px sans-serif';x.fillText(lines[0],62,88);
    x.fillStyle='#223248';x.font='26px sans-serif';lines.slice(1).forEach((line,i)=>x.fillText(line,62,180+i*76));
    x.fillStyle='#53647b';x.font='18px sans-serif';x.fillText('SYNTHETIC DEMO · FICTIONAL DATA',62,540);
    return c.toDataURL('image/png');
  }
  x.fillStyle='#e5eaf0';x.fillRect(0,0,800,440);x.fillStyle='#d4dce5';x.beginPath();x.ellipse(420,363,255,33,0,0,Math.PI*2);x.fill();
  function poly(points,color){x.fillStyle=color;x.beginPath();points.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fill();}
  if(variant==='label'){
    x.fillStyle='#c7a375';x.fillRect(0,0,800,440);
    x.fillStyle='#faf8f2';x.fillRect(90,50,620,340);
    x.fillStyle='#263951';x.font='bold 28px sans-serif';x.fillText('PARCEL · PKG-2051',130,110);
    x.font='20px sans-serif';x.fillText('SHIPPING LABEL',130,155);
    for(let i=0;i<60;i++)x.fillRect(130+i*9,200,2+(i%4),90);
    x.font='16px sans-serif';x.fillText('ILLUSTRATIVE LABEL · NOT A REAL SHIPMENT',130,340);
    return c.toDataURL('image/png');
  }
  poly([[170,130],[440,70],[642,149],[383,218]],'#c7a375');poly([[170,130],[383,218],[383,366],[171,275]],'#b38b5d');poly(variant==='intact'?[[383,218],[642,149],[642,300],[383,366]]:[[383,218],[642,149],[625,207],[650,246],[620,314],[383,366]],'#987047');
  poly([[278,106],[310,99],[518,180],[485,189]],'#e6d4ac');poly([[485,189],[518,180],[510,332],[480,339]],'#cfba8e');
  if(variant!=='intact'){
  poly([[568,174],[642,149],[613,206],[650,246],[591,228],[604,269],[559,245]],'#674a32');poly([[568,174],[613,206],[581,217]],'#ba9466');
  x.strokeStyle='#493b31';x.lineWidth=4;x.beginPath();x.moveTo(547,240);x.lineTo(572,260);x.lineTo(552,282);x.lineTo(579,299);x.stroke();
  }
  poly([[211,170],[313,210],[313,264],[211,222]],'#f3eee2');x.fillStyle='#5c594f';for(let i=0;i<13;i++)x.fillRect(222+i*6,198+i*2.1,2+(i%2),20);
  x.fillStyle='#627186';x.font='16px sans-serif';x.fillText(variant==='intact'?'Illustration · intact exterior, contents unknown':'Illustration · exterior damage, contents unknown',26,410);
  return c.toDataURL('image/png');
}
function updateImage(){ $('expandImage').disabled=!image; $('preview').src=image||'';$('preview').alt=imageName==='Illustrative sample'?scenarios[scenarioId].alt:'Uploaded evidence image';$('preview').hidden=!image;$('imageTag').textContent=image?imageName:'No picture selected'; }
function clear(){results={};render();$('summary').textContent='Run the three modes to compare decisions from different evidence.';}
function controls(){for(const id of ['scenario','model','runAll'])$(id).disabled=busy>0;document.querySelectorAll('[data-run]').forEach(b=>b.disabled=busy>0||!configured);$('runAll').disabled=busy>0||!configured;$('export').disabled=busy>0||!Object.keys(results).length;}
function render(){
 const active=document.activeElement;
 const activeDisclosure=active?.closest('details')?.dataset.disclosure;
 const restoreSummary=active?.tagName==='SUMMARY';
 const codeScrolls=new Map([...$('cards').querySelectorAll('details[data-disclosure] pre')].map(pre=>[pre.closest('details').dataset.disclosure,{top:pre.scrollTop,left:pre.scrollLeft}]));
 const pageScroll={x:window.scrollX,y:window.scrollY};
 const openDetails=new Set([...$('cards').querySelectorAll('details[open]')].map(d=>d.dataset.disclosure));
 const focusedRun=document.activeElement?.dataset?.run;
 const rows=[
  ['decision','Decision','Selected by Zoom'],
  ['evidence','Evidence supplied','App record'],
  ['probabilities','Choice probabilities','Zoom distribution · not measured accuracy'],
  ['uncertainty','Probability outside selected choice','App: 1 − selected probability'],
  ['rationale','What this route means','App-authored description'],
  ['checks','Independent evidence checks','Each question is answered separately. These values do not explain or determine the selected decision.'],
  ...predicateRows().map(([key,label])=>[key,label,'Separate yes/no question']),
  ['diagnostics','Technical details','Request timing and the exact exchange.'],
  ['latency','Request time','Server HTTP round trip'],
  ['exchange','Request & response','Credentials excluded']
 ];
 const groupKeys=new Set(['checks','diagnostics']);
 $('cards').innerHTML=`<table class="comparisonTable"><caption class="srOnly">Zoom Decisions results by input mode</caption><thead><tr><th scope="col">Compare</th>${modes.map(mode=>`<th scope="col"><div class="modeHeading"><div><h3>${titles[mode]}</h3><p>${{text:'Case description',image:'Evidence image',combined:'Description and image'}[mode]}</p></div><button data-run="${mode}" aria-label="Run ${titles[mode].toLowerCase()}">Run</button></div><p class="stickyDecision"><span>Selected decision</span><strong>${esc(decisionLabel(mode))}</strong></p></th>`).join('')}</tr></thead><tbody>${rows.map(([key,label,note])=>groupKeys.has(key)?`<tr class="sectionRow"><th colspan="4"><h3>${label}</h3><p>${note}</p></th></tr>`:`<tr class="${['latency','exchange'].includes(key)?'diagnosticRow':''}"><th scope="row">${label}<small>${note}</small></th>${modes.map(mode=>`<td>${cell(mode,key)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 document.querySelectorAll('[data-run]').forEach(b=>b.onclick=()=>runModes([b.dataset.run]));controls();
 $('cards').querySelectorAll('details').forEach(d=>{if(openDetails.has(d.dataset.disclosure))d.open=true;const pre=d.querySelector('pre'),offset=codeScrolls.get(d.dataset.disclosure);if(pre&&offset){pre.scrollTop=offset.top;pre.scrollLeft=offset.left;}});
 if(activeDisclosure&&restoreSummary)$('cards').querySelector(`details[data-disclosure="${activeDisclosure}"] > summary`)?.focus({preventScroll:true});
 window.scrollTo(pageScroll.x,pageScroll.y);
 updateQuestionStatus();
 if(focusedRun&&!busy)document.querySelector(`[data-run="${focusedRun}"]`)?.focus({preventScroll:true});
}
function decisionLabel(mode){
 const result=results[mode];
 if(result?.loading)return 'Evaluating…';
 if(result?.error)return 'Run failed';
 if(!result?.comparison)return 'Not run yet';
 const route=result.comparison.route;
 return route.type==='refusal'?'Decision refused':labels[route.choice];
}
function cell(mode,key){
 const r=results[mode];
 if(key==='evidence')return {text:'Case text only',image:'Image only',combined:'Case text + image'}[mode];
 if(!r||r.loading){return key==='decision'?`<span class="${r?.loading?'loading':'waiting'}">${r?.loading?'Evaluating…':'Not run yet'}</span>`:'<span class="missing" aria-label="Not available">—</span>';}
 if(key==='exchange')return exchangeView(r,mode);
 if(r.error)return key==='decision'?`<div class="error" role="alert"><strong>Run failed</strong><p>${esc(r.error)}</p></div>`:'<span class="missing">—</span>';
 const n=r.comparison,a=n.route;
 if(key==='decision')return `<strong class="decision">${a.type==='refusal'?'Decision refused':esc(labels[a.choice])}</strong>`;
 if(key==='probabilities')return a.type==='refusal'?'Unavailable after refusal':`<div class="bars">${Object.keys(labels).map(value=>{const p=a.probabilities.find(p=>p.value===value);return `<div class="${value===a.choice?'winner':''}"><div class="barLabel"><span>${esc(labels[value])}</span><b>${pct(p.probability)}</b></div><progress max="1" value="${p.probability}" aria-label="${esc(labels[value])} probability"></progress></div>`;}).join('')}</div>`;
 if(key==='uncertainty')return `<b class="number">${pct(n.uncertainty)}</b>`;
 if(key==='latency')return `<b class="number">${r.latencyMs===null?'Unavailable':r.latencyMs+' ms'}</b>`;
 if(predicateRows().some(([id])=>id===key)){const answer=n.predicates.find(p=>p.name===key);return answer?.type==='refusal'?'Refused':`<b class="number">${pct(answer?.probability)}</b><span class="probabilityNote">Probability the answer is yes</span>`;}
 if(key==='rationale')return a.type==='refusal'?'No route explanation available.':esc(explanations[a.choice]);
}
function updateAuthentication(exchange){
 const status=exchange?.response?.source==='zoom'?exchange.response.status:null;
 if(status===200){$('authDetail').textContent='Last API request succeeded (HTTP 200)';}
 else if(status===401){$('authDetail').textContent='Authentication rejected (HTTP 401)';}
 else if(status===403){$('authDetail').textContent='Access denied (HTTP 403); check entitlement';}
}
function exchangeView(r,mode){
 const e=r.exchange;
 if(!e)return '<p class="minor">No Zoom request was sent and no Zoom response was received.</p>';
 const state=e.request?.state;
 const requestLabel=state==='sample_preview'?'Request preview · not sent':state==='sent'?'Request sent to Zoom':state==='attempted'?'Request attempted · delivery unconfirmed':'Request prepared · not sent';
 const responseLabel=e.response?.source==='fixture'?'Sample fixture · not received from Zoom':e.response?`Response received · HTTP ${e.response.status}`:'No Zoom response received';
 return `<section class="exchange"><h5>Request & response</h5><details class="raw" data-disclosure="${mode}-request"><summary>${requestLabel}</summary><p class="minor">Authentication headers are excluded. Image requests include the full Base64 image data.</p><pre>${esc(JSON.stringify(e.request?{method:e.request.method,url:e.request.url,headers:e.request.headers,body:e.request.body}:null,null,2))}</pre></details><details class="raw" data-disclosure="${mode}-response"><summary>${responseLabel}</summary>${e.response?.credentialsRedacted?'<p class="minor">Credential values were redacted from this response.</p>':''}<pre>${esc(e.response?typeof e.response.body==='string'?e.response.body:JSON.stringify(e.response.body,null,2):'No upstream response body is available.')}</pre></details><small class="minor">App reference: ${esc(r.referenceId||'Unavailable')}</small></section>`;
}
async function runModes(selected){
 if(busy||!configured)return;
 const focusedRun=document.activeElement?.dataset?.run;
 const snapshot={scenario:scenarioId,scenarioTitle:scenarios[scenarioId].title,text:scenarios[scenarioId].text,image,model:$('model').value,source};
 $('summary').textContent='Evaluating '+selected.map(m=>titles[m]).join(', ')+'.';
 busy++;selected.forEach(m=>results[m]={loading:true});render();
 await Promise.all(selected.map(async mode=>{
  try{
   if(mode!=='image'&&!snapshot.text.trim())throw new Error('Enter a case description before running this mode.');
   if(mode!=='text'&&!snapshot.image)throw new Error('Upload a picture before running this mode.');
   const response=await fetch('/api/decide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...snapshot,mode}),signal:AbortSignal.timeout(50000)});
   const data=await response.json();updateAuthentication(data.exchange);if(!response.ok){results[mode]={...data,error:data.error||'Request failed.'};return;}
   results[mode]={...data,snapshot:{...snapshot,image:snapshot.image?`[${imageName}]`:null},completedAt:new Date().toISOString()};
  }catch(e){results[mode]={error:e.name==='TimeoutError'?'The request timed out. Please retry.':e.message};}
  finally{render();}
 }));busy--;controls();summarize();
 if(focusedRun&&document.activeElement===document.body)document.querySelector(`[data-run="${focusedRun}"]`)?.focus({preventScroll:true});
}
function summarize(){
 const complete=modes.filter(mode=>results[mode]?.comparison);
 if(!complete.length){$('summary').textContent='No completed decisions. Check the failed modes below and retry.';return;}
 const routes=complete.map(mode=>`${titles[mode]}: ${decisionLabel(mode)}`);
 const decisions=complete.map(mode=>results[mode].comparison.route.type==='refusal'?'refusal':results[mode].comparison.route.choice);
 const refused=decisions.includes('refusal');
 const conclusion=complete.length<3?'Partial comparison.':refused?'Comparison includes a refusal.':new Set(decisions).size===1?'All three modes selected the same decision.':'The selected decisions differ across modes.';
 $('summary').textContent=conclusion+' '+routes.join(' · ')+'.'+(complete.length<3?' Run the remaining modes to complete the comparison.':'');
}
$('model').onchange=clear;
function loadScenarioEvidence(){ $('customerText').value=scenarios[scenarioId].text; image=sampleImage(scenarios[scenarioId].image); imageName='Illustrative sample'; updateImage(); clear(); }
$('scenarioLens').textContent=learningLenses[scenarioId];
const scenarioMenu=[['conflict','Conflicting evidence'],['text_sufficient','Text sufficient'],['visual_sufficient','Image sufficient'],['complementary','Complementary evidence'],['limited','Insufficient evidence']];
$('scenario').innerHTML=scenarioMenu.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
$('scenario').onchange=()=>{
 scenarioId=$('scenario').value;
 $('scenarioLens').textContent=learningLenses[scenarioId];
 const scenario=scenarios[scenarioId],workflow=workflows[scenarioId];
 labels=workflow?.labels||parcelLabels;
 explanations=workflow?Object.fromEntries(Object.keys(workflow.labels).map((key,i)=>[key,workflow.descriptions[i]+' This is an app explanation, not model-generated reasoning.'])):parcelExplanations;
 $('casePurpose').textContent=workflow?workflow.category+' · app-authored example':'Parcel-damage triage · human review';
 sharedQuestions=null;
 loadQuestions();
 $('caseCode').textContent=`Case ${scenario.code} · human review`;
 $('experimentTitle').textContent=scenario.prompt;
 $('experimentHint').textContent=scenario.hint;
 loadScenarioEvidence();
};
$('runAll').onclick=()=>runModes(modes);
$('export').onclick=()=>{const data={exportedAt:new Date().toISOString(),notes:'Rationale is app text; uncertainty is 1-selected probability; latency is server HTTP round trip. ',results};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='decisions-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const questionLabels={route:'Which review route should this case take?',damage_supported:'Does the evidence support material damage?',evidence_incomplete:'Is the evidence incomplete or contradictory?'};
function updateQuestionStatus(){
 if(!sharedQuestions)return;
 const sent=modes.map(mode=>results[mode]?.exchange?.request).filter(r=>r?.state==='sent');
 const matching=sent.every(r=>JSON.stringify(r.body.questions)===JSON.stringify(sharedQuestions));
 $('questionStatus').textContent=!matching?'A recorded request differs from the current definitions. Inspect that mode’s request body.':sent.length?`Confirmed identical questions in ${sent.length} sent ${sent.length===1?'request':'requests'}.`:'Server definitions loaded. No sent requests to compare yet.';
}
async function loadQuestions(){
 const requestedScenario=scenarioId;
 $('questionDetails').hidden=true;
 $('questionList').innerHTML='<p class="muted">Loading the server’s question definitions…</p>';
 $('questionStatus').textContent='';
 $('retryQuestions').hidden=true;
 try{
  const response=await fetch('/api/questions?scenario='+encodeURIComponent(requestedScenario));if(!response.ok)throw new Error();
  const data=await response.json();if(!Array.isArray(data.questions)||!data.questions.length)throw new Error();
  if(requestedScenario!==scenarioId)return;
  sharedQuestions=data.questions;
  $('questionList').innerHTML=`<ul class="questionOverview">${sharedQuestions.map(q=>`<li><code>${esc(q.name)}</code><span>${esc((workflows[scenarioId]?q.name==='route'?'Which action fits this case?':workflows[scenarioId].predicates.find(([id])=>id===q.name)?.[1]:questionLabels[q.name])||q.instructions)}</span><small>${esc(q.type)}</small></li>`).join('')}</ul>`;
  $('questionInstructions').innerHTML=sharedQuestions.map(q=>`<section class="questionDefinition"><h4>${esc(q.name)} <span>${esc(q.type)}</span></h4><p>${esc(q.instructions)}</p>${q.choices?`<dl>${q.choices.map(c=>`<dt><code>${esc(c.value)}</code></dt><dd>${esc(c.description)}</dd>`).join('')}</dl>`:''}</section>`).join('');
  $('questionsJson').textContent=JSON.stringify(sharedQuestions,null,2);
  $('questionDetails').hidden=false;updateQuestionStatus();
 }catch{
  if(requestedScenario!==scenarioId)return;
  sharedQuestions=null;$('questionDetails').hidden=true;
  $('questionList').innerHTML='<p class="error">Unable to load shared questions. Restart the app server, then reload questions.</p>';
  $('questionStatus').textContent='Question definitions unavailable; recorded request bodies remain available after a run.';
  $('retryQuestions').hidden=false;
 }
}
$('retryQuestions').onclick=loadQuestions;
loadQuestions();
loadScenarioEvidence();
fetch('/api/config').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(c=>{
 configured=c.configured;
 $('connection').textContent=c.auth==='x-api-key'?'API key: configured':c.auth==='bearer'?'API key: not set · Bearer token configured':'API key: not configured';
 $('authDetail').textContent=configured?'Loaded on server · not yet verified':'Add ZOOM_API_KEY to .env and restart';
 $('sourceNotice').hidden=configured;
 $('sourceNotice').textContent='To run decisions, set ZOOM_API_KEY in the project’s .env file, restart npm start, then refresh this page. Your key stays on the server.';
 controls();
}).catch(()=>{configured=false;$('connection').textContent='API key status unavailable';$('authDetail').textContent='Cannot read server configuration';$('sourceNotice').hidden=false;$('sourceNotice').textContent='Start the app server and refresh this page to check configuration.';controls();});

// Tall evidence panels scroll with the page until their bottom is visible.
// Short panels remain pinned just below the application header.
const evidencePanel=document.querySelector('.evidence');
function updateEvidencePosition(){
 const top=Math.min(80,window.innerHeight-evidencePanel.getBoundingClientRect().height-16);
 evidencePanel.style.setProperty('--evidence-top',`${top}px`);
}
new ResizeObserver(updateEvidencePosition).observe(evidencePanel);
window.addEventListener('resize',updateEvidencePosition);
updateEvidencePosition();

const imageViewer=$('imageViewer');
$('expandImage').onclick=()=>{
 if(!image)return;
 $('expandedImage').src=image;
 $('expandedImage').alt=$('preview').alt;
 $('viewerCaption').textContent=imageName;
 imageViewer.showModal();
 document.body.classList.add('viewingImage');
};
$('closeImageViewer').onclick=()=>imageViewer.close();
imageViewer.addEventListener('click',event=>{
 if(event.target!==imageViewer)return;
 const rect=imageViewer.getBoundingClientRect();
 if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)imageViewer.close();
});
imageViewer.addEventListener('close',()=>{
 document.body.classList.remove('viewingImage');
 $('expandedImage').removeAttribute('src');
 $('expandImage').focus({preventScroll:true});
});
