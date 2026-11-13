import assert from'node:assert/strict';
export async function ownerRegistersScenario({page,actor,base,sessions,rec,report,evidenceDir}){
 assert.equal(actor,'owner');
 const api=async(path,body,as='owner')=>{const r=await fetch(base+path+(path.includes('?')?'&':'?')+'forceFunctionRegion=eu-central-1',{method:body?'POST':'GET',headers:{Origin:'https://hakaru4i-afk.github.io',Authorization:'Bearer '+sessions[as],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});return{status:r.status,data:await r.json()};};
 for(const id of ['updates','remarks','developments','cooperation']){await page.locator('[data-ow-register="'+id+'"]').click();await page.locator('#ow-workspace').waitFor();await page.waitForFunction(id=>document.querySelector('#ow-workspace')?.dataset.archiveName===id,id);assert.ok(await page.locator('#ow-workspace h2').innerText());if(id!=='cooperation'){await page.locator('#ow-workspace .ow-work-card').first().waitFor();assert.equal(await page.locator('#ow-workspace > pre').count(),0);}await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4));await page.screenshot({path:evidenceDir+'/owner-register-'+id+'-390.png',fullPage:true});await page.setViewportSize({width:1440,height:900});}
 for(const as of ['carrierA','carrierB','ved','logistic','supplier'])assert.equal((await api('/api/engineering-registers?name=updates',null,as)).status,403);
 const stale=await api('/api/engineering-registers?name=updates&expectedSha='+'0'.repeat(64));assert.equal(stale.status,409);
 const second=await page.context().newPage();try{
  await second.goto(page.url(),{waitUntil:'domcontentloaded'});await second.getByText(/^(Выйти|Sign out|退出)$/).first().waitFor({timeout:60000});
  for(const p of [page,second]){await p.locator('[data-ow-register="updates"]').click();await p.locator('[data-record-id="QA-20261114"]').waitFor({timeout:60000});}
  const marker='[ARCHIVE:updates:QA-20261114]';let before=(await api('/api/portal-feedback')).data.items.filter(x=>x.description.includes(marker));
  if(!before.length)await Promise.all([page,second].map(p=>p.locator('[data-record-id="QA-20261114"]').getByRole('button',{name:'Взять в работу',exact:true}).click()));
  let tasks;for(let i=0;i<30;i++){tasks=(await api('/api/portal-feedback')).data.items.filter(x=>x.description.includes(marker));if(tasks.length===1&&tasks[0].status==='in_progress')break;await page.waitForTimeout(500);}
  assert.equal(tasks.length,1,'Two Owner tabs must create exactly one work item');assert.equal(tasks[0].status,'in_progress');
  for(const p of [page,second]){await p.reload();await p.locator('[data-ow-register="updates"]').waitFor({timeout:60000});await p.locator('[data-ow-register="updates"]').click();await p.locator('[data-record-id="QA-20261114"] .ow-human-status[data-state="working"]').waitFor({timeout:60000});}
  const response=await api('/api/portal-feedback'),events=response.data.events.filter(e=>e.request_id===tasks[0].id);assert.equal(events.filter(e=>e.action==='submitted').length,1);assert.equal(events.filter(e=>e.action==='started').length,1);
  assert.equal((await api('/api/portal-feedback',{action:'set_status',id:tasks[0].id,expectedStatus:'sent',status:'read'})).status,409);
  for(const as of ['carrierA','ved','logistic'])assert.equal((await api('/api/portal-feedback',{action:'set_status',id:tasks[0].id,expectedStatus:'in_progress',status:'release',releaseDate:'2026-11-14'},as)).status,403);
  rec.ownerRegisters={result:'PASS',fourScreens:true,mobile:true,foreignRolesDenied:true,staleVersionDenied:true,oneTaskAcrossTwoTabs:true,reloadPreserved:true,oneSubmittedAudit:true,oneStartedAudit:true,taskId:tasks[0].id};
 }finally{await second.close();}
}
