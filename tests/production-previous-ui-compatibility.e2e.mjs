// Read-only real QA sessions in the currently published production frontend.
// Every API request goes to the isolated QA function; production gets asset GETs only.
import{chromium}from'playwright';import{readFile,writeFile,mkdir}from'node:fs/promises';import{createHash}from'node:crypto';import assert from'node:assert/strict';
import{captureRoot,live}from'../scripts/release/locked-staging.mjs';
import{previousUiSuppression}from'./helpers/isolated-qa-acceptance.mjs';
const origin='https://hakaru4i-afk.github.io',prefix='/freight-quotes-web/',qa='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-rc20261110';
const sessions=JSON.parse(await readFile(process.env.QA_SESSIONS_FILE,'utf8'));
const proofFile=process.env.QA_BROWSER_BACKEND_PROOF_FILE;
const runtime=proofFile?JSON.parse(await readFile(proofFile,'utf8')):undefined;
const report={startedAt:new Date().toISOString(),runtime,runAttempt:process.env.GITHUB_RUN_ATTEMPT,mode:'PUBLISHED_PREVIOUS_PRODUCTION_UI_WITH_REAL_ISOLATED_QA_API',runId:process.env.GITHUB_RUN_ID,frontendSha:runtime?.frontendSha||process.env.GITHUB_SHA,productionApiAccessed:false,productionWrites:false,assets:{},roles:[],calls:[],suppressed:{telemetry:0,routeCalculation:0}};
await mkdir('reports/isolated-rc',{recursive:true});
// Verify the currently published root independently of the newer main checkout.
// The same manifest/byte verification is already used by staging preservation.
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',ico:'image/x-icon',wasm:'application/wasm',gz:'application/gzip',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',txt:'text/plain; charset=utf-8'};
let browser;
try{
 const published=await captureRoot();
 const manifest=published.get('production-release-manifest.json');
 report.productionManifestSha256=createHash('sha256').update(manifest).digest('hex');
 report.verifiedRootAssetCount=published.size;
 browser=await chromium.launch({headless:true});
 for(const actor of['owner','carrierA']){
 const context=await browser.newContext({viewport:{width:1440,height:900}}),errors=[],transport={closing:false,controllers:new Set()};
 await context.addInitScript(token=>{if(/^https?:$/.test(location.protocol))localStorage.setItem('freight-session-persistent-v1',token);},sessions[actor]);
 await context.route('**/*',async route=>{
  const controller=new AbortController();transport.controllers.add(controller);
  try{
  const req=route.request(),u=new URL(req.url());
  const api=u.hostname==='ooclsrndeygojtofuyte.supabase.co'?u.pathname.split('/freight-api')[1]:u.origin===origin&&u.pathname.startsWith('/api/')?u.pathname:null;
  const suppressed=previousUiSuppression(req.method(),api);
  if(suppressed){report.suppressed[suppressed]++;await route.abort('blockedbyclient');return;}
  if(!['GET','HEAD'].includes(req.method())){report.calls.push({actor,path:u.pathname,method:req.method(),status:null,blockedMutation:true});await route.abort();return;}
  if(api){assert.ok(api.startsWith('/api/'));const headers={...req.headers(),origin};for(const key of['host','content-length','accept-encoding'])delete headers[key];const url=new URL(qa+api+u.search);url.searchParams.set('forceFunctionRegion','eu-central-1');const r=await fetch(url,{method:req.method(),headers,redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])});report.calls.push({actor,path:api,method:req.method(),status:r.status});const h=Object.fromEntries(r.headers);for(const key of['content-encoding','content-length'])delete h[key];h['access-control-allow-origin']=origin;await route.fulfill({status:r.status,headers:h,body:Buffer.from(await r.arrayBuffer())});return;}
  if(u.origin===origin&&u.pathname.startsWith(prefix)&&!u.pathname.startsWith(prefix+'test/')){
   const name=decodeURIComponent(u.pathname.slice(prefix.length))||'index.html';
   assert.ok(!name.includes('..'));const bytes=published.get(name);
   assert.ok(bytes,'Asset absent from verified production manifest: '+name);
   const type=mime[name.split('.').at(-1).toLowerCase()];assert.ok(type,'Unexpected asset type: '+name);
   report.assets[name]=createHash('sha256').update(bytes).digest('hex');
   await route.fulfill({status:200,headers:{'content-type':type},body:bytes});return;}
  if(['data:','blob:'].includes(u.protocol)){await route.continue();return;}await route.abort();
  }catch(error){if(!transport.closing)(report.transportErrors??=[]).push({actor,errorType:error.name,code:error.code||null,reason:error.name==='AssertionError'?String(error.message).slice(0,200):null});try{await route.abort('failed');}catch{}}
  finally{transport.controllers.delete(controller);}
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.name));const mandatoryData=page.waitForResponse(r=>r.url().includes(actor==='owner'?'/api/data':'/api/carrier')&&r.request().method()==='GET',{timeout:60000}).catch(error=>({error}));await page.goto(origin+prefix,{waitUntil:'domcontentloaded',timeout:60000});await page.locator('[data-cabinet-role="'+(actor==='owner'?'owner':'carrier')+'"]').waitFor({timeout:60000});
 const nav=page.locator('.cabinet-sidebar nav a[href="'+(actor==='owner'?'#offers':'#carrier-orders')+'"]').first();await nav.evaluate(el=>el.click());await page.locator('.cabinet-panel[data-section="'+(actor==='owner'?'offers':'carrier-orders')+'"]').waitFor({timeout:60000});
 const screenshot='reports/isolated-rc/'+actor+'-previous-production-compatibility.png';await page.screenshot({path:screenshot});
 const dataResponse=await mandatoryData;if(dataResponse.error)throw dataResponse.error;assert.equal(dataResponse.status(),200);assert.equal((report.transportErrors||[]).filter(e=>e.actor===actor).length,0);
 assert.ok(report.calls.some(c=>c.actor===actor&&c.path==='/api/session'&&c.status===200));assert.equal(report.calls.filter(c=>c.actor===actor&&(c.blockedMutation||c.status>=500)).length,0);assert.deepEqual(errors,[]);assert.equal(await page.getByText('Не удалось открыть раздел',{exact:true}).count(),0);
 report.roles.push({actor,status:'PASS',readOnly:true,screenshot,sha256:createHash('sha256').update(await readFile(screenshot)).digest('hex')});transport.closing=true;for(const controller of transport.controllers)controller.abort();await context.close();console.log('PREVIOUS_PRODUCTION_UI_COMPATIBILITY_PASS',actor);
}assert.ok((await live('production-release-manifest.json')).equals(manifest),'Production changed during previous UI test');
 report.result='PASS';}finally{report.completedAt=new Date().toISOString();if(browser)await browser.close();await mkdir('reports/isolated-rc',{recursive:true});await writeFile('reports/isolated-rc/previous-production-ui-compatibility.json',JSON.stringify(report,null,2)+'\n');}
