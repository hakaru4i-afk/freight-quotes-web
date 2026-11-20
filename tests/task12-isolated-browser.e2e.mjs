import{map50Scenario}from'./map50-real-scenario.mjs';
import{addressedLogisticScenario}from'./addressed-logistic-real-scenario.mjs';
import {cabinetMatrix} from "./alignment-cabinet-matrix.mjs";
import {alignmentScenarios} from "./alignment-real-scenarios.mjs";
import {carrier124, carrier124Base, readCandidateAsset, assertCandidateCheckout, isolatedBrowserApiPath, isolatedApiUrl} from './carrier124-isolated-target.mjs';
import {qaDocumentFetch} from './helpers/qa-document-transport.mjs';
/** Real local candidate UI + real isolated Edge API. No mocked server responses.
 * Node transports HTTPS with the environment CA and proxy; Chromium loads local
 * candidate assets. No TLS checks are disabled and no machine trust is changed.
 */
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,cp,mkdtemp,rm} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
async function revealForm(form){await form.waitFor({state:'attached',timeout:60000});const summary=form.locator('xpath=ancestor::details[1]/summary');if(await summary.count()&&await form.isHidden())await summary.click();}
const evidenceDir=process.env.QA_BROWSER_EVIDENCE_DIR||'reports/isolated-rc';
const map50=process.env.QA_MAP50==='true';
const exactCandidate=process.env.QA_CARRIER124_CANDIDATE==='true';
const published=process.env.QA_BROWSER_PUBLISHED==='true';
const loginFor=actor=>(exactCandidate?carrier124.run:'rc20261110')+'-'+actor.toLowerCase();
let candidateManifest;
if(exactCandidate){
 assert.equal(published,false,'Carrier124 candidate must use local committed assets');
 assert.ok(process.env.QA_SESSIONS_FILE,'A dedicated synthetic sessions file is required');
 candidateManifest=assertCandidateCheckout();
}
// Freeze source bytes before browser startup: a concurrent merge must never
// change a running test's HTML or assets underneath it.
assert.equal(execFileSync('git',['diff','--name-only','--diff-filter=U'],{encoding:'utf8'}).trim(),'','Resolve merge conflicts before QA');
const sourceTreeDirty=execFileSync('git',['diff','HEAD','--name-only','--','test'],{encoding:'utf8'}).trim().length>0;
if(published)assert.equal(sourceTreeDirty,false,'Commit runtime source before published QA');
const frozenSource=exactCandidate?null:await mkdtemp('/tmp/freight-browser-source-');
if(frozenSource)await cp(resolve('test'),resolve(frozenSource,'test'),{recursive:true});
const readAsset=async name=>exactCandidate?readCandidateAsset(name):readFile(resolve(frozenSource,name));
const metadata=exactCandidate?{
 isolatedQaFunction:carrier124.function,isolatedQaVersion:carrier124.version,
 isolatedQaBundleSha256:carrier124.bundle,isolatedQaSourceCommit:carrier124.backendSource
}:JSON.parse(await readFile(resolve(frozenSource,'test/build-info.json'),'utf8')).stabilizationQa20261110;
// An isolated backend candidate can be verified before changing published metadata.
if(!exactCandidate&&process.env.QA_BROWSER_BACKEND_PROOF_FILE){
 const proof=JSON.parse(await readFile(process.env.QA_BROWSER_BACKEND_PROOF_FILE,'utf8'));
 assert.equal(proof.function,'freight-api-qa-rc20261110');assert.ok(Number.isInteger(proof.version)&&proof.version>0);assert.match(proof.bundle,/^[a-f0-9]{64}$/);assert.match(proof.sourceCommit,/^[a-f0-9]{40}$/);
 Object.assign(metadata,{isolatedQaVersion:proof.version,isolatedQaBundleSha256:proof.bundle,isolatedQaSourceCommit:proof.sourceCommit});
}
assert.equal(metadata.isolatedQaFunction,exactCandidate?carrier124.function:'freight-api-qa-rc20261110');
assert.ok(Number.isInteger(metadata.isolatedQaVersion)&&metadata.isolatedQaVersion>0);
assert.match(metadata.isolatedQaBundleSha256,/^[a-f0-9]{64}$/);
const loginSmoke=exactCandidate&&process.env.QA_BROWSER_LOGIN==='true';
const ownerFieldsDenied=exactCandidate&&process.env.QA_BROWSER_OWNER_FIELDS_DENIED==='true';
const loserArchive=exactCandidate&&process.env.QA_BROWSER_LOSER_ARCHIVE==='true';
const remainingPhase=exactCandidate&&process.env.QA_BROWSER_REMAINING;
const phase=remainingPhase?'remaining-'+remainingPhase:loginSmoke?'login':ownerFieldsDenied?'owner-fields-denied':loserArchive?'loser-archive':process.env.QA_BROWSER_CARRIER124==='true'?'carrier124-dashboard':process.env.QA_BROWSER_TENDER==='true'?'tender':process.env.QA_BROWSER_MODE_MATRIX==='true'?'mode-matrix':process.env.QA_NOV14_PHASE?'nov14-'+process.env.QA_NOV14_PHASE:process.env.QA_MAP_GEOCODES==='true'?'map50':process.env.QA_BROWSER_LOGISTIC_SECURITY==='true'?'logistic-security':process.env.QA_BROWSER_ALIGNMENT==='true'?'alignment':process.env.QA_BROWSER_CREATE==='true'?'create':process.env.QA_BROWSER_SELECT==='true'?'select':process.env.QA_BROWSER_ACCEPT==='true'?'accept':process.env.QA_BROWSER_TRACK==='true'?'tracking':process.env.QA_BROWSER_LOGISTIC_DOCUMENT==='true'?'logistic-document':process.env.QA_BROWSER_VED_VERIFY==='true'?'ved-verify':process.env.QA_BROWSER_VED_WORK==='true'?'ved-work':process.env.QA_BROWSER_EXECUTION==='true'?'execution':process.env.QA_BROWSER_BID==='true'?'bid-'+(['csv','xlsx'].includes(process.env.QA_BROWSER_IMPORT)?process.env.QA_BROWSER_IMPORT:'manual'):'cabinet-read';
const root=frozenSource||process.cwd(),base=exactCandidate?carrier124Base:'https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-rc20261110';
if(exactCandidate){
 if(candidateManifest.sh59IsolatedQa?.receiptPath){
  const r=await fetch(base+'/health?forceFunctionRegion=eu-central-1',{redirect:'error',signal:AbortSignal.timeout(15000)});
  assert.equal(r.status,200);
  const health=await r.json();
  assert.equal(health.qaRun,carrier124.run);
  assert.equal(health.edgeVersion,carrier124.version,'ISOLATED_EDGE_VERSION_DRIFT');
 }
}
const sessions=JSON.parse(await readFile(process.env.QA_SESSIONS_FILE||'/tmp/freight-rc20261110-private/sessions.json','utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;const file=resolve(root,'.'+(path==='/test/'?'/test/index.html':path));if(!file.startsWith(root+'/test/')){res.writeHead(403).end();return;}try{res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(await readAsset(file.slice(root.length+1)));}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=published?'https://hakaru4i-afk.github.io':'http://127.0.0.1:'+server.address().port;
const launchArgs=map50||phase==='remaining-modes'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[];
const browser=await chromium.launch({headless:true,...(exactCandidate&&process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH}:{}),args:launchArgs});const report={frontendSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),backendFunction:metadata.isolatedQaFunction,...(exactCandidate?{frontendSource:carrier124.frontendSource,frontendMetadata:carrier124.frontendMetadata,frontendTestTree:carrier124.frontendTestTree,sqlMigrationVersion:candidateManifest.sh59IsolatedQa?.catalogMigrationVersion||candidateManifest.sqlMigrationVersion,workflowRunId:process.env.GITHUB_RUN_ID||null}:{}),backendVersion:metadata.isolatedQaVersion,backendBundle:metadata.isolatedQaBundleSha256,backendSourceCommit:metadata.isolatedQaSourceCommit||metadata.backendSourceCommit,startedAt:new Date().toISOString(),sourceSite:published?'https://hakaru4i-afk.github.io/freight-quotes-web/test/':origin,servedAssetHashes:{},sourceAssets:{},environment:exactCandidate?'isolated-qa-'+carrier124.run:'isolated-qa-rc20261110',transport:'TLS_VERIFIED_REAL_HTTP',sourceTreeDirty,immutableSource:true,mocks:false,roles:[],calls:[]};
await mkdir(evidenceDir,{recursive:true});
const html=(await readAsset('test/index.html')).toString('utf8');
for(const name of new Set([...html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)].map(m=>m[1]))){report.sourceAssets[name]=createHash('sha256').update(await readAsset('test/'+name)).digest('hex');}

try{for(const actor of (process.env.QA_BROWSER_ACTORS||'owner,carrierA,carrierB,ved,logistic,supplier,supplierB,designer,content,purchasing,certification').split(',')){
 const rec={actor,status:'RUNNING',viewports:[]};report.roles.push(rec);
 assert.match(sessions[actor]||'',/^[a-f0-9]{64}$/,'Missing isolated QA session for '+actor);
 const context=await browser.newContext({viewport:{width:1440,height:900},...(exactCandidate?{serviceWorkers:'block'}:{})});const errors=[];
 if(!loginSmoke)await context.addInitScript(({token})=>{if(window.top===window&&/^https?:$/.test(location.protocol))localStorage.setItem('freight-staging-ibclzdkxiozbzmniiygv-session-persistent-v1',token);},{token:sessions[actor]});
 const realTransport=async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='ooclsrndeygojtofuyte.supabase.co')throw Error('PRODUCTION_REQUEST_BLOCKED');
  const path=exactCandidate?isolatedBrowserApiPath(url,origin):url.hostname==='ibclzdkxiozbzmniiygv.supabase.co'?url.pathname.split('/freight-api')[1]:url.pathname.startsWith('/api/')?url.pathname:null;
  if(path){
   if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS','access-control-allow-credentials':'true'}});return;}
   const start=Date.now(),headers={...req.headers(),origin:'https://hakaru4i-afk.github.io'};delete headers.host;delete headers['content-length'];
   let r;try{r=await qaDocumentFetch(exactCandidate?isolatedApiUrl(path,url.search):base+path+url.search,{...(exactCandidate?{redirect:'error'}:{}),method:req.method(),headers,body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),},{timeout:60000,onTransportRetry:()=>report.calls.push({actor,path,method:req.method(),retry:'document_upload_transport'})});}catch(error){report.calls.push({actor,path,method:req.method(),status:null,durationMs:Date.now()-start,error:'REAL_HTTP_TRANSPORT_FAILED'});await route.abort('timedout');return;}
   const body=Buffer.from(await r.arrayBuffer());report.calls.push({actor,path,method:req.method(),status:r.status,durationMs:Date.now()-start,requestId:r.headers.get('x-freight-request-id'),requestedRegion:url.searchParams.get('forceFunctionRegion'),actualRegion:r.headers.get('x-sb-edge-region')});
   const out=Object.fromEntries(r.headers);delete out['content-encoding'];delete out['content-length'];out['access-control-allow-origin']=origin;out['access-control-allow-credentials']='true';
   await route.fulfill({status:r.status,headers:out,body});return;
  }
  if(published&&url.origin===origin&&url.pathname.startsWith('/freight-quotes-web/test/')){
   const r=await fetch(url.href,{signal:AbortSignal.timeout(60000)});const bytes=Buffer.from(await r.arrayBuffer());
   const name=decodeURIComponent(url.pathname.slice('/freight-quotes-web/test/'.length))||'index.html';
   if(r.ok){const local=resolve(root,'test',name);assert.ok(local.startsWith(root+'/test/'));if(/\.(?:html|js|mjs|css|svg|ttf|png)$/.test(name)||name==='build-info.json')assert.deepEqual(bytes,await readFile(local),'Published asset differs: '+name);report.servedAssetHashes[name]=createHash('sha256').update(bytes).digest('hex');}
   const headers=Object.fromEntries(r.headers);delete headers['content-encoding'];delete headers['content-length'];await route.fulfill({status:r.status,headers,body:bytes});return;
  }
  if(map50&&url.hostname==='router.project-osrm.org'&&url.pathname.startsWith('/route/v1/driving/')&&req.method()==='GET'){
   try{const r=await fetch(url.href,{signal:AbortSignal.timeout(20000)});const bytes=Buffer.from(await r.arrayBuffer());(report.externalRoutes??=[]).push({provider:'OSRM',status:r.status,realHttp:true,authorizationForwarded:false});await route.fulfill({status:r.status,contentType:'application/json',body:bytes});}catch{await route.abort('timedout');}return;
  }
  if(url.origin===origin||['data:','blob:'].includes(url.protocol)){await route.continue();return;}
  await route.abort();
 };await context.route('**/*',realTransport);
 const createPublicPage=async()=>{const ctx=await browser.newContext({viewport:{width:1366,height:768},...(exactCandidate?{serviceWorkers:'block'}:{})});await ctx.route('**/*',realTransport);const anonymous=await ctx.newPage();anonymous.on('pageerror',e=>errors.push(e.message));await anonymous.goto(origin+(published?'/freight-quotes-web/test/':'/test/')+'#lw-partners',{waitUntil:'domcontentloaded'});return{page:anonymous,close:()=>ctx.close()};};
 const page=await context.newPage();const password=loginSmoke?process.env.QA_BROWSER_PASSWORD:undefined;
 const secretValues=[...Object.values(sessions),...(password?[password]:[])];
 const redact=value=>secretValues.reduce((output,secret)=>output.replaceAll(secret,'[REDACTED]'),String(value));
 const consoleErrors=[];page.on('pageerror',e=>errors.push(redact(e.message)));page.on('console',m=>{if(m.type()==='error'){consoleErrors.push(redact(m.text()).slice(0,1500));}});
 try{
  await page.goto(origin+(published?'/freight-quotes-web/test/':'/test/'),{waitUntil:'domcontentloaded'});
  if(loginSmoke){
   assert.match(password||'',/^[a-f0-9]{64}$/,'Expected a protected synthetic credential');
   const login=page.locator('input[name="login"]').first();
   await login.fill(loginFor(actor));
   await page.locator('input[name="password"]').first().fill(password);
   const response=page.waitForResponse(r=>r.url().includes('/api/auth')&&r.request().method()==='POST');
   await page.locator('form').filter({has:login}).getByRole('button',{name:/Войти|Вход|Login/i}).first().click();
   const signedIn=await response;
   assert.equal(signedIn.status(),200);
   rec.login={http:200,requestId:signedIn.headers()['x-freight-request-id']};
  }
  await page.getByText(/^(Выйти|Sign out|退出)$/).first().waitFor({timeout:60000});
  rec.dom=await page.evaluate(()=>[...document.querySelectorAll('main,section,[class*=workspace],[class*=cabinet]')].slice(0,35).map(x=>({tag:x.tagName,cls:x.className,section:x.getAttribute('data-section'),role:x.getAttribute('data-cabinet-role')})));
  await writeFile(evidenceDir+'/'+actor+'-dom.json',JSON.stringify(rec.dom,null,2));
  if(ownerFieldsDenied){
   assert.ok(['carrierA','carrierB','ved','supplier'].includes(actor));
   await page.evaluate(()=>{location.hash='#create-request';});
   assert.equal(await page.locator('.cabinet-panel[data-section="create-request"] fieldset.request-owner-fields').isVisible(),false);
   assert.equal(await page.getByRole('button',{name:/Опубликовать и уведомить/}).isVisible(),false);
   rec.ownerFieldAccess={formHidden:true,publishControlHidden:true};
  }
  if(loserArchive){
   const saved=JSON.parse(await readFile(evidenceDir+'/browser-results-owner.json','utf8')).roles[0];
   assert.ok(['carrierA','carrierB'].includes(actor)&&actor!==saved.selection.winnerActor);
   const response=await fetch(isolatedApiUrl('/api/carrier'),{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[actor]},redirect:'error',signal:AbortSignal.timeout(15000)});
   assert.equal(response.status,200);
   const dashboard=(await response.json()).dashboard;
   const lost=dashboard.items.find(x=>x.order_code===saved.createdOrder);
   assert.equal(lost?.stage,'lost');assert.ok(lost.filters.includes('archive'));
   await page.locator('[data-carrier-filter=archive]').click();
   const card=page.locator('.carrier-request-list .carrier-request').filter({hasText:saved.createdOrder});
   await card.waitFor();
   assert.equal(await card.getByText(/^Участвую$/).count(),0);
   rec.loserArchive={order:saved.createdOrder,archived:true,participationHidden:true,requestId:response.headers.get('x-freight-request-id')};
  }
  if(exactCandidate&&process.env.QA_BROWSER_CARRIER124==='true'){
   assert.equal(actor,'carrierA');
   const dashboard=async()=>{
    const response=await fetch(isolatedApiUrl('/api/carrier'),{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[actor]},redirect:'error',signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200);
    return (await response.json()).dashboard;
   };
   const before=await dashboard();
   assert.equal(before.version,1);
   const target=before.items.find(item=>item.stage==='new'&&/^QA-CI-[0-9A-F]+-DASHBOARD124REFUSAL-[0-9A-F]+$/.test(item.order_code));
   assert.ok(target,'A fresh synthetic dashboard fixture must be available');
   const stageKeys=['new','viewed','preparing','review','selected','execution'];
   const filterKeys=['all','requires_response','declined','lost','completed','archive'];
   await page.locator('[data-carrier-dashboard]').waitFor();
   for(const key of [...stageKeys,...filterKeys]){
    await page.evaluate(()=>{location.hash='#overview';});
    const button=page.locator('[data-carrier-'+(stageKeys.includes(key)?'stage':'filter')+'="'+key+'"]');
    await button.click();
    await page.waitForFunction(count=>document.querySelectorAll('.carrier-request-list .carrier-request').length===count,before.counts[key]);
   }
   await page.evaluate(()=>{location.hash='#overview';});
   await page.locator('[data-carrier-stage=new]').click();
   const row=page.locator('.carrier-request-list .carrier-request').filter({hasText:target.order_code});
   const opened=page.waitForResponse(r=>r.url().includes('/api/carrier')&&r.request().method()==='POST'&&r.request().postDataJSON()?.id===target.id);
   await row.locator('.map-link').click();
   assert.equal((await opened).status(),200);
   assert.equal(report.calls.filter(c=>c.path==='/api/carrier'&&c.method==='POST').length,1);
   const after=await dashboard();
   assert.equal(after.items.find(item=>item.id===target.id).stage,'viewed');
   assert.equal(after.counts.new,before.counts.new-1);
   assert.equal(after.counts.viewed,before.counts.viewed+1);
   await page.waitForFunction(order=>document.querySelector('.logistics-panel')?.getAttribute('aria-label')?.includes(order),target.order_code);
   await page.reload({waitUntil:'domcontentloaded'});
   assert.equal((await dashboard()).items.find(item=>item.id===target.id).stage,'viewed');
   rec.dashboard={matchedCounts:stageKeys.length+filterKeys.length,order:target.order_code,openedOnce:true,routePreserved:true,persistedAfterReload:true};
  }
  if(remainingPhase)await (await import('./carrier124-remaining-workflows.mjs')).remainingWorkflow({page,actor,sessions,rec,report,evidenceDir,phase:remainingPhase});
  if(process.env.QA_BROWSER_LOGISTIC_SECURITY==='true'&&actor==='logistic')await addressedLogisticScenario({page,rec,base,sessions});
  if(process.env.QA_OWNER_REGISTERS==='true')await (await import('./nov14-owner-registers-real.mjs')).ownerRegistersScenario({page,actor,base,sessions,rec,report,evidenceDir});
  if(process.env.QA_NOV14_PHASE)await (await import('./nov14-real-scenario.mjs')).nov14Scenario({page,actor,base,sessions,rec,report,evidenceDir});
  if(process.env.QA_MAP_GEOCODES==='true')await map50Scenario({page,actor,base,sessions,rec,report,evidenceDir});
  if(process.env.QA_BROWSER_CREATE==='true'&&actor==='owner'){
   const order=process.env.QA_MAP_ORDER||'QA-UI-'+Date.now();rec.createdOrder=order;
   const nav=page.locator('.cabinet-sidebar nav a[href="#create-request"]').first();await nav.evaluate(el=>el.click());
   const panel=page.locator('.cabinet-panel[data-section="create-request"]');await panel.waitFor({state:'visible'});
   await panel.locator('input[aria-label="Номер заказа *"]').fill(order);
   const fields=panel.locator('fieldset.request-owner-fields');
   const incompletePublish=panel.getByRole('button',{name:/Опубликовать и уведомить/});
   assert.equal(await incompletePublish.isEnabled(),false,'Number alone cannot enable publication');
   await fields.locator('input[type="datetime-local"]').fill('2026-12-15T12:00');
   assert.equal(await incompletePublish.isEnabled(),false,'Number and deadline cannot publish without mandatory shipment fields');
   await panel.locator('textarea[placeholder^="Например, 5324"]').fill('910001, 910002');
   rec.requiredFieldUiValidation={numberOnlyDisabled:true,numberAndDeadlineDisabled:true,publishedUi:true};
   for(const [selector,value] of [['input[placeholder^="Что перевозим"]','Synthetic browser shipment'],['input[placeholder^="Имя, телефон"]','Synthetic QA sender'],['input[placeholder^="Страна, город, адрес склада"]',process.env.QA_NOV14_RAIL==='true'?'Китай, Нинбо':map50?'Китай, Шеньчжэнь':'Brest, Belarus'],['input[placeholder^="Например, 1250"]','1250'],['input[placeholder^="Страна, город, адрес доставки"]',map50?'Беларусь, Минск, Колядичи':'Minsk, Belarus'],['input[placeholder^="Например, 8,4"]','12.5'],['input[placeholder^="Наименование, упаковка"]','Synthetic QA cargo']])await fields.locator(selector).fill(value);
   await fields.locator('select').first().selectOption('EXW');await fields.locator('select').nth(1).selectOption('no');
   await fields.locator('input[name="incoterm_place"]').fill('Brest warehouse · synthetic QA');
   await fields.locator('input[name="supplier_order_number"]').fill('QA-PI-'+order);
   assert.equal(await fields.locator('input[name="incoterm_place"]').inputValue(),'Brest warehouse · synthetic QA');
   assert.equal(await fields.locator('input[name="supplier_order_number"]').inputValue(),'QA-PI-'+order);
   await fields.locator('input[type="date"]').fill(map50?'2026-11-01':'2026-12-05');await fields.locator('input[type="datetime-local"]').fill('2026-12-15T12:00');
   const files=panel.locator('input[type="file"]');rec.fileInputs=await files.count();
   const uploaded=page.waitForResponse(r=>r.url().includes('/api/documents')&&r.request().method()==='POST',{timeout:60000});
   await files.last().setInputFiles({name:'qa-browser.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic browser upload\n')});
   const upload=panel.getByRole('button',{name:/Загрузить/}).first();if(await upload.count())await upload.click();
   assert.equal((await uploaded).status(),200,'Real browser file upload failed');
   const publish=panel.getByRole('button',{name:/Опубликовать и уведомить/});
   const saved=page.waitForResponse(r=>r.url().includes('/api/requests')&&r.request().method()==='POST',{timeout:60000});await publish.click({timeout:60000});
   const r=await saved;const result=await r.json();assert.equal(r.status(),200,JSON.stringify({error:result.error,fields:result.fields,requestId:r.headers()["x-freight-request-id"]}));assert.equal(result.recipients,2);rec.publication={http:200,round:result.round,recipients:2};
   const readback=await fetch(base+'/api/requests?order='+encodeURIComponent(order)+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions.owner},redirect:'error',signal:AbortSignal.timeout(30000)});
   assert.equal(readback.status,200,'POST publication must be readable through the same isolated API');
   const payload=await readback.json(),stored=payload.request;
   assert.equal(stored?.order_code,order,'GET /api/requests returned a different request');
   assert.equal(stored.round_id,result.round,'GET /api/requests returned a different publication round');
   assert.ok(typeof stored?.registration_no==='string'&&stored.registration_no.trim(),
     'API_CONTRACT_REGISTRATION_MISSING: GET /api/requests must return the trigger-assigned number; '+
     'responseShape='+JSON.stringify({topLevelKeys:Object.keys(payload||{}).sort(),requestKeys:Object.keys(stored||{}).sort(),
       registrationType:typeof stored?.registration_no,postRoundType:typeof result?.round,
       readbackRequestId:readback.headers.get('x-freight-request-id')}));
   assert.match(stored.registration_no,/^TR-\d{2}-\d{6}$/,'GET /api/requests returned an invalid canonical registration number');
   assert.deepEqual(stored.bitrix_task.split(/[,;\s]+/).filter(Boolean),['910001','910002']);
   rec.publication.registrationNumber=stored.registration_no;rec.publication.registrationReadbackRequestId=readback.headers.get('x-freight-request-id');rec.publication.bitrixNumbers=2;
  }
  if(process.env.QA_BROWSER_BID==='true'&&['carrierA','carrierB'].includes(actor)){
   const targetOrder=exactCandidate&&process.env.QA_CARRIER124_BID_ORDER;
   if(targetOrder)assert.match(targetOrder,/^QA-N26-[A-Z0-9-]+$/);
   const order=targetOrder||JSON.parse(await readFile(evidenceDir+'/browser-results-owner.json','utf8')).roles[0].createdOrder;
   rec.bidOrder=order;
   await page.locator('.cabinet-sidebar nav a[href="#carrier-orders"]').first().evaluate(el=>el.click());
   if(exactCandidate&&process.env.QA_CARRIER124_LATE_SUBMIT==='true'){
    await page.locator('#late-bid-controls-carrier').getByRole('button',{name:'Подать позднюю ставку по заявке '+order}).click({timeout:20000});
   }else{
    const card=page.locator('article.carrier-request').filter({hasText:order}).first();await card.waitFor({state:'visible',timeout:60000});
    await card.locator('a[href*="quote"]').first().click();
   }
   const form=page.locator('form').filter({has:page.locator('input[name="carrier"]')});
   await revealForm(form);await form.waitFor({state:'visible',timeout:120000});
   await form.locator('input[name="carrier"]').fill('Synthetic browser carrier');await form.locator('input[name="contact"]').fill('Synthetic QA contact');
   if(exactCandidate&&process.env.QA_CARRIER124_ADD_REMOVE==='true'){
    const variants=form.locator('fieldset.quote-variant');
    const initial=await variants.count();
    await form.getByRole('button',{name:'+ Добавить вариант',exact:true}).click();
    assert.equal(await variants.count(),initial+1);
    await form.getByRole('button',{name:'Удалить вариант '+(initial+1),exact:true}).click();
    assert.equal(await variants.count(),initial);
    rec.removedEmptyVariant=true;
   }
   const v=form.locator('fieldset.quote-variant').first();
   await v.locator('input[aria-label="Общая ставка за партию"]').fill('1550');await v.locator('select[aria-label="Валюта"]').selectOption('USD');
   await v.locator('select[name$=".mode"]').selectOption({label:process.env.QA_NOV14_RAIL==='true'?'ЖД':'Авто'});await v.locator('input[name$=".pickup"]').fill(map50?'2026-11-02':'2026-12-05');await v.locator('input[name$=".days"]').fill(process.env.QA_NOV14_RAIL==='true'?'65':'21');
   await v.locator('input[name$=".incotermPlace"]').fill(process.env.QA_NOV14_RAIL==='true'?'Китай, Пекин, станция Beijing Railway Station':map50?'Китай, Шэньчжэнь, порт Yantian':'Brest warehouse');
   if(map50)await v.locator('textarea[name$=".waypoints"]').fill(process.env.QA_NOV14_RAIL==='true'?'Россия, Забайкальск, станция Забайкальск':(actor==='carrierA'?'Китай, Шанхай':'Китай, Нинбо')+'\nБеларусь, Брест');await v.locator('select[name$=".insurance"]').selectOption({label:'Включено'});
   await v.locator('input[name$=".validUntil"]').fill('2026-12-20');await v.locator('textarea[name$=".includes"]').fill('Transport and documents');await v.locator('textarea[name$=".extras"]').fill('No extras');
   if(process.env.QA_BROWSER_IMPORT==='xlsx'){
    const downloaded=page.waitForEvent('download');
    await form.getByRole('button',{name:'Скачать Excel-шаблон',exact:true}).click();
    const download=await downloaded;const bytes=await readFile(await download.path());
    assert.equal(bytes.subarray(0,2).toString(),'PK','A real XLSX archive must be exported');
    await v.locator('input[aria-label="Общая ставка за партию"]').fill('1');
    const before=report.calls.filter(c=>c.path==='/api/quote'&&c.method==='POST').length;
    const dialogs=[];page.on('dialog',async dialog=>{dialogs.push({type:dialog.type(),message:dialog.message()});await dialog.accept();});
    await form.locator('input[type="file"][accept^=".xlsx,.csv"]').setInputFiles({name:'qa-roundtrip.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
    await page.waitForFunction(()=>[...document.querySelectorAll('input[aria-label="Общая ставка за партию"]')].some(e=>e.value==='1550'));
    assert.equal(report.calls.filter(c=>c.path==='/api/quote'&&c.method==='POST').length,before,'Import must not submit a quote');
    assert.ok(dialogs.some(d=>d.type==='confirm'),'Actual import preview must be confirmed');
    rec.workbookImport={status:'PASS',format:'xlsx',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),previewConfirmed:true,importDidNotSubmit:true,amountRestored:'1550'};
   }
   if(process.env.QA_BROWSER_IMPORT==='csv'){
    const dialogs=[];page.on('dialog',async dialog=>{dialogs.push({type:dialog.type(),message:dialog.message()});await dialog.accept();});
    const amount=v.locator('input[aria-label="Общая ставка за партию"]');await amount.fill('1');
    const upload=form.locator('input[type="file"][accept^=".xlsx,.csv"]');
    rec.csvFieldNames=await form.locator('input[name],select[name],textarea[name]').evaluateAll(xs=>xs.map(x=>x.name));rec.csvDialogs=dialogs;
    const names=await Promise.all(['amount','validUntil','insurance'].map(key=>v.locator('[name$=".'+key+'"]').getAttribute('name')));
    const invalid=Buffer.from(names.slice(0,2).join(';')+'\n1550;31.02.2026\n');
    await upload.setInputFiles({name:'qa-invalid.csv',mimeType:'text/csv',buffer:invalid});
    await page.waitForFunction(()=>document.querySelector('input[type="file"][accept^=".xlsx,.csv"]').value==='');
    assert.equal(await amount.inputValue(),'1','Invalid date must reject the entire import');
    assert.ok(dialogs.some(d=>d.type==='alert'&&/дата/i.test(d.message)),'Invalid date needs an actionable message: '+JSON.stringify(dialogs));
    const before=report.calls.filter(c=>c.path==='/api/quote'&&c.method==='POST').length;
    const bytes=Buffer.from('\uFEFF'+names.join(';')+'\r\n1550;20.12.2026;ВКЛЮЧЕНО\r\n');
    await upload.setInputFiles({name:'qa-valid.csv',mimeType:'text/csv',buffer:bytes});
    await page.waitForFunction(()=>document.querySelector('input[aria-label="Общая ставка за партию"]').value==='1550');
    assert.equal(await v.locator('input[name$=".validUntil"]').inputValue(),'2026-12-20');
    assert.equal(report.calls.filter(c=>c.path==='/api/quote'&&c.method==='POST').length,before);
    assert.ok(dialogs.some(d=>d.type==='confirm'));
    rec.csvImport={status:'PASS',utf8Bom:true,invalidDateRejectedAtomically:true,previewConfirmed:true,importDidNotSubmit:true,sha256:createHash('sha256').update(bytes).digest('hex')};
   }
   await form.locator('input[type="checkbox"][required]').check();
   const sent=page.waitForResponse(r=>r.url().includes('/api/quote')&&r.request().method()==='POST',{timeout:60000});await form.getByRole('button',{name:/Отправить все варианты/}).click();
   const r=await sent;assert.equal(r.status(),200);rec.quote={http:200};
   const check=await fetch(base+'/api/carrier',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[actor]}});const saved=await check.json();assert.ok(saved.bids.some(b=>b.order_code===order&&Number(b.amount)===1550));rec.quote.readbackVerified=true;
   if(map50){const replay=await fetch(base+'/api/quote',{method:'POST',headers:{Origin:'https://hakaru4i-afk.github.io','Content-Type':'application/json',Authorization:'Bearer '+sessions[actor]},body:JSON.stringify(r.request().postDataJSON())});assert.equal(replay.status,200,'Unchanged bid replay must be accepted');const again=await(await fetch(base+'/api/carrier',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[actor]}})).json();assert.deepEqual(again.bids.filter(b=>b.order_code===order).map(b=>b.id),saved.bids.filter(b=>b.order_code===order).map(b=>b.id));rec.quote.replayPreservedIds=true;}

  }
  if((process.env.QA_BROWSER_LOGISTIC_DOCUMENT==='true'||process.env.QA_BROWSER_LOGISTIC_COMPLETE_ONLY==='true')&&actor==='logistic'){
   const owner=JSON.parse(await readFile(evidenceDir+'/browser-results-owner.json','utf8')).roles[0];const order=owner.createdOrder;rec.bidOrder=order;
   const api=async(id,path,body)=>{const r=await fetch(base+path+(path.includes('?')?'&':'?')+'forceFunctionRegion=eu-central-1',{method:body?'POST':'GET',headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[id],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};};
   const snapshot=await api('logistic','/api/task2?order='+encodeURIComponent(order));assert.equal(snapshot.status,200);const tasks=snapshot.data.tasks.filter(t=>t.task_type==='ved_request_logistic'&&t.assigned_login===loginFor('logistic')&&t.status==='open');assert.equal(tasks.length,1);const task=tasks[0];
   assert.equal((await api('ved','/api/task2',{order,action:'complete_task',taskId:task.id})).status,403,'Sender cannot impersonate the addressed recipient');if(process.env.QA_BROWSER_LOGISTIC_COMPLETE_ONLY!=='true')assert.equal((await api('logistic','/api/task2',{order,action:'complete_task',taskId:task.id})).status,409,'Document handoff cannot finish without a file');
   await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());await page.locator('#t2-select').selectOption(order,{timeout:60000});const form=page.locator('[data-t2-form="upload"]');await revealForm(form);await form.waitFor({state:'visible',timeout:60000});const bytes=Buffer.from('Synthetic requested packing list '+order+'\n');let doc;if(process.env.QA_BROWSER_LOGISTIC_COMPLETE_ONLY==='true'){doc=task.payload?.files?.[0];assert.ok(doc);}else{await form.locator('select[name="taskId"]').selectOption(task.id);await form.locator('input[name="files"]').setInputFiles({name:'qa-requested-packing.txt',mimeType:'text/plain',buffer:bytes});
   const uploaded=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&(r.request().headers()['content-type']||'').includes('multipart/form-data'),{timeout:60000});await form.locator('button[type="submit"]').click();const upload=await uploaded;assert.equal(upload.status(),200);doc=(await upload.json()).id;assert.ok(doc);}
   page.once('dialog',d=>d.accept());const completed=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&(r.request().headers()['content-type']||'').includes('application/json')&&r.request().postDataJSON()?.action==='complete_task',{timeout:60000});await revealForm(page.locator('[data-t2-task-complete="'+task.id+'"]'));await page.locator('[data-t2-task-complete="'+task.id+'"]').click();assert.equal((await completed).status(),200);
   const checked=await api('ved','/api/task2?order='+encodeURIComponent(order));assert.equal(checked.status,200);assert.equal(checked.data.tasks.find(t=>t.id===task.id).status,'completed');assert.equal(checked.data.state.pto_checked_at,null,'Addressed document handoff must not complete the separate PTO review');
   const feed=await api('logistic','/api/pending-tasks');assert.ok(!feed.data.items.some(t=>t.id===task.id));const file=await fetch(base+'/api/task2?order='+encodeURIComponent(order)+'&download='+doc+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions.ved}});assert.equal(file.status,200);assert.deepEqual(Buffer.from(await file.arrayBuffer()),bytes);rec.documentHandoff={http:200,taskId:task.id,fileId:doc,sha256:createHash('sha256').update(bytes).digest('hex'),completed:true,wrongActorDenied:true,missingFileDenied:process.env.QA_BROWSER_LOGISTIC_COMPLETE_ONLY!=='true',recipientFeedCleared:true,ptoReviewUnchanged:true};
  }
  if(process.env.QA_BROWSER_VED_VERIFY==='true'&&actor==='ved'){
   const owner=JSON.parse(await readFile(evidenceDir+'/browser-results-owner.json','utf8')).roles[0],order=owner.createdOrder;rec.bidOrder=order;
   const prior=JSON.parse(await readFile(evidenceDir+'/browser-results-ved-ved-work.json','utf8')).roles[0];assert.equal(prior.bidOrder,order);
   const api=async(id,path)=>{const r=await fetch(base+path+(path.includes('?')?'&':'?')+'forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[id]}});return{status:r.status,data:await r.json()};};
   let mutations=0;const observe=req=>{if(req.method()!=='POST')return;const path=new URL(req.url()).pathname;if(path.endsWith('/api/task2')||path.endsWith('/api/chats')&&(req.headers()['content-type']||'').includes('multipart/form-data'))mutations++;};page.on('request',observe);
   await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());await page.locator('#t2-select').selectOption(order,{timeout:60000});const form=page.locator('[data-t2-form="ved_logistic_docs"]');await revealForm(form);await form.waitFor({state:'visible',timeout:60000});const draft='Unsent draft preserved on reselect';await form.locator('[name="assignedLogin"]').selectOption(loginFor('logistic'));await form.locator('[name="description"]').fill(draft);await form.locator('[name="types"]').selectOption({label:'Упаковочный лист'});
   let duplicateReads=0;const count=req=>{const url=new URL(req.url());if(req.method()==='GET'&&url.pathname.endsWith('/api/task2')&&url.searchParams.get('order')===order)duplicateReads++;};page.on('request',count);await page.locator('#t2-select').selectOption(order);await page.waitForTimeout(500);page.off('request',count);assert.equal(duplicateReads,0);assert.equal(await form.locator('[name="assignedLogin"]').inputValue(),loginFor('logistic'));assert.equal(await form.locator('[name="description"]').inputValue(),draft);assert.deepEqual(await form.locator('[name="types"]').evaluate(el=>[...el.selectedOptions].map(x=>x.value)),['Упаковочный лист']);
   const taskData=await api('ved','/api/task2?order='+encodeURIComponent(order));assert.equal(taskData.status,200);const tasks=taskData.data.tasks.filter(t=>t.id===prior.addressedRequest.taskId);assert.equal(tasks.length,1);assert.equal(tasks[0].status,'completed');assert.equal(tasks[0].payload.files.length,1);
   const verifyChat=async()=>{await page.locator('.cabinet-sidebar nav a[href="#chats"]').first().evaluate(el=>el.click());const chatPage=page.locator('#lw-ved-chat-page');await chatPage.locator('[data-vc-order="'+order+'"]').click({timeout:60000});const chat=await api('ved','/api/chats?id='+prior.sharedChat.chatId);assert.equal(chat.status,200);assert.equal(chat.data.messages.length,1);assert.equal(chat.data.messages[0].files.length,1);await chatPage.getByText(chat.data.messages[0].body,{exact:true}).waitFor({state:'visible',timeout:60000});return chat.data.messages[0].files[0].id;};
   const fileId=await verifyChat();await page.reload({waitUntil:'domcontentloaded'});await page.getByText(/^(Выйти|Sign out|退出)$/).first().waitFor({timeout:60000});assert.equal(await verifyChat(),fileId);
   for(const id of ['ved','owner',owner.selection.winnerActor]){const r=await fetch(base+'/api/chat-files?id='+fileId+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[id]}});assert.equal(r.status,200);assert.equal(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),prior.sharedChat.sha256);}
   page.off('request',observe);assert.equal(mutations,0,'Verification and reload must not resend documents, tasks or messages');rec.persistence={duplicateDetailReads:0,draftPreserved:true,addressedTasks:1,documentHandoff:'completed',taskFiles:1,chatMessages:1,chatFiles:1,attachmentSha256:prior.sharedChat.sha256,recipients:3,reloadVerified:true,submissionRequests:0};
  }
  if((process.env.QA_BROWSER_VED_WORK==='true'||process.env.QA_BROWSER_VED_CHAT_ONLY==='true')&&actor==='ved'){
   const owner=JSON.parse(await readFile(evidenceDir+'/browser-results-owner.json','utf8')).roles[0];const order=owner.createdOrder;rec.bidOrder=order;
   const api=async(id,path)=>{const r=await fetch(base+path+(path.includes('?')?'&':'?')+'forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[id]}});return{status:r.status,data:await r.json()};};
   await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());await page.locator('#t2-select').selectOption(order,{timeout:60000});
   if(process.env.QA_BROWSER_VED_CHAT_ONLY!=='true'){
   const form=page.locator('[data-t2-form="ved_logistic_docs"]');await revealForm(form);await form.waitFor({state:'visible',timeout:60000});await form.locator('select[name="assignedLogin"]').selectOption(loginFor('logistic'));await form.locator('textarea[name="description"]').fill('Synthetic browser request: provide the original packing list.');await form.locator('select[name="types"]').selectOption({label:'Упаковочный лист'});
   const saved=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='request_logistic_docs',{timeout:60000});await form.getByRole('button',{name:'Направить логисту',exact:true}).click();const response=await saved;assert.equal(response.status(),200);const task=(await response.json()).task;assert.ok(task.id);
   const recipient=await api('logistic','/api/pending-tasks');assert.equal(recipient.status,200);assert.ok(recipient.data.items.some(x=>x.id===task.id));const sender=await api('ved','/api/pending-tasks');assert.equal(sender.status,200);assert.ok(!sender.data.items.some(x=>x.id===task.id));rec.addressedRequest={http:200,taskId:task.id,recipientFeedVerified:true,senderFeedExcludesRecipientTask:true};
   }
   await page.locator('.cabinet-sidebar nav a[href="#chats"]').first().evaluate(el=>el.click());const chatPage=page.locator('#lw-ved-chat-page');await chatPage.locator('[data-vc-order="'+order+'"]').click({timeout:60000});const root=chatPage.locator('[data-lw-ved-chat-order="'+order+'"]');const composer=root.locator('[data-vc-send]');await composer.waitFor({state:'visible',timeout:60000});
   await page.waitForFunction(order=>document.querySelector('#lw-ved-chat-page [data-lw-ved-chat-order="'+order+'"]')?.dataset.vedChatId,order);const chatId=await root.getAttribute('data-ved-chat-id');const before=await api('ved','/api/chats?id='+chatId);assert.equal(before.status,200);assert.equal(before.data.messages.length,0,'Uploads and document requests must not create template messages');
   const message='Synthetic browser VED message '+Date.now(),bytes=Buffer.from('Synthetic VED chat attachment '+order+'\n');await composer.locator('textarea[name="body"]').fill(message);await composer.locator('input[name="files"]').setInputFiles({name:'qa-ved-chat.txt',mimeType:'text/plain',buffer:bytes});
   const sent=page.waitForResponse(r=>r.url().includes('/api/chats')&&r.request().method()==='POST'&&(r.request().headers()['content-type']||'').includes('multipart/form-data'),{timeout:60000});await composer.getByRole('button',{name:'Отправить',exact:true}).click();assert.equal((await sent).status(),200);await root.getByText(message,{exact:true}).waitFor({timeout:60000});
   let fileId;for(const id of ['ved','owner',owner.selection.winnerActor]){const r=await api(id,'/api/chats?id='+chatId);assert.equal(r.status,200);assert.equal(r.data.messages.length,1);assert.equal(r.data.messages[0].body,message);assert.equal(r.data.messages[0].files.length,1);fileId=r.data.messages[0].files[0].id;const file=await fetch(base+'/api/chat-files?id='+fileId+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[id]}});assert.equal(file.status,200);assert.deepEqual(Buffer.from(await file.arrayBuffer()),bytes);}
   const loser=owner.selection.winnerActor==='carrierA'?'carrierB':'carrierA';assert.ok([403,404].includes((await api(loser,'/api/chats?id='+chatId)).status));const file=await fetch(base+'/api/chat-files?id='+fileId+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[loser]}});assert.ok([403,404].includes(file.status));rec.sharedChat={http:200,chatId,manualMessages:1,files:1,realRecipients:3,sha256:createHash('sha256').update(bytes).digest('hex'),loserDenied:true,automaticTemplates:0};
  }
  if(process.env.QA_BROWSER_TRACK==='true'&&['carrierA','carrierB'].includes(actor)){
   const owner=JSON.parse(await readFile(evidenceDir+'/browser-results-owner.json','utf8')).roles[0];const order=owner.createdOrder;assert.equal(owner.selection.winnerActor,actor);rec.bidOrder=order;rec.tracking={uiPlanSaves:0};
   const api=async(path,body,id=actor)=>{const r=await fetch(base+path+(path.includes('?')?'&':'?')+'forceFunctionRegion=eu-central-1',{method:body?'POST':'GET',headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[id],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};};
   const details=()=>api('/api/task2?order='+encodeURIComponent(order));const initial=await details();assert.equal(initial.status,200);assert.equal(initial.data.plans.filter(x=>!x.is_baseline).length,0,'Fresh journey fixture required');const baseline=initial.data.state.original_departure;
   await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());await page.locator('#t2-select').selectOption(order,{timeout:60000});
   const submit=async(form,field)=>{const saved=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&(r.request().headers()['content-type']||'').includes('application/json')&&Object.hasOwn(r.request().postDataJSON()?.fields||{},field),{timeout:60000});await form.getByRole('button',{name:'Сохранить',exact:true}).click();assert.equal((await saved).status(),200);await page.waitForFunction(()=>document.querySelector('#task2-root')?.getAttribute('aria-busy')==='false');};
   for(let index=0;index<3;index++){
    const form=page.locator('[data-t2-form="plan"]');await revealForm(form);await form.waitFor({state:'visible'});await form.locator('[name="new_plan_date"]').fill('2026-12-'+String(6+index).padStart(2,'0')+'T12:00');await form.locator('[name="new_plan_reason"]').fill('Synthetic browser reschedule reason '+(index+1));await submit(form,'new_plan_date');await page.locator('#t2-alert').filter({hasText:'Перенос № '+(index+1)+' сохранён'}).waitFor();rec.tracking.uiPlanSaves++;
   }
   const competing=[{action:'save',order,fields:{new_plan_date:'2026-12-09T12:00',new_plan_reason:'Synthetic fourth reschedule race A'}},{action:'save',order,fields:{new_plan_date:'2026-12-10T12:00',new_plan_reason:'Synthetic fourth reschedule race B'}}];
   const race=await Promise.all(competing.map(body=>api('/api/task2',body)));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);rec.tracking.concurrentFourthStatuses=race.map(r=>r.status);const accepted=competing[race.findIndex(r=>r.status===200)];
   const fourth=await details();assert.equal(fourth.data.plans.filter(x=>!x.is_baseline).length,4);assert.equal(fourth.data.plans.filter(x=>x.is_baseline).length,1);assert.equal(fourth.data.state.original_departure,baseline);await page.reload();await page.locator('#t2-select').selectOption(order,{timeout:60000});await page.locator('[data-t2-form="container"]').waitFor();assert.equal(await page.locator('[data-t2-form="plan"]').count(),0);
   const fifth=await api('/api/task2',{action:'save',order,fields:{new_plan_date:'2026-12-10T12:00:00+03:00',new_plan_reason:'Synthetic forbidden fifth reschedule'}});rec.tracking.fifthStatus=fifth.status;rec.tracking.afterFifthCount=(await details()).data.plans.filter(x=>!x.is_baseline).length;assert.equal(fifth.status,409,'Server must reject the fifth date reschedule');assert.equal(rec.tracking.afterFifthCount,4);
   for(let attempt=0;attempt<2;attempt++){const retry=await api('/api/task2',accepted);assert.equal(retry.status,200);assert.equal(retry.data.already,true);}
   const legacyRetry=await api('/api/task2',{action:'new_plan',order,date:accepted.fields.new_plan_date,reason:accepted.fields.new_plan_reason});assert.equal(legacyRetry.status,200);assert.equal(legacyRetry.data.already,true);
   const legacyFifth=await api('/api/task2',{action:'new_plan',order,date:'2026-12-11T12:00',reason:'Synthetic legacy fifth denied'});assert.equal(legacyFifth.status,409);
   const afterRetry=await details();assert.equal(afterRetry.data.plans.filter(x=>!x.is_baseline).length,4);assert.equal(afterRetry.data.events.length,fourth.data.events.length);rec.tracking.retryHistoryAndAuditUnchanged=true;rec.tracking.legacyFifthStatus=legacyFifth.status;
   for(const deniedActor of ['owner','ved',actor==='carrierA'?'carrierB':'carrierA'])assert.equal((await api('/api/task2',accepted,deniedActor)).status,403);
   const minsk=minutes=>new Date(Date.now()-minutes*60000+3*3600000).toISOString().slice(0,16);const actual=minsk(90),locationAt=minsk(60);const actualForm=page.locator('[data-t2-form="actual"]');await actualForm.locator('[name="actual_departure"]').fill(actual);await submit(actualForm,'actual_departure');await page.locator('#t2-alert').filter({hasText:'Фактическая дата отправления сохранена'}).waitFor();
   for(const value of ['QA1234567','QA7654321']){const form=page.locator('[data-t2-form="container"]');await form.locator('[name="container_no"]').fill(value);await submit(form,'container_no');}
   const point='QA-unresolvable-checkpoint-'+Date.now(),weekly=page.locator('[data-t2-form="weekly-point"]');await weekly.locator('[name="location"]').fill(point);await weekly.locator('[name="location_date"]').fill(locationAt);await submit(weekly,'location');
   const saved=await details();assert.equal(saved.status,200);assert.equal(saved.data.state.original_departure,baseline);assert.ok(saved.data.state.actual_departure);for(const value of ['QA1234567','QA7654321'])assert.ok(saved.data.containers.some(x=>x.container_no===value));assert.ok(saved.data.points.some(x=>x.location_text===point&&x.observed_at));
   rec.tracking={...rec.tracking,http:200,baselinePreserved:true,actualDeparture:saved.data.state.actual_departure,containers:2,location:point,locationAt,readbackVerified:true};
  }
  if(process.env.QA_BROWSER_EXECUTION==='true'&&['carrierA','carrierB','ved'].includes(actor)){
   const previous=JSON.parse(await readFile(evidenceDir+'/browser-results-owner.json','utf8'));const owner=previous.roles[0];const order=owner.createdOrder;if(actor!=='ved')assert.equal(owner.selection.winnerActor,actor);rec.bidOrder=order;
   await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());await page.locator('#t2-select').selectOption(order,{timeout:60000});if(actor!=='ved')await page.locator('[data-t2-form="container"]').waitFor({state:'visible',timeout:60000});else await page.getByText('Ставка победителя',{exact:true}).waitFor({state:'visible',timeout:60000});
   const r=await fetch(base+'/api/task2?order='+encodeURIComponent(order)+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[actor]}});assert.equal(r.status,200);assert.equal((await r.json()).state.status,'in_progress');rec.execution={http:200,loadedAcceptedShipment:true};
  }
  if(process.env.QA_BROWSER_ACCEPT==='true'&&['carrierA','carrierB'].includes(actor)){
   const previous=JSON.parse(await readFile(evidenceDir+'/browser-results-owner.json','utf8'));const owner=previous.roles[0];const order=owner.createdOrder;assert.equal(owner.selection.winnerActor,actor);rec.bidOrder=order;
   const roleCheck=async id=>{const r=await fetch(base+'/api/task2?order='+encodeURIComponent(order)+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[id]}});return{status:r.status,data:await r.json()};};
   assert.equal((await roleCheck('ved')).status,403,'VED must wait for carrier acceptance');const loser=actor==='carrierA'?'carrierB':'carrierA';assert.equal((await roleCheck(loser)).status,403,'Losing carrier cannot execute the shipment');
   await page.locator('.cabinet-sidebar nav a[href="#carrier-orders"]').first().evaluate(el=>el.click());
   const winningCard=page.locator('article.carrier-request').filter({hasText:order}).first();await winningCard.waitFor({state:'visible'});assert.doesNotMatch(await winningCard.innerText(),/Приём ставок открыт/,'Winner card must not advertise open bidding');
   const button=page.locator('[data-flow-action="take"][data-flow-order="'+order+'"]');await button.waitFor({timeout:60000});page.once('dialog',d=>d.accept());
   const saved=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='take',{timeout:60000});await button.click();assert.equal((await saved).status(),200);
   const readback=await roleCheck(actor);assert.equal(readback.status,200);assert.equal(readback.data.state.status,'in_progress');assert.equal((await roleCheck('ved')).status,200);assert.equal((await roleCheck(loser)).status,403);
   rec.acceptance={http:200,winner:actor,loserDenied:true,vedDeniedBefore:true,vedAvailableAfter:true,state:'in_progress'};
  }
  if(process.env.QA_BROWSER_SELECT==='true'&&actor==='owner'){
   const previous=JSON.parse(await readFile(evidenceDir+'/browser-results-owner.json','utf8'));const order=previous.roles[0].createdOrder;assert.ok(order);rec.createdOrder=order;
   await page.locator('.cabinet-sidebar nav a[href="#answers"]').first().evaluate(el=>el.click());
   const answers=page.locator('.cabinet-panel[data-section="answers"]');await answers.waitFor({state:'visible'});
   const approval=answers.locator('tbody tr').filter({hasText:order}).getByRole('button',{name:'Согласовать участие',exact:true});
   await answers.locator('tbody tr').filter({hasText:order}).first().waitFor({timeout:60000});
   // Timely eligible bids may already be admitted automatically. Do not invent
   // a mandatory Owner approval step where the actual server does not need one.
   let approvalActions=0;while(await approval.count()){
    assert.ok(approvalActions<2);const saved=page.waitForResponse(r=>r.url().includes('/api/request-status')&&r.request().method()==='POST',{timeout:60000});await approval.first().click();assert.equal((await saved).status(),200);approvalActions++;await page.waitForTimeout(500);
   }
   await page.locator('.cabinet-sidebar nav a[href="#offers"]').first().evaluate(el=>el.click());
   const offers=page.locator('.cabinet-panel[data-section="offers"]');await offers.waitFor({state:'visible'});
   const rows=offers.locator('tbody tr').filter({hasText:order});await rows.first().waitFor({timeout:60000});assert.equal(await rows.count(),2,'Owner must compare both actual carrier bids');
   await rows.first().getByRole('button',{name:'Выбрать этот вариант',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Выбор варианта ставки'});await dialog.locator('textarea').fill('Synthetic QA comparison: confirmed route, price and delivery terms.');
   const saved=page.waitForResponse(r=>r.url().includes('/api/offer-selection')&&r.request().method()==='POST',{timeout:60000});await dialog.getByRole('button',{name:'Подтвердить выбор варианта',exact:true}).click();const selected=await saved;assert.equal(selected.status(),200);const command=selected.request().postDataJSON();
   const readback=await fetch(base+'/api/offer-analysis?forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions.owner}});assert.equal(readback.status,200);const data=await readback.json();const selections=data.selections.filter(x=>x.round_id===command.expected.round_id);assert.equal(selections.length,1);assert.equal(selections[0].bidId,command.bidId);assert.equal(selections[0].reason,command.reason);
   const winnerActor=['carrierA','carrierB'].find(id=>selections[0].bid.submitted_email===loginFor(id));assert.ok(winnerActor);rec.selection={http:200,comparedBids:2,approvalActions,winnerActor,bidId:command.bidId,notificationId:selections[0].notificationId,round:selections[0].round_id,uniqueWinnerReadback:true};
  }
  if(process.env.QA_BROWSER_MANUAL_REVIEW==='true'&&actor==='owner'){
   const order=JSON.parse(await readFile('/tmp/freight-rc20261110-private/manual-ui-state.json','utf8')).order;
   await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());
   await page.locator('#t2-select').selectOption(order,{timeout:60000});
   const form=page.locator('form[data-t2-form="manual_pto_review"]');await form.waitFor({state:'attached',timeout:60000});await form.locator('xpath=..').locator('summary').click();
   await form.locator('[name="reason"]').fill('Synthetic browser: sea route has no supported kilometre provider');
   await form.locator('[name="evidence"]').fill('QA sea checkpoint recorded in shipment history');
   const response=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST',{timeout:60000});await form.getByRole('button',{name:'Запустить единственную проверку ВЭД'}).click();const r=await response;assert.equal(r.status(),200);const result=await r.json();assert.ok(result.taskId);
   rec.manualReview={status:'PASS',order,taskId:result.taskId,realBrowserSubmission:true};
  }
  if(process.env.QA_BROWSER_TENDER==='true'&&actor==='owner'){
   await page.locator('.cabinet-sidebar nav a[href="#tender-hub"]').first().evaluate(el=>el.click());
   const tender=page.locator('.cabinet-panel[data-section="tender-hub"]');await tender.waitFor({state:'visible'});
   let expectedTender;
   if(exactCandidate){
    const apiEvidence=JSON.parse(await readFile('reports/isolated-rc/business-api-real.json','utf8'));
    assert.equal(apiEvidence.runId,process.env.GITHUB_RUN_ID);
    assert.equal(apiEvidence.backendBundle,carrier124.bundle);
    const fixture=apiEvidence.checks.find(c=>c.id==='competitive_tender_step_final_protocol_and_role_guard');
    assert.equal(fixture?.status,'PASS');
    expectedTender=fixture.evidence;
   }
   const buttons=tender.getByRole('button',{name:/Скачать итоговый протокол PDF/});
   const button=expectedTender
     ? buttons.and(tender.locator('article').filter({has:page.getByText(expectedTender.order,{exact:true})}).getByRole('button'))
     : buttons.first();
   await button.waitFor({timeout:60000});
   const downloaded=page.waitForEvent('download',{timeout:60000});
   const protocolResponse=page.waitForResponse(r=>{
    const url=new URL(r.url());
    return url.pathname.endsWith('/api/tenders')&&url.searchParams.has('protocol')&&
      (!expectedTender||url.searchParams.get('protocol')===expectedTender.id);
   },{timeout:60000});
   await button.click();const download=await downloaded;const response=await protocolResponse;
   assert.equal(response.status(),200);const protocol=await response.json();assert.equal(protocol.final,true);
   if(expectedTender)assert.equal(protocol.protocol.tender.order_code,expectedTender.order);
   const path=await download.path();const bytes=await readFile(path);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
   const text=execFileSync('pdftotext',['-layout',path,'-'],{encoding:'utf8'});
   for(const value of [protocol.protocol.tender.protocol,protocol.protocol.tender.order_code,'1480','Synthetic QA price tender'])assert.ok(text.includes(value),'PDF missing '+value);
   rec.tenderPdf={status:'PASS',http:200,final:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),protocolNumber:protocol.protocol.tender.protocol,order:protocol.protocol.tender.order_code,serverValuesVerifiedInPdf:true};
  }
  if(process.env.QA_BROWSER_EXPAND_TASKS==='true'&&actor==='content'){
   const inbox=page.locator('#lw-pending-tasks-all-roles');await inbox.getByText('Business QA assignment 6',{exact:true}).waitFor({timeout:60000});
   assert.equal(await inbox.locator('li').count(),5);assert.equal(await inbox.getByText('Business QA assignment 1',{exact:true}).count(),0);
   const before=report.calls.length;await inbox.getByRole('button',{name:'Показать ещё',exact:true}).click();
   await inbox.getByText('Business QA assignment 1',{exact:true}).waitFor();assert.equal(await inbox.locator('li').count(),7);
   assert.equal(await inbox.getByText('Foreign QA task must stay hidden',{exact:true}).count(),0);
   assert.equal(report.calls.length,before,'Expanding already loaded work must not issue new requests');
   rec.taskExpansion={status:'PASS',initialVisible:5,afterExpand:7,foreignTaskVisible:false,extraRequests:0};
  }
  if(process.env.QA_EXPECT_TASK_FEED==='true'){
   await page.locator('#lw-pending-tasks-all-roles').waitFor({timeout:60000});
   if(['content','purchasing','certification'].includes(actor)){
    await page.getByText('Assigned QA '+actor,{exact:true}).waitFor({timeout:60000});
    assert.equal(await page.getByText('Foreign QA task must stay hidden',{exact:true}).count(),0);
   }
  }
  if(process.env.QA_BROWSER_ALIGNMENT==='true')await alignmentScenarios({page,actor,base,sessions,rec,report,createPublicPage});
  if(process.env.QA_BROWSER_MODE_MATRIX==='true')await(await import('./transport-mode-real-scenarios.mjs')).transportModeScenarios({page,actor,base,sessions,rec,report});
  if(process.env.QA_BROWSER_MATRIX==='true')await cabinetMatrix({page,actor,rec});
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(1200);
   const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,text:document.body.innerText.length,role:document.querySelector('[data-cabinet-role]')?.getAttribute('data-cabinet-role')}));
   assert.ok(layout.text>100,'Blank cabinet');assert.ok(layout.scroll<=viewport.width+4,'Horizontal overflow: '+JSON.stringify(layout));
   const file=evidenceDir+'/'+actor+'-'+phase+'-'+viewport.width+'.png';await page.screenshot({path:file,fullPage:false,animations:"disabled",timeout:60000,mask:phase==='alignment'?[page.locator('#ow-workspace')]:[]});rec.viewports.push({...viewport,...layout,screenshot:file,screenshotSha256:createHash('sha256').update(await readFile(file)).digest('hex')});
  }
  if(loginSmoke){
   const logout=page.waitForResponse(r=>r.url().includes('/api/auth')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='logout');
   await page.getByText(/^(Выйти|Sign out|退出)$/).first().click();
   const signedOut=await logout;
   assert.equal(signedOut.status(),200);
   const login=page.locator('input[name="login"]').first();
   await login.waitFor({state:'visible'});
   await page.reload({waitUntil:'domcontentloaded'});
   await login.waitFor({state:'visible'});
   assert.equal(await page.getByText(/^(Выйти|Sign out|退出)$/).count(),0);
   rec.logout={http:200,requestId:signedOut.headers()['x-freight-request-id'],anonymousAfterReload:true};
  }
  rec.runtimeErrors=consoleErrors.filter(value=>/^(?:[A-Za-z]+Error:|Error:)|Minified React error|The above error occurred/.test(value)).slice(0,5);assert.deepEqual(rec.runtimeErrors,[],'Caught application render error');assert.equal(await page.getByText('Не удалось открыть раздел',{exact:true}).count(),0,'Application error boundary');assert.deepEqual(errors,[]);assert.equal(report.calls.filter(c=>c.actor===actor&&c.error).length,0,'Real API transport failure');rec.status='PASS';console.log('REAL_BROWSER_PASS',actor);
 }catch(e){rec.failureScreenshot=evidenceDir+'/'+actor+'-'+phase+'-failure.png';await page.screenshot({path:rec.failureScreenshot,fullPage:false,animations:"disabled",timeout:60000}).catch(error=>{rec.failureScreenshotError=String(error.message).slice(0,300);});
   await writeFile(evidenceDir+'/'+actor+'-'+phase+'-failure.txt',(await page.locator('body').innerText()).slice(0,20000));
   rec.errorStack=redact(e.stack||'').slice(0,5000);rec.status='FAIL';rec.pageErrors=errors;rec.consoleErrors=consoleErrors.slice(0,20);rec.error=redact(e.message).slice(0,600);console.log('REAL_BROWSER_FAIL',actor,rec.error);if(rec.cabinetMatrixFailures)console.log('QA_MATRIX_FAILURES',JSON.stringify(rec.cabinetMatrixFailures.map(f=>({lang:f.lang,screen:f.screen,width:f.width,error:f.error?.slice(0,120),violations:f.violations?.map(v=>({id:v.id,impact:v.impact,targets:v.nodes?.map(n=>n.target)}))}))));console.log('QA_FAILURE_CONTEXT',JSON.stringify({phase,pageErrors:errors,apiCalls:report.calls.filter(c=>c.actor===actor).slice(-12).map(({path,method,status,error})=>({path,method,status,error}))}));process.exitCode=1;}
 await context.close();
}}finally{await browser.close();await new Promise(done=>server.close(done));if(frozenSource)await rm(frozenSource,{recursive:true,force:true});report.completedAt=new Date().toISOString();const actorName=(process.env.QA_BROWSER_ACTORS||'all').replaceAll(',','-');report.scenario=phase;const bytes=JSON.stringify(report,null,2);if(actorName!=='owner'||['create','select'].includes(phase))await writeFile(evidenceDir+'/browser-results-'+actorName+'.json',bytes);await writeFile(evidenceDir+'/browser-results-'+actorName+'-'+phase+'.json',bytes);}
