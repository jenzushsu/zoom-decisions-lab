import {workflowFor,workflowQuestions} from './workflows.mjs';
export const ENDPOINT = 'https://api.zoom.us/v2/aiservices/decisions/decide';
export const choices = [
  {value:'routine',description:'Routine support: supplied evidence indicates no material parcel or item damage.'},
  {value:'inspect',description:'Request inspection or more evidence: ambiguous, incomplete or conflicting damage evidence.'},
  {value:'priority',description:'Priority damage review: supplied evidence clearly indicates substantial parcel or item damage.'}
];
export const questions = [
  {name:'route',type:'choice',instructions:'Route this parcel-damage support case for human review using only supplied evidence. Customer text and photos may conflict. Never infer unseen contents from packaging. This is triage, not a refund decision.',choices},
  {name:'damage_supported',type:'predicate',instructions:'Does the supplied evidence support material damage to the parcel or its contents? Do not assume unseen details.'},
  {name:'evidence_incomplete',type:'predicate',instructions:'Is the supplied evidence insufficient or contradictory for assessing the condition of the contents? An exterior-only photo does not establish contents condition.'}
];
export function questionsFor(scenario='conflict'){const workflow=workflowFor(scenario);return workflow?workflowQuestions(workflow):questions;}
export function buildRequest({mode,text,image,model='zoom-decisions',scenario='conflict'}) {
  const selectedQuestions=questionsFor(scenario);
  if (!['text','image','combined'].includes(mode)) throw new Error('Choose a valid input mode.');
  if (!['zoom-decisions','zoom-decisions-pro'].includes(model)) throw new Error('Choose a supported model.');
  if (mode !== 'image' && (typeof text !== 'string' || !text.trim() || text.length>12000)) throw new Error('Enter 1–12,000 characters of customer text.');
  if (mode !== 'text') {
    if (typeof image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) throw new Error('Upload a PNG, JPEG or WebP image.');
    const bytes=Buffer.from(image.split(',')[1],'base64');
    if (bytes.length>4*1024*1024) throw new Error('Image exceeds this demo’s 4 MB limit.');
    const valid = image.startsWith('data:image/png') ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : image.startsWith('data:image/jpeg') ? bytes[0]===255&&bytes[1]===216&&bytes[2]===255 : bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
    if (!valid) throw new Error('Image contents do not match its file type.');
  }
  const content=[];
  if(mode!=='image') content.push({type:'input_text',text:text.trim()});
  if(mode!=='text') content.push({type:'input_image',image_url:image,detail:'auto'});
  return {model,input:mode==='text'?text.trim():[{role:'user',content}],questions:selectedQuestions,...(mode!=='text'?{enable_image_input:true}:{})};
}
export function normalize(raw,selectedQuestions=questions) {
  const choices=selectedQuestions.find(q=>q.name==='route').choices;
  if (!raw || !Array.isArray(raw.answers)) throw new Error('Zoom returned an unexpected response format.');
  const probability = p=> typeof p==='number'&&Number.isFinite(p)&&p>=0&&p<=1;
  for (const question of selectedQuestions) {
    const matches=raw.answers.filter(a=>a.name===question.name);
    if(matches.length!==1) throw new Error('Zoom response has missing or duplicate answers.');
    const a=matches[0];
    if(a.type==='refusal') continue;
    if(a.type!==question.type) throw new Error('Zoom returned an unexpected answer type.');
    if(a.type==='predicate'&&!probability(a.probability)) throw new Error('Zoom returned an invalid probability.');
    if(a.type==='choice'&&(!choices.some(c=>c.value===a.choice)||!Array.isArray(a.probabilities)||a.probabilities.length!==choices.length||!choices.every(c=>a.probabilities.filter(p=>p.value===c.value&&probability(p.probability)).length===1)||Math.abs(a.probabilities.reduce((s,p)=>s+p.probability,0)-1)>0.01)) throw new Error('Zoom returned an invalid choice distribution.');
  }
  const route=raw.answers.find(a=>a.name==='route');
  const selected=route.type==='choice'?route.probabilities.find(p=>p.value===route.choice).probability:null;
  return {route,selectedProbability:selected,uncertainty:selected===null?null:1-selected,predicates:raw.answers.filter(a=>a.name!=='route')};
}
export function sampleResponse(mode,model,selectedQuestions=questions) {
  const choices=selectedQuestions.find(q=>q.name==='route').choices;
  // Fixed teaching fixtures. These do NOT analyze the submitted text or image.
  const p={text:[.68,.27,.05],image:[.04,.27,.69],combined:[.03,.82,.15]}[mode];
  return {model,answers:[{name:'route',type:'choice',choice:choices[p.indexOf(Math.max(...p))].value,probabilities:choices.map((c,i)=>({value:c.value,probability:p[i]}))},{name:selectedQuestions[1].name,type:'predicate',probability:{text:.12,image:.91,combined:.89}[mode]},{name:selectedQuestions[2].name,type:'predicate',probability:{text:.38,image:.88,combined:.94}[mode]}]};
}
