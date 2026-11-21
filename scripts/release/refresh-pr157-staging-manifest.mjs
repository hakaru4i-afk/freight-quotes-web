// Rebuild PR #157 staging provenance from the exact tracked source tree.
// This is a candidate-only operation: NEVER authorizes production publication.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'../..');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const read=p=>readFileSync(resolve(root,p));
const hash=b=>createHash('sha256').update(b).digest('hex');
const path='test/staging-manifest.json';
if(process.env.GITHUB_REPOSITORY!=='hakaru4i-afk/freight-quotes-web' ||
 process.env.GITHUB_REF!=='refs/heads/feature/owner-ci-release-readiness-20261121' ||
 process.env.GITHUB_ACTOR!=='hakaru4i-afk')throw Error('CANDIDATE_OWNER_BRANCH_ONLY');
const sourceCommit=git('rev-parse','HEAD');
if(!/^[0-9a-f]{40}$/.test(sourceCommit)||git('branch','--show-current')!=='feature/owner-ci-release-readiness-20261121')throw Error('INVALID_SOURCE_COMMIT');
if(git('status','--porcelain'))throw Error('UNCLEAN_CANDIDATE_SOURCE');
const manifest=JSON.parse(read(path)),info=JSON.parse(read('test/build-info.json')),model=JSON.parse(read('test/business-process-model.json'));
if(manifest.environment!=='staging'||manifest.releaseStatus!=='RELEASE_BLOCKED'||manifest.publicationState==='PUBLISHED')throw Error('RELEASE_SCOPE_FORBIDDEN');
if(info.environment!=='staging'||info.releaseVersion!==info.primaryBusinessVersion||!manifest.businessVersions.some(x=>x.version===info.primaryBusinessVersion))throw Error('MISSING_REVIEWED_SH59_VERSION');
const apiSource=info.stabilizationQa20261110?.backendSourceCommit,apiBundle=info.stabilizationQa20261110?.sharedBackendBundleSha256;
if(!/^[0-9a-f]{40}$/.test(apiSource||'')||!/^[0-9a-f]{64}$/.test(apiBundle||'')||!Number.isInteger(info.task2?.backendVersion))throw Error('UNVERIFIED_STAGING_API_PAIR');
const excludes=new Set(['test/staging-manifest.json','test/alignment-role-help.json','test/qa-robot-latest.json','test/qa-release-readiness.json']);
const entries=[];
function walk(dir){for(const item of readdirSync(resolve(root,dir),{withFileTypes:true})){
 if(['process-history','processes'].includes(item.name))continue;
 const p=dir+'/'+item.name;
 if(item.isDirectory())walk(p);
 else if(item.isFile()&&/\.(js|mjs|css|html|json|md|yml|png|jpe?g|svg|webp|woff2?|ttf|otf)$/.test(item.name)&&!excludes.has(p))entries.push(p);
 else if(item.isSymbolicLink())throw Error('SYMLINK_IN_CANDIDATE:'+p);
}}
for(const dir of ['test','docs','scripts','tests','.github/workflows'])walk(dir);
entries.sort();
const assets={};
for(const p of entries){
 const bytes=read(p),committed=execFileSync('git',['show',sourceCommit+':'+p],{cwd:root,maxBuffer:16*1024*1024});
 if(!bytes.equals(committed))throw Error('UNCOMMITTED_SOURCE_BYTES:'+p);
 assets[p]=hash(bytes);
}
manifest.frontendCommit=sourceCommit;
manifest.assetHashes=assets;
manifest.primaryBusinessVersion=info.primaryBusinessVersion;
manifest.apiVersion=info.task2.backendVersion;
manifest.apiSourceCommit=apiSource;
manifest.apiBundleSha256=apiBundle;
manifest.sqlMigrationVersion=info.sqlMigrationVersion;
manifest.processModelVersion=model.version;
manifest.roleHelpSha256=hash(read('test/alignment-role-help.json'));
// Deliberately preserve all historical decisions, QA evidence, publication state,
// rollback evidence and canonicalHash. Never invent a canonical proof or PASS.
if(manifest.releaseStatus!=='RELEASE_BLOCKED')throw Error('UNSAFE_RELEASE_STATE');
writeFileSync(resolve(root,path),JSON.stringify(manifest,null,2)+'\n');
console.log('STAGING_CANDIDATE_MANIFEST_REGENERATED',JSON.stringify({sourceCommit,assetCount:entries.length,apiVersion:manifest.apiVersion,primaryBusinessVersion:manifest.primaryBusinessVersion,releaseStatus:manifest.releaseStatus}));
