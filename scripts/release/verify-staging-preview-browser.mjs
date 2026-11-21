import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,statSync,realpathSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {chromium} from 'playwright';
const root=realpathSync(process.argv[2] || '.qa-pages');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const ext=p=>p.slice(p.lastIndexOf('.'));
const server=createServer((request,response)=>{
 try{
  if(request.method!=='GET') {response.writeHead(405).end();return;}
  const u=new URL(request.url,'http://127.0.0.1');let p=decodeURIComponent(u.pathname);
  if(p.endsWith('/'))p+='index.html';
  const file=resolve(root,'.'+p);
  if(!file.startsWith(root+sep)||!statSync(file,{throwIfNoEntry:false})?.isFile()||!realpathSync(file).startsWith(root+sep)) {response.writeHead(404).end();return;}
  response.writeHead(200,{'content-type':mime[ext(file)]||'application/octet-stream','cache-control':'no-store'});
  response.end(readFileSync(file));
 }catch(e){response.writeHead(500).end();}
});
await new Promise((ok,fail)=>server.once('error',fail).listen(0,'127.0.0.1',ok));
const addr=`http://127.0.0.1:${server.address().port}/test/`;
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'});
  const page=await context.newPage(); const shared=[];const errors=[];
  // Local CI origin cannot satisfy the protected QA provider's Pages-only CORS.
  // Forward requests to the REAL isolated API server-side with the exact Pages Origin;
  // never synthesize a success response, cookie, actor, or protected API result.
  await page.route('https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-carrier124nov18/**', async route=>{
    const r=route.request();
    const cors={'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS, POST, PATCH, PUT, DELETE','access-control-allow-headers':'authorization, apikey, content-type, x-client-info'};
    if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:cors,body:''});
    const upstream=await fetch(r.url(),{
      method:r.method(),
      headers:{Origin:'https://hakaru4i-afk.github.io'},
      signal:AbortSignal.timeout(20000),redirect:'error'
    });
    const body=Buffer.from(await upstream.arrayBuffer());
    await route.fulfill({status:upstream.status,headers:{...cors,'content-type':upstream.headers.get('content-type')||'application/json'},body});
  });
  page.on('request',r=>{const u=new URL(r.url());if(u.hostname==='ibclzdkxiozbzmniiygv.supabase.co'&&/^\/functions\/v1\/freight-api(?:\/|$)/.test(u.pathname))shared.push(u.pathname);});
  page.on('pageerror',e=>errors.push(e.message));
  const p=await page.goto(addr,{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(p.status(),200);
  await page.locator('#root').waitFor({state:'visible',timeout:20000});
  const result=await page.evaluate(async()=>{
   const root='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api';
   const h=await fetch(root+'/health');
   const denied=await fetch(root+'/api/carrier');
   return {status:h.status,health:await h.json(),denial:denied.status,binding:window.__sh59Qa20};
  });
  assert.equal(result.status,200);
  assert.equal(result.health.edgeVersion,20);
  assert.equal(result.health.projectRef,'ibclzdkxiozbzmniiygv');
  assert.equal(result.health.qaRun,'carrier124nov18');
  assert.ok([401,403].includes(result.denial));
  assert.equal(result.binding.apiVersion,20);
  assert.deepEqual(shared,[],'Shared staging API was contacted');
  assert.deepEqual(errors,[],'Browser runtime threw errors');
  console.log('STAGING_QA20_BROWSER_PAIR_PASS',JSON.stringify({viewport,apiVersion:20,anonymousDenied:true}));
  await context.close();
 }
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}