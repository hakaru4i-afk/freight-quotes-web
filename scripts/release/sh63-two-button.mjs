// Assemble SH63 from the exact LIVE SH62 site. Do not substitute repo/main app assets.
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
const write=(p,v)=>{const file=local(p);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n')};
const version='SH-01.30.63 v',date='2026-11-23';
const web=process.env.GITHUB_SHA||'',api=process.env.PORTAL_BACKEND_SHA||'';
if(!/^[a-f0-9]{40}$/.test(web)||! /^[a-f0-9]{40}$/.test(api))throw Error('SH63_APPROVED_SHA_MISSING');
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
if(manifest.businessVersion!=='SH-01.30.62 v'||manifest.environment!=='production'||!manifest.assets||Object.keys(manifest.assets).length<195)
 throw Error('LIVE_SH62_BASE_NOT_VERIFIED');
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
const oldBuild=json('build-info.json');
const oldRelease=json('release-status.json');
if(oldBuild.releaseVersion!=='SH-01.30.62 v'||oldRelease.version!=='SH-01.30.62 v')
 throw Error('LIVE_RELEASE_VERSION_MISMATCH');
const candidate=readFileSync('release/owner-portal-feedback-center-20261122.js');
for(const p of ['portal-feedback-center-20261107.js','test/portal-feedback-center-20261107.js'])
 if(!readFileSync(p).equals(candidate))throw Error('STAGING_RELEASE_UI_DIVERGENCE:'+p);
for(const marker of ['Передать в GitHub','Запустить Codex',"action:'run_codex'",'CODEX_NETWORK_BLOCKED_403','codex_failed','data-pf="start-codex"'])
 if(!candidate.toString('utf8').includes(marker))throw Error('P0_UI_MARKER_MISSING:'+marker);
for(const p of ['portal-feedback-center-20261107.js','test/portal-feedback-center-20261107.js'])write(p,candidate);
const releaseChanges=[
 'В Центре доработок две отдельные кнопки: «Передать в GitHub» и «Запустить Codex».',
 'Передача создаёт только ветку и Issue; Codex запускается отдельно с разрешения Владельца.',
 'Ошибки Codex, код причины и ссылка на GitHub Actions выводятся в карточке, RU/EN/ZH.',
 'Supabase freight-api v59 проверяет существующую ветку и Issue и отслеживает отдельный запуск Codex.'
];
const notes=json('release-status.json');
notes.version=version;notes.status='released';notes.date=date;notes.changes=releaseChanges;write('release-status.json',notes);
const info=json('build-info.json');
info.version=build;info.build=build;info.releaseVersion=version;info.releaseDate=date;info.releaseStatus='PUBLISHED';
info.frontendSourceCommit=web;info.backendSourceCommit=api;info.backendApiVersion=59;
write('build-info.json',info);
const site=json('site-status.json');
const release={version,date,title:'Две кнопки GitHub и Codex — P0',changes:releaseChanges};
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
 html=html.replace(/portal-release-status-20261117\.js\?v=SH-01\.30\.62%20v/g,
  'portal-release-status-20261117.js?v=SH-01.30.63%20v');
 write(p,html);
}
// No missing static imports are allowed, including the scoring module previously omitted.
const imported=[...app.matchAll(/\bfrom\s*["'](\.[^"']+)["']|\bimport\s*\(\s*["'](\.[^"']+)["']/g)]
 .map(m=>(m[1]||m[2]).split('?')[0].replace(/^\.\//,''));
for(const p of imported){if(!existsSync(local(p)))throw Error('MISSING_APP_IMPORT:'+p)}
for(const p of ['index.html','test/index.html']){
 for(const m of read(p).toString('utf8').matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)){
  if(!existsSync(local(m[1])))throw Error('MISSING_HTML_ASSET:'+p+':'+m[1]);
 }
}
if(!existsSync(local('offer-scoring.mjs')))throw Error('SCORING_MODULE_LOST');
manifest.businessVersion=version;manifest.frontendBuild=build;manifest.frontendSourceCommit=web;
manifest.backendSourceCommit=api;manifest.backendApiVersion=59;manifest.publicationState='PUBLISHED';manifest.releaseDate=date;
manifest.ownerReleaseApproval='2026-11-23 Owner-approved two-button Codex and visible error UI';
manifest.twoButtonCodex={ownerApproved:true,backendChanged:true,uiSha256:sha(candidate),publishedAt:date};
for(const p of Object.keys(manifest.assets)){
 if(!existsSync(local(p)))throw Error('MISSING_MANIFEST_ASSET:'+p);
 manifest.assets[p]=sha(read(p));
}
for(const p of ['app.js','index.html','test/index.html','portal-feedback-center-20261107.js','test/portal-feedback-center-20261107.js',
 'build-info.json','site-status.json','release-status.json'])
 manifest.assets[p]=sha(read(p));
write('production-release-manifest.json',manifest);
write('.nojekyll','');
console.log('SH63_COMPLETE_PACKAGE',JSON.stringify({version,build,assets:Object.keys(manifest.assets).length,imports:imported,apiVersion:59}));
