import {readFileSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export function checkAlignment(root){
 const read=p=>readFileSync(resolve(root,p));const m=JSON.parse(read('test/staging-manifest.json'));
 if(m.environment!=='staging'||m.releaseStatus!=='RELEASE_BLOCKED')throw Error('UNAUTHORIZED_RELEASE_STATE');
 if(!/^[a-f0-9]{40}$/.test(m.frontendCommit)||!m.businessVersions.length)throw Error('MISSING_PROVENANCE');
 if(!/^[a-f0-9]{64}$/.test(m.apiBundleSha256||'')||!/^[a-f0-9]{40}$/.test(m.apiSourceCommit||''))throw Error('MISSING_VERIFIED_RUNTIME_PAIR');
 const versions=new Map();for(const {version,issue}of m.businessVersions){if(versions.has(version)&&versions.get(version)!==issue)throw Error('BUSINESS_VERSION_COLLISION');versions.set(version,issue);}
 const hash=b=>createHash('sha256').update(b).digest('hex');
 const excluded=new Set(['test/staging-manifest.json','test/alignment-role-help.json','test/qa-robot-latest.json','test/qa-release-readiness.json']);
 function visit(dir){for(const e of readdirSync(resolve(root,dir),{withFileTypes:true})){if(['process-history','processes'].includes(e.name))continue;const p=dir+'/'+e.name;if(e.isDirectory())visit(p);else if(/\.(js|mjs|css|html|json|md|yml)$/.test(p)&&!excluded.has(p)&&!m.assetHashes[p])throw Error('UNINDEXED_DEPENDENCY:'+p);}}
 for(const d of ['test','docs','scripts','tests'])visit(d);
 for(const [path,expected]of Object.entries(m.assetHashes)){
  const absolute=resolve(root,path);if(!absolute.startsWith(resolve(root,'test')+'/')&&!absolute.startsWith(resolve(root,'docs')+'/')&&!absolute.startsWith(resolve(root,'scripts')+'/')&&!absolute.startsWith(resolve(root,'tests')+'/'))throw Error('INVALID_DEPENDENCY_PATH');
  if(hash(readFileSync(absolute))!==expected)throw Error('STALE_DEPENDENCY:'+path);
  if(hash(execFileSync('git',['show',m.frontendCommit+':'+path],{cwd:root}))!==expected)throw Error('SOURCE_COMMIT_MISMATCH:'+path);
 }
 const info=JSON.parse(read('test/build-info.json')),model=JSON.parse(read('test/business-process-model.json'));
 if(m.apiVersion!==info.task2.backendVersion||m.apiSourceCommit!==info.stabilizationQa20261110.backendSourceCommit||m.processModelVersion!==model.version)throw Error('VERSION_PAIR_MISMATCH');
 if(hash(read('test/alignment-role-help.json'))!==m.roleHelpSha256)throw Error('STALE_ROLE_HELP');
 const help=JSON.parse(read('test/alignment-role-help.json'));for(const [role,langs]of Object.entries(help.roles))for(const l of ['ru','en','zh'])if(!langs[l]?.length)throw Error('MISSING_ROLE_HELP:'+role+':'+l);
 const html=read('test/index.html').toString();for(const match of html.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:js|mjs|css))(?:\?[^"]*)?"/g))if(!m.assetHashes['test/'+match[1]])throw Error('UNINDEXED_RUNTIME_ASSET:'+match[1]);
 return m;
}
if(process.argv[1]===import.meta.filename){checkAlignment(resolve(import.meta.dirname,'..'));console.log('STAGING_ALIGNMENT_PASS');}
