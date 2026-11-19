/* Repair only reproducible provenance for STAGING, never declare acceptance.
   Run after building/committing source assets, with an explicit source commit. */
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p));
const digest=p=>createHash('sha256').update(read(p)).digest('hex');
const skip=new Set(['test/staging-manifest.json','test/alignment-role-help.json','test/qa-robot-latest.json','test/qa-release-readiness.json']);
const ext=/\.(js|mjs|css|html|json|md|yml|png|jpe?g|svg|webp|woff2?|ttf|otf)$/;
function walk(dir,out=[]){
 if(!existsSync(resolve(root,dir)))throw Error('MISSING_REQUIRED_DIR:'+dir);
 for(const entry of readdirSync(resolve(root,dir),{withFileTypes:true})){
  if(['process-history','processes'].includes(entry.name))continue;
  const path=dir+'/'+entry.name;
  if(entry.isDirectory())walk(path,out);
  else if(ext.test(path)&&!skip.has(path))out.push(path);
 }
 return out;
}
const current=JSON.parse(read('test/staging-manifest.json'));
if(current.environment!=='staging'||current.releaseStatus!=='RELEASE_BLOCKED')
 throw Error('RELEASE_GATE_MUST_REMAIN_BLOCKED');
const prod=JSON.parse(read('build-info.json')),stage=JSON.parse(read('test/build-info.json'));
if(prod.projectRef===stage.projectRef||stage.projectRef!=='ibclzdkxiozbzmniiygv')
 throw Error('UNSAFE_ENVIRONMENT_IDENTITY');
const candidate=process.argv.includes('--candidate');
if((!candidate&&current.primaryBusinessVersion!==stage.primaryBusinessVersion)||stage.primaryBusinessVersion!==prod.releaseVersion)
 throw Error('BUSINESS_VERSION_MISMATCH');
const sourceArg=process.argv.find(x=>x.startsWith('--source-commit='));
const sourceCommit=sourceArg?.split('=')[1];
if(!/^([a-f0-9]{40})$/.test(sourceCommit||''))throw Error('REQUIRE_EXPLICIT_REVIEWED_SOURCE_COMMIT');
const git=(args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const head=git(['rev-parse','HEAD']);if(head!==sourceCommit)throw Error('SOURCE_COMMIT_MUST_BE_CURRENT_HEAD');
const files=[...new Set(['test','docs','scripts','tests','.github/workflows'].flatMap(dir=>walk(dir)))].sort();
const hashes=Object.fromEntries(files.map(path=>[path,digest(path)]));
// Hashing a dirty worktree must never certify it as an immutable Git source.
for(const path of files){const committed=execFileSync('git',['show',sourceCommit+':'+path],{cwd:root,maxBuffer:16*1024*1024});if(createHash('sha256').update(committed).digest('hex')!==hashes[path])throw Error('SOURCE_COMMIT_MISMATCH:'+path);}
let candidatePins={};
if(candidate){
 const model=JSON.parse(read('test/business-process-model.json')),c=stage.carrierDashboard124;
 if(c?.status!=='UNPUBLISHED_CANDIDATE'||c.releaseGate!=='BLOCKED'||c.ownerAccepted!==false||!/^[a-f0-9]{40}$/.test(c.backendSourceCommit||'')||model.reviewedBackendSourceCommit!==c.backendSourceCommit||stage.observedBackendDeployment?.sourceBindingStatus!=='UNVERIFIED')throw Error('INVALID_CANDIDATE_PROVENANCE');
 const versionSource=process.argv.find(x=>x.startsWith('--business-version-source='))?.split('=')[1]||current.businessVersionSourceCommit;
 if(!/^[a-f0-9]{40}$/.test(versionSource||''))throw Error('REQUIRE_BUSINESS_VERSION_SOURCE');
 const original=JSON.parse(git(['show',versionSource+':build-info.json']));
 if(original.releaseVersion!==stage.primaryBusinessVersion)throw Error('BUSINESS_VERSION_SOURCE_MISMATCH');
 git(['merge-base','--is-ancestor',versionSource,sourceCommit]);
 candidatePins={publicationState:'CANDIDATE_NOT_RELEASED',ownerAccepted:false,runtimePairStatus:'UNVERIFIED',businessVersionSourceCommit:versionSource,primaryBusinessVersion:stage.primaryBusinessVersion,businessVersions:current.businessVersions.some(x=>x.version===stage.primaryBusinessVersion)?current.businessVersions:[...current.businessVersions,{version:stage.primaryBusinessVersion,issue:null,sourceCommit:versionSource}],apiVersion:stage.observedBackendDeployment.version,apiSourceCommit:null,apiBundleSha256:null,backendSourceCommit:c.backendSourceCommit,processModelVersion:model.version,sqlMigrationVersion:stage.sqlMigrationVersion,observedBackendDeployment:stage.observedBackendDeployment,
 ...(stage.sh59IsolatedQa?{sh59IsolatedQa:stage.sh59IsolatedQa}:{}),
 canonicalHash:null,qaEvidence:{status:'BLOCKED_CURRENT_PAIR_NOT_RUN',fullGroupsPassed:0,fullGroupsTotal:37,protectedCi:'MAIN_ONLY_CANDIDATE_UNAUTHORIZED',independentRestore:'NOT_CONFIRMED_FOR_CURRENT_CANDIDATE'},rollback:'NOT_AUTHORIZED: a verified paired rollback receipt is required before deployment.',sqlMigrationSemantics:'Source-declared migration baseline; not an attestation of the applied staging ledger.',
 historicalPublication:{...(current.historicalPublication||{frontendCommit:current.frontendCommit,primaryBusinessVersion:current.primaryBusinessVersion,apiVersion:current.apiVersion,apiSourceCommit:current.apiSourceCommit,apiBundleSha256:current.apiBundleSha256,processModelVersion:current.processModelVersion}),canonicalHash:current.historicalPublication?.canonicalHash??current.canonicalHash,qaEvidence:current.historicalPublication?.qaEvidence??current.qaEvidence,rollback:current.historicalPublication?.rollback??current.rollback,sqlMigrationVersion:current.historicalPublication?.sqlMigrationVersion??current.sqlMigrationVersion}};
}
const manifest={...current,...candidatePins,frontendCommit:sourceCommit,assetHashes:hashes,roleHelpSha256:digest('test/alignment-role-help.json')};
const serialized=JSON.stringify(manifest,null,2)+'\n';
if(process.argv.includes('--write')){
 writeFileSync(resolve(root,'test/staging-manifest.json'),serialized);
 writeFileSync(resolve(root,'staging-manifest.json'),serialized);
}
console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'inspect',sourceCommit,
 indexed:files.length,added:files.filter(f=>!current.assetHashes[f]),removed:Object.keys(current.assetHashes).filter(f=>!(f in hashes)),
 changed:files.filter(f=>current.assetHashes[f]!==hashes[f]).length,releaseStatus:manifest.releaseStatus},null,2));
