/** Real local candidate UI + real isolated Edge API. No mocked server responses.
 * Node transports HTTPS with the environment CA and proxy; Chromium loads local
 * candidate assets. No TLS checks are disabled and no machine trust is changed.
 */
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('.'),base='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-rc20261110';
const sessions=JSON.parse(await readFile('/tmp/freight-rc20261110-private/sessions.json','utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;const file=resolve(root,'.'+(path==='/test/'?'/test/index.html':path));if(!file.startsWith(root+'/test/')){res.writeHead(403).end();return;}try{res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});const report={environment:'isolated-qa-rc20261110',transport:'TLS_VERIFIED_REAL_HTTP',mocks:false,roles:[],calls:[]};
await mkdir('reports/isolated-rc',{recursive:true});
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
}}finally{await browser.close();await new Promise(done=>server.close(done));await writeFile('reports/isolated-rc/browser-results-'+(process.env.QA_BROWSER_ACTORS||'all').replaceAll(',','-')+'.json',JSON.stringify(report,null,2));}
