import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createRemainingClient, deadlineMinsk, verifyServiceBoundaries} from './carrier124-remaining-api.mjs';

const fixtures = {
  auto:'QA-CI-77529DD8-DASHBOARD124-FDC91FC4',
  container:'QA-CI-18E8AAF6-MULTI-95CAED84',
  claim:'QA-CI-18E8AAF6-AIR-289CC1EF',
  carrierA:'QA-N26-SEC-A1',
  carrierB:'QA-N26-SEC-B1'
};
export async function openCabinet(page, section) {
  await page.locator('.cabinet-sidebar nav a[href="#'+section+'"]').first().evaluate(a=>a.click());
  await page.locator('.cabinet-panel[data-section="'+section+'"]').waitFor({state:'visible',timeout:20000});
}
export async function openShipment(page, order) {
  await openCabinet(page,'approved-shipments');
  await page.locator('#t2-select').selectOption(order,{timeout:20000});
  await page.waitForFunction(order=>document.querySelector('#t2-select')?.value===order
    &&!!document.querySelector('#task2-root global-route-view')&&document.querySelector('#task2-root')?.getAttribute('aria-busy')==='false',order,{timeout:20000});
}
export function browserCommand(page,action,path='/api/task2') {
  return page.waitForResponse(r=>new URL(r.url()).pathname.endsWith(path)&&r.request().method()==='POST'
    &&r.request().postDataJSON()?.action===action,{timeout:30000});
}
export async function reveal(form) {
  const summary=form.locator('xpath=ancestor::details[1]/summary');
  await form.waitFor({state:'attached',timeout:12000});
  if(await summary.count()&&await form.isHidden())await summary.click();
  await form.waitFor({state:'visible',timeout:12000});
}
export async function remainingWorkflow({page,actor,sessions,rec,report,evidenceDir,phase}) {
  const api=await createRemainingClient(sessions,report.calls);
  const read=(who,order)=>api(who,'/api/task2',{order}).then(r=>r.json);
  if(['decline','timely','late-start','late-blocked','late-decisions','offer-edit','comparison'].includes(phase)){
    await (await import('./carrier124-remaining-offers.mjs')).remainingOffers({page,actor,sessions,rec,report,phase},openCabinet,browserCommand);
  }
  if(['locales','modes','menus','weekly'].includes(phase)){
    await (await import('./carrier124-remaining-display.mjs')).remainingDisplay({page,actor,sessions,rec,report,evidenceDir,phase},openCabinet);
  }
  if(phase==='documents'){
    await (await import('./carrier124-remaining-documents.mjs')).remainingDocuments({page,actor,sessions,rec,report},openCabinet);
  }
  if(phase==='security'){
    const proof=actor==='carrierA'||actor==='carrierB'?'security-verify.json':'security-supplier.json';
    const security=JSON.parse(await readFile(join(evidenceDir,proof),'utf8'));
    if(actor==='carrierA'||actor==='carrierB'){
      const other=actor==='carrierA'?'carrierB':'carrierA';
      await openCabinet(page,'carrier-orders');
      const list=page.locator('.carrier-request-list');
      await list.waitFor();
      await list.getByText(fixtures[actor],{exact:true}).first().waitFor({timeout:12000});
      assert.equal(await list.getByText(fixtures[other],{exact:true}).count(),0);
      rec.remaining={ownListed:fixtures[actor],foreignNotListed:fixtures[other]};
    }else{
      const supplierProof=security.checks.find(x=>x.id==='T2-02');
      assert.equal(supplierProof.status,'PASS');
      const own=supplierProof.supplierFixtures[actor==='supplier'?0:1];
      const foreign=supplierProof.supplierFixtures[actor==='supplier'?1:0];
      const target=page.getByText(own.order,{exact:true}).first();
      await target.waitFor({timeout:12000});
      assert.equal(await page.getByText(foreign.order,{exact:true}).count(),0);
      rec.remaining={ownListed:own.order,foreignNotListed:foreign.order};
    }
  }
  if(phase==='sl'){
    const ui=[];
    const scores=await verifyServiceBoundaries(api,async(value)=>{
      const loaded=page.waitForResponse(r=>r.url().includes('/api/session')&&r.request().method()==='GET',{timeout:20000});
      await page.reload({waitUntil:'domcontentloaded'});
      assert.equal((await (await loaded).json()).carrierPolicy.score,value);
      if(value<=50){
        await page.evaluate(()=>{location.hash='#overview';});
        await page.getByRole('heading',{name:'Участие приостановлено'}).waitFor({timeout:12000});
        assert.equal(await page.locator('.cabinet-panel[data-section="carrier-orders"]').count(),0);
      }else{
        await openCabinet(page,'carrier-orders');
        await page.locator('.carrier-request-list').getByText(fixtures.carrierB,{exact:true}).first().waitFor({timeout:12000});
      }
      ui.push({value,blockedBanner:value<=50,requestListVisible:value>50});
    },process.env.QA_SL_RETRY_BLOCKED==='true'?[50]:undefined);
    rec.remaining={scores,ui,restored:true};
  }
  if(phase==='road'){
    const order=process.env.QA_AUTO_CONFIRMED_POINTS==='true'?'QA-N26-ROAD-POINTS':fixtures.auto;
    const location=process.env.QA_AUTO_CONFIRMED_POINTS==='true'?'Китай, Шэньчжэнь, порт Яньтянь':'Минск, Беларусь';
    const before=await read('carrierA',order);
    assert.equal(before.tasks.filter(t=>t.task_type==='pto_review').length,0);
    await openShipment(page,order);
    const form=page.locator('[data-t2-form="weekly-point"]').first();
    await reveal(form);
    await form.locator('[name="location"]').fill(location);
    await form.locator('[name="location_date"]').fill(deadlineMinsk(Date.now()-60000));
    const post=browserCommand(page,'save');
    await form.getByRole('button',{name:'Сохранить',exact:true}).click();
    assert.equal((await post).status(),200);
    const snapshot=await read('carrierA',order);
    const point=snapshot.points.find(p=>p.location_text===location);
    assert.ok(point,'Control point missing');
    rec.remaining={recorded:true,routeStatus:point.route_calculation_status,remainingKm:point.remaining_km};
    assert.equal(point.route_calculation_status,'verified','Actual distance provider unavailable');
    assert.ok(point.remaining_km!==null&&Number(point.remaining_km)<1000);
    const ved=await read('ved',order);
    const review=ved.tasks.filter(t=>t.task_type==='pto_review'&&t.status==='open');
    assert.equal(review.length,1);
    await api('carrierA','/api/task2',{}, {order,action:'save',fields:{location:point.location_text,location_date:point.observed_at}});
    assert.equal((await read('ved',order)).tasks.filter(t=>t.id===review[0].id).length,1);
    rec.remaining={...rec.remaining,taskId:review[0].id};
  }
  if(phase.startsWith('container-')){
    const order=fixtures.container;
    await openShipment(page,order);
    const before=await read(actor,order);
    if(actor==='owner'){
      assert.equal(before.canClose,true);
      assert.equal(before.containers.length,0);
      const finish=page.locator('[data-t2-action="finish"]');
      const wait=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'
        &&r.request().postDataJSON()?.answer==='yes',{timeout:30000});
      page.once('dialog',dialog=>dialog.accept());
      await finish.click();
      assert.equal((await wait).status(),200);
      const after=await read('owner',order);
      assert.equal(after.state.status,'waiting_container');
      const task=after.tasks.find(t=>t.task_type==='container_number'&&t.status==='open');
      assert.ok(task);
      assert.equal(task.assigned_login,'carrier124nov18-carriera');
      await api('owner','/api/task2',{}, {order,action:'finish',answer:'yes'});
      assert.equal((await read('owner',order)).tasks.filter(t=>t.task_type==='container_number').length,1);
      rec.remaining={taskId:task.id,waiting:true,deduplicated:true};
    }else{
      assert.equal(before.state.status,'waiting_container');
      const feed=await api('carrierA','/api/pending-tasks');
      const task=feed.json.items.find(t=>t.order_code===order&&t.task_type==='container_number');
      assert.ok(task,'Assigned carrier must see the pending container request');
      await openCabinet(page,'overview');
      const pending=page.locator('#lw-pending-tasks-all-roles');
      const taskText=pending.getByText(task.description,{exact:false}).first();
      await pending.locator('li').first().waitFor({timeout:16000});
      const more=pending.getByRole('button',{name:'Показать ещё',exact:true});
      while(await more.isVisible()&&!(await taskText.isVisible()))await more.click();
      await taskText.waitFor({timeout:16000});
      await openShipment(page,order);
      const form=page.locator('[data-t2-form="container"]');
      await reveal(form);
      await form.locator('[name="container_no"]').fill('QA-N26-CONT-001');
      const wait=page.waitForResponse(r=>r.url().includes('/api/task2')&&r.request().method()==='POST'
        &&r.request().postDataJSON()?.fields?.container_no==='QA-N26-CONT-001',{timeout:30000});
      await form.getByRole('button',{name:'Сохранить',exact:true}).click();
      assert.equal((await wait).status(),200);
      const after=await read('owner',order);
      assert.equal(after.state.status,'completed');
      assert.equal(after.containers.filter(c=>c.container_no==='QA-N26-CONT-001').length,1);
      assert.equal(after.tasks.find(t=>t.task_type==='container_number').status,'completed');
      rec.remaining={completed:true,taskCompleted:true};
    }
  }
  if(phase.startsWith('claim-')){
    const order=fixtures.claim;
    await openShipment(page,order);
    const before=await read(actor,order);
    if(phase==='claim-open'){
      const form=page.locator('[data-t2-form="claim_open"]');
      await form.locator('[name="note"]').fill('Synthetic damage dispute at warehouse for testing');
      let wait=browserCommand(page,'claim_open');
      await form.locator('button[type="submit"]').click();
      assert.equal((await wait).status(),200);
      const doc=(await read('owner',order)).docs[0];
      assert.ok(doc,'Need a real fixture document');
      const send=page.locator('[data-t2-form="claim_send"]');
      await send.locator('[name="proofId"]').selectOption(doc.id);
      wait=browserCommand(page,'claim_send');
      await send.locator('button[type="submit"]').click();
      assert.equal((await wait).status(),200);
      rec.remaining={sent:true,documentId:doc.id};
    }else if(phase==='claim-dispute'){
      assert.equal(before.claim.state,'sent');
      const form=page.locator('[data-t2-form="claim_command"]');
      await form.locator('[name="action"]').selectOption('claim_dispute');
      await form.locator('[name="note"]').fill('Synthetic carrier dispute evidence regarding freight damage');
      await form.locator('[name="proofId"]').selectOption(before.docs[0].id);
      const wait=browserCommand(page,'claim_dispute');
      await form.locator('button[type="submit"]').click();
      assert.equal((await wait).status(),200);
      assert.equal((await read('owner',order)).claim.state,'disputed');
      rec.remaining={disputed:true,previousRevision:before.claim.revision};
    }
  }
}
