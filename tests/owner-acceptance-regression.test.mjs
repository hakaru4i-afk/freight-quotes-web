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
test('Owner acceptance is distinct from verified publication and archive',()=>{
  const extract=name=>{
    const line=owner.split('\n').find(line=>line.startsWith('const '+name+'='));
    assert.ok(line,'missing '+name);
    return line.slice(line.indexOf('=')+1).replace(/;$/,'');
  };
  const finished=Function('return ('+extract('finished')+')')();
  const accepted=Function('acceptanceTaskFor','acceptanceExecutionFor','return ('+extract('acceptedByOwner')+')')(row=>row.job,row=>row.execution);
  for(const status of ['sent','in_progress','release','published','merged']){
    assert.equal(Boolean(finished(status,{status})),false);
    assert.equal(Boolean(accepted({job:{status},execution:{decision:'review_pending'},merged:true,published:true})),false);
  }
  assert.equal(finished('release',{status:'completed'}),true);
  assert.equal(accepted({job:{status:'completed'}}),true);
  assert.equal(accepted({job:{status:'release'},execution:{decision:'accepted'}}),true);
  assert.equal(finished('accepted',{status:'release'}),false);
  assert.match(owner,/Принято; ожидает публикации/);
  assert.match(owner,/Опубликовано и в архиве/);
  assert.match(owner,/\/api\/owner-register-execution\?register=/);
  assert.match(owner,/action:'transfer',register:row.register,recordId:row.id/);
  assert.match(owner,/Приёмка и возврат на доработку доступны в Центре доработок/);
  assert.doesNotMatch(owner,/action:'set_status',id:job.id,expectedStatus:'release'/);
  const center=readFileSync(new URL('../portal-feedback-center-20261107.js',import.meta.url),'utf8');
  assert.match(center,/if\(busy\|\|!data.owner\)return/);
  assert.match(center,/action==='return_for_rework'&&reason.trim\(\).length<10/);
  assert.match(center,/ownerReviewAction\(item,action==='submit-review'\?'submit_review':'accept'\)/);
  assert.match(center,/action:'archive_published',id:item.id,expectedStatus:item.status/);
  assert.match(center,/runState.status==='published'/);
  assert.match(center,/if\(!response.ok\|\|out.ok!==true\)throw Error/);
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
