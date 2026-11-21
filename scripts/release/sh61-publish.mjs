// Owner-approved one-shot SH61 release assembly; no deployment without API smoke and Pages verification.
import {readFileSync,writeFileSync,existsSync,readdirSync,lstatSync,mkdirSync,rmSync,cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join,relative,sep} from 'node:path';
import {assertProductionReleaseIntegrity} from '../../tests/helpers/production-release-boundary.mjs';
const root=resolve(import.meta.dirname,'../..');
const version='SH-01.30.61 v',date='2026-11-22',state=process.argv[2];
if(!['updating','released'].includes(state))throw Error('RELEASE_STATE_REQUIRED');
const sourceSha=process.env.GITHUB_SHA||'';
if(!/^[a-f0-9]{40}$/.test(sourceSha))throw Error('MISSING_IMMUTABLE_RELEASE_SOURCE_SHA');
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>readFileSync(join(root,p),'utf8');
const write=(p,s)=>writeFileSync(join(root,p),typeof s==='string'?s:JSON.stringify(s,null,2)+'\n');
const note=JSON.parse(read('docs/releases/SH-01.30.61-candidate.json'));
if(note.version!==version||note.date!==date||!Array.isArray(note.changes)||!note.changes[0]?.includes('Центр доработок'))throw Error('UNREVIEWED_RELEASE_NOTES');
const release={version,date,title:note.title,changes:note.changes};
const build=hash('production-owner-release|'+version+'|'+sourceSha).slice(0,20);
const data=JSON.parse(read('site-status.json'));
data.release=release;data.releases=[release,...(data.releases||[]).filter(x=>x.version!==version)];
data.releaseStatus=state;data.version=build;
write('site-status.json',data);
const ownerStatus=JSON.parse(read('release-status.json'));
write('release-status.json',{version,ownerVersion:ownerStatus.ownerVersion,status:state,date,changes:release.changes});
const info=JSON.parse(read('build-info.json'));
if(info.environment!=='production'||info.projectRef!=='ooclsrndeygojtofuyte')throw Error('NOT_PRODUCTION_ROOT');
info.releaseVersion=version;info.releaseDate=date;info.releaseStatus=state==='released'?'PUBLISHED':'DEPLOYING';info.build=build;info.version=build;
write('build-info.json',info);
let app=read('app.js');
const matches=[...app.matchAll(/currentVersion:"[a-f0-9]{20}"/g)];
if(matches.length!==1)throw Error('APP_BUILD_MARKER_NOT_UNIQUE:'+matches.length);
app=app.replace(/currentVersion:"[a-f0-9]{20}"/,'currentVersion:"'+build+'"');
write('app.js',app);
let html=read('index.html');
if(!html.includes('bundle.css')||!html.includes('owner-register-task-actions-20261121.js')||!html.includes('portal-feedback-center-20261107.js'))throw Error('CSS_OR_OWNER_BUTTON_BUNDLE_NOT_LINKED');
html=html.replace(/app\.js\?v=[a-f0-9]{20}/g,'app.js?v='+build);
const notice=/portal-release-status-20261117\.js\?v=[^"]+/g;
if([...html.matchAll(notice)].length!==1)throw Error('RELEASE_NOTIFICATION_SCRIPT_NOT_UNIQUE');
html=html.replace(notice,'portal-release-status-20261117.js?v=SH-01.30.61%20v&rev=unified');
write('index.html',html);
const ui=read('owner-register-task-actions-20261121.js');
for(const s of ['Запустить в разработку','Отложить','Отклонить','Прогресс выполнения'])if(!ui.includes(s))throw Error('OWNER_CARD_ACTION_MISSING:'+s);
const manifest=JSON.parse(read('production-release-manifest.json'));
if(manifest.environment!=='production'||!manifest.sourceStagingBuild||!manifest.sourceStagingFrontendCommit)throw Error('PROVENANCE_MISSING');
manifest.businessVersion=version;manifest.frontendBuild=build;manifest.publicationState=state==='released'?'PUBLISHED':'DEPLOYING';
manifest.sourceProductionCommit=sourceSha;
manifest.ownerReleaseApproval='2026-11-22: Owner explicitly requested SH61 release after production API v47 deployment';
const paths=new Set(Object.keys(manifest.assets||{}));
for(const m of html.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:js|mjs|css))(?:\?[^"]*)?"/g))paths.add(m[1]);
paths.add('release-status.json');paths.add('portal-release-status-20261117.js');paths.add('owner-register-task-actions-20261121.js');paths.add('owner-register-task-actions-20261121.css');
manifest.assets={};
for(const name of [...paths].sort()){
 if(name.startsWith('/')||name.includes('..')||!existsSync(join(root,name)))throw Error('MISSING_PUBLIC_ASSET:'+name);
 manifest.assets[name]=hash(readFileSync(join(root,name)));
}
write('production-release-manifest.json',manifest);
assertProductionReleaseIntegrity(root);
if(manifest.assets['owner-register-task-actions-20261121.js']!==hash(readFileSync(join(root,'owner-register-task-actions-20261121.js'))))throw Error('OWNER_UI_DIGEST_MISMATCH');
const out=join(root,'.release-pages');rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
const allowed=/\.(?:js|mjs|css|html|json|svg|webp|png|jpe?g|gif|ico|wasm|gz|woff2?|ttf|otf|txt)$/i;
const publicDirs=new Set(['test','global-view','processes','process-history']);
const sensitive=/^(?:node_modules|reports|scripts|tests|docs|config|release|\.git|\.github|\.release-pages)$/;
const forbidden=/(?:^|[-_.])(?:secret|private-key|credential|session-token|password|database-url)(?:[-_.]|$)/i;
function copy(path){
 const rel=relative(root,path).split(sep).join('/');
 if(!rel||rel.startsWith('..'))throw Error('UNSAFE_PATH');
 const st=lstatSync(path);
 if(st.isSymbolicLink())throw Error('SYMLINK_PUBLIC_ARTIFACT:'+rel);
 if(st.isDirectory()){
  if(rel.split('/').some(x=>sensitive.test(x)))return;
  for(const name of readdirSync(path))copy(join(path,name));
  return;
 }
 if(!st.isFile()||forbidden.test(rel))throw Error('UNSAFE_PUBLIC_ARTIFACT:'+rel);
 if(!allowed.test(rel)&&rel!=='.nojekyll')return;
 const target=join(out,rel);mkdirSync(resolve(target,'..'),{recursive:true});cpSync(path,target);
}
for(const name of readdirSync(root)){
 if(name==='.nojekyll'){copy(join(root,name));continue;}
 if(name.startsWith('.'))continue;
 const path=join(root,name);
 if(lstatSync(path).isDirectory()){if(publicDirs.has(name))copy(path);}
 else if(allowed.test(name)&&!forbidden.test(name))copy(path);
}
for(const name of Object.keys(manifest.assets))if(!existsSync(join(out,name)))throw Error('MISSING_PACKAGED_ASSET:'+name);
if(!existsSync(join(out,'test/index.html')))throw Error('STAGING_ENTRYPOINT_MISSING');
console.log('SH61_RELEASE_ASSEMBLY_PASS',JSON.stringify({state,version,build,assetCount:Object.keys(manifest.assets).length,sourceSha}));
