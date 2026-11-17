import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const source='test/owner-team-users-20261117.js';
test('Owner may create all 7 roles and permanently delete a synthetic user',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.setContent('<div id="root"><div class="cabinet-app" data-cabinet-role="owner"><section class="cabinet-panel" data-section="team"><section class="card" id="owner-access-card"><h2>Уровни доступа</h2></section><section class="card" id="owner-users-card"><h2>Пользователи и права</h2><button id="native-supplier">Создать поставщика</button><button id="native-combined">Создать дизайнера / контент-менеджера</button><div class="bar" id="native-create-actions"><button>Создать поставщика</button></div><p class="small" id="legacy-instruction">Логист / сотрудник ВЭД видит все предложения</p><form class="grid" id="legacy-user-create"><input aria-label="Повторный логин" /><button type="submit">Сохранить пользователя</button></form><p class="small" id="legacy-secondary-help">Старая инструкция создания пользователей</p><div class="doc-list" id="members-list"><div>Работающий список сотрудников</div></div></section></section></div><div class="cabinet-app" data-cabinet-role="carrier"><section class="cabinet-panel" data-section="team"><h2>Пользователи</h2></section></div></div>');
  await page.evaluate(()=>{window.__requests=[];window.fetch=async(url,opts)=>{if(!String(url).endsWith('/api/team'))throw Error('unexpected route');const p=opts?.body?JSON.parse(opts.body):null;window.__requests.push(p);return new Response(JSON.stringify(p?{ok:true}:{members:[{email:'qa-content',name:'QA Content',role:'content'}]}),{status:200,headers:{'Content-Type':'application/json'}})};});
  await page.addStyleTag({path:'test/owner-team-users-20261117.css'});
  await page.addScriptTag({path:source});
  const owner='.cabinet-app[data-cabinet-role="owner"]';
  await page.waitForSelector(owner+' .ow-users-actions');
  assert.equal(await page.locator(owner+' .ow-users-create').count(),7);
  assert.equal(await page.locator(owner+' .ow-users-delete').count(),1);
  assert.deepEqual(await page.locator(owner+' .ow-users-create').evaluateAll(nodes=>nodes.map(n=>n.dataset.userRole)),['carrier','logistic','supplier','designer','content','purchasing','certification']);
  assert.equal(await page.locator('#native-supplier:visible').count(),0);
  assert.equal(await page.locator('#native-combined:visible').count(),0);
  assert.equal(await page.locator('#owner-access-card .ow-users-action').count(),0);
  assert.equal(await page.locator('#owner-users-card .ow-users-create').count(),7);
  assert.equal(await page.locator('#legacy-user-create:visible').count(),0,'Legacy duplicate creation form is hidden');
  assert.equal(await page.locator('#native-create-actions:visible').count(),0,'Old action row is hidden');
  assert.equal(await page.locator('#legacy-secondary-help:visible').count(),0,'Old creation instructions are hidden');
  assert.equal(await page.locator('#members-list:visible').count(),1,'Existing users remain visible');
  assert.equal(await page.locator('.cabinet-app[data-cabinet-role="carrier"] .ow-users-action').count(),0);
  for(const [label,role]of [['Создать перевозчика','carrier'],['Создать сотрудника ВЭД','logistic'],['Создать поставщика','supplier'],['Создать дизайнера','designer'],['Создать контент-менеджера','content'],['Создать сотрудника закупок','purchasing'],['Создать сотрудника сертификации','certification']]){
   await page.getByRole('button',{name:label,exact:true}).click();
   await page.locator('.ow-users-dialog input').nth(0).fill('qa-'+role);
   await page.locator('.ow-users-dialog input').nth(1).fill('QA '+role);
   await page.locator('.ow-users-dialog input').nth(2).fill('test-passphrase-123');
   await page.locator('.ow-users-dialog button[type="submit"]').click();
   await page.waitForFunction(()=>document.querySelector('.ow-users-result')?.textContent.includes('Пользователь создан'));
   const received=await page.evaluate(()=>window.__requests.at(-1));
   assert.equal(received.action,'add');assert.equal(received.role,role);
   assert.equal(received.email,'qa-'+role);assert.equal(received.password,'test-passphrase-123');
   await page.locator('.ow-users-dialog .ow-users-secondary').click();
  }
  await page.getByRole('button',{name:'Удалить пользователя',exact:true}).click();
  await page.locator('.ow-users-dialog select').selectOption('qa-content');
  await page.locator('.ow-users-dialog input').fill('qa-content');
  await page.locator('.ow-users-dialog button[type="submit"]').click();
  await page.waitForFunction(()=>window.__requests.some(r=>r?.action==='delete'));
  const del=await page.evaluate(()=>window.__requests.at(-1));
  assert.deepEqual({action:del.action,email:del.email,confirmLogin:del.confirmLogin},{action:'delete',email:'qa-content',confirmLogin:'qa-content'});
  await page.close();
 }finally{await browser.close()}
});
