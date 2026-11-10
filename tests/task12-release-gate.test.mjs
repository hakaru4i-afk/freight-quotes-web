import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const gate=new URL('./task12-release-gate.mjs',import.meta.url);
const roster=JSON.parse(await readFile(new URL('../test/qa-observer.json',import.meta.url),'utf8'));
const ids=[...roster.task1.cases,...roster.task2.cases].map(x=>x.id);
const sha='a'.repeat(40);
async function run(t,{current,historical,steps}={}){
 const cwd=await mkdtemp(join(tmpdir(),'freight-gate-'));
 t.after(()=>rm(cwd,{recursive:true,force:true}));
 await mkdir(join(cwd,'test'));await mkdir(join(cwd,'reports'));
 const json=(p,v)=>writeFile(join(cwd,p),JSON.stringify(v));
 await json('test/qa-observer.json',roster);
 if(current)await json('reports/task12-robot-matrix.json',current);
 if(historical)await json('test/qa-robot-latest.json',historical);
 if(steps)await json('reports/private-authenticated-e2e.json',{scenarios:steps});
 const proc=spawnSync(process.execPath,[gate.pathname],{cwd,env:{...process.env,GITHUB_SHA:sha,ROBOT_REPORT_PATH:'reports/task12-robot-matrix.json'},encoding:'utf8'});
 assert.equal(proc.status,1,proc.stderr);
 return JSON.parse(await readFile(join(cwd,'reports/task12-release-readiness.json'),'utf8'));
}
const robot=()=>({commit:sha,checks:{FAIL:0,BLOCKED:0},scenarios:ids.map(id=>({id,status:'PARTIAL'}))});
const currentCheck=r=>r.checks.find(x=>x.id==='CURRENT_ROBOT_REPORT');
test('historical public evidence cannot replace missing current-run robot report',async t=>{
 const r=await run(t,{historical:robot()});
 assert.equal(currentCheck(r).status,'BLOCKED');
 assert.equal(r.status,'RELEASE_BLOCKED');assert.equal(r.canDeployProduction,false);
});
for(const variant of ['wrong-sha','missing-case','duplicate-case','blocked-case']){
 test('rejects robot evidence: '+variant,async t=>{
  const current=robot();
  if(variant==='wrong-sha')current.commit='b'.repeat(40);
  if(variant==='missing-case')current.scenarios.pop();
  if(variant==='duplicate-case')current.scenarios[0]=current.scenarios[1];
  if(variant==='blocked-case')current.scenarios[0].status='BLOCKED';
  assert.equal(currentCheck(await run(t,{current})).status,'BLOCKED');
 });
}
test('complete current unit evidence passes only robot gate, never authenticated E2E',async t=>{
 const r=await run(t,{current:robot()});
 assert.equal(currentCheck(r).status,'PASS');assert.equal(r.authenticatedE2ePassed,0);
 assert.equal(r.status,'RELEASE_BLOCKED');
});
test('malformed scenario evidence fails closed with a readable release decision',async t=>{
 const r=await run(t,{steps:{unexpected:true}});
 assert.equal(r.status,'RELEASE_BLOCKED');assert.equal(r.authenticatedE2ePassed,0);
});
