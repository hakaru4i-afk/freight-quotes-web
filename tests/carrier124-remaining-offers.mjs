import assert from 'node:assert/strict';
import {createRemainingClient} from './carrier124-remaining-api.mjs';

const order='QA-N26-BID-1';
const late='QA-N26-LATE-1';
const decline='QA-N26-DECLINE-1';

export async function remainingOffers({page,actor,sessions,rec,report,phase},openCabinet,browserCommand) {
  const api=await createRemainingClient(sessions,report.calls);
  if(phase==='decline'){
    await openCabinet(page,'carrier-orders');
    const card=page.locator('article.carrier-request').filter({hasText:decline}).first();
    await card.getByRole('button',{name:'Не участвую',exact:true}).click({timeout:12000});
    const send=card.getByRole('button',{name:'Подтвердить отказ',exact:true});
    assert.equal(await send.isDisabled(),true);
    const reason='Synthetic QA carrier cannot transport this cargo';
    await card.getByRole('textbox',{name:'Почему не участвуете? *'}).fill(reason);
    const response=browserCommand(page,'decline','/api/decline');
    await send.click();
    assert.equal((await response).status(),200);
    const after=(await api(actor,'/api/carrier')).json;
    assert.equal(after.notifications.find(n=>n.order_code===decline).decline_reason,reason);
    await card.getByText(reason,{exact:false}).first().waitFor({timeout:12000});
    rec.remaining={declineReasonRequired:true,reasonStored:true};
  }else if(phase==='timely'||phase==='late-start'){
    await openCabinet(page,'carrier-orders');
    const result=(await api(actor,'/api/requests',{order:late})).json;
    assert.equal(result.closed,phase==='late-start');
    const deadline=Date.parse(result.request.deadline+'+03:00');
    const link=page.locator('#late-bid-controls-carrier').getByRole('button',{name:'Подать позднюю ставку по заявке '+late});
    if(phase==='timely'){
      assert.equal(await link.count(),0);
      const card=page.locator('article.carrier-request').filter({hasText:late}).first();
      await card.getByText(/Ставки принимаются до/).first().waitFor({timeout:15000});
      const date=new Date(deadline).toLocaleTimeString('ru-RU',{timeZone:'Europe/Minsk',hour:'2-digit',minute:'2-digit'});
      assert.match(await card.innerText(),new RegExp(date));
      rec.remaining={deadline,open:true,displayedMinsk:date};
    }else{
      await link.click({timeout:15000});
      const start=page.locator('[data-late-action="start"]');
      await start.waitFor({timeout:15000});
      const posted=browserCommand(page,'start','/api/late-bid-drafts');
      await start.click();
      assert.equal((await posted).status(),200);
      await page.locator('[data-late-action="cancel"]').waitFor({timeout:15000});
      const drafts=(await api('owner','/api/late-bid-drafts')).json.items.filter(d=>d.order_code===late&&d.status==='active');
      assert.equal(drafts.length,1);
      rec.remaining={deadline,closed:true,activeDraft:true};
    }
  }else if(phase==='late-blocked'){
    await openCabinet(page,'offers');
    const panel=page.locator('.cabinet-panel[data-section="offers"]');
    await panel.locator('#late-bid-controls-owner').getByText(late,{exact:true}).waitFor({timeout:20000});
    const block=panel.locator('tbody tr').filter({hasText:late}).getByRole('button',{name:'Выбрать этот вариант',exact:true});
    await block.waitFor({timeout:15000});
    assert.equal(await block.isDisabled(),true);
    rec.remaining={winnerControlDisabled:true,order:late};
  }else if(phase==='late-decisions'){
    await openCabinet(page,'offers');
    const panel=page.locator('.cabinet-panel[data-section="offers"]');
    const rows=panel.locator('tbody tr').filter({hasText:late});
    const lateBid=rows.filter({hasText:'Ответ с просрочкой'});
    await lateBid.first().waitFor({timeout:20000});
    assert.equal(await lateBid.count(),1);
    for(const [decision,label] of [['accepted','Учитывать'],['rejected','Не учитывать']]){
      const wait=page.waitForResponse(r=>r.url().includes('/api/review')&&r.request().method()==='POST'
        &&r.request().postDataJSON()?.decision===decision,{timeout:22000});
      await lateBid.getByRole('button',{name:label,exact:true}).click({timeout:12000});
      assert.equal((await wait).status(),200);
      const list=(await api('owner','/api/data')).json.bids.filter(b=>b.order_code===late&&Number(b.late)===1);
      assert.equal(list.length,1);
      assert.equal(list[0].decision,decision);
    }
    const active=(await api('owner','/api/late-bid-drafts')).json.items.some(t=>t.order_code===late&&t.status==='active');
    assert.equal(active,false);
    const winnerButtons=rows.getByRole('button',{name:'Выбрать этот вариант',exact:true});
    assert.ok(await winnerButtons.count()>0);
    await winnerButtons.first().waitFor({timeout:15000});
    assert.equal(await winnerButtons.first().isEnabled(),true);
    rec.remaining={lateReceived:true,reviews:['accepted','rejected'],unblocked:true};
  }else if(phase==='comparison'){
    await openCabinet(page,'offers');
    const panel=page.locator('.cabinet-panel[data-section="offers"]');
    const before=(await api('owner','/api/data')).json.bids.filter(x=>x.order_code===order);
    assert.equal(before.length,2);
    const weights=await panel.locator('.offer-methodology-table tbody td:nth-child(2)').allTextContents();
    assert.deepEqual(weights.map(s=>Number.parseInt(s,10)),[25,20,10,15,15,10,5]);
    const grid=panel.locator('tbody tr').filter({hasText:order});
    await grid.first().waitFor({timeout:15000});
    assert.equal(await grid.count(),2);
    assert.equal(await grid.getByText('Лучшая цена',{exact:true}).count(),0);
    const compareOffer=grid.filter({hasText:'Synthetic Carrier B comparator'});
    await compareOffer.getByRole('button',{name:'Изменить ставку',exact:true}).click({timeout:16000});
    const edit=page.getByRole('dialog',{name:'Изменение ставки по заказу '+order});
    await edit.locator('[name="currency"]').selectOption('EUR');
    const wait=page.waitForResponse(r=>r.url().includes('/api/bids')&&r.request().method()==='PATCH',{timeout:18000});
    await edit.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
    assert.equal((await wait).status(),200);
    await edit.waitFor({state:'detached'});
    await page.waitForFunction(order=>{
      const rows=[...document.querySelectorAll('.cabinet-panel[data-section="offers"] tbody tr')].filter(r=>r.textContent.includes(order));
      return rows.length===2&&rows.every(r=>r.textContent.includes('EUR'));
    },order,{timeout:16000});
    const values=await grid.allTextContents();
    assert.equal(values.length,2);
    assert.ok(values.every(t=>t.includes('EUR')&&t.includes('/ 100')));
    const latest=(await api('owner','/api/offer-analysis')).json;
    assert.ok(!latest.selections.some(x=>x.round_id===before[0].round_id));
    rec.remaining={criteria:weights,rows:values.map(t=>t.slice(0,570)),differentCurrenciesSeparate:true,ownerWinnerExclusive:true};
  }else if(phase==='offer-edit'){
    await openCabinet(page,'offers');
    const rows=page.locator('.cabinet-panel[data-section="offers"] tbody tr').filter({hasText:order});
    await rows.first().waitFor({timeout:20000});
    const before=(await api('owner','/api/data')).json.bids.filter(b=>b.order_code===order);
    assert.equal(before.length,2);
    const selected=rows.filter({hasText:'Synthetic browser carrier'}).first();
    await selected.getByRole('button',{name:'Изменить ставку',exact:true}).click({timeout:15000});
    const edit=page.getByRole('dialog',{name:'Изменение ставки по заказу '+order});
    await edit.locator('[name="amount"]').fill('1811.25');
    await edit.locator('[name="currency"]').selectOption('EUR');
    const wait=page.waitForResponse(r=>r.url().includes('/api/bids')&&r.request().method()==='PATCH',{timeout:22000});
    await edit.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
    assert.equal((await wait).status(),200);
    const after=(await api('owner','/api/data')).json.bids.filter(b=>b.order_code===order);
    assert.equal(after.length,2);
    const changed=after.find(b=>b.currency==='EUR');
    assert.equal(Number(changed.amount),1811.25);
    const original=before.find(b=>b.id===changed.id);
    for(const key of ['round_id','order_code','created','submitted_email'])assert.equal(changed[key],original[key]);
    rec.remaining={currency:'EUR',amount:Number(changed.amount),unchanged:['round_id','order_code','created','submitted_email']};
  }
}
