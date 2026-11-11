/** Real local candidate UI + real isolated Edge API. No mocked server responses.
 * Node transports HTTPS with the environment CA and proxy; Chromium loads local
 * candidate assets. No TLS checks are disabled and no machine trust is changed.
 */
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const metadata=JSON.parse(await readFile('test/build-info.json','utf8')).stabilizationQa20261110;
// An isolated backend candidate can be verified before changing published metadata.
if(process.env.QA_BROWSER_BACKEND_PROOF_FILE){
 const proof=JSON.parse(await readFile(process.env.QA_BROWSER_BACKEND_PROOF_FILE,'utf8'));
 assert.equal(proof.function,'freight-api-qa-rc20261110');assert.ok(Number.isInteger(proof.version)&&proof.version>0);assert.match(proof.bundle,/^[a-f0-9]{64}$/);assert.match(proof.sourceCommit,/^[a-f0-9]{40}$/);
 Object.assign(metadata,{isolatedQaVersion:proof.version,isolatedQaBundleSha256:proof.bundle,isolatedQaSourceCommit:proof.sourceCommit});
}
assert.equal(metadata.isolatedQaFunction,'freight-api-qa-rc20261110');
assert.ok(Number.isInteger(metadata.isolatedQaVersion)&&metadata.isolatedQaVersion>0);
assert.match(metadata.isolatedQaBundleSha256,/^[a-f0-9]{64}$/);
const phase=process.env.QA_BROWSER_CREATE==='true'?'create':process.env.QA_BROWSER_SELECT==='true'?'select':process.env.QA_BROWSER_ACCEPT==='true'?'accept':process.env.QA_BROWSER_LOGISTIC_DOCUMENT==='true'?'logistic-document':process.env.QA_BROWSER_VED_WORK==='true'?'ved-work':process.env.QA_BROWSER_EXECUTION==='true'?'execution':process.env.QA_BROWSER_BID==='true'?'bid-'+(['csv','xlsx'].includes(process.env.QA_BROWSER_IMPORT)?process.env.QA_BROWSER_IMPORT:'manual'):'cabinet-read';
const root=resolve('.'),base='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-rc20261110';
const sessions=JSON.parse(await readFile(process.env.QA_SESSIONS_FILE||'/tmp/freight-rc20261110-private/sessions.json','utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;const file=resolve(root,'.'+(path==='/test/'?'/test/index.html':path));if(!file.startsWith(root+'/test/')){res.writeHead(403).end();return;}try{res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const published=process.env.QA_BROWSER_PUBLISHED==='true';
const origin=published?'https://hakaru4i-afk.github.io':'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});const report={frontendSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),backendFunction:'freight-api-qa-rc20261110',backendVersion:metadata.isolatedQaVersion,backendBundle:metadata.isolatedQaBundleSha256,backendSourceCommit:metadata.isolatedQaSourceCommit||metadata.backendSourceCommit,startedAt:new Date().toISOString(),sourceSite:published?'https://hakaru4i-afk.github.io/freight-quotes-web/test/':origin,servedAssetHashes:{},sourceAssets:{},environment:'isolated-qa-rc20261110',transport:'TLS_VERIFIED_REAL_HTTP',mocks:false,roles:[],calls:[]};
await mkdir('reports/isolated-rc',{recursive:true});
const html=await readFile('test/index.html','utf8');
for(const name of new Set([...html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)].map(m=>m[1]))){report.sourceAssets[name]=createHash('sha256').update(await readFile('test/'+name)).digest('hex');}

try{for(const actor of (process.env.QA_BROWSER_ACTORS||'owner,carrierA,carrierB,ved,logistic,supplier,designer,content,purchasing,certification').split(',')){
 const rec={actor,status:'RUNNING',viewports:[]};report.roles.push(rec);
 const context=await browser.newContext({viewport:{width:1440,height:900}});const errors=[];
 await context.addInitScript(({token})=>{if(window.top===window&&/^https?:$/.test(location.protocol))localStorage.setItem('freight-staging-ibclzdkxiozbzmniiygv-session-persistent-v1',token);},{token:sessions[actor]});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='ooclsrndeygojtofuyte.supabase.co')throw Error('PRODUCTION_REQUEST_BLOCKED');
  const path=url.hostname==='ibclzdkxiozbzmniiygv.supabase.co'?url.pathname.split('/freight-api')[1]:url.pathname.startsWith('/api/')?url.pathname:null;
  if(path){
   if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS','access-control-allow-credentials':'true'}});return;}
   const start=Date.now(),headers={...req.headers(),origin:'https://hakaru4i-afk.github.io'};delete headers.host;delete headers['content-length'];
   let r;try{r=await fetch(base+path+url.search,{method:req.method(),headers,body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),signal:AbortSignal.timeout(60000)});}catch(error){report.calls.push({actor,path,method:req.method(),status:null,durationMs:Date.now()-start,error:'REAL_HTTP_TRANSPORT_FAILED'});await route.abort('timedout');return;}
   const body=Buffer.from(await r.arrayBuffer());report.calls.push({actor,path,method:req.method(),status:r.status,durationMs:Date.now()-start,requestedRegion:url.searchParams.get('forceFunctionRegion'),actualRegion:r.headers.get('x-sb-edge-region')});
   const out=Object.fromEntries(r.headers);delete out['content-encoding'];delete out['content-length'];out['access-control-allow-origin']=origin;out['access-control-allow-credentials']='true';
   await route.fulfill({status:r.status,headers:out,body});return;
  }
  if(published&&url.origin===origin&&url.pathname.startsWith('/freight-quotes-web/test/')){
   const r=await fetch(url.href,{signal:AbortSignal.timeout(60000)});const bytes=Buffer.from(await r.arrayBuffer());
   const name=decodeURIComponent(url.pathname.slice('/freight-quotes-web/test/'.length))||'index.html';
   if(r.ok){const local=resolve(root,'test',name);assert.ok(local.startsWith(root+'/test/'));if(/\.(?:html|js|mjs|css|svg|ttf|png)$/.test(name)||name==='build-info.json')assert.deepEqual(bytes,await readFile(local),'Published asset differs: '+name);report.servedAssetHashes[name]=createHash('sha256').update(bytes).digest('hex');}
   const headers=Object.fromEntries(r.headers);delete headers['content-encoding'];delete headers['content-length'];await route.fulfill({status:r.status,headers,body:bytes});return;
  }
  if(url.origin===origin||['data:','blob:'].includes(url.protocol)){await route.continue();return;}
  await route.abort();
 });
 const page=await context.newPage();const consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){let value=m.text();for(const token of Object.values(sessions))value=value.replaceAll(token,'[REDACTED_SESSION]');consoleErrors.push(value.slice(0,1500));}});
 try{
  await page.goto(origin+(published?'/freight-quotes-web/test/':'/test/'),{waitUntil:'domcontentloaded'});
  await page.getByText(/^(Выйти|Sign out|退出)$/).first().waitFor({timeout:60000});
  rec.dom=await page.evaluate(()=>[...document.querySelectorAll('main,section,[class*=workspace],[class*=cabinet]')].slice(0,35).map(x=>({tag:x.tagName,cls:x.className,section:x.getAttribute('data-section'),role:x.getAttribute('data-cabinet-role')})));
  await writeFile('reports/isolated-rc/'+actor+'-dom.json',JSON.stringify(rec.dom,null,2));
  if(process.env.QA_BROWSER_CREATE==='true'&&actor==='owner'){
   const order='QA-UI-'+Date.now();rec.createdOrder=order;
   const nav=page.locator('.cabinet-sidebar nav a[href="#create-request"]').first();await nav.evaluate(el=>el.click());
   const panel=page.locator('.cabinet-panel[data-section="create-request"]');await panel.waitFor({state:'visible'});
   await panel.locator('input[aria-label="Номер заказа *"]').fill(order);
   const fields=panel.locator('fieldset.request-owner-fields');
   for(const [selector,value] of [['input[placeholder^="Что перевозим"]','Synthetic browser shipment'],['input[placeholder^="Имя, телефон"]','Synthetic QA sender'],['input[placeholder^="Страна, город, адрес склада"]','Brest, Belarus'],['input[placeholder^="Например, 1250"]','1250'],['input[placeholder^="Страна, город, адрес доставки"]','Minsk, Belarus'],['input[placeholder^="Например, 8,4"]','12.5'],['input[placeholder^="Наименование, упаковка"]','Synthetic QA cargo']])await fields.locator(selector).fill(value);
   await fields.locator('select').first().selectOption('EXW');await fields.locator('select').nth(1).selectOption('no');
   await fields.locator('input[type="date"]').fill('2026-12-05');await fields.locator('input[type="datetime-local"]').fill('2026-12-15T12:00');
   const files=panel.locator('input[type="file"]');rec.fileInputs=await files.count();
   const uploaded=page.waitForResponse(r=>r.url().includes('/api/documents')&&r.request().method()==='POST',{timeout:60000});
   await files.last().setInputFiles({name:'qa-browser.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic browser upload\n')});
   const upload=panel.getByRole('button',{name:/Загрузить/}).first();if(await upload.count())await upload.click();
   assert.equal((await uploaded).status(),200,'Real browser file upload failed');
   const publish=panel.getByRole('button',{name:/Опубликовать и уведомить/});
   const saved=page.waitForResponse(r=>r.url().includes('/api/requests')&&r.request().method()==='POST',{timeout:60000});await publish.click({timeout:60000});
   const r=await saved;assert.equal(r.status(),200);const result=await r.json();assert.equal(result.recipients,2);rec.publication={http:200,round:result.round,recipients:2};
  }
  if(process.env.QA_BROWSER_BID==='true'&&['carrierA','carrierB'].includes(actor)){
   const previous=JSON.parse(await readFile('reports/isolated-rc/browser-results-owner.json','utf8'));const order=previous.roles[0].createdOrder;rec.bidOrder=order;
   await page.locator('.cabinet-sidebar nav a[href="#carrier-orders"]').first().evaluate(el=>el.click());
   const card=page.locator('article.carrier-request').filter({hasText:order}).first();await card.waitFor({state:'visible',timeout:60000});
   await card.locator('a[href*="quote"]').first().click();
   const form=page.locator('form').filter({has:page.locator('input[name="carrier"]')});
   await form.waitFor({state:'visible',timeout:120000});
   await form.locator('input[name="carrier"]').fill('Synthetic browser carrier');await form.locator('input[name="contact"]').fill('Synthetic QA contact');
   const v=form.locator('fieldset.quote-variant').first();
   await v.locator('input[aria-label="Общая ставка за партию"]').fill('1550');await v.locator('select[aria-label="Валюта"]').selectOption('USD');
   await v.locator('select[name$=".mode"]').selectOption({label:'Авто'});await v.locator('input[name$=".pickup"]').fill('2026-12-05');await v.locator('input[name$=".days"]').fill('21');
   await v.locator('input[name$=".incotermPlace"]').fill('Brest warehouse');await v.locator('select[name$=".insurance"]').selectOption({label:'Включено'});
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
  }
  if((process.env.QA_BROWSER_LOGISTIC_DOCUMENT==='true'||process.env.QA_BROWSER_LOGISTIC_COMPLETE_ONLY==='true')&&actor==='logistic'){
   const owner=JSON.parse(await readFile('reports/isolated-rc/browser-results-owner.json','utf8')).roles[0];const order=owner.createdOrder;rec.bidOrder=order;
   const api=async(id,path,body)=>{const r=await fetch(base+path+(path.includes('?')?'&':'?')+'forceFunctionRegion=eu-central-1',{method:body?'POST':'GET',headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[id],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};};
   const snapshot=await api('logistic','/api/task2?order='+encodeURIComponent(order));assert.equal(snapshot.status,200);const tasks=snapshot.data.tasks.filter(t=>t.task_type==='ved_request_logistic'&&t.assigned_login==='rc20261110-logistic'&&t.status==='open');assert.equal(tasks.length,1);const task=tasks[0];
   assert.equal((await api('ved','/api/task2',{order,action:'complete_task',taskId:task.id})).status,403,'Sender cannot impersonate the addressed recipient');if(process.env.QA_BROWSER_LOGISTIC_COMPLETE_ONLY!=='true')assert.equal((await api('logistic','/api/task2',{order,action:'complete_task',taskId:task.id})).status,409,'Document handoff cannot finish without a file');
   await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());await page.locator('#t2-select').selectOption(order,{timeout:60000});const form=page.locator('[data-t2-form="upload"]');await form.waitFor({state:'visible',timeout:60000});const bytes=Buffer.from('Synthetic requested packing list '+order+'\n');let doc;if(process.env.QA_BROWSER_LOGISTIC_COMPLETE_ONLY==='true'){doc=task.payload?.files?.[0];assert.ok(doc);}else{await form.locator('select[name="taskId"]').selectOption(task.id);await form.locator('input[name="files"]').setInputFiles({name:'qa-requested-packing.txt',mimeType:'text/plain',buffer:bytes});
   const uploaded=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&(r.request().headers()['content-type']||'').includes('multipart/form-data'),{timeout:60000});await form.getByRole('button',{name:'Загрузить документы',exact:true}).click();const upload=await uploaded;assert.equal(upload.status(),200);doc=(await upload.json()).id;assert.ok(doc);}
   page.once('dialog',d=>d.accept());const completed=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&(r.request().headers()['content-type']||'').includes('application/json')&&r.request().postDataJSON()?.action==='complete_task',{timeout:60000});await page.locator('[data-t2-task-complete="'+task.id+'"]').click();assert.equal((await completed).status(),200);
   const checked=await api('ved','/api/task2?order='+encodeURIComponent(order));assert.equal(checked.status,200);assert.equal(checked.data.tasks.find(t=>t.id===task.id).status,'completed');assert.equal(checked.data.state.pto_checked_at,null,'Addressed document handoff must not complete the separate PTO review');
   const feed=await api('logistic','/api/pending-tasks');assert.ok(!feed.data.items.some(t=>t.id===task.id));const file=await fetch(base+'/api/task2?order='+encodeURIComponent(order)+'&download='+doc+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions.ved}});assert.equal(file.status,200);assert.deepEqual(Buffer.from(await file.arrayBuffer()),bytes);rec.documentHandoff={http:200,taskId:task.id,fileId:doc,sha256:createHash('sha256').update(bytes).digest('hex'),completed:true,wrongActorDenied:true,missingFileDenied:process.env.QA_BROWSER_LOGISTIC_COMPLETE_ONLY!=='true',recipientFeedCleared:true,ptoReviewUnchanged:true};
  }
  if((process.env.QA_BROWSER_VED_WORK==='true'||process.env.QA_BROWSER_VED_CHAT_ONLY==='true')&&actor==='ved'){
   const owner=JSON.parse(await readFile('reports/isolated-rc/browser-results-owner.json','utf8')).roles[0];const order=owner.createdOrder;rec.bidOrder=order;
   const api=async(id,path)=>{const r=await fetch(base+path+(path.includes('?')?'&':'?')+'forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[id]}});return{status:r.status,data:await r.json()};};
   await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());await page.locator('#t2-select').selectOption(order,{timeout:60000});
   if(process.env.QA_BROWSER_VED_CHAT_ONLY!=='true'){
   const form=page.locator('[data-t2-form="ved_logistic_docs"]');await form.waitFor({state:'visible',timeout:60000});await form.locator('select[name="assignedLogin"]').selectOption('rc20261110-logistic');await form.locator('textarea[name="description"]').fill('Synthetic browser request: provide the original packing list.');await form.locator('select[name="types"]').selectOption({label:'Упаковочный лист'});
   const saved=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='request_logistic_docs',{timeout:60000});await form.getByRole('button',{name:'Направить задачу логисту',exact:true}).click();const response=await saved;assert.equal(response.status(),200);const task=(await response.json()).task;assert.ok(task.id);
   const recipient=await api('logistic','/api/pending-tasks');assert.equal(recipient.status,200);assert.ok(recipient.data.items.some(x=>x.id===task.id));const sender=await api('ved','/api/pending-tasks');assert.equal(sender.status,200);assert.ok(!sender.data.items.some(x=>x.id===task.id));rec.addressedRequest={http:200,taskId:task.id,recipientFeedVerified:true,senderFeedExcludesRecipientTask:true};
   }
   await page.locator('.cabinet-sidebar nav a[href="#chats"]').first().evaluate(el=>el.click());const chatPage=page.locator('#lw-ved-chat-page');await chatPage.locator('[data-vc-order="'+order+'"]').click({timeout:60000});const root=chatPage.locator('[data-lw-ved-chat-order="'+order+'"]');const composer=root.locator('[data-vc-send]');await composer.waitFor({state:'visible',timeout:60000});
   await page.waitForFunction(order=>document.querySelector('#lw-ved-chat-page [data-lw-ved-chat-order="'+order+'"]')?.dataset.vedChatId,order);const chatId=await root.getAttribute('data-ved-chat-id');const before=await api('ved','/api/chats?id='+chatId);assert.equal(before.status,200);assert.equal(before.data.messages.length,0,'Uploads and document requests must not create template messages');
   const message='Synthetic browser VED message '+Date.now(),bytes=Buffer.from('Synthetic VED chat attachment '+order+'\n');await composer.locator('textarea[name="body"]').fill(message);await composer.locator('input[name="files"]').setInputFiles({name:'qa-ved-chat.txt',mimeType:'text/plain',buffer:bytes});
   const sent=page.waitForResponse(r=>r.url().includes('/api/chats')&&r.request().method()==='POST'&&(r.request().headers()['content-type']||'').includes('multipart/form-data'),{timeout:60000});await composer.getByRole('button',{name:'Отправить',exact:true}).click();assert.equal((await sent).status(),200);await root.getByText(message,{exact:true}).waitFor({timeout:60000});
   let fileId;for(const id of ['ved','owner',owner.selection.winnerActor]){const r=await api(id,'/api/chats?id='+chatId);assert.equal(r.status,200);assert.equal(r.data.messages.length,1);assert.equal(r.data.messages[0].body,message);assert.equal(r.data.messages[0].files.length,1);fileId=r.data.messages[0].files[0].id;const file=await fetch(base+'/api/chat-files?id='+fileId+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[id]}});assert.equal(file.status,200);assert.deepEqual(Buffer.from(await file.arrayBuffer()),bytes);}
   const loser=owner.selection.winnerActor==='carrierA'?'carrierB':'carrierA';assert.ok([403,404].includes((await api(loser,'/api/chats?id='+chatId)).status));const file=await fetch(base+'/api/chat-files?id='+fileId+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[loser]}});assert.ok([403,404].includes(file.status));rec.sharedChat={http:200,chatId,manualMessages:1,files:1,realRecipients:3,sha256:createHash('sha256').update(bytes).digest('hex'),loserDenied:true,automaticTemplates:0};
  }
  if(process.env.QA_BROWSER_EXECUTION==='true'&&['carrierA','carrierB','ved'].includes(actor)){
   const previous=JSON.parse(await readFile('reports/isolated-rc/browser-results-owner.json','utf8'));const owner=previous.roles[0];const order=owner.createdOrder;if(actor!=='ved')assert.equal(owner.selection.winnerActor,actor);rec.bidOrder=order;
   await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());await page.locator('#t2-select').selectOption(order,{timeout:60000});if(actor!=='ved')await page.locator('[data-t2-form="container"]').waitFor({state:'visible',timeout:60000});else await page.getByText('Ставка победителя',{exact:true}).waitFor({state:'visible',timeout:60000});
   const r=await fetch(base+'/api/task2?order='+encodeURIComponent(order)+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[actor]}});assert.equal(r.status,200);assert.equal((await r.json()).state.status,'in_progress');rec.execution={http:200,loadedAcceptedShipment:true};
  }
  if(process.env.QA_BROWSER_ACCEPT==='true'&&['carrierA','carrierB'].includes(actor)){
   const previous=JSON.parse(await readFile('reports/isolated-rc/browser-results-owner.json','utf8'));const owner=previous.roles[0];const order=owner.createdOrder;assert.equal(owner.selection.winnerActor,actor);rec.bidOrder=order;
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
   const previous=JSON.parse(await readFile('reports/isolated-rc/browser-results-owner.json','utf8'));const order=previous.roles[0].createdOrder;assert.ok(order);rec.createdOrder=order;
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
   const winnerActor=['carrierA','carrierB'].find(id=>selections[0].bid.submitted_email==='rc20261110-'+id.toLowerCase());assert.ok(winnerActor);rec.selection={http:200,comparedBids:2,approvalActions,winnerActor,bidId:command.bidId,notificationId:selections[0].notificationId,round:selections[0].round_id,uniqueWinnerReadback:true};
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
   const button=tender.getByRole('button',{name:/Скачать итоговый протокол PDF/}).first();await button.waitFor({timeout:60000});
   const downloaded=page.waitForEvent('download',{timeout:60000});
   const protocolResponse=page.waitForResponse(r=>r.url().includes('/api/tenders?protocol='),{timeout:60000});
   await button.click();const download=await downloaded;const response=await protocolResponse;
   assert.equal(response.status(),200);const protocol=await response.json();assert.equal(protocol.final,true);
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
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(1200);
   const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,text:document.body.innerText.length,role:document.querySelector('[data-cabinet-role]')?.getAttribute('data-cabinet-role')}));
   assert.ok(layout.text>100,'Blank cabinet');assert.ok(layout.scroll<=viewport.width+4,'Horizontal overflow: '+JSON.stringify(layout));
   const file='reports/isolated-rc/'+actor+'-'+phase+'-'+viewport.width+'.png';await page.screenshot({path:file,fullPage:true});rec.viewports.push({...viewport,...layout,screenshot:file,screenshotSha256:createHash('sha256').update(await readFile(file)).digest('hex')});
  }
  rec.runtimeErrors=consoleErrors.filter(value=>/^(?:[A-Za-z]+Error:|Error:)|Minified React error|The above error occurred/.test(value)).slice(0,5);assert.deepEqual(rec.runtimeErrors,[],'Caught application render error');assert.equal(await page.getByText('Не удалось открыть раздел',{exact:true}).count(),0,'Application error boundary');assert.deepEqual(errors,[]);assert.equal(report.calls.filter(c=>c.actor===actor&&c.error).length,0,'Real API transport failure');rec.status='PASS';console.log('REAL_BROWSER_PASS',actor);
 }catch(e){rec.failureScreenshot='reports/isolated-rc/'+actor+'-'+phase+'-failure.png';await page.screenshot({path:rec.failureScreenshot,fullPage:true});
   await writeFile('reports/isolated-rc/'+actor+'-'+phase+'-failure.txt',(await page.locator('body').innerText()).slice(0,20000));
   rec.status='FAIL';rec.pageErrors=errors;rec.consoleErrors=consoleErrors.slice(0,20);rec.error=e.message.slice(0,600);console.log('REAL_BROWSER_FAIL',actor,rec.error);process.exitCode=1;}
 await context.close();
}}finally{await browser.close();await new Promise(done=>server.close(done));report.completedAt=new Date().toISOString();const actorName=(process.env.QA_BROWSER_ACTORS||'all').replaceAll(',','-');report.scenario=phase;const bytes=JSON.stringify(report,null,2);await writeFile('reports/isolated-rc/browser-results-'+actorName+'.json',bytes);await writeFile('reports/isolated-rc/browser-results-'+actorName+'-'+phase+'.json',bytes);}
