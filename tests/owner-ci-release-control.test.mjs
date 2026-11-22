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
test('owner and exact task READY are mandatory',()=>{
 const item={id:'task-4',status:'release'};
 assert.equal(sandbox.check(item,true,{taskId:'task-4',ready:true}),true);
 for(const args of [
  [item,false,{taskId:'task-4',ready:true}],
  [item,true,{taskId:'other',ready:true}],
  [item,true,{taskId:'task-4',ready:false}],
  [{...item,status:'completed'},true,{taskId:'task-4',ready:true}],
  [item,true,undefined]
 ])assert.equal(sandbox.check(...args),false);
});
test('browser can initiate release but cannot self-approve publication',()=>{
 assert.match(main,/response\.ok&&result\.ok===true&&result\.ready===true&&result\.status==='READY'/);
 assert.match(main,/\.filter\(status=>status!=='completed'\)/);
 assert.match(main,/data-pf="release-update"/);
 assert.match(main,/Ожидаются тесты/);
 assert.match(main,/if\(data\.owner&&item&&\['in_progress','release'\]\.includes\(item\.status\)&&!busy\)/);
 assert.match(main,/isRunning\|\|isConfirmed\|\|busy\?'disabled':''/);
 assert.match(main,/action:'release_update'/);
});
