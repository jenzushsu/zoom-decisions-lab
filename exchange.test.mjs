import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {questions} from './decisions.mjs';

async function launch(t, mock=false){
  const mockScript=`
    import {sampleResponse} from ${JSON.stringify(new URL('./decisions.mjs',import.meta.url).href)};
    globalThis.fetch=async(url,options)=>{
      const payload=JSON.parse(options.body);
      if(options.headers['x-api-key']!=='test-only-secret')throw new Error('Missing authentication header');
      if(payload.input==='rate-limit')return new Response(JSON.stringify({code:429,message:'Slow down'}),{status:429});
      if(payload.input==='non-json')return new Response('Upstream unavailable',{status:503});
      const raw=sampleResponse('text',payload.model,payload.questions);
      raw.observedRequest=payload;
      return new Response(JSON.stringify(raw),{status:200});
    };
  `;
  const args=mock?['--import',`data:text/javascript,${encodeURIComponent(mockScript)}`,'server.mjs']:['server.mjs'];
  const child=spawn(process.execPath,args,{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:'0',ZOOM_API_KEY:mock?'test-only-secret':'',ZOOM_ACCESS_TOKEN:''},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null){child.kill();await once(child,'exit');}});
  const url=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(new Error('Server startup timed out')),5000);
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/localhost:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
    child.once('error',error=>{clearTimeout(timer);reject(error);});
  });
  const send=async(body)=>{const res=await fetch(url+'/api/decide',{method:'POST',body:JSON.stringify(body)});return {status:res.status,data:await res.json()};};
  send.questions=async(scenario='conflict')=>{const res=await fetch(url+'/api/questions?scenario='+scenario);assert.equal(res.status,200);return res.json();};
  return send;
}
test('sample preview and missing credentials never claim a Zoom exchange',async t=>{
 const send=await launch(t);
 const sample=await send({source:'sample',mode:'text',text:'parcel okay'});
 assert.equal(sample.data.exchange.request.state,'sample_preview');
 assert.equal(sample.data.exchange.response.source,'fixture');
 assert.equal(sample.data.exchange.response.status,null);
 assert.equal(sample.data.exchange.request.body.input,'parcel okay');
 const missing=await send({source:'live',mode:'text',text:'parcel okay'});
 assert.equal(missing.status,503);
 assert.equal(missing.data.exchange.request.state,'not_sent');
 assert.equal(missing.data.exchange.response,null);
});
test('live viewer mirrors actual body, HTTP status and JSON or text errors without credentials',async t=>{
 const send=await launch(t,true);
 const success=await send({source:'live',mode:'text',text:'parcel okay'});
 assert.equal(success.status,200);
 const exchange=success.data.exchange;
 assert.deepEqual(exchange.request.body,success.data.raw.observedRequest);
 assert.equal(exchange.request.state,'sent');
 assert.equal(exchange.response.status,200);
 assert.equal(JSON.stringify(success.data).includes('test-only-secret'),false);
 for(const [text,status,expected] of [['rate-limit',429,{code:429,message:'Slow down'}],['non-json',503,'Upstream unavailable']]){
   const result=await send({source:'live',mode:'text',text});
   assert.ok(result.data.error);
   assert.equal(result.data.exchange.response.status,status);
   assert.deepEqual(result.data.exchange.response.body,expected);
 }
});

test('shared questions viewer matches the exact payload sent in all three modes',async t=>{
 const send=await launch(t,true);
 const displayed=await send.questions();
 assert.deepEqual(displayed.questions,questions);
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMioAAAAASUVORK5CYII=';
 for(const mode of ['text','image','combined']){
  const result=await send({source:'live',mode,text:'Parcel condition unknown',image});
  assert.equal(result.status,200);
  assert.deepEqual(result.data.raw.observedRequest.questions,displayed.questions);
 }
 assert.equal(JSON.stringify(displayed).includes('test-only-secret'),false);
});

test('workflow-specific questions are identical across modes and normalize their own choices',async t=>{
 const send=await launch(t,true);
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMioAAAAASUVORK5CYII=';
 for(const scenario of ['text_sufficient','visual_sufficient','complementary']){
  const displayed=await send.questions(scenario);
  for(const mode of ['text','image','combined']){
   const result=await send({source:'live',scenario,mode,text:'Fictional case evidence',image});
   assert.equal(result.status,200);
   assert.deepEqual(result.data.exchange.request.body.questions,displayed.questions);
   assert.deepEqual(result.data.comparison.predicates.map(a=>a.name),displayed.questions.slice(1).map(q=>q.name));
   assert.ok(displayed.questions[0].choices.some(c=>c.value===result.data.comparison.route.choice));
   assert.equal(result.data.exchange.request.body.scenario,undefined);
   assert.equal(result.data.exchange.request.body.hint,undefined);
   assert.equal(result.data.exchange.request.body.learningLens,undefined);
  }
 }
 const invalid=await send({source:'live',scenario:'unknown',mode:'text',text:'note'});
 assert.equal(invalid.status,400);
 assert.equal(invalid.data.exchange.request,null);
});
