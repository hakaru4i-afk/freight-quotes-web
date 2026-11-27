import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
test('Owner audit row renders real path, exact reason, rollback and cabinet identity in Chromium',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.setContent(`<div id="root"><div class="cabinet-app" data-cabinet-role="owner"><section class="site-monitor"><table><tbody><tr data-site-audit-path="/api/owner-register-execution" data-site-audit-kind="validation" data-site-audit-source="server" data-site-audit-role="owner" data-site-audit-effective-role="logistic" data-site-audit-reason-code="STATE_CONFLICT" data-site-audit-server-code="PUBLICATION_NOT_VERIFIED" data-site-audit-phase="transaction_rollback"><td>27.11</td><td>owner</td><td><b>Ошибка проверки данных</b><small>Центр доработок</small></td><td>Запрос не выполнен</td><td><details><summary>Подробнее</summary><p>accept_published</p><p>HTTP 409</p><p>ID: request-id</p></details></td></tr></tbody></table></section></div></div>`);
  await page.addScriptTag({type:'module',content:readFileSync('test/owner-audit-explanations-20261117.mjs','utf8')});
  await page.locator('[data-owner-audit-explained="1"]').waitFor();
  await page.locator('tbody summary').click();
  const detail=await page.locator('tbody details').innerText();
  assert.match(detail,/не подтвердил доказательство публикации/);
  assert.match(detail,/откатилась/);
  assert.match(detail,/Фактическая роль: Владелец/);
  assert.match(detail,/Роль кабинета: Логист \/ ВЭД/);
  assert.match(detail,/PUBLICATION_NOT_VERIFIED/);
  assert.match(detail,/Исходная запись: \/api\/owner-register-execution/);
  assert.doesNotMatch(detail,/по заявке\/объекту ID:/);
 }finally{await browser.close();}
});
