import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const main=readFileSync('portal-feedback-center-20261107.js','utf8');
const staging=readFileSync('test/portal-feedback-center-20261107.js','utf8');
const functionText=main.match(/const isReleaseReady=.*?;\n/)[0];
const sandbox={};
runInNewContext(functionText+'\nglobalThis.check=isReleaseReady;',sandbox);
test('root and staging keep exactly the same gate logic',()=>assert.equal(main,staging));
test('only 100% progress and four verified gates enable release',()=>{
 const item={id:'task-4',status:'release'},ready={taskId:'task-4',ready:true,passed:4,total:4},done={progress:100,checksPassed:true};
 assert.equal(sandbox.check(item,true,ready,done),true);
 for(const args of [
  [item,false,ready,done],
  [item,true,{...ready,taskId:'other'},done],
  [item,true,{...ready,ready:false},done],
  [item,true,{...ready,passed:3},done],
  [item,true,ready,{progress:50,checksPassed:false}],
  [item,true,ready,{progress:90,checksPassed:true}],
  [{...item,status:'completed'},true,ready,done],
  [item,true,undefined,done]
 ])assert.equal(sandbox.check(...args),false);
});
test('browser cannot release before server readiness and 100 percent work',()=>{
 assert.match(main,/response\.ok&&result\.ok===true&&result\.ready===true&&result\.status==='READY'/);
 assert.match(main,/\.filter\(status=>status!=='completed'\)/);
 assert.match(main,/data-pf="release-update"/);
 assert.match(main,/Ожидаются тесты/);
 assert.match(main,/if\(isReleaseReady\(item,data\.owner,releaseReadiness,executionByFeedback\.get\(item\?\.id\)\)&&!busy\)/);
 assert.match(main,/!releaseReady\|\|isRunning\|\|isConfirmed\|\|busy\?'disabled':''/);
 assert.match(main,/releaseGateLabel/);
 assert.match(main,/readySummary:'Готово к выпуску'/);
 assert.match(main,/action:'release_update'/);
});
