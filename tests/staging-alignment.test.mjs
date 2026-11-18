import test from 'node:test';import assert from 'node:assert/strict';import{mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import{checkAlignment}from'../scripts/check-staging-alignment.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){const root=mkdtempSync(join(tmpdir(),'freight-alignment-'));const put=(p,v)=>writeFileSync(join(root,p),typeof v==='string'?v:JSON.stringify(v));for(const d of ['test','docs','scripts','tests','.github/workflows'])mkdirSync(join(root,d),{recursive:true});const api='a'.repeat(40);put('test/index.html','<script src="./app.js"></script>');put('test/app.js','/* real indexed source */');put('docs/FAQ.md','Reviewed role instructions');put('.github/workflows/check.yml','name: gate');put('test/build-info.json',{primaryBusinessVersion:'SH-01.30.50 v',releaseVersion:'SH-01.30.50 v',sqlMigrationVersion:'20261111182346',task2:{backendVersion:92},stabilizationQa20261110:{backendSourceCommit:api}});put('test/business-process-model.json',{version:'20261111-logic-8'});put('test/alignment-role-help.json',{roles:{owner:{ru:['Справка'],en:['Help'],zh:['帮助']}}});const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();git(['init','-q']);git(['add','.']);git(['-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','Reviewed inputs']);const m={primaryBusinessVersion:'SH-01.30.50 v',environment:'staging',releaseStatus:'RELEASE_BLOCKED',frontendCommit:git(['rev-parse','HEAD']),businessVersions:[{version:'SH-01.30.50 v',issue:47}],assetHashes:Object.fromEntries(['test/index.html','test/app.js','docs/FAQ.md','.github/workflows/check.yml','test/build-info.json','test/business-process-model.json'].map(p=>[p,hash(readFileSync(join(root,p)))])),apiBundleSha256:'b'.repeat(64),apiSourceCommit:api,apiVersion:92,sqlMigrationVersion:'20261111182346',processModelVersion:'20261111-logic-8',roleHelpSha256:hash(readFileSync(join(root,'test/alignment-role-help.json')))};put('test/staging-manifest.json',m);return{root,put,m,git,close:()=>rmSync(root,{recursive:true,force:true})};}
function scenario(name,change,expected){test(name,()=>{const f=fixture();try{assert.doesNotThrow(()=>checkAlignment(f.root));change(f);assert.throws(()=>checkAlignment(f.root),expected);}finally{f.close();}});}
scenario('an edited instruction blocks readiness',f=>f.put('docs/FAQ.md','Changed without review'),/STALE_DEPENDENCY:docs\/FAQ/);
scenario('an edited process model blocks readiness',f=>f.put('test/business-process-model.json',{version:'changed'}),/STALE_DEPENDENCY/);
scenario('a new unindexed runtime module blocks readiness',f=>f.put('test/new-feature.mjs','export default 1'),/UNINDEXED_DEPENDENCY/);
scenario('a changed workflow is also a reviewed dependency',f=>f.put('.github/workflows/check.yml','name: altered'),/STALE_DEPENDENCY/);
scenario('unreviewed translated help blocks readiness',f=>f.put('test/alignment-role-help.json',{roles:{owner:{ru:['new']}}}),/STALE_ROLE_HELP/);
scenario('a missing runtime bundle cannot be marked current',f=>{f.m.apiBundleSha256=null;f.put('test/staging-manifest.json',f.m);},/MISSING_VERIFIED_RUNTIME_PAIR/);
scenario('version number reuse across issues blocks readiness',f=>{f.m.businessVersions.push({version:'SH-01.30.50 v',issue:999});f.put('test/staging-manifest.json',f.m);},/BUSINESS_VERSION_COLLISION/);
scenario('a different API version blocks readiness even with intact source hashes',f=>{f.m.apiVersion=93;f.put('test/staging-manifest.json',f.m);},/VERSION_PAIR_MISMATCH/);
scenario('rewriting only the manifest cannot approve uncommitted source',f=>{f.put('docs/FAQ.md','Changed');f.m.assetHashes['docs/FAQ.md']=hash('Changed');f.put('test/staging-manifest.json',f.m);},/SOURCE_COMMIT_MISMATCH/);

scenario('a different SQL migration blocks readiness',f=>{f.m.sqlMigrationVersion='20261111123018';f.put('test/staging-manifest.json',f.m);},/SQL_MIGRATION_VERSION_MISMATCH/);

scenario('a stale primary business version blocks readiness',f=>{f.m.primaryBusinessVersion='SH-01.30.49 v';f.put('test/staging-manifest.json',f.m);},/PRIMARY_BUSINESS_VERSION_MISMATCH/);

test('a committed candidate can prove source coherence without claiming a verified deployment',()=>{
 const f=fixture();try{
  const info=JSON.parse(readFileSync(join(f.root,'test/build-info.json'))),model=JSON.parse(readFileSync(join(f.root,'test/business-process-model.json')));
  const source='d'.repeat(40);info.carrierDashboard124={status:'UNPUBLISHED_CANDIDATE',releaseGate:'BLOCKED',ownerAccepted:false,backendSourceCommit:source};info.observedBackendDeployment={version:92,sourceBindingStatus:'UNVERIFIED'};model.reviewedBackendSourceCommit=source;
  f.put('test/build-info.json',info);f.put('test/business-process-model.json',model);f.put('build-info.json',{releaseVersion:info.primaryBusinessVersion});
  f.git(['add','.']);f.git(['-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','Reviewed candidate source']);
  Object.assign(f.m,{publicationState:'CANDIDATE_NOT_RELEASED',ownerAccepted:false,runtimePairStatus:'UNVERIFIED',apiSourceCommit:null,apiBundleSha256:null,backendSourceCommit:source,frontendCommit:f.git(['rev-parse','HEAD']),businessVersionSourceCommit:f.git(['rev-parse','HEAD']),canonicalHash:null,qaEvidence:{status:'BLOCKED_CURRENT_PAIR_NOT_RUN',fullGroupsPassed:0,fullGroupsTotal:37,independentRestore:'NOT_CONFIRMED_FOR_CURRENT_CANDIDATE'}});
  for(const p of Object.keys(f.m.assetHashes))f.m.assetHashes[p]=hash(readFileSync(join(f.root,p)));f.put('test/staging-manifest.json',f.m);
  assert.doesNotThrow(()=>checkAlignment(f.root,{sourceOnly:true}));
  f.m.qaEvidence.independentRestore='PASS_FROM_AN_OLD_RELEASE';f.put('test/staging-manifest.json',f.m);assert.throws(()=>checkAlignment(f.root,{sourceOnly:true}),/STALE_CANDIDATE_ACCEPTANCE_EVIDENCE/);f.m.qaEvidence.independentRestore='NOT_CONFIRMED_FOR_CURRENT_CANDIDATE';f.put('test/staging-manifest.json',f.m);
  assert.throws(()=>checkAlignment(f.root),/MISSING_VERIFIED_RUNTIME_PAIR/);
  f.m.apiSourceCommit=source;f.put('test/staging-manifest.json',f.m);assert.throws(()=>checkAlignment(f.root,{sourceOnly:true}),/INVALID_CANDIDATE_PROVENANCE/);
  f.m.apiSourceCommit=null;f.m.ownerAccepted=true;f.put('test/staging-manifest.json',f.m);assert.throws(()=>checkAlignment(f.root,{sourceOnly:true}),/INVALID_CANDIDATE_PROVENANCE/);
  f.m.ownerAccepted=false;f.put('test/staging-manifest.json',f.m);f.put('test/new.css','new source');assert.throws(()=>checkAlignment(f.root,{sourceOnly:true}),/UNINDEXED_DEPENDENCY/);
 }finally{f.close();}
});
