import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRemainingClient, deadlineMinsk, sha256} from './carrier124-remaining-api.mjs';

const order=process.env.QA_CARRIER124_DOCUMENT_ORDER||'QA-N26-DOCS-1';
assert.match(order,/^QA-N26-[A-Z0-9-]+$/);
const prefix='Synthetic continuation';
const logistics={sender_contact:prefix+' contact',origin:'Brest, Belarus',destination:'Minsk, Belarus',cargo:prefix+' cargo',weight:'1250',
  volume:'12.5',ready_date:'2099-12-01',incoterm:'EXW',dangerous_goods:'no'};
const pair={a:'qa-n26-alpha.txt',b:'qa-n26-beta.txt'};
const bytes=name=>Buffer.from(prefix+' '+name+'\n');
const place='QA named delivery gate';
const supplierNumber='QA-SUP-00017-中文';

export async function remainingDocuments({page,actor,sessions,rec,report}, openCabinet) {
  const api=await createRemainingClient(sessions,report.calls);
  if(actor==='owner') {
    const visit=async()=>{
      await openCabinet(page,'create-request');
      const panel=page.locator('.cabinet-panel[data-section="create-request"]');
      await panel.getByRole('textbox',{name:'Номер заказа *',exact:true}).fill(order);
      return panel;
    };
    let panel=await visit();
    const fields=panel.locator('fieldset.request-owner-fields');
    const existing=await api('owner','/api/requests',{order},undefined,[200,404]);
    let published;
    if(existing.status===404){
    const values=[
      ['input[placeholder^="Что перевозим"]',prefix+' summary'],['input[placeholder^="Имя, телефон"]',logistics.sender_contact],
      ['input[placeholder^="Страна, город, адрес склада"]',logistics.origin],['input[placeholder^="Например, 1250"]',logistics.weight],
      ['input[placeholder^="Страна, город, адрес доставки"]',logistics.destination],['input[placeholder^="Например, 8,4"]',logistics.volume],
      ['input[placeholder^="Наименование, упаковка"]',logistics.cargo]
    ];
    for(const [selector,val] of values)await fields.locator(selector).fill(val);
    await fields.locator('select').first().selectOption('EXW');
    await fields.locator('[name="incoterm_place"]').fill(place+' draft');
    await fields.locator('[name="supplier_order_number"]').fill(supplierNumber+'-draft');
    await fields.locator('select').nth(1).selectOption('no');
    await fields.locator('input[type="date"]').fill(logistics.ready_date);
    await fields.locator('input[type="datetime-local"]').fill(deadlineMinsk(Date.now()+86400000));
    await panel.locator('textarea[placeholder^="Например, 5324"]').fill('910083, 910084');
    const files=panel.locator('input[aria-label="Документы к заявке"]');
    const upload=page.waitForResponse(r=>r.url().includes('/api/documents')&&r.request().method()==='POST',{timeout:20000});
    await files.setInputFiles(Object.values(pair).map(name=>({name,mimeType:'text/plain',buffer:bytes(name)})));
    assert.equal((await upload).status(),200);
    const settle=panel.locator('.request-documents .doc-row');
    await settle.filter({hasText:pair.a}).waitFor();
    await settle.filter({hasText:pair.b}).waitFor();
    const publish=page.waitForResponse(r=>r.url().includes('/api/requests')&&r.request().method()==='POST',{timeout:25000});
    await panel.getByRole('button',{name:'Опубликовать и уведомить перевозчиков'}).click();
    const pushed=await publish;
    assert.equal(pushed.status(),200);
    published=await pushed.json();
    assert.equal(published.recipients,2);
    }else{
      published={round:existing.json.request.round_id};
    }
    const journal=(await api('owner','/api/registry',{kind:'request',id:published.round})).json;
    assert.deepEqual(journal.recipients.map(n=>n.recipient).sort(),['carrier124nov18-carriera','carrier124nov18-carrierb']);
    assert.ok(journal.recipients.every(n=>Number.isFinite(Date.parse(n.created))&&n.created===journal.item.published));
    rec.remaining={publish:{round:published.round,recipients:journal.recipients.map(r=>({login:r.recipient,created:r.created})),uiResponse:true}};
    const edit=panel.getByRole('button',{name:'Сохранить изменения заявки',exact:true});
    await edit.waitFor({timeout:15000});
    const cargo=fields.locator('input[placeholder^="Наименование, упаковка"]');
    await page.waitForFunction(()=>document.querySelector('.cabinet-panel[data-section="create-request"] input[placeholder^="Наименование, упаковка"]')?.value?.startsWith('Synthetic continuation cargo'));
    await cargo.fill(prefix+' cargo revised');
    await fields.locator('select').first().selectOption('FCA');
    await fields.locator('[name="incoterm_place"]').fill(place);
    await fields.locator('[name="supplier_order_number"]').fill(supplierNumber);
    const editResponse=page.waitForResponse(r=>r.url().includes('/api/requests')&&r.request().method()==='POST'
      &&r.request().postDataJSON()?.action==='save_logistics',{timeout:25000});
    await edit.click();
    assert.equal((await editResponse).status(),200);
    await page.reload({waitUntil:'domcontentloaded'});
    panel=await visit();
    await page.waitForFunction(()=>document.querySelector('.cabinet-panel[data-section="create-request"] fieldset.request-owner-fields select')?.value==='FCA',null,{timeout:15000});
    assert.equal(await panel.locator('input[placeholder^="Наименование, упаковка"]').inputValue(),prefix+' cargo revised');
    assert.equal(await panel.locator('input[placeholder^="Страна, город, адрес склада"]').inputValue(),logistics.origin);
    const readback=(await api('owner','/api/requests',{order})).json.request;
    assert.equal(readback.round_id,published.round);
    assert.equal(readback.incoterm,'FCA');
    assert.equal(readback.cargo,prefix+' cargo revised');
    assert.match(readback.registration_no,/^TR-/);
    assert.deepEqual(readback.bitrix_task.split(/[,;\s]+/).filter(Boolean),['910083','910084']);
    assert.equal(await panel.locator('[name="incoterm_place"]').inputValue(),place);
    assert.equal(await panel.locator('[name="supplier_order_number"]').inputValue(),supplierNumber);
    assert.equal(readback.incoterm_place,place);
    assert.equal(readback.supplier_order_number,supplierNumber);
    rec.remaining.edit={roundPreserved:true,reopened:true,incoterm:'FCA',incotermPlace:place,supplierOrderNumber:supplierNumber,
      registrationNo:readback.registration_no,bitrix:readback.bitrix_task};
    const remains=panel.locator('.request-documents .doc-row');
    await remains.filter({hasText:pair.a}).waitFor();
    const download=page.waitForEvent('download',{timeout:15000});
    await remains.filter({hasText:pair.a}).getByRole('link').click();
    const downloaded=await download;
    assert.equal(sha256(await readFile(await downloaded.path())),sha256(bytes(pair.a)));
    if(await remains.filter({hasText:pair.b}).count()) {
      const remove=page.waitForResponse(r=>r.url().includes('/api/documents')&&r.request().method()==='POST'
        &&r.request().postDataJSON()?.action==='remove',{timeout:20000});
      await panel.getByRole('button',{name:'Удалить документ '+pair.b}).click();
      assert.equal((await remove).status(),200);
      rec.remaining.removedSecondDocument=true;
    }
    await remains.filter({hasText:pair.b}).waitFor({state:'detached'});
    const docs=(await api('owner','/api/documents',{order})).json.files;
    assert.deepEqual(docs.map(f=>f.name),[pair.a]);
    rec.remaining.documents={downloadSha256:sha256(bytes(pair.a)),remainingFiles:docs.map(f=>f.name)};
  } else {
    await openCabinet(page,'carrier-orders');
    const card=page.locator('article.carrier-request').filter({hasText:order}).first();
    await card.waitFor({timeout:15000});
    const data=(await api(actor,'/api/requests',{order})).json.request;
    const open=card.locator('a[href*="quote"]').first();
    await open.click();
    const expected=[data.origin,data.destination,data.cargo,pair.a,place,supplierNumber];
    const seen=[];
    for(const label of expected){
      await page.getByText(label,{exact:false}).first().waitFor({timeout:10000});
      seen.push(label);
    }
    assert.equal(data.incoterm,'FCA');
    assert.equal(data.incoterm_place,place);
    assert.equal(data.supplier_order_number,supplierNumber);
    assert.equal(data.sender_contact,logistics.sender_contact);
    assert.equal(Number(data.weight),Number(logistics.weight));
    assert.equal(Number(data.volume),Number(logistics.volume));
    rec.remaining={order,fieldsInUI:seen,requestReadback:true,incoterm:data.incoterm};
  }
}
