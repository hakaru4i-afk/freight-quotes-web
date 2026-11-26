import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const mode=process.argv[2],root=resolve(process.argv[3]||'.release-pages');
assert.ok(['candidate','live'].includes(mode),'INVALID_PRODUCTION_SMOKE_MODE');
const token=process.env.PRODUCTION_SMOKE_SESSION||'';
assert.ok(/^[a-f0-9]{64}$/i.test(token),'DEDICATED_PRODUCTION_SMOKE_SESSION_REQUIRED');
const base='https://hakaru4i-afk.github.io/freight-quotes-web/';
const manifest=JSON.parse(readFileSync(resolve(root,'production-release-manifest.json'),'utf8'));
const slug=manifest.apiFunction;
assert.match(slug,/^freight-api-release-[a-f0-9]{32}$/);
const endpoint='https://ooclsrndeygojtofuyte.supabase.co/functions/v1/'+slug;
const app=readFileSync(resolve(root,'app.js'),'utf8');
// Production app constructs the persistence key from the base "freight-session".
assert.ok(app.includes('"freight-session"')&&app.includes('+"-persistent-v1"'),'PRODUCTION_SESSION_STORAGE_KEY_UNVERIFIED');
const storageKey='freight-session-persistent-v1';
const {stagingRegionalUrl}=await import(pathToFileURL(resolve(root,'staging-api-region.mjs')).href);
for(const route of ['session','data','auth','chats']){
 const u=new URL(stagingRegionalUrl(endpoint+'/api/'+route+'?probe=1'));
 assert.equal(u.origin,new URL(endpoint).origin);
 assert.equal(u.pathname,new URL(endpoint+'/api/'+route).pathname);
 assert.equal(u.searchParams.get('forceFunctionRegion'),'eu-central-1');
 assert.equal(u.searchParams.get('probe'),'1');
}
const transport=readFileSync(resolve(root,'staging-transport-20261111.js'),'utf8');
assert.ok(transport.includes('forceFunctionRegion'),'PRODUCTION_REGION_ROUTING_MISSING');
const vm=await import('node:vm');
const calls=[];
const window={fetch:(...args)=>{calls.push(args);return Promise.resolve(new Response(null,{status:204}))}};
vm.runInNewContext(transport,{window,Request,URL,location:{href:base}});
await window.fetch(endpoint+'/api/session');
assert.equal(calls.length,1);
assert.equal(new URL(calls[0][0]).searchParams.get('forceFunctionRegion'),'eu-central-1','VERSIONED_PRODUCTION_ROUTE_NOT_REGION_BOUND');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.wasm':'application/wasm'};
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.addInitScript(({token,key,origin})=>{if(location.origin===origin&&window.top===window)localStorage.setItem(key,token)},{token,key:storageKey,origin:new URL(base).origin});
 const page=await context.newPage();
 const observed=new Set();let legacy=false,mutation=false;
 const sessionResponse=page.waitForResponse(r=>r.status()===200&&r.request().method()==='GET'&&new URL(r.url()).pathname===new URL(endpoint+'/api/session').pathname,{timeout:55000});
 const dataResponse=page.waitForResponse(r=>r.status()===200&&r.request().method()==='GET'&&new URL(r.url()).pathname===new URL(endpoint+'/api/data').pathname,{timeout:55000});
 const responseProof=Promise.all([sessionResponse,dataResponse]);responseProof.catch(()=>{});
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='ooclsrndeygojtofuyte.supabase.co'){
   if(!['GET','OPTIONS','HEAD'].includes(req.method())){mutation=true;return route.abort();}
   if(u.pathname.includes('/functions/v1/')&&!u.pathname.startsWith('/functions/v1/'+slug+'/')){legacy=true;return route.abort();}
   return route.continue();
  }
  if(!['GET','HEAD','OPTIONS'].includes(req.method()))return route.abort();
  if(mode==='candidate'&&req.url().startsWith(base)){
   const rel=decodeURIComponent(u.pathname.slice(new URL(base).pathname.length))||'index.html';
   const file=resolve(root,rel);
   if(!file.startsWith(root+'/'))return route.abort();
   try{if(!statSync(file).isFile())return route.abort();return route.fulfill({status:200,contentType:mime[extname(file)]||'application/octet-stream',body:readFileSync(file)});}catch{return route.abort();}
  }
  return route.continue();
 });
 page.on('response',res=>{
  const u=new URL(res.url());
  if(res.status()===200&&res.request().method()==='GET'&&res.url().startsWith(endpoint+'/api/')){
   for(const name of ['session','data'])if(u.pathname.endsWith('/api/'+name))observed.add(name);
  }
 });
 await page.goto(base+'?production-smoke='+Date.now(),{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('.cabinet-sidebar').first().waitFor({state:'visible',timeout:45000});
 await page.waitForFunction(()=>!!document.querySelector('.cabinet-sidebar')&&!!document.querySelector('.cabinet-panel, .cabinet-app'),null,{timeout:45000});
 const [session,data]=await responseProof;
 const profile=await session.json();
 assert.equal(profile.role,'owner','PRODUCTION_SMOKE_OWNER_ROLE_REQUIRED');
 const payload=await data.json();
 assert.ok(payload&&typeof payload==='object'&&!payload.error,'PRODUCTION_SMOKE_DATA_INVALID');
 // Require actual browser startup responses, not separate synthetic fetches.
 assert.ok(observed.has('session')&&observed.has('data'),'PRODUCTION_AUTHENTICATED_STARTUP_RESPONSES_MISSING');
 assert.ok(!legacy&&!mutation,'PRODUCTION_SMOKE_UNEXPECTED_ROUTE_OR_MUTATION');
 assert.ok(!/Сервер отвечает слишком долго/.test(await page.locator('#root').innerText()),'PRODUCTION_CABINET_TIMEOUT');
 console.log('PRODUCTION_AUTHENTICATED_BROWSER_PASS '+mode+' '+slug);
 await context.close();
}catch(error){
 const code=/^[A-Z0-9_]+$/.test(error?.message||'')?error.message:'BROWSER_OR_NETWORK_FAILURE';
 throw Error('PRODUCTION_AUTHENTICATED_BROWSER_FAILED_'+mode+':'+code);
}finally{await browser.close();}
