import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {readFileSync} from 'node:fs';import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
test('opening a saved scheme waits for its body and ignores an older late response',async t=>{
 const root=resolve('test'),approved=JSON.parse(readFileSync(root+'/business-process-model.json'));
 const a='00000000-0000-4000-8000-000000000041',b='00000000-0000-4000-8000-000000000042';
 const saved=id=>{const model=structuredClone(approved);model.processes[0].nodes[0].title=id===a?'Delayed saved stage':'Current saved stage';return{id,model};};
 const pending=[];const server=createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/api/process-models'){
   const id=u.searchParams.get('id');res.writeHead(200,{'Content-Type':'application/json'});
   if(id){const body=JSON.stringify({revision:saved(id)});if(id===a){res.write(body.slice(0,1));pending.push(()=>res.end(body.slice(1)));}else res.end(body);}
   else res.end(JSON.stringify({approvedModel:approved,approvedHash:'a'.repeat(64),revisions:[a,b].map(id=>({id,status:'draft',model_version:approved.version,created_at:'2026-11-16T00:00:00Z',created_by:'Synthetic Owner'})),nextOffset:null}));return;
  }
  if(u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="ru"><meta charset="utf-8"><link rel="stylesheet" href="/owner-registers-20261111.css"><div class="cabinet-app staff-portal" data-cabinet-role="owner"><section id="ow-workspace"><div id="ow-process-editor"></div></section></div><script type="module" src="/process-editor-20261111.mjs"></script>');return;}
  try{const path=resolve(root,'.'+u.pathname);assert.ok(path.startsWith(root+'/'));const bytes=readFileSync(path);res.writeHead(200,{'Content-Type':extname(path)==='.css'?'text/css':'text/javascript'});res.end(bytes);}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 t.after(async()=>{pending.forEach(f=>f());await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));});
 const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto('http://127.0.0.1:'+server.address().port);
 const host=page.locator('#ow-process-editor'),open=id=>page.locator('[data-revision-id="'+id+'"]').getByRole('button',{name:'Открыть версию',exact:true});
 await open(a).waitFor();const response=page.waitForResponse(r=>new URL(r.url()).searchParams.get('id')===a);await open(a).click();await response;
 assert.equal(await host.getAttribute('aria-busy'),'true');assert.equal(await host.getAttribute('data-loaded-revision'),null);
 pending.shift()();await page.locator('#ow-process-editor[data-loaded-revision="'+a+'"][aria-busy="false"]').waitFor();
 await host.locator('[data-editor-node]').first().click();assert.equal(await host.locator('[name="editor-title"]').inputValue(),'Delayed saved stage');
 const late=page.waitForResponse(r=>new URL(r.url()).searchParams.get('id')===a);await open(a).click();const oldResponse=await late;await open(b).click();
 await page.locator('#ow-process-editor[data-loaded-revision="'+b+'"][aria-busy="false"]').waitFor();await host.locator('[data-editor-node]').first().click();
 pending.shift()();await oldResponse.finished();
 assert.equal(await host.getAttribute('data-loaded-revision'),b);assert.equal(await host.locator('[name="editor-title"]').inputValue(),'Current saved stage');
});
