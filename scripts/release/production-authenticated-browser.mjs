import assert from 'node:assert/strict';
import {readFileSync,statSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {loginProductionOwner} from './production-owner-login.mjs';

const mode=process.argv[2],root=resolve(process.argv[3]||'.release-pages');
assert.ok(['candidate','live','cleanup'].includes(mode),'INVALID_PRODUCTION_SMOKE_MODE');
const run=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT;
assert.ok(/^\d+$/.test(run||'')&&/^\d+$/.test(attempt||'')&&process.env.RUNNER_TEMP,'SMOKE_RUN_IDENTITY_REQUIRED');
const stateDir=resolve(process.env.RUNNER_TEMP,'freight-prod-smoke-'+run+'-'+attempt),statePath=resolve(stateDir,'session');
const validToken=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function readSession(){const st=statSync(statePath);assert.ok(st.isFile()&&(st.mode&0o077)===0&&st.uid===process.getuid(),'SMOKE_STATE_PERMISSIONS');const value=readFileSync(statePath,'utf8');assert.ok(validToken(value),'INVALID_SMOKE_SESSION');return value;}
const base='https://hakaru4i-afk.github.io/freight-quotes-web/';
const manifest=JSON.parse(readFileSync(resolve(root,'production-release-manifest.json'),'utf8'));
const slug=manifest.apiFunction;
assert.match(slug,/^freight-api-release-[a-f0-9]{32}$/);
const endpoint='https://ooclsrndeygojtofuyte.supabase.co/functions/v1/'+slug;
if(mode==='cleanup'){
 if(!existsSync(statePath)){console.log('PRODUCTION_SMOKE_NO_SESSION_TO_REVOKE');process.exit(0);}
 try{
  const token=readSession(),headers={Authorization:'Bearer '+token,Origin:new URL(base).origin,'Content-Type':'application/json'};
  const logout=await fetch(endpoint+'/api/auth?forceFunctionRegion=eu-central-1',{method:'POST',headers,body:JSON.stringify({action:'logout'}),redirect:'error',signal:AbortSignal.timeout(15000)});
  assert.ok(logout.ok,'SMOKE_LOGOUT_FAILED');
  const session=await fetch(endpoint+'/api/session?forceFunctionRegion=eu-central-1',{headers,redirect:'error',signal:AbortSignal.timeout(15000)});
  assert.ok(session.ok&&(await session.json()).authenticated===false,'SMOKE_SESSION_NOT_REVOKED');
  console.log('PRODUCTION_SMOKE_SESSION_REVOKED');
 }finally{rmSync(stateDir,{recursive:true,force:true});}
 process.exit(0);
}
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
let token;
if(mode==='candidate'){
 const login=process.env.SMOKE_OWNER_LOGIN||process.env.SMOKE_OWNER_EMAIL;
 const password=process.env.SMOKE_OWNER_PASSWORD;
 // Do not pass credentials to the browser or any child process.
 delete process.env.SMOKE_OWNER_LOGIN;
 delete process.env.SMOKE_OWNER_EMAIL;
 delete process.env.SMOKE_OWNER_PASSWORD;
 mkdirSync(stateDir,{mode:0o700});
 token=await loginProductionOwner({endpoint,login,password});
 writeFileSync(statePath,token,{mode:0o600,flag:'wx'});
 console.log('PRODUCTION_DIRECT_OWNER_LOGIN_PASS');
}else token=readSession();
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.addInitScript(({token,key,origin})=>{if(location.origin===origin&&window.top===window)localStorage.setItem(key,token)},{token,key:storageKey,origin:new URL(base).origin});
 const page=await context.newPage();
 const observed=new Set(),blocked=new Set();let legacy=false,mutation=false;
 const recordBlocked=(kind,req,u)=>{
  const route=u.pathname.match(/\/api\/([a-z-]+)(?:\/|$)/)?.[1];
  const known=['session','auth','data','chats','task2','route-distance','site-events','pending-tasks','supplier-orders','late-bid-drafts','requests','shipments','documents','audit','health','owner-registers','release'];
  let action=null;try{const body=req.postDataJSON();const value=body?.action;if(['geocode_points','geocode_route','geocode_retry','login','logout','route_metrics','owner_reassign_logistic','owner_transition_document_task','owner_record_process_risk'].includes(value))action=value;}catch{}
  const method=['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD'].includes(req.method())?req.method():'OTHER';
  const key=JSON.stringify({kind,method,route:known.includes(route)?route:'other',action});
  if(!blocked.has(key)){blocked.add(key);console.log('PRODUCTION_SMOKE_BLOCKED_REQUEST '+key);}
 };
 const wait=55000;
 const exact=(r,name)=>new URL(r.url()).origin===new URL(endpoint).origin&&new URL(r.url()).pathname===new URL(endpoint+'/api/'+name).pathname;
 const authenticated=async r=>((await r.request().allHeaders()).authorization||'').replace(/^Bearer /i,'')===token;
 const sessionResponse=page.waitForResponse(async r=>r.status()===200&&r.request().method()==='GET'&&exact(r,'session')&&await authenticated(r),{timeout:wait});
 const dataResponse=page.waitForResponse(async r=>r.status()===200&&r.request().method()==='GET'&&exact(r,'data')&&await authenticated(r),{timeout:wait});
 const responseProof=Promise.all([sessionResponse,dataResponse]);responseProof.catch(()=>{});
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='ooclsrndeygojtofuyte.supabase.co'){
   if(!u.pathname.startsWith('/functions/v1/'+slug+'/')){legacy=true;recordBlocked('api-route-mismatch',req,u);return route.abort();}
   if(!['GET','OPTIONS','HEAD'].includes(req.method())){
    // Login occurred through the direct API; no browser writes are permitted.
    if(u.pathname===new URL(endpoint+'/api/site-events').pathname&&req.method()==='POST')return route.abort();
    mutation=true;recordBlocked('browser-mutation',req,u);return route.abort();
   }
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
 assert.equal(profile.authenticated,true,'PRODUCTION_SMOKE_NOT_AUTHENTICATED');
 const payload=await data.json();
 assert.ok(payload&&typeof payload==='object'&&!payload.error,'PRODUCTION_SMOKE_DATA_INVALID');
 // Require actual browser startup responses, not separate synthetic fetches.
 assert.ok(observed.has('session')&&observed.has('data'),'PRODUCTION_AUTHENTICATED_STARTUP_RESPONSES_MISSING');
 assert.ok(!legacy&&!mutation,'PRODUCTION_SMOKE_UNEXPECTED_ROUTE_OR_MUTATION');
 assert.ok(!/Сервер отвечает слишком долго/.test(await page.locator('#root').innerText()),'PRODUCTION_CABINET_TIMEOUT');
 console.log('PRODUCTION_AUTHENTICATED_BROWSER_PASS '+mode+' '+slug);
 await context.close();
}catch(error){
 const code=/^[A-Z0-9_]+$/.test(error?.message||'')?error.message:error?.name==='TimeoutError'?'PRODUCTION_CABINET_TIMEOUT':'BROWSER_OR_NETWORK_FAILURE';
 throw Error('PRODUCTION_AUTHENTICATED_BROWSER_FAILED_'+mode+':'+code);
}finally{await browser.close();}
