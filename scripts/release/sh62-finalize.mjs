// Owner-approved P0 SH62 release metadata; run ONLY after verifying live SH61 assets.
// This script modifies the staged Pages artifact; it does not deploy by itself.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve('.release-pages');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const version='SH-01.30.62 v';
const date='2026-11-23';
const web=process.env.GITHUB_SHA||'';
const api=process.env.PORTAL_BACKEND_SHA||'';
if(!/^[a-f0-9]{40}$/.test(web)||! /^[a-f0-9]{40}$/.test(api))throw Error('RELEASE_SHA_NOT_PINNED');
const path=name=>join(out,name);
const read=name=>readFileSync(path(name));
const json=name=>JSON.parse(read(name).toString('utf8'));
const write=(name,data)=>writeFileSync(path(name),typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');
const manifest=json('production-release-manifest.json');
const info=json('build-info.json');
const status=json('release-status.json');
const site=json('site-status.json');
if(manifest.businessVersion!=='SH-01.30.61 v'||status.version!=='SH-01.30.61 v'||
 info.releaseVersion!=='SH-01.30.61 v'||info.environment!=='production'||
 manifest.environment!=='production')throw Error('UNEXPECTED_PRODUCTION_BASE_VERSION');
const candidate=readFileSync('release/owner-portal-feedback-center-20261122.js');
for(const name of ['portal-feedback-center-20261107.js','test/portal-feedback-center-20261107.js']){
 if(!read(name).equals(candidate))throw Error('UNREVIEWED_UI_CANDIDATE:'+name);
}
const ui=candidate.toString('utf8');
for(const snippet of ['Codex пишет код (Работает)','Ветка создана, ожидает Codex','Проверки пройдены, готов к приёмке','fetchExecutions().then'])
 if(!ui.includes(snippet))throw Error('P0_UI_STATUS_MISSING:'+snippet);
const build=sha(web+api+version).slice(0,20);
const changes=[
 'Центр доработок показывает реальные этапы GitHub и Codex, без условных 10% и 50%.',
 'GitHub Actions запускает авторизованный Codex CLI; отсутствие входа, запуска или изменений завершается ошибкой.',
 'Результат GitHub, причина ошибки и ссылка на запуск обновляются автоматически; интерфейс RU/EN/ZH.',
 'Серверный API freight-api v58 проверяет запуск и записывает ошибки в рабочую базу.'
];
const release={version,date,title:'P0: запуск Codex и честный статус разработки',changes};
status.version=version;status.date=date;status.status='released';status.changes=changes;
write('release-status.json',status);
info.version=build;info.build=build;info.releaseVersion=version;info.releaseDate=date;info.releaseStatus='PUBLISHED';
info.frontendSourceCommit=web;info.backendSourceCommit=api;info.backendApiVersion=58;
write('build-info.json',info);
site.environment='production';site.maintenance=false;site.version=build;site.releaseStatus='released';site.release=release;
site.releases=[release,...(site.releases||[]).filter(x=>x.version!==version)].slice(0,100);
write('site-status.json',site);
let app=read('app.js').toString('utf8');
const marker=/currentVersion:"[a-f0-9]{20}"/g;
if([...app.matchAll(marker)].length!==1)throw Error('APP_VERSION_MARKER_NOT_UNIQUE');
app=app.replace(marker,'currentVersion:"'+build+'"');
write('app.js',app);
for(const name of ['index.html','test/index.html']){
 let html=read(name).toString('utf8');
 if(!/app\.js\?v=[a-f0-9]{20}/.test(html))throw Error('APP_REFERENCE_MISSING:'+name);
 html=html.replace(/app\.js\?v=[a-f0-9]{20}/g,'app.js?v='+build);
 html=html.replace(/portal-release-status-20261117\.js\?v=SH-01\.30\.61%20v/g,
  'portal-release-status-20261117.js?v=SH-01.30.62%20v');
 write(name,html);
}
manifest.businessVersion=version;manifest.frontendBuild=build;manifest.frontendSourceCommit=web;
manifest.backendSourceCommit=api;manifest.backendApiVersion=58;manifest.publicationState='PUBLISHED';
manifest.sourceProductionCommit=web;manifest.releaseDate=date;
manifest.ownerReleaseApproval='2026-11-23: Owner authorized P0 SH62 production release and API deployment';
manifest.ownerUiHotfix={...(manifest.ownerUiHotfix||{}),type:'P0_CODEX_WORKFLOW_AND_STATUS',
 frontendSourceCommit:web,backendSourceCommit:api,backendChanged:true,newRootScriptSha256:sha(candidate)};
for(const name of Object.keys(manifest.assets||{})){
 if(!existsSync(path(name)))throw Error('PUBLISHED_ASSET_MISSING:'+name);
 manifest.assets[name]=sha(read(name));
}
for(const name of ['app.js','index.html','test/index.html','portal-feedback-center-20261107.js','test/portal-feedback-center-20261107.js',
 'release-status.json','build-info.json','site-status.json']){
 manifest.assets[name]=sha(read(name));
}
write('production-release-manifest.json',manifest);
if(json('build-info.json').releaseVersion!==version||json('production-release-manifest.json').businessVersion!==version)
 throw Error('VERSION_READBACK_FAILED');
console.log('SH62_PACKAGE_VALIDATED',JSON.stringify({version,frontend:web,backend:api,backendApiVersion:58,assets:Object.keys(manifest.assets).length,build}));
