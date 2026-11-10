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
assert.equal(metadata.isolatedQaFunction,'freight-api-qa-rc20261110');
assert.ok(Number.isInteger(metadata.isolatedQaVersion)&&metadata.isolatedQaVersion>0);
assert.match(metadata.isolatedQaBundleSha256,/^[a-f0-9]{64}$/);
const root=resolve('.'),base='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-rc20261110';
const sessions=JSON.parse(await readFile('/tmp/freight-rc20261110-private/sessions.json','utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;const file=resolve(root,'.'+(path==='/test/'?'/test/index.html':path));if(!file.startsWith(root+'/test/')){res.writeHead(403).end();return;}try{res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});const report={frontendSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),backendFunction:'freight-api-qa-rc20261110',backendVersion:metadata.isolatedQaVersion,backendBundle:metadata.isolatedQaBundleSha256,backendSourceCommit:metadata.backendSourceCommit,startedAt:new Date().toISOString(),sourceAssets:{},environment:'isolated-qa-rc20261110',transport:'TLS_VERIFIED_REAL_HTTP',mocks:false,roles:[],calls:[]};
await mkdir('reports/isolated-rc',{recursive:true});
const html=await readFile('test/index.html','utf8');
for(const name of new Set([...html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)].map(m=>m[1]))){report.sourceAssets[name]=createHash('sha256').update(await readFile('test/'+name)).digest('hex');}

try{for(const actor of (process.env.QA_BROWSER_ACTORS||'owner,carrierA,carrierB,ved,logistic,supplier,designer,content,purchasing,certification').split(',')){
 const rec={actor,status:'RUNNING',viewports:[]};report.roles.push(rec);
 const context=await browser.newContext({viewport:{width:1440,height:900}});const errors=[];
 await context.addInitScript(({token})=>localStorage.setItem('freight-staging-ibclzdkxiozbzmniiygv-session-persistent-v1',token),{token:sessions[actor]});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='ooclsrndeygojtofuyte.supabase.co')throw Error('PRODUCTION_REQUEST_BLOCKED');
  const path=url.hostname==='ibclzdkxiozbzmniiygv.supabase.co'?url.pathname.split('/freight-api')[1]:url.pathname.startsWith('/api/')?url.pathname:null;
  if(path){
   if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS','access-control-allow-credentials':'true'}});return;}
   const start=Date.now(),headers={...req.headers(),origin:'https://hakaru4i-afk.github.io'};delete headers.host;delete headers['content-length'];
   const r=await fetch(base+path+url.search,{method:req.method(),headers,body:['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer(),signal:AbortSignal.timeout(60000)});
   const body=Buffer.from(await r.arrayBuffer());report.calls.push({actor,path,method:req.method(),status:r.status,durationMs:Date.now()-start});
   const out=Object.fromEntries(r.headers);delete out['content-encoding'];delete out['content-length'];out['access-control-allow-origin']=origin;out['access-control-allow-credentials']='true';
   await route.fulfill({status:r.status,headers:out,body});return;
  }
  if(url.origin===origin||['data:','blob:'].includes(url.protocol)){await route.continue();return;}
  await route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(origin+'/test/',{waitUntil:'domcontentloaded'});
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
   const file='reports/isolated-rc/'+actor+'-'+viewport.width+'.png';await page.screenshot({path:file,fullPage:true});rec.viewports.push({...viewport,...layout,screenshot:file});
  }
  assert.deepEqual(errors,[]);rec.status='PASS';console.log('REAL_BROWSER_PASS',actor);
 }catch(e){await page.screenshot({path:'reports/isolated-rc/'+actor+'-failure.png',fullPage:true});
   await writeFile('reports/isolated-rc/'+actor+'-failure.txt',(await page.locator('body').innerText()).slice(0,20000));
   rec.status='FAIL';rec.error=e.message.slice(0,600);console.log('REAL_BROWSER_FAIL',actor,rec.error);process.exitCode=1;}
 await context.close();
}}finally{await browser.close();await new Promise(done=>server.close(done));report.completedAt=new Date().toISOString();await writeFile('reports/isolated-rc/browser-results-'+(process.env.QA_BROWSER_ACTORS||'all').replaceAll(',','-')+'.json',JSON.stringify(report,null,2));}
