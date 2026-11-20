// Authenticated real HTTP and real portal UI. Synthetic fixtures stay in isolated QA.
import assert from'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';import{createHash,randomUUID}from'node:crypto';
import {carrier124Base} from './carrier124-isolated-target.mjs';
async function revealForm(form){await form.waitFor({state:'attached',timeout:60000});const summary=form.locator('xpath=ancestor::details[1]/summary');if(await summary.count()&&await form.isHidden())await summary.click();}
export async function nov14Scenario({page,actor,base,sessions,rec,report,evidenceDir}){
 const carrier124=process.env.QA_CARRIER124_CANDIDATE==='true';
 assert.equal(base,carrier124?carrier124Base:'https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api-qa-rc20261110');
 const source=JSON.parse(await readFile(evidenceDir+'/browser-results-owner.json','utf8')).roles[0];
 const ordinary=process.env.QA_NOV14_ORDINARY==='true';
 const order=source.createdOrder,winner=source.selection.winnerActor,loser=winner==='carrierA'?'carrierB':'carrierA';assert.match(order,carrier124?/^(?:QA-UI-[0-9]+|QA-NOV14-[A-Z0-9-]+|QA-CI-[0-9A-F]+-SEA-[0-9A-F]+|QA-C124-REV-[0-9]+-[0-9]+)$/:/^QA-NOV14-/);
 const recent=minutes=>new Date(Date.now()-minutes*60000).toISOString();
 rec.createdOrder=order;rec.selection=source.selection;
 const api=async(who,path,body)=>{const r=await fetch(base+path+(path.includes('?')?'&':'?')+'forceFunctionRegion=eu-central-1',{method:body?'POST':'GET',...(carrier124?{redirect:'error'}:{}),headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[who],...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});report.calls.push({actor:who,path,method:body?'POST':'GET',status:r.status,requestId:r.headers.get('x-freight-request-id')});return{status:r.status,data:await r.json()};};
 const detail=async(who=actor)=>{const r=await api(who,'/api/task2?order='+order);assert.equal(r.status,200);return r.data;};
 const command=(who,body)=>api(who,'/api/task2',{order,...body});
 const nav=async()=>{await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());await page.locator('#t2-select').selectOption(order,{timeout:60000});await page.waitForFunction(order=>document.querySelector('#t2-select')?.value===order&&!!document.querySelector('#task2-root global-route-view'),order);await page.waitForFunction(()=>document.querySelector('#task2-root')?.getAttribute('aria-busy')!=='true');};
 const post=async(run,predicate)=>{const saved=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&predicate(r.request()),{timeout:60000}).catch(waitError=>({waitError}));await run();const r=await saved;if(r.waitError)throw r.waitError;assert.equal(r.status(),200);await page.waitForFunction(()=>document.querySelector('#task2-root')?.getAttribute('aria-busy')==='false');return r;};
 await nav();const phase=process.env.QA_NOV14_PHASE;rec.nov14={phase,order};
 if(phase==='carrier'){
  assert.equal(actor,winner);let d=await detail();assert.equal(d.state.actual_departure,null);
  assert.equal((await page.locator('.t2-weekly-row').count()),10,'65 days require ten weekly rows');
  assert.match(await page.locator('#task2-root').innerText(),/План трекинга — ожидается фактическое отправление/);
  const form=page.locator('[data-t2-form="actual"]');await form.locator('[name="actual_departure"]').fill('2099-12-09T10:00');const denied=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'&&r.request().postDataJSON()?.fields?.actual_departure);await form.getByRole('button',{name:'Сохранить',exact:true}).click();assert.equal((await denied).status(),400);assert.equal((await detail()).state.actual_departure,null);
  for(let i=1;i<=4;i++){const body={action:'new_plan',date:'2026-12-'+String(10+i).padStart(2,'0'),reason:'Synthetic documented railway reschedule '+i};assert.equal((await command(winner,body)).status,200);assert.equal((await command(winner,body)).data.already,true);}
  d=await detail();assert.equal(d.plans.filter(p=>!p.is_baseline).length,4);assert.equal((await command(winner,{action:'new_plan',date:'2026-12-20',reason:'Fifth railway reschedule must be refused'})).status,409);
  await page.locator('[data-t2-refresh]').click();await page.waitForFunction(()=>document.querySelector('#task2-root')?.dataset.refreshing==='false');assert.equal(await page.locator('.t2-plan-four-row.is-saved').count(),4);const actual=page.locator('[data-t2-form="actual"]');await actual.locator('[name="actual_departure"]').fill('2026-11-02T06:00');await post(()=>actual.getByRole('button',{name:'Сохранить',exact:true}).click(),r=>!!r.postDataJSON()?.fields?.actual_departure);
  for(const[location,at]of [['Китай, Пекин, станция Beijing Railway Station','2026-11-06T06:00'],['Россия, Забайкальск, станция Забайкальск','2026-11-13T06:00']]){const f=page.locator('[data-t2-form="weekly-point"]').first();await f.locator('[name="location"]').fill(location);await f.locator('[name="location_date"]').fill(at);const saved=await post(()=>f.getByRole('button',{name:'Сохранить',exact:true}).click(),r=>r.postDataJSON()?.fields?.location===location);const ids=(await detail()).points.map(p=>p.id);assert.equal((await api(actor,'/api/task2',saved.request().postDataJSON())).status,200);assert.deepEqual((await detail()).points.map(p=>p.id),ids);}
  d=await detail();assert.equal(d.points.length,2);
  // Keep the original strict gate; expose only allowlisted status/precision and
  // coordinate presence so failures are diagnosable without leaking locations.
  const checkpointProblems=d.points.map(p=>p.geocode||{}).filter(g=>g.status!=='resolved'||g.precision!=='facility'||!Number.isFinite(g.lat)||!Number.isFinite(g.lon));
  if(checkpointProblems.length)console.error('NOV14_MAP50_CHECKPOINT_SAFE_SUMMARY '+JSON.stringify(checkpointProblems.map(g=>({
   status:['resolved','ambiguous','unavailable','not_found','pending','error'].includes(g.status)?g.status:'other',
   precision:['facility','approximate','city','object','exact'].includes(g.precision)?g.precision:'other',
   hasFiniteCoordinates:Number.isFinite(g.lat)&&Number.isFinite(g.lon)
  }))));
  assert.ok(d.points.every(p=>p.geocode?.precision==='facility'&&p.geocode?.status==='resolved'&&Number.isFinite(p.geocode.lat)&&Number.isFinite(p.geocode.lon)));
  if(carrier124){
   const stations=[
    {text:'Китай, Пекин, станция Beijing Railway Station',id:'osm:node:269996666',revision:'2026-02-03T13:57:55Z'},
    {text:'Россия, Забайкальск, станция Забайкальск',id:'osm:node:3965162822',revision:'2026-11-08T03:17:14Z'},
   ];
   rec.nov14.stationReadback=stations.map(({text,id,revision})=>{
    const checkpoint=d.points.find(p=>p.location_text===text);
    assert.ok(checkpoint,'Saved station checkpoint must be returned verbatim');
    const geo=checkpoint.geocode;
    assert.equal(geo.candidateId,id);
    assert.equal(geo.sourceRevision,revision);
    assert.equal(geo.source,'OpenStreetMap');
    assert.equal(geo.provider,'local-gazetteer');
    assert.equal(geo.confirmed,true);
    assert.equal(Number(checkpoint.latitude),geo.lat);
    assert.equal(Number(checkpoint.longitude),geo.lon);
    return {id:geo.candidateId,revision:geo.sourceRevision,precision:geo.precision,confirmed:geo.confirmed};
   });
  }
  const map=page.locator('global-route-view').first();for(const size of[{width:1440,height:900},{width:390,height:844}]){await page.setViewportSize(size);for(const mode of ['3d','2d']){await map.getByRole('button',{name:mode==='3d'?'3D-глобус':'2D-карта',exact:true}).click();await page.waitForFunction(mode=>document.querySelector('global-route-view')?.dataset.mode===mode,mode);const snap=await map.evaluate(e=>e.routeSnapshot);assert.equal(snap.stops.length,5,'Owner origin, Incoterms, carrier departure, border station and destination must remain distinct');assert.ok(snap.stops.every(p=>p.position));assert.equal(snap.markers.filter(p=>p.tracking).length,2);assert.equal(snap.markers.find(p=>p.current).pointId,d.points[1].id);assert.ok((await map.innerText()).includes('ЖД')||snap.mode==='rail');const file=evidenceDir+'/rail-'+mode+'-'+size.width+'.png';await map.screenshot({path:file});(rec.nov14.screenshots??=[]).push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});}assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4));}
  const ids=d.points.map(p=>p.id);let mutations=0;const count=r=>{if(r.url().includes('/api/task2')&&r.method()==='POST')mutations++;};page.on('request',count);await page.reload();await nav();assert.deepEqual((await detail()).points.map(p=>p.id),ids);assert.equal(mutations,0);page.off('request',count);assert.equal(await page.locator('.t2-map').count(),0);assert.equal(await page.locator('#task2-root .lw-ved-chat-mount').count(),0);
  for(const who of[loser,'supplier','logistic'])assert.ok([403,404].includes((await api(who,'/api/task2?order='+order)).status));
  assert.equal((await command(winner,{action:'customs',date:carrier124?recent(20):'2026-11-13T09:00:00+03:00'})).status,409);assert.equal((await command('owner',{action:'finish',answer:'no'})).status,409);
  rec.nov14={...rec.nov14,futureRejected:true,fourReschedules:true,weeklyRows:10,routeStops:5,stationPoints:2,reloadPreserved:true,mutationsAfterReload:0};
 }
 if(phase==='start-review'){
  assert.equal(actor,'owner');const f=page.locator('[data-t2-form="manual_pto_review"]');await f.locator('..').locator('summary').click();await f.locator('[name="reason"]').fill('Synthetic rail route: no approved remaining railway-distance provider');await f.locator('[name="evidence"]').fill('QA rail shipment mode and documented unsupported railway-distance calculation');const r=await post(()=>f.getByRole('button',{name:'Запустить единственную проверку ВЭД',exact:true}).click(),r=>r.postDataJSON()?.action==='manual_pto_review');const body=r.request().postDataJSON();assert.equal((await api('owner','/api/task2',body)).data.already,true);const d=await detail();assert.equal(d.tasks.filter(t=>t.task_type==='pto_review').length,1);assert.equal(d.state.pto_checked_at,null);rec.nov14.reviewTask=d.tasks.find(t=>t.task_type==='pto_review').id;
 }
 if(phase==='remarks'||phase==='approve'){
  assert.equal(actor,'ved');let d=await detail();const t=d.tasks.find(t=>t.task_type==='pto_review');assert.ok(t);const f=page.locator('[data-t2-form="pto-review"]').filter({has:page.locator('input[value="'+t.id+'"]')});
  for(const who of[winner,loser,'logistic','supplier'])assert.equal((await command(who,{action:'complete_task',taskId:t.id,reviewDecision:'approve',packageComplete:true})).status,403);
  await revealForm(f);
  if(phase==='remarks'){
   const remarks='Synthetic VED review: replace the incomplete signed packing list.';await f.locator('[name="remarks"]').fill(remarks);const r=await post(()=>f.getByRole('button',{name:'Направить замечания в чат заявки',exact:true}).click(),r=>r.postDataJSON()?.reviewDecision==='remarks');assert.equal((await api('ved','/api/task2',r.request().postDataJSON())).data.already,true);
   await page.reload();await nav();const again=page.locator('[data-t2-form="pto-review"]');await revealForm(again);await again.locator('[name="remarks"]').fill(remarks);await post(()=>again.getByRole('button',{name:'Направить замечания в чат заявки',exact:true}).click(),r=>r.postDataJSON()?.reviewDecision==='remarks');d=await detail();assert.equal(d.state.pto_checked_at,null);assert.equal(d.tasks.find(x=>x.id===t.id).status,'in_progress');
   for(const who of['owner',winner,'ved']){const chats=await api(who,'/api/chats');const chat=chats.data.chats.find(c=>c.order_code===order);assert.ok(chat);const messages=(await api(who,'/api/chats?id='+chat.id)).data.messages;assert.equal(messages.filter(m=>m.body===remarks).length,1);}
   assert.equal((await command(winner,{action:'customs',date:carrier124?recent(20):'2026-11-13T09:00:00+03:00'})).status,409);rec.nov14.remarksDeliveredToThreeRoles=true;rec.nov14.sameOpenTask=t.id;rec.nov14.replayAndReloadDeduplicated=true;
  }else{
   await f.locator('[name="packageComplete"]').check();await post(()=>f.getByRole('button',{name:'Подтвердить комплект документов',exact:true}).click(),r=>r.postDataJSON()?.reviewDecision==='approve');d=await detail();assert.ok(d.state.pto_checked_at);assert.equal(d.tasks.find(x=>x.id===t.id).status,'completed');assert.equal(d.tasks.filter(x=>x.task_type==='pto_review').length,1);rec.nov14.approvedTask=t.id;
  }
 }
 if(phase==='correct-documents'){
  assert.equal(actor,winner);const bytes=Buffer.from('Synthetic corrected signed packing list for '+order),f=page.locator('[data-t2-form="upload"]');await revealForm(f);await f.locator('input[type="file"]').setInputFiles({name:'nov14-corrected-packing-list.txt',mimeType:'text/plain',buffer:bytes});const saved=await post(()=>f.locator('button[type="submit"]').click(),r=>(r.headers()['content-type']||'').includes('multipart/form-data'));const d=await detail(),doc=d.docs.find(x=>x.name==='nov14-corrected-packing-list.txt');assert.ok(doc);for(const who of['owner',winner,'ved']){const r=await fetch(base+'/api/task2?order='+order+'&download='+doc.id+'&forceFunctionRegion=eu-central-1',{headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[who]}});assert.equal(r.status,200);assert.equal(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),createHash('sha256').update(bytes).digest('hex'));}rec.nov14.correctedDocument=doc.id;
 }
 if(phase==='legacy-correction'){
  assert.equal(actor,winner);let d=await detail();assert.equal(d.state.actual_departure,null);assert.ok(d.state.untrusted_actual_departure.startsWith('2099-12-09'));assert.equal((await command(winner,{action:'actual_departure',date:'2026-11-02T06:00:00+03:00'})).status,400);assert.equal((await command('owner',{action:'actual_departure',date:'2026-11-02T06:00:00+03:00',reason:'Synthetic correction attempt by unauthorized actor'})).status,403);
  const f=page.locator('[data-t2-form="actual"]');await f.locator('[name="actual_departure"]').fill('2026-11-02T06:00');await f.locator('[name="actual_departure_reason"]').fill('Synthetic QA014: restoring the documented real departure after isolated legacy fixture');await post(()=>f.getByRole('button',{name:'Сохранить',exact:true}).click(),r=>!!r.postDataJSON()?.fields?.actual_departure);d=await detail();assert.equal(d.state.actual_departure,'2026-11-02T03:00:00.000Z');const audit=d.events.find(e=>e.action==='actual_departure'&&e.detail?.correction);assert.ok(audit);assert.ok(audit.detail.previous.startsWith('2099-12-09'));assert.ok(audit.detail.reason.includes('QA014'));assert.equal(d.points.length,2);assert.equal(d.plans.filter(p=>!p.is_baseline).length,4);rec.nov14={...rec.nov14,legacyIgnored:true,reasonRequired:true,ownerDenied:true,historyPreserved:true,correctionAudited:true};
 }
 if(phase==='stages'){
  assert.equal(actor,winner);const fields={pto_yes:true,pto_date:'2026-11-13T08:00:00+03:00',customs_date:carrier124?recent(20):'2026-11-13T09:00:00+03:00',warehouse_date:'2026-11-13T10:00:00+03:00',...(ordinary?{}:{container_no:'QAAX1234567'})};assert.equal((await command(winner,{action:'save',fields})).status,200);await page.reload();await nav();const d=await detail();assert.ok(d.state.pto_at&&d.state.customs_at&&d.state.warehouse_at);if(ordinary)assert.equal(d.containers.length,0);else if(carrier124)assert.ok(d.containers.some(c=>c.container_no==='QAAX1234567'));else assert.equal(d.containers[0]?.container_no,'QAAX1234567');rec.nov14.stagesSaved=true;
 }
 if(phase==='final-cost'||phase==='revise-cost'){
  assert.equal(actor,winner);let d=await detail();
  const amount=phase==='final-cost'?'8100.50':'8200.50',beforeRevision=Number(d.state.final_cost_revision||0);
  if(phase==='final-cost')assert.equal((await command('owner',{action:'finish',answer:'no'})).status,409,'Physical milestones alone cannot approve a final amount');
  else assert.ok(d.state.final_cost_confirmed_at,'Revision case requires an earlier Owner confirmation');
  const f=page.locator('[data-t2-form="final_cost_submit"]');await f.locator('[name="amount"]').fill(amount);const sent=await post(()=>f.getByRole('button',{name:'Отправить итоговую сумму владельцу',exact:true}).click(),r=>r.postDataJSON()?.action==='final_cost_submit');
  const body=sent.request().postDataJSON();assert.equal((await api(winner,'/api/task2',body)).data.already,true);d=await detail();assert.equal(Number(d.state.final_cost_amount),Number(amount));assert.equal(d.state.final_cost_revision,beforeRevision+1);assert.equal(d.state.final_cost_confirmed_at,null);assert.equal((await command('owner',{action:'finish',answer:'no'})).status,409);
  rec.nov14.finalCostSubmitted={amount,currency:d.state.final_cost_currency,revision:d.state.final_cost_revision,retryIdempotent:true,previousApprovalInvalidated:true,unconfirmedClosureDenied:true};
 }
 if(phase==='approve-cost'||phase==='approve-cost-revision'){
  assert.equal(actor,'owner');let d=await detail();const body={action:'final_cost_confirm',amount:d.state.final_cost_amount,currency:d.state.final_cost_currency,expectedRevision:d.state.final_cost_revision};
  assert.equal((await command('ved',body)).status,403);assert.equal((await command('owner',{...body,expectedRevision:0})).status,409);
  const f=page.locator('[data-t2-form="final_cost_confirm"]');await post(()=>f.getByRole('button',{name:'Подтвердить итоговую сумму',exact:true}).click(),r=>r.postDataJSON()?.action==='final_cost_confirm');
  const eventCount=(await detail()).events.filter(e=>e.action==='final_cost_confirmed').length;assert.equal((await command('owner',body)).data.already,true);d=await detail();assert.ok(d.state.final_cost_confirmed_at);assert.equal(d.events.filter(e=>e.action==='final_cost_confirmed').length,eventCount);assert.equal(d.canClose,true);rec.nov14.finalCostApproved={amount:d.state.final_cost_amount,currency:d.state.final_cost_currency,revision:d.state.final_cost_revision,ownerOnly:true,staleApprovalDenied:true,retryIdempotent:true};
 }
 if(phase==='claim-open'){
  assert.equal(actor,'owner');assert.equal((await command(winner,{action:'claim_open',note:'Synthetic warehouse discrepancy for the approved claim workflow'})).status,403);
  const f=page.locator('[data-t2-form="claim_open"]');await f.locator('[name="note"]').fill('Synthetic warehouse discrepancy for the approved claim workflow');await post(()=>f.locator('button[type="submit"]').click(),r=>r.postDataJSON()?.action==='claim_open');let d=await detail();assert.equal(d.claim.state,'draft');assert.equal(d.canClose,false);const evidence=d.docs.find(x=>x.id);assert.ok(evidence);const send=page.locator('[data-t2-form="claim_send"]');await send.locator('[name="proofId"]').selectOption(evidence.id);await post(()=>send.locator('button[type="submit"]').click(),r=>r.postDataJSON()?.action==='claim_send');d=await detail();assert.equal(d.claim.state,'sent');assert.equal((await command('owner',{action:'claim_close'})).status,409);assert.equal(d.acts.length,0);rec.nov14.noticeSentWithoutFormalAct=true;
 }
 if(phase==='claim-propose'){
  assert.equal(actor,winner);let f=page.locator('[data-t2-form="claim_command"]');await f.locator('[name="note"]').fill('Synthetic acceptance of the recorded warehouse discrepancy');await post(()=>f.locator('button[type="submit"]').click(),r=>r.postDataJSON()?.action==='claim_accept');f=page.locator('[data-t2-form="claim_command"]');await f.locator('[name="method"]').selectOption('compensation');await f.locator('[name="deadline"]').fill('2099-12-01');await f.locator('[name="note"]').fill('Synthetic compensation proposal for Owner review');await post(()=>f.locator('button[type="submit"]').click(),r=>r.postDataJSON()?.action==='claim_propose');assert.equal((await detail()).claim.data.settlementStatus,'proposed');rec.nov14.carrierProposed=true;
 }
 if(phase==='claim-approve'){
  assert.equal(actor,'owner');const f=page.locator('[data-t2-form="claim_command"]');await f.locator('[name="note"]').fill('Synthetic Owner approval of the exact compensation proposal');await post(()=>f.locator('button[type="submit"]').click(),r=>r.postDataJSON()?.action==='claim_approve');assert.equal((await detail()).claim.data.settlementStatus,'approved');rec.nov14.exactProposalApproved=true;
 }
 if(phase==='claim-fulfill'){
  assert.equal(actor,winner);const bytes=Buffer.from('Synthetic Carrier fulfilment evidence for '+order);const f=page.locator('[data-t2-form="upload"]');await revealForm(f);await f.locator('input[type="file"]').setInputFiles({name:'claim-fulfilment.txt',mimeType:'text/plain',buffer:bytes});await post(()=>f.locator('button[type="submit"]').click(),r=>(r.headers()['content-type']||'').includes('multipart/form-data'));let d=await detail();const file=d.docs.find(x=>x.name==='claim-fulfilment.txt');assert.ok(file);const form=page.locator('[data-t2-form="claim_command"]');await form.locator('[name="proofId"]').selectOption(file.id);await form.locator('[name="note"]').fill('Synthetic Carrier confirmation of the approved compensation');await post(()=>form.locator('button[type="submit"]').click(),r=>r.postDataJSON()?.action==='claim_fulfill');d=await detail();assert.equal(d.claim.data.settlementStatus,'execution_review');assert.equal(d.canClose,false);rec.nov14.freshOwnProofSubmitted=true;
 }
 if(phase==='claim-resolve'){
  assert.equal(actor,'owner');let d=await detail();const f=page.locator('[data-t2-form="claim_command"]');await f.locator('[name="proofId"]').selectOption(d.claim.data.fulfillment.proofId);await f.locator('[name="note"]').fill('Synthetic Owner verification of the Carrier fulfilment evidence');await post(()=>f.locator('button[type="submit"]').click(),r=>r.postDataJSON()?.action==='claim_resolve');d=await detail();assert.equal(d.claim.state,'settled');assert.equal(d.state.status,'claim');assert.equal(d.canClose,true);assert.equal(d.acts.length,0);rec.nov14.claimSettledWithoutAutomaticShipmentCompletion=true;
 }
 if(phase==='finish'){
  assert.equal(actor,'owner');const d=await detail();assert.equal(d.canClose,true);if(d.hasClaim){await post(()=>page.locator('[data-t2-form="claim_close"] button[type="submit"]').click(),r=>r.postDataJSON()?.action==='claim_close');}else {
   assert.equal(d.hasClaim,false);assert.equal(d.containers.length,0);
   assert.equal((await command(winner,{action:'finish',answer:'no'})).status,403);
   const before=(await detail()).events.length;let questionSeen=false;
   page.once('dialog',async dialog=>{assert.match(dialog.message(),/Номер контейнера не указан/);questionSeen=true;await dialog.dismiss();});
   await post(()=>page.locator('[data-t2-action="finish"]').click(),r=>r.postDataJSON()?.action==='finish'&&r.postDataJSON()?.answer==='no');
   assert.equal(questionSeen,true);const closed=await detail();assert.equal(closed.state.status,'completed');
   const count=closed.events.length;assert.ok(count>before);assert.equal((await command('owner',{action:'finish',answer:'no'})).status,409);assert.equal((await detail()).events.length,count);
   assert.equal(closed.acts.length,0);assert.equal(closed.containers.length,0);rec.nov14.ordinaryCompletion={noClaim:true,noContainer:true,explicitOwnerDecision:true,carrierDenied:true,replayIdempotent:true,noFormalAct:true};
  }assert.equal((await detail()).state.status,'completed');await page.reload();await page.locator('.cabinet-sidebar nav a[href="#approved-shipments"]').first().evaluate(el=>el.click());await page.locator('[data-t2-filter="archive"]').click();await page.locator('#t2-select').selectOption(order);assert.equal((await detail()).state.status,'completed');const summary=await api('owner','/api/shipments');assert.equal(summary.status,200);const projected=summary.data.items.find(x=>x.order_code===order);assert.equal(projected?.cargo_status,'completed');assert.ok(projected.actual_departure);rec.nov14.completedAndArchived=true;rec.nov14.dashboardAgrees=true;
 }
 rec.nov14.result='PASS';await writeFile(evidenceDir+'/nov14-'+actor+'-'+phase+'.json',JSON.stringify(rec.nov14,null,2)+'\n');
}
