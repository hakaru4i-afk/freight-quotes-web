import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const gate=new URL('./task12-release-gate.mjs',import.meta.url);
const roster=JSON.parse(await readFile(new URL('../test/qa-observer.json',import.meta.url),'utf8'));
const ids=[...roster.task1.cases,...roster.task2.cases].map(x=>x.id);
const sha='a'.repeat(40);
async function run(t,{current,historical,steps,manifest,e2e,artifacts}={}){
 const cwd=await mkdtemp(join(tmpdir(),'freight-gate-'));
 t.after(()=>rm(cwd,{recursive:true,force:true}));
 await mkdir(join(cwd,'test'));await mkdir(join(cwd,'reports'));
 const json=(p,v)=>writeFile(join(cwd,p),JSON.stringify(v));
 await json('test/qa-observer.json',roster);
 if(current)await json('reports/task12-robot-matrix.json',current);
 if(historical)await json('test/qa-robot-latest.json',historical);
 if(manifest)await json('test/staging-manifest.json',manifest);
 if(steps||e2e)await json('reports/private-authenticated-e2e.json',e2e??{scenarios:steps});
 for(const [name,bytes] of Object.entries(artifacts||{})){
  const dir=join(cwd,'reports/verified-authenticated/report');
  await mkdir(dir,{recursive:true});
  await writeFile(join(dir,name),bytes);
 }
 const proc=spawnSync(process.execPath,[gate.pathname],{cwd,env:{...process.env,GITHUB_SHA:sha,GITHUB_RUN_ID:'44701234',ROBOT_REPORT_PATH:'reports/task12-robot-matrix.json'},encoding:'utf8'});
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


test('37 group decisions are tied to the exact isolated API, migration and run',async t=>{
 const source='c'.repeat(40),backend='d'.repeat(40),bundle='e'.repeat(64),sql='20261119163433';
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const runId='44701234',traceId='00000000-aaaa-4444-8888-000000000001';
 const screenshot=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
 const image={file:'report/owner-390.png',sha256:hash(screenshot)};
 const browser=JSON.stringify({frontendSha:sha,frontendSource:source,backendSourceCommit:backend,backendVersion:18,
  backendBundle:bundle,sqlMigrationVersion:sql,workflowRunId:runId,mocks:false,immutableSource:true,sourceTreeDirty:false,
  transport:'TLS_VERIFIED_REAL_HTTP',calls:[{requestId:traceId,status:200,path:'/api/requests'}],
  roles:[{status:'PASS',viewports:[{screenshot:'reports/'+image.file,screenshotSha256:image.sha256}]}]});
 const artifacts={'browser-results-owner.json':browser,'owner-390.png':screenshot};
 const manifest={frontendCommit:source,backendSourceCommit:backend,sqlMigrationVersion:sql,
  publicationState:'CANDIDATE_NOT_RELEASED',sh59IsolatedQa:{sourceCommit:backend,version:18,providerBundleSha256:bundle}};
 const scenarios=ids.map(id=>({id,status:'PASS',mode:'AUTHENTICATED_QA_API',actorRole:'owner',
  evidence:{method:'HTTP_AND_BROWSER',responseVerified:true,traceId,
   sources:[{file:'report/browser-results-owner.json',sha256:hash(browser)},image]}}));
 const exact={frontendSha:sha,frontendSource:source,backendSha:backend,backendVersion:18,backendBundle:bundle,
  sqlMigrationVersion:sql,runId,environment:'isolated-qa',authorized:true,scenarios};
 const current=robot();
 const result=await run(t,{current,manifest,e2e:exact,artifacts});
 assert.equal(result.authenticatedE2ePassed,37);
 assert.equal(result.status,'RELEASE_BLOCKED','Acceptance and recoverability remain separate release gates');
 const duplicates={...exact,scenarios:[...scenarios,scenarios[0]]};
 const regressions=[duplicates,{...exact,backendSha:'0'.repeat(40)},{...exact,backendBundle:'0'.repeat(64)},
  {...exact,backendVersion:17},{...exact,sqlMigrationVersion:'20261118161830'},{...exact,runId:'44701235'}];
 for (const e2e of regressions) {
  assert.equal((await run(t,{current,manifest,e2e,artifacts})).authenticatedE2ePassed,0);
 }
 assert.equal((await run(t,{current,manifest,e2e:exact})).authenticatedE2ePassed,0);
 const tampered={...artifacts,'owner-390.png':Buffer.concat([screenshot,Buffer.from('tampered')])};
 assert.equal((await run(t,{current,manifest,e2e:exact,artifacts:tampered})).authenticatedE2ePassed,0);
 const badTrace={...exact,scenarios:scenarios.map(row=>({...row,evidence:{...row.evidence,traceId:'00000000-aaaa-4444-8888-000000000002'}}))};
 assert.equal((await run(t,{current,manifest,e2e:badTrace,artifacts})).authenticatedE2ePassed,0);
});
