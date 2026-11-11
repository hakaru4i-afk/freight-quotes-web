// Called only by the authenticated isolated browser harness. No response fixtures.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {writeFile,readFile} from 'node:fs/promises';
const digest=b=>createHash('sha256').update(b).digest('hex');
export async function alignmentScenarios({page,actor,base,sessions,rec,report}){
 const api=async(path,{method='GET',body,as=actor}={})=>{const r=await fetch(base+path+(path.includes('?')?'&':'?')+'forceFunctionRegion=eu-central-1',{method,headers:{Origin:'https://hakaru4i-afk.github.io',...(as?{Authorization:'Bearer '+sessions[as]}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});report.calls.push({actor:as||'anonymous',path,method,status:r.status});return r;};
 const privateState=(process.env.QA_SCENARIO_STATE_DIR||'/tmp/freight-rc20261110-private')+'/sh50-state.json';
 if(actor!=='owner'){
  for(const path of ['/api/engineering-registers?name=updates','/api/partner-inquiries','/api/process-models']){const r=await api(path);assert.equal(r.status,403);assert.ok((await r.text()).length<250);}
  const state=JSON.parse(await readFile(privateState,'utf8'));assert.equal((await api('/api/partner-inquiries/attachments/'+state.attachment)).status,403);
  assert.equal((await api('/api/process-models',{method:'POST',body:{action:'activate'}})).status,403);rec.alignment={privateArchivesDenied:true,cooperationDenied:true,attachmentDenied:true,editorDenied:true};return;
 }
 for(const name of ['updates','remarks','developments']){
  await page.locator('[data-ow-register="'+name+'"]').click();await page.locator('#ow-archive-records .ow-record').first().waitFor({timeout:45000});
  const response=await api('/api/engineering-registers?name='+name);assert.equal(response.status,200);const data=await response.json();assert.equal(digest(Buffer.from(data.markdown)),data.sha256);assert.ok(data.markdown.length>5000);assert.ok(data.entries.length>=4);
  const search=page.locator('#ow-workspace input[type=search]');await search.fill(data.entries[0].id);assert.match(await page.locator('#ow-archive-records').innerText(),new RegExp(data.entries[0].id));await search.fill('');
  assert.equal((await api('/api/engineering-registers?name='+name+'&expectedSha=obsolete')).status,409);
 }
 const nonce=Date.now(),bytes=Buffer.from('QA SH50 private commercial proposal '+nonce+'\n'),company='QA_ONLY_SH50_'+nonce;
 const form=()=>{const f=new FormData();for(const[k,v]of Object.entries({partnerKind:'carrier',company,contactName:'Synthetic QA contact',contactDetails:'qa@example.invalid',message:'Synthetic complete commercial proposal '+nonce,consent:'true',website:''}))f.set(k,v);f.set('attachments',new Blob([bytes],{type:'text/plain'}),'qa-proposal.txt');return f;};
 const posted=await api('/api/partner-inquiries',{method:'POST',body:form(),as:null});assert.equal(posted.status,201);const reference=(await posted.json()).reference;
 const repeated=await api('/api/partner-inquiries',{method:'POST',body:form(),as:null});assert.equal(repeated.status,200);assert.equal((await repeated.json()).already,true);
 await page.locator('[data-ow-register="cooperation"]').click();await page.locator('#ow-cooperation-screen').waitFor();await page.locator('[data-lw-refresh]').click();
 const card=page.locator('[data-inquiry-id]').filter({hasText:company});await card.waitFor({timeout:45000});await card.locator('summary').click();
 await card.locator('[data-inquiry-status]').selectOption('read');const saved=page.waitForResponse(r=>r.url().includes('/api/partner-inquiries')&&r.request().method()==='PATCH');await card.locator('[data-lw-status]').click();assert.equal((await saved).status(),200);
 let list=await(await api('/api/partner-inquiries')).json(),item=list.items.find(i=>i.company_name===company);assert.ok(item);assert.equal(item.status,'read');assert.equal(item.attachments.length,1);assert.equal(item.history.length,1);
 const file=await api('/api/partner-inquiries/attachments/'+item.attachments[0].id);assert.equal(file.status,200);assert.equal(digest(Buffer.from(await file.arrayBuffer())),digest(bytes));
 if(!await card.locator('details').evaluate(el=>el.open))await card.locator('summary').click();const downloaded=page.waitForEvent('download');await card.locator('[data-lw-file]').click();const download=await downloaded;const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);assert.equal(digest(Buffer.concat(chunks)),digest(bytes));
 for(const status of ['in_progress','closed','rejected']){const r=await api('/api/partner-inquiries',{method:'PATCH',body:{id:item.id,status}});assert.equal(r.status,200);}
 const retry=await api('/api/partner-inquiries',{method:'PATCH',body:{id:item.id,status:'rejected'}});assert.equal((await retry.json()).already,true);
 item=(await(await api('/api/partner-inquiries')).json()).items.find(i=>i.id===item.id);assert.equal(item.history.length,4);
 assert.equal((await api('/api/partner-inquiries/attachments/'+item.attachments[0].id,{as:null})).status,403);
 await writeFile(privateState,JSON.stringify({inquiry:item.id,attachment:item.attachments[0].id,reference,sha256:digest(bytes)}),{mode:0o600});
 await page.reload();await page.locator('#ow-cooperation-screen').waitFor();await page.locator('[data-partner-search]').fill(company);assert.equal(await page.locator('[data-inquiry-id]').count(),1);
 await page.locator('[data-ow-register="process"]').click();const svg=page.locator('#ow-process-editor svg');await svg.waitFor();const first=svg.locator('[data-editor-node]').first();await first.waitFor();
 const initial=await(await api('/api/process-models')).json();const approvedHash=initial.approvedHash;const id=await first.getAttribute('data-editor-node');const box=await first.boundingBox();await page.mouse.move(box.x+30,box.y+20);await page.mouse.down();await page.mouse.move(box.x+85,box.y+65,{steps:8});await page.mouse.up();
 await page.locator('[name="editor-title"]').fill('QA stage '+nonce);await page.locator('[name="editor-role"]').selectOption('carrier');await page.locator('[name="editor-assignee"]').fill('Synthetic QA assignee');
 const uiSave=page.waitForResponse(r=>r.url().includes('/api/process-models')&&r.request().method()==='POST');await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();assert.equal((await uiSave).status(),201);
 const firstVersion=(await(await api('/api/process-models')).json()).revisions[0];const firstModel=(await(await api('/api/process-models?id='+firstVersion.id)).json()).revision.model;assert.equal(firstModel.processes.length,10);assert.equal(firstModel.processes[0].nodes.find(n=>n.id===id).title,'QA stage '+nonce);
 await page.reload();await page.getByRole('button',{name:'Открыть версию',exact:true}).first().click();await svg.locator('[data-editor-node="'+id+'"]').click();assert.equal(await page.locator('[name="editor-title"]').inputValue(),'QA stage '+nonce);
 await page.locator('[name="editor-title"]').fill('QA second stage '+nonce);const second=page.waitForResponse(r=>r.url().includes('/api/process-models')&&r.request().method()==='POST');await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();assert.equal((await second).status(),201);
 const rollback=page.waitForResponse(r=>r.url().includes('/api/process-models')&&r.request().method()==='POST');await page.getByRole('button',{name:'Восстановить в новый черновик',exact:true}).nth(1).click();assert.equal((await rollback).status(),201);
 const after=await(await api('/api/process-models')).json();assert.equal(after.approvedHash,approvedHash);const restored=(await(await api('/api/process-models?id='+after.revisions[0].id)).json()).revision;assert.equal(restored.restored_from,firstVersion.id);assert.equal(restored.model.processes[0].nodes.find(n=>n.id===id).title,'QA stage '+nonce);
 assert.equal((await api('/api/process-models',{method:'POST',body:{action:'activate'}})).status,403);
 const exportEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Экспорт draw.io',exact:true}).click();const exported=await exportEvent,xmlChunks=[];for await(const chunk of await exported.createReadStream())xmlChunks.push(chunk);const xml=Buffer.concat(xmlChunks);assert.match(xml.toString(),/portalModel/);for(let n=1;n<=10;n++)assert.ok(xml.includes(Buffer.from('P'+String(n).padStart(2,'0'))));
 await page.locator('input[type=file][accept=".drawio,.xml"]').setInputFiles({name:'qa-roundtrip.drawio',mimeType:'application/xml',buffer:xml});assert.equal(await svg.locator('[data-editor-node]').count(),restored.model.processes[0].nodes.length);
 const finalSave=page.waitForResponse(r=>r.url().includes('/api/process-models')&&r.request().method()==='POST');await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();assert.ok([200,201].includes((await finalSave).status()));
 rec.alignment={archives:3,sourceHashVerified:true,cooperation:{id:item.id,attachments:1,sha256:digest(bytes),statusEvents:4,retriesUnchanged:true},processEditor:{saved:true,reopened:true,restoredAsNewVersion:true,approvedModelUnchanged:true,drawioRoundTrip:true,processes:10},mocks:false};
}
