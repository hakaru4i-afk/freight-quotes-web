// Approved SH69 UI-only release: each filled Excel / CSV row is one carrier rate variant.
// The input is the exact live SH68 Pages manifest; every byte is hash-verified
// before a new release artifact is assembled. This script DOES NOT deploy.
import {readFileSync,writeFileSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';

const root=resolve('.release-pages');
const base='https://hakaru4i-afk.github.io/freight-quotes-web/';
const sha=value=>createHash('sha256').update(value).digest('hex');
const safe=p=>typeof p==='string'&&/^[a-zA-Z0-9._/-]+$/.test(p)&&
 !p.startsWith('/')&&!p.split('/').some(s=>!s||s==='..'||s.startsWith('.'));
const local=p=>resolve(root,p);
const read=p=>readFileSync(local(p));
const json=p=>JSON.parse(read(p).toString('utf8'));
const write=(p,value)=>{
 const target=local(p);mkdirSync(dirname(target),{recursive:true});
 writeFileSync(target,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
};
const version='SH-01.30.69 v',date='2026-11-24';
const frontend=process.env.GITHUB_SHA||'';
if(!/^[a-f0-9]{40}$/.test(frontend))throw Error('INVALID_FRONTEND_RELEASE_SOURCE_SHA');

async function fetchLive(path){
 if(!safe(path))throw Error('UNSAFE_LIVE_PATH:'+path);
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const url=new URL(path,base);url.searchParams.set('verify',frontend.slice(0,12));
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error('HTTP_'+response.status);
   return Buffer.from(await response.arrayBuffer());
  }catch(error){
   if(attempt===3)throw Error('LIVE_ASSET_FETCH_FAILED:'+path+':'+error.message);
   await new Promise(resolve=>setTimeout(resolve,attempt*700));
  }
 }
}
const manifest=JSON.parse((await fetchLive('production-release-manifest.json')).toString('utf8'));
if(manifest.environment!=='production'||manifest.businessVersion!=='SH-01.30.68 v'
 ||!manifest.assets||Object.keys(manifest.assets).length<190)
 throw Error('SH69_BASE_MUST_BE_VERIFIED_LIVE_SH68');
if(!/^[a-f0-9]{40}$/.test(manifest.backendSourceCommit||''))
 throw Error('BACKEND_COMPATIBILITY_ID_MISSING');
const backend=manifest.backendSourceCommit;
const build=sha(frontend+backend+version).slice(0,20);

rmSync(root,{recursive:true,force:true});mkdirSync(root,{recursive:true});
const entries=Object.entries(manifest.assets);
let pointer=0;
await Promise.all(Array.from({length:8},async()=>{
 while(pointer<entries.length){
  const [path,expected]=entries[pointer++];
  if(!safe(path)||!/^[a-f0-9]{64}$/.test(expected))throw Error('UNSAFE_MANIFEST_ASSET:'+path);
  const bytes=await fetchLive(path);
  if(sha(bytes)!==expected)throw Error('PUBLISHED_SHA256_MISMATCH:'+path);
  write(path,bytes);
 }
}));
if(json('build-info.json').releaseVersion!=='SH-01.30.68 v'
 ||json('release-status.json').version!=='SH-01.30.68 v'
 ||json('site-status.json').release?.version!=='SH-01.30.68 v')
 throw Error('LIVE_BASE_VERSION_INCONSISTENT');

const guidance=readFileSync('release/candidates/carrier-multirow-guidance-20261124.js');
const codec=readFileSync('release/candidates/carrier-multirow-xlsx-20261124.js');
if(!guidance.includes('async function importQuoteRows(')
 ||!guidance.includes('if(quote)return importQuoteRows(form,rows,quote);')
 ||!guidance.includes('const newCount=variants.length-quote.prefixes.length')
 ||!codec.includes('if(rows.length>21)'))
 throw Error('APPROVED_MULTIRATE_CANDIDATE_MISSING');
if(read('task2-guidance-42dc6ccc8a20.js').equals(guidance)
 ||read('carrier-csv-wps-hotfix.js').equals(codec))
 throw Error('NO_CHANGES_TO_RELEASE');

write('task2-guidance-42dc6ccc8a20.js',guidance);
write('carrier-csv-wps-hotfix.js',codec);
// Staging /test/ is independently signed. Never silently replace its runtime.
for(const path of ['test/task2-guidance-42dc6ccc8a20.js','test/task2-guidance.js','test/carrier-csv-wps-hotfix.js']){
 const file=read(path);
 if(sha(file)!==manifest.assets[path])throw Error('STAGING_ASSET_CHANGED:'+path);
}

const changes=[
 'Импорт 1–20 заполненных строк Excel/CSV как отдельных вариантов ставки перевозчика.',
 'Пустые строки игнорируются, ошибки содержат номер строки, все строки проверяются до записи в форму.',
 'Существующие варианты заменяются без переноса устаревших маршрутов или комментариев.',
 'Предпросмотр и явная отправка ставок перевозчиком сохранены; автоматическая отправка отсутствует.'
];
const release={version,date,title:'Массовый импорт Excel/CSV ставок перевозчика',changes};
const info=json('build-info.json');
info.version=build;info.build=build;info.releaseVersion=version;info.releaseDate=date;
info.releaseStatus='PUBLISHED';info.frontendSourceCommit=frontend;
// This is a UI-only release. Do not falsify or silently upgrade backend identity.
write('build-info.json',info);
const notes=json('release-status.json');
notes.version=version;notes.date=date;notes.status='released';notes.changes=changes;
write('release-status.json',notes);
const site=json('site-status.json');
site.version=build;site.release=release;site.releaseStatus='released';site.maintenance=false;
site.releases=[release,...(site.releases||[]).filter(x=>x.version!==version)].slice(0,100);
write('site-status.json',site);

let app=read('app.js').toString('utf8');
if([...app.matchAll(/currentVersion:"[a-f0-9]{20}"/g)].length!==1)
 throw Error('APP_CURRENT_VERSION_MARKER_INVALID');
app=app.replace(/currentVersion:"[a-f0-9]{20}"/g,'currentVersion:"'+build+'"');
write('app.js',app);
let html=read('index.html').toString('utf8');
for(const [path,bytes] of [
 ['task2-guidance-42dc6ccc8a20.js',guidance],
 ['carrier-csv-wps-hotfix.js',codec]
]){
 const rx=new RegExp('(?<=src="./)'+path.replace(/\./g,'\\.')+'\\?v=[A-Za-z0-9._-]+','g');
 const found=[...html.matchAll(rx)];
 if(found.length!==1)throw Error('EXPECTED_ONE_HTML_REFERENCE:'+path+':'+found.length);
 html=html.replace(rx,path+'?v='+sha(bytes).slice(0,12));
}
if([...html.matchAll(/app\.js\?v=[a-f0-9]{12,20}/g)].length!==1)
 throw Error('APP_REFERENCE_NOT_UNIQUE');
html=html.replace(/app\.js\?v=[a-f0-9]{12,20}/g,'app.js?v='+build);
html=html.replace(/portal-release-status-20261117\.js\?v=SH-01\.30\.68%20v/g,
 'portal-release-status-20261117.js?v=SH-01.30.69%20v');
write('index.html',html);

// Complete package integrity. Do not bring extra JS from unreviewed Git main.
for(const p of Object.keys(manifest.assets)){
 if(!existsSync(local(p)))throw Error('MISSING_RELEASE_ASSET:'+p);
 manifest.assets[p]=sha(read(p));
}
for(const p of ['app.js','index.html','build-info.json','site-status.json',
                 'release-status.json','task2-guidance-42dc6ccc8a20.js','carrier-csv-wps-hotfix.js'])
 manifest.assets[p]=sha(read(p));
for(const m of app.matchAll(/\bfrom\s*["'](\.[^"']+)["']|\bimport\s*\(\s*["'](\.[^"']+)["']/g)){
 const path=(m[1]||m[2]).split('?')[0].replace(/^\.\//,'');
 if(!existsSync(local(path)))throw Error('MISSING_APP_JS_IMPORT:'+path);
}
for(const m of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)){
 if(!existsSync(local(m[1])))throw Error('MISSING_ROOT_PAGE_ASSET:'+m[1]);
}
if(!existsSync(local('offer-scoring.mjs')))throw Error('MISSING_SCORING_IMPORT');

manifest.businessVersion=version;manifest.frontendBuild=build;
manifest.frontendSourceCommit=frontend;manifest.publicationState='PUBLISHED';
manifest.releaseDate=date;
manifest.carrierMultirowExcel={
 ownerApproved:true,
 approval:'2026-11-24 Owner directive: Выпусти обновление',
 sourcePullRequest:179,fastCiRun:45351464888,
 csvGuidanceSha256:sha(guidance),xlsxCodecSha256:sha(codec),
 maxVariantsPerFile:20,automaticSubmission:false,
 productionOnly:true,independentStagingPreserved:true
};
write('production-release-manifest.json',manifest);
write('.nojekyll','');
console.log('SH69_MULTIROW_PACKAGE_OK',JSON.stringify({
 version,build,assets:Object.keys(manifest.assets).length,
 sourceFrontend:frontend,backendSourcePreserved:backend,
 guidanceSha256:sha(guidance),codecSha256:sha(codec),
 stagingUnchanged:true
}));
