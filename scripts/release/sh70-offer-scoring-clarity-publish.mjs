// SH70 Owner release: publish clear quote status without changing the seven-criteria math.
// Assemble from exactly live SHA256-verified SH69 Pages, not mutable local build files.
import {readFileSync,writeFileSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('.release-pages');
const base='https://hakaru4i-afk.github.io/freight-quotes-web/';
const sha=b=>createHash('sha256').update(b).digest('hex');
const local=p=>resolve(root,p);
const safe=p=>typeof p==='string'&&/^[a-zA-Z0-9._/-]+$/.test(p)&&!p.startsWith('/')&&!p.split('/').some(s=>!s||s==='..'||s.startsWith('.'));
const read=p=>readFileSync(local(p));
const json=p=>JSON.parse(read(p).toString('utf8'));
const write=(p,bytes)=>{
 const path=local(p);mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,Buffer.isBuffer(bytes)||typeof bytes==='string'?bytes:JSON.stringify(bytes,null,2)+'\n');
};
const version='SH-01.30.70 v',date='2026-11-24';
const web=process.env.GITHUB_SHA||'';
if(!/^[a-f0-9]{40}$/.test(web))throw Error('NO_EXACT_FRONTEND_SHA');
async function live(path){
 if(!safe(path))throw Error('UNSAFE_ASSET_PATH:'+path);
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const url=new URL(path,base);url.searchParams.set('sh70',web.slice(0,12));
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error('HTTP_'+response.status);
   return Buffer.from(await response.arrayBuffer());
  }catch(e){
   if(attempt===3)throw Error('LIVE_ASSET_DOWNLOAD_FAILED:'+path+':'+e.message);
   await new Promise(r=>setTimeout(r,600*attempt));
  }
 }
}
const manifest=JSON.parse((await live('production-release-manifest.json')).toString('utf8'));
if(manifest.environment!=='production'||manifest.businessVersion!=='SH-01.30.69 v'||
  !manifest.assets||Object.keys(manifest.assets).length<190)
 throw Error('SH70_MUST_BE_BASED_ON_LIVE_SIGNED_SH69');
if(!/^[a-f0-9]{40}$/.test(manifest.backendSourceCommit||''))
 throw Error('BACKEND_SOURCE_SHA_MISSING');
const build=sha(web+manifest.backendSourceCommit+version).slice(0,20);
rmSync(root,{recursive:true,force:true});mkdirSync(root,{recursive:true});
const assets=Object.entries(manifest.assets);
let pointer=0;
await Promise.all(Array.from({length:8},async()=>{
 while(pointer<assets.length){
  const [path,expected]=assets[pointer++];
  if(!safe(path)||!/^[a-f0-9]{64}$/.test(expected))throw Error('INVALID_MANIFEST_ASSET:'+path);
  const bytes=await live(path);
  if(sha(bytes)!==expected)throw Error('LIVE_ASSET_SHA_MISMATCH:'+path);
  write(path,bytes);
 }
}));
if(json('build-info.json').releaseVersion!=='SH-01.30.69 v'||
   json('release-status.json').version!=='SH-01.30.69 v'||
   json('site-status.json').release?.version!=='SH-01.30.69 v')
 throw Error('SH69_LIVE_BASE_INCONSISTENT');
const candidate=readFileSync('release/candidates/offer-scoring-clear-status-sh70.mjs');
if(!candidate.includes('const materiallyWorst=completeExtras')||
 !candidate.includes("a.score>=90?'Высокая оценка условий'")||
 !candidate.includes('a.classificationIsCarrierReliability=false'))
 throw Error('SH70_SCORING_FIX_UNVERIFIED');
if(read('offer-scoring.mjs').equals(candidate))throw Error('SH70_NO_SCORING_CHANGE');
write('offer-scoring.mjs',candidate);
// App is a transpiled module; edit only two exact UI anchors and the cache key.
// Any unexpected compiled-bundle change fails closed.
let app=read('app.js').toString('utf8');
function oneReplace(oldValue,newValue,label){
 const count=app.split(oldValue).length-1;
 if(count!==1)throw Error('SH70_APP_ANCHOR_NOT_UNIQUE_'+label+':'+count);
 app=app.replace(oldValue,newValue);
}
oneReplace('"./offer-scoring.mjs?v=offer-r3-20261117-verified"',
 '"./offer-scoring.mjs?v='+sha(candidate).slice(0,12)+'"','scoring_module_cache');
oneReplace('r("p",{children:"Категория: "+c.category}),c.tags?.length>0&&o',
 'r("p",{children:"Условия ставки: "+c.category}),c.statusExplanation&&r("p",{className:"offer-scoring-note",children:c.statusExplanation}),c.tags?.length>0&&o',
 'card_status_and_explanation');
oneReplace(/currentVersion:"[a-f0-9]{20}"/.exec(app)?.[0]||'NO_APP_VERSION',
 'currentVersion:"'+build+'"','app_current_version');
write('app.js',app);
let html=read('index.html').toString('utf8');
const appOld=/app\.js\?v=[a-f0-9]{12,20}/g;
if([...html.matchAll(appOld)].length!==1)throw Error('SH70_INDEX_APP_REFERENCE_MISMATCH');
html=html.replace(appOld,'app.js?v='+build);
html=html.replace(/portal-release-status-20261117\.js\?v=SH-01\.30\.69%20v/g,
 'portal-release-status-20261117.js?v=SH-01.30.70%20v');
write('index.html',html);

const changes=[
 'Оценка 97/100 больше не выделяется красным только потому, что у конкурента 100.',
 'Красная пометка остаётся лишь для существенно слабой сравнимой ставки: 69 баллов и ниже, отставание минимум 10 баллов.',
 'Вместо общей «сомнительной» категории показывается, какие условия именно этой ставки необходимо уточнить.',
 'Баллы, критерии расчёта, Service Level, действующие ставки и выбор победителя не изменены.'
];
const release={version,date,title:'Понятная оценка предложений · 97 баллов не плохая ставка',changes};
const info=json('build-info.json');
info.version=build;info.build=build;info.releaseVersion=version;info.releaseDate=date;
info.frontendSourceCommit=web;info.releaseStatus='PUBLISHED';
write('build-info.json',info);
const notes=json('release-status.json');
notes.version=version;notes.date=date;notes.status='released';notes.changes=changes;
write('release-status.json',notes);
const site=json('site-status.json');
site.version=build;site.release=release;site.releaseStatus='released';site.maintenance=false;
site.releases=[release,...(site.releases||[]).filter(x=>x.version!==version)].slice(0,100);
write('site-status.json',site);
for(const path of Object.keys(manifest.assets)){
 if(!existsSync(local(path)))throw Error('RELEASE_ASSET_MISSING:'+path);
 manifest.assets[path]=sha(read(path));
}
for(const path of ['offer-scoring.mjs','app.js','index.html','build-info.json','release-status.json','site-status.json'])
 manifest.assets[path]=sha(read(path));
for(const found of app.matchAll(/\bfrom\s*["'](\.[^"']+)["']|\bimport\s*\(\s*["'](\.[^"']+)["']/g)){
 const path=(found[1]||found[2]).split('?')[0].replace(/^\.\//,'');
 if(!existsSync(local(path)))throw Error('APP_STATIC_IMPORT_MISSING:'+path);
}
for(const found of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)){
 if(!existsSync(local(found[1])))throw Error('INDEX_STATIC_ASSET_MISSING:'+found[1]);
}
if(!existsSync(local('offer-scoring.mjs'))||!existsSync(local('offer-scoring.mjs')))
 throw Error('OFFER_SCORER_MISSING');
manifest.businessVersion=version;manifest.frontendBuild=build;manifest.frontendSourceCommit=web;
manifest.publicationState='PUBLISHED';manifest.releaseDate=date;
manifest.offerScoreClarity={
  ownerRequested:true,
  sourcePullRequests:[182,183],
  scoreMathUnchanged:true,carrierReliabilityUnchanged:true,
  manualWinnerOnly:true,
  materiallyWorseCeiling:69,materialGapMin:10,
  scorerSha256:sha(candidate),appSha256:sha(read('app.js')),
  stagingUnchanged:true
};
write('production-release-manifest.json',manifest);
write('.nojekyll','');
console.log('SH70_SCORE_CLARITY_PACKAGE_READY',JSON.stringify({
 version,build,scorer:sha(candidate),app:sha(read('app.js')),
 assetCount:Object.keys(manifest.assets).length,stagingUnchanged:true
}));
