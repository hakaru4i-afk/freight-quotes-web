// Full existing app + deterministic API responses. UI regression, not hosted E2E.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const stages=['new','viewed','preparing','review','selected','execution'];
const filters=['all','requires_response','declined','lost','completed','archive'];
const root=resolve('test');
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');const p=resolve('.'+(url.pathname==='/test/'?'/test/index.html':url.pathname));
 if(!p.startsWith(root+'/')){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(p));
}catch{res.writeHead(404);res.end();}});
test('Carrier #124: actual app cards/list parity, translations, first open/reload and explicit load errors',{timeout:120000},async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:900}});let fail=false,reads=0,posts=0;
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const notes=[...stages,'declined','lost','completed','archive'].map((stage,i)=>({id:'note-'+stage,order_code:'QA-'+stage,round_id:'round-'+stage,recipient:'carrier-a',created:'2026-11-18T00:00:00Z',deadline:'2099-12-01T12:00',is_current:stage==='archive'?0:1,read_at:stage==='new'?null:'2026-11-18',workflow_status:stage==='preparing'?'accepted':'new',dashboard_stage:stage,summary:'Synthetic '+stage,origin:'Original '+stage+' 00017 中文',destination:'Minsk',cargo:'00017',bitrix_task:'QA-'+i,round_result:stage==='lost'?'lost':stage==='declined'?'declined':null}));
   const dashboard=()=>{const items=notes.map(n=>({id:n.id,order_code:n.order_code,round_id:n.round_id,stage:n.dashboard_stage,filters:['all',...['new','viewed','preparing'].includes(n.dashboard_stage)?['requires_response']:[],...['declined','lost','completed'].includes(n.dashboard_stage)?[n.dashboard_stage,'archive']:n.dashboard_stage==='archive'?['archive']:[]]}));return {version:1,scope:'assigned_requests',items,counts:Object.fromEntries([...stages,...filters].map(k=>[k,items.filter(n=>n.stage===k||n.filters.includes(k)).length]))};};
   await page.route('https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname.split('/freight-api')[1]||'';
    const respond=(status,payload)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(payload),headers:{'Access-Control-Allow-Origin':'*'}});
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}});
    if(path==='/api/session')return respond(200,{role:'carrier'});
    if(path==='/api/carrier'){
     if(req.method()==='POST'){posts++;const n=notes.find(n=>n.id===req.postDataJSON().id);if(!n)return respond(404,{error:'Not found'});n.read_at||='2026-11-18T12:00:00Z';if(n.dashboard_stage==='new')n.dashboard_stage='viewed';return respond(200,{ok:true});}
     reads++;return respond(fail?503:200,fail?{error:'Synthetic unavailable'}:{policy:{score:100},bids:[],notifications:notes,dashboard:dashboard(),token:'synthetic'});
    }
    if(path==='/api/access')return respond(200,{access:{owner:false,permissions:['workspace.read','requests.read','shipments.read','chats.read','tenders.read','documents.read']},users:[],roles:[],profiles:[],roleProfiles:[]});
    if(path==='/api/task2')return respond(200,{role:'carrier',pendingProjection:true,limited:false,items:[]});
    if(path==='/api/late-bid-drafts')return respond(200,{role:'carrier',items:[],assigned:[],archive:[]});
    if(path==='/api/test-cabinets')return respond(200,{environment:'staging',presets:[],users:[]});
    return respond(200,{ok:true,role:'carrier',items:[],files:[],tasks:[],users:[],rows:[],rounds:[],responses:[],events:[],unread:0});
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/test/#overview',{waitUntil:'networkidle'});
   const overview=page.locator('[data-carrier-dashboard]');await overview.waitFor();
   await page.waitForFunction(()=>document.querySelector('[data-carrier-stage=new] strong')?.textContent==='1');
   assert.equal(await page.locator('[data-carrier-stage]').count(),6);
   assert.equal(await page.locator('#lw2-dashboard .lw2-kpi').count(),0,'legacy four-card overlay must not duplicate six approved cards');
   for(const [lang,label] of [['ru','Новые'],['en','New'],['zh','新申请']]){
    await page.locator('.language-bar button[lang="'+(lang==='zh'?'zh-CN':lang)+'"]').first().click();
    await page.waitForFunction(label=>document.querySelector('[data-carrier-stage=new] span')?.textContent===label,label);
    const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+2,JSON.stringify(size));
    await mkdir('reports/carrier124',{recursive:true});await overview.screenshot({path:`reports/carrier124/cards-${width}-${lang}.png`});
   }
   for(const key of [...stages,...filters]){
    await page.evaluate(()=>{location.hash='#overview'});
    const button=page.locator(`[data-carrier-${stages.includes(key)?'stage':'filter'}="${key}"]`);
    await button.click();await page.waitForFunction(()=>location.hash==='#carrier-orders');
    try{await page.waitForFunction(count=>document.querySelectorAll('.carrier-request-list .carrier-request').length===count,dashboard().counts[key],{timeout:5000});}
    catch(error){throw Error(JSON.stringify({key,errors,state:await page.evaluate(()=>({hash:location.hash,html:document.querySelector('#carrier-orders')?.innerHTML,body:document.body.innerText.slice(-3200)}))}).slice(0,6500));}
    assert.equal(await page.locator('.carrier-request-list .carrier-request').count(),dashboard().counts[key],key+' exact list parity');
   }
   await page.evaluate(()=>{location.hash='#overview'});await page.locator('[data-carrier-stage=new]').click();
   assert.equal(await page.locator('.carrier-request-list .carrier-request .map-link').getAttribute('aria-pressed'),'false','A preview must not pretend that an unopened request is already open');
   await page.locator('.carrier-request-list .carrier-request .map-link').click();
   await page.waitForFunction(()=>document.querySelector('[data-carrier-stage=new] strong')?.textContent==='0');
   assert.equal(posts,1,'nested button and row bubbling must not send opening twice');
   assert.ok((await page.locator('.logistics-panel').getAttribute('aria-label')).includes('QA-new'),'Opened request stays selected when server moves it out of the New filter');
   assert.equal(JSON.parse(await page.locator('.logistics-panel global-route-view').getAttribute('data-route'))[0].origin,'Original new 00017 中文','The map receives the original data of the explicitly opened request');
   await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>{location.hash='#overview'});
   await page.waitForFunction(()=>document.querySelector('[data-carrier-stage=new] strong')?.textContent==='0');
   assert.equal(await page.locator('[data-carrier-stage=viewed] strong').textContent(),'2');
   // A failure must remain visible; neither stale numbers nor fabricated zeroes.
   fail=true;await page.reload({waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.querySelector('[data-carrier-dashboard] [role=alert]'));
   assert.equal(await page.locator('[data-carrier-stage=new]').isDisabled(),true);
   assert.equal(await page.locator('[data-carrier-stage=new] strong').textContent(),'…');
   fail=false;await page.locator('[data-carrier-dashboard] button.btn').click();
   await page.waitForFunction(()=>document.querySelector('[data-carrier-stage=new] strong')?.textContent==='0');
   assert.ok(reads>=3);assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
