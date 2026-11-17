import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const owner = readFileSync(new URL('../owner-registers-20261111.js', import.meta.url),'utf8');
const staged = readFileSync(new URL('../test/owner-registers-20261111.js', import.meta.url),'utf8');
const index = readFileSync(new URL('../index.html',import.meta.url),'utf8');
const testIndex = readFileSync(new URL('../test/index.html',import.meta.url),'utf8');

test('Owner acceptance is the fourth engineering journal and cooperation stays separate',()=>{
  assert.equal(owner,staged);
  assert.match(owner,/acceptance:\['Реестр приёмки владельцем'/);
  assert.match(owner,/cooperation:\['Реестр предложений по сотрудничеству'/);
  assert.match(owner,/\['today','Сегодня'\]/);
  assert.match(owner,/const minskDay=/);
  assert.match(owner,/for\(const id of \['remarks','developments','updates'\]\)/);
});
test('Work is only done after Owner status completed, not GitHub merge or release flags',()=>{
  assert.match(owner,/const finished=\(s,job\)=>job\?\.status==='completed'/);
  assert.match(owner,/const acceptedByOwner=\(row\)=>acceptanceTaskFor\(row\)\?\.status==='completed'/);
  assert.match(owner,/job\?\.status==='release'/);
  assert.match(owner,/expectedStatus:'release',status,note/);
  assert.match(owner,/Подтвердить выполнение/);
  assert.match(owner,/Вернуть в работу/);
  assert.match(owner,/Лично проверил/);
  assert.match(owner,/await feedbackRequest\(\{action:'set_status'/);
});
test('Private engineering archives stay Owner-authenticated and are not embedded as public records',()=>{
  assert.match(owner,/\/api\/engineering-registers\?name=/);
  assert.match(owner,/SOURCE_DIGEST_MISMATCH|Несовпадение контрольной суммы/);
  assert.doesNotMatch(owner,/owner:20261117:RM-20261117-/);
  assert.doesNotMatch(owner,/localStorage/);
});
test('Cache keys on both pages point to the new owner journal',()=>{
  assert.match(index,/owner-registers-20261111\.js\?v=ow-reg-acceptance-20261117-/);
  assert.match(testIndex,/owner-registers-20261111\.js\?v=ow-reg-acceptance-20261117-/);
});
