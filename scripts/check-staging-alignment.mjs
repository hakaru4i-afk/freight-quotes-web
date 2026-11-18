import {readFileSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export function checkAlignment(root,{sourceOnly=false}={}){
 const read=p=>readFileSync(resolve(root,p));const m=JSON.parse(read('test/staging-manifest.json'));
 if(m.environment!=='staging'||m.releaseStatus!=='RELEASE_BLOCKED')throw Error('UNAUTHORIZED_RELEASE_STATE');
 if(!/^[a-f0-9]{40}$/.test(m.frontendCommit)||!m.businessVersions.length)throw Error('MISSING_PROVENANCE');
 const candidate=m.publicationState==='CANDIDATE_NOT_RELEASED';
 if(candidate){
  if(m.ownerAccepted!==false||m.runtimePairStatus!=='UNVERIFIED'||m.apiSourceCommit!==null||m.apiBundleSha256!==null||!/^[a-f0-9]{40}$/.test(m.backendSourceCommit||''))throw Error('INVALID_CANDIDATE_PROVENANCE');
  if(!sourceOnly)throw Error('MISSING_VERIFIED_RUNTIME_PAIR:CANDIDATE_NOT_RELEASED');
  if(!/^[a-f0-9]{40}$/.test(m.businessVersionSourceCommit||''))throw Error('MISSING_BUSINESS_VERSION_SOURCE');
  const original=JSON.parse(execFileSync('git',['show',m.businessVersionSourceCommit+':build-info.json'],{cwd:root}));
  if(original.releaseVersion!==m.primaryBusinessVersion)throw Error('BUSINESS_VERSION_SOURCE_MISMATCH');
  execFileSync('git',['merge-base','--is-ancestor',m.businessVersionSourceCommit,m.frontendCommit],{cwd:root});
 }else if(!/^[a-f0-9]{64}$/.test(m.apiBundleSha256||'')||!/^[a-f0-9]{40}$/.test(m.apiSourceCommit||''))throw Error('MISSING_VERIFIED_RUNTIME_PAIR');
 const versions=new Map();for(const {version,issue}of m.businessVersions){if(versions.has(version)&&versions.get(version)!==issue)throw Error('BUSINESS_VERSION_COLLISION');versions.set(version,issue);}
 const hash=b=>createHash('sha256').update(b).digest('hex');
 const excluded=new Set(['test/staging-manifest.json','test/alignment-role-help.json','test/qa-robot-latest.json','test/qa-release-readiness.json']);
 function visit(dir){for(const e of readdirSync(resolve(root,dir),{withFileTypes:true})){if(['process-history','processes'].includes(e.name))continue;const p=dir+'/'+e.name;if(e.isDirectory())visit(p);else if(/\.(js|mjs|css|html|json|md|yml|png|jpe?g|svg|webp|woff2?|ttf|otf)$/.test(p)&&!excluded.has(p)&&!m.assetHashes[p])throw Error('UNINDEXED_DEPENDENCY:'+p);}}
 for(const d of ['test','docs','scripts','tests','.github/workflows'])visit(d);
 for(const [path,expected]of Object.entries(m.assetHashes)){
  const absolute=resolve(root,path);if(!absolute.startsWith(resolve(root,'test')+'/')&&!absolute.startsWith(resolve(root,'docs')+'/')&&!absolute.startsWith(resolve(root,'scripts')+'/')&&!absolute.startsWith(resolve(root,'tests')+'/')&&!absolute.startsWith(resolve(root,'.github/workflows')+'/'))throw Error('INVALID_DEPENDENCY_PATH');
  if(hash(readFileSync(absolute))!==expected)throw Error('STALE_DEPENDENCY:'+path);
  if(hash(execFileSync('git',['show',m.frontendCommit+':'+path],{cwd:root,maxBuffer:16*1024*1024}))!==expected)throw Error('SOURCE_COMMIT_MISMATCH:'+path);
 }
 const info=JSON.parse(read('test/build-info.json')),model=JSON.parse(read('test/business-process-model.json'));
 if(m.primaryBusinessVersion!==info.primaryBusinessVersion||!versions.has(info.primaryBusinessVersion)||info.releaseVersion!==info.primaryBusinessVersion)throw Error('PRIMARY_BUSINESS_VERSION_MISMATCH');
 if(!/^\d{14}$/.test(m.sqlMigrationVersion||'')||m.sqlMigrationVersion!==info.sqlMigrationVersion)throw Error('SQL_MIGRATION_VERSION_MISMATCH');
 if(m.processModelVersion!==model.version)throw Error('VERSION_PAIR_MISMATCH');
 if(candidate){
  const c=info.carrierDashboard124;
  if(c?.status!=='UNPUBLISHED_CANDIDATE'||c.releaseGate!=='BLOCKED'||c.ownerAccepted!==false||m.backendSourceCommit!==c.backendSourceCommit||model.reviewedBackendSourceCommit!==c.backendSourceCommit||m.apiVersion!==info.observedBackendDeployment?.version||info.observedBackendDeployment?.sourceBindingStatus!=='UNVERIFIED')throw Error('VERSION_PAIR_MISMATCH');
 }else if(m.apiVersion!==info.task2.backendVersion||m.apiSourceCommit!==info.stabilizationQa20261110.backendSourceCommit)throw Error('VERSION_PAIR_MISMATCH');
 if(hash(read('test/alignment-role-help.json'))!==m.roleHelpSha256)throw Error('STALE_ROLE_HELP');
 const help=JSON.parse(read('test/alignment-role-help.json'));for(const [role,langs]of Object.entries(help.roles))for(const l of ['ru','en','zh'])if(!langs[l]?.length)throw Error('MISSING_ROLE_HELP:'+role+':'+l);
 const html=read('test/index.html').toString();for(const match of html.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:js|mjs|css))(?:\?[^"]*)?"/g))if(!m.assetHashes['test/'+match[1]])throw Error('UNINDEXED_RUNTIME_ASSET:'+match[1]);
 return m;
}
if(process.argv[1]===import.meta.filename){const sourceOnly=process.argv.includes('--source-only');checkAlignment(resolve(import.meta.dirname,'..'),{sourceOnly});console.log(sourceOnly?'CANDIDATE_SOURCE_ALIGNMENT_PASS; RELEASE_BLOCKED':'STAGING_ALIGNMENT_PASS');}
