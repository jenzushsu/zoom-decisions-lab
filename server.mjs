import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {buildRequest,normalize,sampleResponse,ENDPOINT} from './decisions.mjs';
const root=fileURLToPath(new URL('./public/',import.meta.url));
const port=Number(process.env.PORT||3000);
const key=process.env.ZOOM_API_KEY?.trim(),token=process.env.ZOOM_ACCESS_TOKEN?.trim();
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const log=(event,data)=>console.log(JSON.stringify({time:new Date().toISOString(),event,...data}));
let active=0;
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  if(req.method==='GET'&&req.url==='/api/config') return json(res,200,{configured:!!(key||token),auth:key?'x-api-key':token?'bearer':null});
  if(req.method==='POST'&&req.url==='/api/decide'){
    const origin=req.headers.origin;
    if(origin && origin!==`http://${req.headers.host}`) return json(res,403,{error:'Request origin is not allowed.'});
    if(active>=6) return json(res,429,{error:'Too many active requests. Wait for a run to finish.'});
    active++;
    const id=crypto.randomUUID();
    let status=400;
    try{
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>6*1024*1024){status=413;throw new Error('Upload exceeds the demo request limit.');}chunks.push(chunk);}
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new Error('Send valid JSON.');}
      if(!body||typeof body!=='object')throw new Error('Send an input object.');
      if(!['sample','live'].includes(body.source))throw new Error('Choose sample or live mode.');
      const payload=buildRequest(body);
      if(body.source==='sample'){
        const raw=sampleResponse(body.mode,payload.model);
        return json(res,200,{source:'sample',raw,comparison:normalize(raw),latencyMs:null,referenceId:id});
      }
      if(!key&&!token){status=503;throw new Error('Live API is not configured. Set ZOOM_API_KEY in .env and restart the server. See Setup.');}
      status=502;
      log('zoom.request',{id,mode:body.mode,model:payload.model,questionNames:payload.questions.map(q=>q.name),requestBytes:size});
      const start=performance.now();
      const upstream=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',...(key?{'x-api-key':key}:{Authorization:`Bearer ${token}`})},body:JSON.stringify({...payload,reference_id:id}),signal:AbortSignal.timeout(45000)});
      const responseText=await upstream.text();
      const latencyMs=Math.round(performance.now()-start);
      log('zoom.response',{id,status:upstream.status,latencyMs});
      if(!upstream.ok){status=upstream.status===429?429:502;const advice={400:'Zoom rejected the input. Check supported image encoding and account limits.',401:'Zoom rejected the credentials. Update your server environment.',403:'Your credentials lack access. Verify Decisions entitlement and permissions.',429:'Zoom rate limit reached. Wait before retrying.'}[upstream.status]||'Zoom is unavailable. Try again later.';throw new Error(`${advice} (HTTP ${upstream.status})`);}
      let raw;try{raw=JSON.parse(responseText);}catch{throw new Error('Zoom returned a non-JSON response.');}
      return json(res,200,{source:'live',raw,comparison:normalize(raw),latencyMs,referenceId:id});
    }catch(error){const message=error.name==='TimeoutError'?'Zoom did not respond within 45 seconds. Retry this mode.':error.message;log('request.error',{id,status,message});return json(res,status,{error:message,referenceId:id});}
    finally{active--;}
  }
  const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
  if(req.method!=='GET'||!files[req.url])return json(res,404,{error:'Not found.'});
  try{const name=files[req.url];res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':'text/javascript'});res.end(await readFile(root+name));}catch{json(res,500,{error:'Unable to load app.'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Decisions Lab: http://localhost:${port}`));
