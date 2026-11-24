// UI-only Owner-approved SH71 release. Source of truth: SHA-verified live SH70.
import {readFileSync,writeFileSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('.release-pages'),base='https://hakaru4i-afk.github.io/freight-quotes-web/';
const sha=x=>createHash('sha256').update(x).digest('hex');
const safe=p=>typeof p==='string'&&/^[\w./-]+$/.test(p)&&!p.startsWith('/')&&!p.split('/').some(s=>!s||s==='..'||s.startsWith('.'));
const path=p=>resolve(root,p),read=p=>readFileSync(path(p));
const json=p=>JSON.parse(read(p).toString('utf8'));
function write(p,x){mkdirSync(dirname(path(p)),{recursive:true});writeFileSync(path(p),Buffer.isBuffer(x)||typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');}
const version='SH-01.30.71 v',prior='SH-01.30.70 v',date='2026-11-24',source=process.env.GITHUB_SHA||'';
if(!/^[a-f0-9]{40}$/.test(source))throw Error('MISSING_SOURCE_SHA');
async function live(p){
 if(!safe(p))throw Error('UNSAFE_FILE:'+p);
 for(let attempt=1;attempt<=3;attempt++)try{
  const url=new URL(p,base);url.searchParams.set('verify',source.slice(0,12));
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('HTTP_'+response.status);
  return Buffer.from(await response.arrayBuffer());
 }catch(err){
  if(attempt===3)throw Error('DOWNLOAD_FAILED:'+p+':'+err.message);
  await new Promise(ok=>setTimeout(ok,attempt*750));
 }
}
const manifest=JSON.parse((await live('production-release-manifest.json')).toString('utf8'));
if(manifest.environment!=='production'||manifest.businessVersion!==prior||
 !manifest.assets||Object.keys(manifest.assets).length<190||
 !/^[a-f0-9]{40}$/.test(manifest.backendSourceCommit||''))
 throw Error('SH71_REQUIRES_SIGNED_SH70_PRODUCTION');
const build=sha(source+manifest.backendSourceCommit+version).slice(0,20);
rmSync(root,{recursive:true,force:true});mkdirSync(root,{recursive:true});
const assets=Object.entries(manifest.assets);
let i=0;
await Promise.all(Array.from({length:8},async()=>{
 while(i<assets.length){
  const [p,expected]=assets[i++];
  if(!safe(p)||!/^[a-f0-9]{64}$/.test(expected))throw Error('INVALID_ASSET_ENTRY:'+p);
  const bytes=await live(p);
  if(sha(bytes)!==expected)throw Error('SHA256_MISMATCH:'+p);
  write(p,bytes);
 }
}));
if(json('build-info.json').releaseVersion!==prior||
 json('release-status.json').version!==prior||
 json('site-status.json').release?.version!==prior)
 throw Error('LIVE_SH70_METADATA_CONFLICT');
const module='lw-pending-tasks-all-roles-20261109.js';
const candidate=readFileSync('release/candidates/lw-carrier-winner-only-home-sh71.js');
const code=candidate.toString('utf8');
if(!code.includes('async function fetchCarrier(){')||
 !code.includes('const work=await fetchTask2("carrier")')||
 !code.includes('Задачи по выигранным перевозкам')||
 code.includes('tasks.push(makeTask("invite:"'))
 throw Error('EXPECTED_WINNER_ONLY_CODE_NOT_PRESENT');
if(candidate.equals(read(module)))throw Error('NO_VERSION_CHANGE');
write(module,candidate);
for(const p of ['test/index.html','test/build-info.json','test/portal-feedback-center-20261107.js']){
 if(!manifest.assets[p]||sha(read(p))!==manifest.assets[p])throw Error('STAGING_NOT_SIGNED:'+p);
}
const changes=[
 'На главной каждого перевозчика показаны только задания по выигранным им перевозкам.',
 'Заявки, по которым выбран другой победитель, не отображаются в ожидающих заданиях.',
 'Принятие выигранной перевозки, фактический выход и документы остаются доступными.',
 'При ошибке сервера чужие задачи и старые приглашения не подставляются.',
 '«Мои заявки» и «Мои предложения» сохраняют историю и не удаляются.'
];
const release={version,date,title:'Задачи перевозчика только по выигранным перевозкам',changes};
const info=json('build-info.json');
info.version=build;info.build=build;info.releaseVersion=version;info.releaseDate=date;info.releaseStatus='PUBLISHED';info.frontendSourceCommit=source;
write('build-info.json',info);
const notes=json('release-status.json');notes.version=version;notes.date=date;notes.status='released';notes.changes=changes;write('release-status.json',notes);
const status=json('site-status.json');status.version=build;status.release=release;status.releaseStatus='released';status.maintenance=false;
status.releases=[release,...(status.releases||[]).filter(x=>x.version!==version)].slice(0,100);write('site-status.json',status);
let app=read('app.js').toString('utf8');
if([...app.matchAll(/currentVersion:"[a-f0-9]{20}"/g)].length!==1)throw Error('INVALID_APP_BUILD_MARKER');
app=app.replace(/currentVersion:"[a-f0-9]{20}"/g,'currentVersion:"'+build+'"');
write('app.js',app);
let html=read('index.html').toString('utf8');
const target=/lw-pending-tasks-all-roles-20261109\.js\?v=[a-zA-Z0-9._-]+/g;
if([...html.matchAll(target)].length!==1)throw Error('INBOX_SCRIPT_REFERENCE_NOT_UNIQUE');
html=html.replace(target,module+'?v='+sha(candidate).slice(0,12));
const appRx=/app\.js\?v=[a-f0-9]{12,20}/g;
if([...html.matchAll(appRx)].length!==1)throw Error('APP_INDEX_REFERENCE_NOT_UNIQUE');
html=html.replace(appRx,'app.js?v='+build);
html=html.replace(/portal-release-status-20261117\.js\?v=SH-01\.30\.70%20v/g,'portal-release-status-20261117.js?v=SH-01.30.71%20v');
write('index.html',html);
for(const p of Object.keys(manifest.assets)){
 if(!existsSync(path(p)))throw Error('MISSING_RELEASE_ASSET:'+p);
 manifest.assets[p]=sha(read(p));
}
for(const p of [module,'app.js','index.html','build-info.json','release-status.json','site-status.json'])manifest.assets[p]=sha(read(p));
for(const match of app.matchAll(/\bfrom\s*["'](\.[^"']+)["']|\bimport\s*\(\s*["'](\.[^"']+)["']/g)){
 const name=(match[1]||match[2]).split('?')[0].replace(/^\.\//,'');
 if(!existsSync(path(name)))throw Error('APP_IMPORT_MISSING:'+name);
}
for(const match of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)){
 if(!existsSync(path(match[1])))throw Error('INDEX_ASSET_MISSING:'+match[1]);
}
manifest.businessVersion=version;manifest.frontendBuild=build;manifest.frontendSourceCommit=source;
manifest.publicationState='PUBLISHED';manifest.releaseDate=date;
manifest.carrierWinnerOnlyHome={
 sourcePullRequest:185,allCarrierAccounts:true,serverScopedSource:'/api/task2?pending=1',
 invitationTasksRemoved:true,winnerExecutionTasksPreserved:true,
 stagingUnchanged:true,scriptSha256:sha(candidate)
};
write('production-release-manifest.json',manifest);write('.nojekyll','');
console.log('SH71_WINNER_ONLY_RELEASE_PACKAGE_PASS',JSON.stringify({version,build,assets:Object.keys(manifest.assets).length,scriptSha256:sha(candidate)}));
