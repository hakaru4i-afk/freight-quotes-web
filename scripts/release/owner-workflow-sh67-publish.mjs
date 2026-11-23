// Prepare SH67 from exact verified live SH66 bytes; Owner-approved workflow lifecycle and archive UI.
// Every published file is downloaded and SHA-256 verified to prevent blank-page regressions.
import {readFileSync,writeFileSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('.release-pages');
const url='https://hakaru4i-afk.github.io/freight-quotes-web/';
const sha=b=>createHash('sha256').update(b).digest('hex');
const safe=p=>typeof p==='string'&&/^[a-zA-Z0-9._/-]+$/.test(p)&&!p.startsWith('/')&&
 !p.split('/').some(x=>!x||x==='..'||x.startsWith('.'));
const local=p=>resolve(root,p);
const read=p=>readFileSync(local(p));
const json=p=>JSON.parse(read(p).toString('utf8'));
const write=(p,v)=>{const file=local(p);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,Buffer.isBuffer(v)||typeof v==='string'?v:JSON.stringify(v,null,2)+'\n')};
const version='SH-01.30.67 v',date='2026-11-23';
const web=process.env.GITHUB_SHA||'',api=process.env.PORTAL_BACKEND_SHA||'';
if(!/^[a-f0-9]{40}$/.test(web)||! /^[a-f0-9]{40}$/.test(api))throw Error('SH67_APPROVED_SHA_MISSING');
const build=sha(web+api+version).slice(0,20);
async function get(p){
 if(!safe(p))throw Error('BAD_LIVE_PATH:'+p);
 for(let n=1;n<=3;n++){
  try{
   const r=await fetch(new URL(p,url),{cache:'no-store',signal:AbortSignal.timeout(25000)});
   if(!r.ok)throw Error('HTTP_'+r.status);
   return Buffer.from(await r.arrayBuffer());
  }catch(e){if(n===3)throw Error('LIVE_ASSET_DOWNLOAD_FAILED:'+p+':'+e.message);await new Promise(done=>setTimeout(done,n*500))}
 }
}
const manifest=JSON.parse((await get('production-release-manifest.json')).toString('utf8'));
if(manifest.businessVersion!=='SH-01.30.66 v'||manifest.environment!=='production'||!manifest.assets||Object.keys(manifest.assets).length<195)
 throw Error('LIVE_SH66_BASE_NOT_VERIFIED');
rmSync(root,{force:true,recursive:true});mkdirSync(root,{recursive:true});
const assets=Object.entries(manifest.assets);
let pointer=0;
await Promise.all(Array.from({length:8},async()=>{
 while(pointer<assets.length){
  const [p,expected]=assets[pointer++];
  if(!safe(p)||! /^[a-f0-9]{64}$/.test(expected))throw Error('BAD_MANIFEST_ENTRY:'+p);
  const bytes=await get(p);
  if(sha(bytes)!==expected)throw Error('LIVE_ASSET_SHA_MISMATCH:'+p);
  write(p,bytes);
 }
}));
// Keep exactly the reviewed staging build receipt included in the SH66 release.
const reviewedStagingInfo=readFileSync('test/build-info.json');
const stageInfo=JSON.parse(reviewedStagingInfo.toString('utf8'));
if(stageInfo.environment!=='staging'||stageInfo.projectRef!=='ibclzdkxiozbzmniiygv'||!stageInfo.stabilizationQa20261110)throw Error('STAGING_BUILD_INFO_UNVERIFIED');
write('test/build-info.json',reviewedStagingInfo);
manifest.assets['test/build-info.json']=sha(reviewedStagingInfo);
const oldBuild=json('build-info.json');
const oldRelease=json('release-status.json');
if(oldBuild.releaseVersion!=='SH-01.30.66 v'||oldRelease.version!=='SH-01.30.66 v')
 throw Error('LIVE_RELEASE_VERSION_MISMATCH');
const candidate=readFileSync('release/candidates/owner-workflow-lifecycle-20261123.js');
if(readFileSync('portal-feedback-center-20261107.js').equals(candidate))throw Error('RELEASE_HAS_NO_CHANGE');
for(const marker of ['Дедлайн исполнения','Completion deadline','完成截止日期','Отправить на приёмку','Принять разработку','Вернуть на доработку','Подтвердить выпуск и в архив','pf-rework','archive_published'])
 if(!candidate.toString('utf8').includes(marker))throw Error('P0_UI_MARKER_MISSING:'+marker);
for(const p of ['portal-feedback-center-20261107.js','test/portal-feedback-center-20261107.js'])write(p,candidate);
const releaseChanges=[
 'Понятная последовательность: обращение → разработка → проверка → приёмка владельцем → публикация → архив.',
 'Возврат на доработку возможен только с обязательным комментарием от 10 символов; он сохраняется в истории и GitHub Issue.',
 'Приёмка не равна выпуску, а архив подтверждается сервером по успешной публикации.',
 'Активные задачи и архив разделены, ручное изменение статуса не подменяет GitHub-проверки.'
];
const notes=json('release-status.json');
notes.version=version;notes.status='released';notes.date=date;notes.changes=releaseChanges;write('release-status.json',notes);
const info=json('build-info.json');
info.version=build;info.build=build;info.releaseVersion=version;info.releaseDate=date;info.releaseStatus='PUBLISHED';
info.frontendSourceCommit=web;info.backendSourceCommit=api;info.backendApiVersion=66;
write('build-info.json',info);
const site=json('site-status.json');
const release={version,date,title:'Центр доработок — приёмка, возврат и архив',changes:releaseChanges};
site.version=build;site.release=release;site.releaseStatus='released';site.maintenance=false;
site.releases=[release,...(site.releases||[]).filter(x=>x.version!==version)].slice(0,100);
write('site-status.json',site);
let app=read('app.js').toString('utf8');
if([...app.matchAll(/currentVersion:"[a-f0-9]{20}"/g)].length!==1)throw Error('APP_VERSION_NOT_UNIQUE');
app=app.replace(/currentVersion:"[a-f0-9]{20}"/g,'currentVersion:"'+build+'"');
write('app.js',app);
for(const p of ['index.html','test/index.html']){
 let html=read(p).toString('utf8');
 if(!/portal-feedback-center-20261107\.js\?v=/.test(html))throw Error('PORTAL_CENTER_SCRIPT_MISSING:'+p);
 html=html.replace(/portal-feedback-center-20261107\.js\?v=[A-Za-z0-9._-]+/g,
  'portal-feedback-center-20261107.js?v='+sha(candidate).slice(0,12));
 html=html.replace(/app\.js\?v=[a-f0-9]{12,20}/g,'app.js?v='+build);
 html=html.replace(/portal-release-status-20261117\.js\?v=SH-01\.30\.66%20v/g,
  'portal-release-status-20261117.js?v=SH-01.30.67%20v');
 write(p,html);
}
// Keep staging JS cache pinned to its own reviewed Git object SHA.
const stagingReviewed=readFileSync('test/index.html','utf8');
if(!stagingReviewed.includes('app.js?v=e74bbe578f34'))throw Error('STAGING_BUNDLE_HASH_NOT_REVIEWED');
write('test/index.html',stagingReviewed.replace(/portal-feedback-center-20261107\.js\?v=[A-Za-z0-9._-]+/g,
  'portal-feedback-center-20261107.js?v='+sha(candidate).slice(0,12)));
// No missing static imports are allowed, including the scoring module previously omitted.
const imported=[...app.matchAll(/\bfrom\s*["'](\.[^"']+)["']|\bimport\s*\(\s*["'](\.[^"']+)["']/g)]
 .map(m=>(m[1]||m[2]).split('?')[0].replace(/^\.\//,''));
for(const p of imported){if(!existsSync(local(p)))throw Error('MISSING_APP_IMPORT:'+p)}
// Root production HTML must resolve every linked asset. Staging /test/ is an existing
// independent environment whose older references are not altered by this P0 hotfix.
for(const m of read('index.html').toString('utf8').matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)){
 if(!existsSync(local(m[1])))throw Error('MISSING_PRODUCTION_ASSET:'+m[1]);
}
if(!existsSync(local('offer-scoring.mjs')))throw Error('SCORING_MODULE_LOST');
manifest.businessVersion=version;manifest.frontendBuild=build;manifest.frontendSourceCommit=web;
manifest.backendSourceCommit=api;manifest.backendApiVersion=66;manifest.publicationState='PUBLISHED';manifest.releaseDate=date;
manifest.ownerReleaseApproval='2026-11-23 Owner directive: correct lifecycle, mandatory GitHub rework note, safe review and verified archive';
// Preserve earlier SH64/SH65/SH66 release receipts; SH67 includes the active Supabase v66 API proof.
manifest.ownerWorkflowLifecycle={ownerApproved:true,apiVersion:66,apiBundleSha256:'091c2139e0972b91348bb9e31757aeaa44ad548e11b05b7bd4141a0fdaf9de55',uiSha256:sha(candidate),reworkCommentRequired:true,archiveRequiresVerifiedPublication:true,publishedAt:date};
for(const p of Object.keys(manifest.assets)){
 if(!existsSync(local(p)))throw Error('MISSING_MANIFEST_ASSET:'+p);
 manifest.assets[p]=sha(read(p));
}
for(const p of ['app.js','index.html','test/index.html','portal-feedback-center-20261107.js','test/portal-feedback-center-20261107.js',
 'build-info.json','site-status.json','release-status.json'])
 manifest.assets[p]=sha(read(p));
write('production-release-manifest.json',manifest);
write('.nojekyll','');
console.log('SH67_DEADLINE_COMPLETE_PACKAGE',JSON.stringify({version,build,assets:Object.keys(manifest.assets).length,imports:imported,apiVersion:66}));
