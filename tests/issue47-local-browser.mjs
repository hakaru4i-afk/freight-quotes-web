// Browser interaction against the isolated PostgreSQL-backed Task2 test service.
// Does not claim login or end-to-end coverage of the hosted portal.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export async function runTask2Browser(origin,tools) {
 const {chromium}=await import(pathToFileURL(path.join(tools,'node_modules/playwright/index.mjs')).href);
 const browser=await chromium.launch({headless:true,executablePath:process.env.TASK2_CHROMIUM||'/usr/bin/chromium'});
 const results=[];
 try {
  for(const role of ['carrier','owner','logistic']) {
   const context=await browser.newContext({viewport:{width:390,height:844}});
   await context.addCookies([{name:'qa_role',value:role,url:origin}]);
   const page=await context.newPage(),errors=[];
   await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
   page.on('pageerror',e=>errors.push(e.message));
   page.on('dialog',d=>d.accept());
   await page.goto(origin,{waitUntil:'networkidle'});
   await page.locator('#t2-select').selectOption('QA-UI');
   await page.waitForFunction(()=>document.querySelector('.t2-context')?.textContent.includes('QA-UI'));
   if(role==='carrier') {
    await page.locator('[data-t2-action=take]').click();
    await page.locator('form[data-t2-form=save]').waitFor();
    await page.locator('form[data-t2-form=save] [data-t2-csv-upload]').setInputFiles({name:'plan.csv',mimeType:'text/csv',buffer:Buffer.from('\uFEFFnew_plan_date;new_plan_reason\r\n2026-11-10T12:00;Browser CSV verification\r\n')});
    await page.waitForFunction(()=>document.querySelector('[name=new_plan_reason]')?.value==='Browser CSV verification');
    await page.locator('form[data-t2-form=save] button[type=submit]').click();
    await page.waitForFunction(()=>document.querySelector('#t2-alert')?.textContent==='Изменения сохранены.');
    results.push({check:'mobile CSV preview, apply and PostgreSQL save',status:'PASS'});
    await page.locator('.t2-tabs [data-t2-tab=documents]').click();
    await page.locator('form[data-t2-form=upload] input[type=file]').setInputFiles([
     {name:'browser-a.txt',mimeType:'text/plain',buffer:Buffer.from('Browser document A 中文')},
     {name:'browser-b.txt',mimeType:'text/plain',buffer:Buffer.from('Browser document B русский')},
    ]);
    await page.locator('form[data-t2-form=upload] button[type=submit]').click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-t2-doc]').length===2);
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-t2-doc]').first().click()]);
    const bytes=fs.readFileSync(await download.path());
    assert.ok(['Browser document A 中文','Browser document B русский'].includes(bytes.toString()));
    results.push({check:'mobile multiple upload and browser download preserve bytes',status:'PASS'});
   } else {
    assert.equal(await page.locator('form[data-t2-form=save]').count(),0,'staff must not edit carrier execution fields');
   }
   for(const [locale,language,title] of [['ru','ru','Задача №2 · Полный бизнес-процесс перевозки'],['en','en','Task 2 · Complete shipment workflow'],['zh','zh-CN','任务2 · 完整运输流程']]) {
    await page.evaluate(language=>document.documentElement.lang=language,language);
    await page.waitForFunction(expected=>document.querySelector('#task2-faq h2')?.textContent===expected,title);
    assert.equal(await page.locator('#task2-faq details').count(),14);
    for(const tab of ['track','overview','documents','arrival','claims','history']) {
     await page.locator('.t2-tabs [data-t2-tab='+tab+']').click();
     await page.waitForTimeout(40);
     const width=await page.evaluate(()=>document.documentElement.scrollWidth);
     assert.ok(width<=390+1,`${role}/${locale}/${tab}: horizontal overflow ${width}`);
    }
    results.push({check:`${role} ${locale}: six tabs and 14 FAQ entries at 390x844`,status:'PASS'});
   }
   await page.evaluate(()=>location.hash='#shipment-fulfillment');
   await page.waitForFunction(()=>location.hash==='#approved-shipments');
   assert.deepEqual(errors,[]);
   await context.close();
  }
 } finally {await browser.close();}
 return results;
}
