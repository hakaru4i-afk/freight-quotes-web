// Read-only real QA sessions in the currently published production frontend.
// Every API request goes to the isolated QA function; production gets asset GETs only.
import{chromium}from'playwright';import{readFile,writeFile,mkdir}from'node:fs/promises';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const origin='https://hakaru4i-afk.github.io',prefix='/freight-quotes-web/',qa='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-rc20261110';
const sessions=JSON.parse(await readFile(process.env.QA_SESSIONS_FILE,'utf8'));
const report={mode:'PUBLISHED_PREVIOUS_PRODUCTION_UI_WITH_REAL_ISOLATED_QA_API',runId:process.env.GITHUB_RUN_ID,frontendSha:process.env.GITHUB_SHA,productionApiAccessed:false,productionWrites:false,assets:{},roles:[],calls:[]};
await mkdir('reports/isolated-rc',{recursive:true});
const browser=await chromium.launch({headless:true});
try{for(const actor of['owner','carrierA']){
 const context=await browser.newContext({viewport:{width:1440,height:900}}),errors=[];
 await context.addInitScript(token=>{if(/^https?:$/.test(location.protocol))localStorage.setItem('freight-session-persistent-v1',token);},sessions[actor]);
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  const api=u.hostname==='ooclsrndeygojtofuyte.supabase.co'?u.pathname.split('/freight-api')[1]:u.origin===origin&&u.pathname.startsWith('/api/')?u.pathname:null;
  if(api==='/api/site-events'&&req.method()==='POST'){report.suppressedTelemetry=(report.suppressedTelemetry||0)+1;await route.abort('blockedbyclient');return;}
  if(!['GET','HEAD'].includes(req.method())){report.calls.push({actor,path:u.pathname,method:req.method(),status:null,blockedMutation:true});await route.abort();return;}
  if(api){assert.ok(api.startsWith('/api/'));const headers={...req.headers(),origin};for(const key of['host','content-length','accept-encoding'])delete headers[key];const r=await fetch(qa+api+u.search,{headers,signal:AbortSignal.timeout(60000)});report.calls.push({actor,path:api,method:req.method(),status:r.status});const h=Object.fromEntries(r.headers);for(const key of['content-encoding','content-length'])delete h[key];h['access-control-allow-origin']=origin;await route.fulfill({status:r.status,headers:h,body:Buffer.from(await r.arrayBuffer())});return;}
  if(u.origin===origin&&u.pathname.startsWith(prefix)&&!u.pathname.startsWith(prefix+'test/')){
   const name=decodeURIComponent(u.pathname.slice(prefix.length))||'index.html';assert.ok(!name.includes('..'));const r=await fetch(u,{signal:AbortSignal.timeout(60000)}),bytes=Buffer.from(await r.arrayBuffer());if(r.ok&&/\.(?:html|js|css)$/.test(name)){assert.deepEqual(bytes,await readFile(name),'Previous production asset changed: '+name);report.assets[name]=createHash('sha256').update(bytes).digest('hex');}const h=Object.fromEntries(r.headers);for(const key of['content-encoding','content-length'])delete h[key];await route.fulfill({status:r.status,headers:h,body:bytes});return;}
  if(['data:','blob:'].includes(u.protocol)){await route.continue();return;}await route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.name));await page.goto(origin+prefix,{waitUntil:'domcontentloaded',timeout:60000});await page.locator('[data-cabinet-role="'+(actor==='owner'?'owner':'carrier')+'"]').waitFor({timeout:60000});
 const nav=page.locator('.cabinet-sidebar nav a[href="'+(actor==='owner'?'#offers':'#carrier-orders')+'"]').first();await nav.evaluate(el=>el.click());await page.locator('.cabinet-panel[data-section="'+(actor==='owner'?'offers':'carrier-orders')+'"]').waitFor({timeout:60000});
 assert.ok(report.calls.some(c=>c.actor===actor&&c.path==='/api/session'&&c.status===200));assert.equal(report.calls.filter(c=>c.actor===actor&&(c.blockedMutation||c.status>=500)).length,0);assert.deepEqual(errors,[]);assert.equal(await page.getByText('Не удалось открыть раздел',{exact:true}).count(),0);
 const screenshot='reports/isolated-rc/'+actor+'-previous-production-compatibility.png';await page.screenshot({path:screenshot});report.roles.push({actor,status:'PASS',readOnly:true,screenshot,sha256:createHash('sha256').update(await readFile(screenshot)).digest('hex')});await context.close();console.log('PREVIOUS_PRODUCTION_UI_COMPATIBILITY_PASS',actor);
}report.result='PASS';}finally{await browser.close();await mkdir('reports/isolated-rc',{recursive:true});await writeFile('reports/isolated-rc/previous-production-ui-compatibility.json',JSON.stringify(report,null,2)+'\n');}
