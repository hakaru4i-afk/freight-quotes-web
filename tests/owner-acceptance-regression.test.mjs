import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {runtimeAssetUrl} from './helpers/runtime-assets.mjs';

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
test('Acceptance and publication remain distinct; only the Center can decide',()=>{
  assert.match(owner,/const finished=\(s,job\)=>job\?\.status==='completed'/);
  assert.match(owner,/\/api\/owner-register-execution\?register=/);
  assert.doesNotMatch(owner,/action:'set_status'/);
  assert.match(owner,/Приёмка и возврат на доработку доступны в Центре доработок/);
  const start=owner.indexOf('const acceptanceExecutionFor=');
  const end=owner.indexOf('async function refreshAcceptance',start);
  assert.ok(start>=0&&end>start);
  let job,execution;
  const state=new Map();
  const row={register:'developments',id:'test',status:'published'};
  const probe=new Function('acceptanceExecutions','acceptanceTaskFor',owner.slice(start,end)+';return {acceptedByOwner,approvalState};')(state,()=>job);
  for(const scenario of [
    {job:{status:'in_progress'},execution:{decision:'in_progress'},accepted:false,label:'В работе'},
    {job:{status:'release'},execution:{decision:'review_pending'},accepted:false,label:'На приёмке владельца'},
    {job:{status:'in_progress'},execution:{decision:'accepted'},accepted:true,label:'Принято; ожидает публикации'},
    {job:{status:'completed'},execution:{decision:'accepted'},accepted:true,label:'Опубликовано и в архиве'},
    {job:{status:'release'},execution:undefined,accepted:false,label:'Устаревший статус: требуется сверка'}
  ]){
    job=scenario.job;state.clear();if(scenario.execution)state.set('developments:test',scenario.execution);
    assert.equal(probe.acceptedByOwner(row),scenario.accepted);
    assert.equal(probe.approvalState(row,job),scenario.label);
  }
  assert.match(owner,/acceptanceView==='pending'\)return !acceptedByOwner\(row\)/);
});
test('Private engineering archives stay Owner-authenticated and are not embedded as public records',()=>{
  assert.match(owner,/\/api\/engineering-registers\?name=/);
  assert.match(owner,/SOURCE_DIGEST_MISMATCH|Несовпадение контрольной суммы/);
  assert.doesNotMatch(owner,/owner:20261117:RM-20261117-/);
  assert.doesNotMatch(owner,/localStorage/);
});
test('Cache keys on both pages point to the new owner journal',()=>{
  const asset=runtimeAssetUrl('owner-registers-20261111.js');
  assert.ok(index.includes(asset),'production references the exact current module blob');
  assert.ok(testIndex.includes(asset),'staging references the same module blob');
  assert.match(owner,/setInterval\(\(\)=>void pollLiveRegisters\(\),30000\)/);
  assert.match(owner,/liveRevision/);
});
