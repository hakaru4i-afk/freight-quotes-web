import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';

const tool=resolve('tools/qa-fast.mjs');
function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'freight-qa-'));
 mkdirSync(join(dir,'tools'));mkdirSync(join(dir,'tests'));
 copyFileSync(tool,join(dir,'tools/qa-fast.mjs'));
 try{return fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}
}
const call=(dir,args)=>spawnSync(process.execPath,['tools/qa-fast.mjs',...args],{cwd:dir,encoding:'utf8',timeout:15000});
const git=(dir,...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']});

test('read-only plan distinguishes missing regression files',()=>fixture(dir=>{
 writeFileSync(join(dir,'tests/issue47-late-ui.test.mjs'),'');
 const plan=call(dir,['--suite','carrier']);
 assert.equal(plan.status,0,plan.stderr);
 const data=JSON.parse(plan.stdout);
 assert.equal(data.mode,'plan');assert.equal(data.coverage,'PARTIAL');
 assert.ok(data.existingTests.includes('tests/issue47-late-ui.test.mjs'));
 assert.ok(data.missingTests.includes('tests/carrier-dashboard-browser.test.mjs'));
 assert.equal(data.fullAuthenticatedE2E,false);assert.equal(data.productionWrites,false);
}));

test('targeted runner passes only an actual local test and labels partial coverage',()=>fixture(dir=>{
 writeFileSync(join(dir,'tests/issue47-late-ui.test.mjs'),
  "import test from 'node:test'; test('synthetic fixture',()=>{});\n");
 const out=call(dir,['--suite','carrier','--run']);
 assert.equal(out.status,0,out.stderr);
 assert.match(out.stdout,/TARGETED_TESTS_PASS_WITH_MISSING_TESTS/);
}));

test('unknown options, missing suites and no tests all fail closed',()=>fixture(dir=>{
 for(const args of [['--suite','unknown'],['--suite','carrier','--deploy'],['--suite','carrier','--run'],['--changed','--run']])
  assert.notEqual(call(dir,args).status,0,args.join(' '));
}));

test('changed mode recognizes committed and uncommitted paths',()=>fixture(dir=>{
 git(dir,'init','-q');git(dir,'config','user.name','QA');git(dir,'config','user.email','qa@example.invalid');
 writeFileSync(join(dir,'README.md'),'base');git(dir,'add','.');git(dir,'commit','-qm','baseline');git(dir,'branch','-M','main');
 git(dir,'checkout','-qb','candidate');
 writeFileSync(join(dir,'carrier-current.js'),'new');git(dir,'add','.');git(dir,'commit','-qm','carrier');
 writeFileSync(join(dir,'global-view-map50.mjs'),'local');
 const out=call(dir,['--changed','main']);
 assert.equal(out.status,0,out.stderr);
 const plan=JSON.parse(out.stdout);
 assert.deepEqual(plan.selected,['carrier','map']);
 assert.ok(plan.changedFiles.includes('carrier-current.js'));
 assert.ok(plan.changedFiles.includes('global-view-map50.mjs'));
}));

test('doctor and list use existing tools without installation',()=>fixture(dir=>{
 const doctor=call(dir,['--doctor']);assert.equal(doctor.status,0,doctor.stderr);
 assert.equal(JSON.parse(doctor.stdout).mode,'doctor');
 const list=call(dir,['--list']);assert.equal(list.status,0,list.stderr);
 assert.ok(JSON.parse(list.stdout).suites.owner);
}));