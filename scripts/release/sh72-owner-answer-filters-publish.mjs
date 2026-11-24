// One-time owner-approved SH72 UI release: answer filters only.
import {readFileSync,writeFileSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve('.release-pages');
const base='https://hakaru4i-afk.github.io/freight-quotes-web/';
const hash=x=>createHash('sha256').update(x).digest('hex');
const valid=p=>typeof p==='string'&&/^[\w./-]+$/.test(p)&&!p.startsWith('/')&&!p.split('/').some(x=>!x||x==='..'||x.startsWith('.'));
const read=p=>readFileSync(resolve(out,p));
function write(p,data){const file=resolve(out,p);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,Buffer.isBuffer(data)||typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');}
const version='SH-01.30.72 v',prior='SH-01.30.71 v',sha=process.env.GITHUB_SHA||'';
if(!/^[a-f0-9]{40}$/.test(sha))throw Error('SOURCE_COMMIT_MISSING');
async function live(p){
 if(!valid(p))throw Error('UNSAFE_ASSET:'+p);
 for(let i=0;i<3;i++){
  try{
   const u=new URL(p,base);u.searchParams.set('r',sha.slice(0,12));
   const response=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error('HTTP_'+response.status);
   return Buffer.from(await response.arrayBuffer());
  }catch(e){if(i===2)throw Error('LIVE_ASSET_UNAVAILABLE:'+p+':'+e.message);await new Promise(r=>setTimeout(r,1000*(i+1)));}
 }
}
const manifest=JSON.parse((await live('production-release-manifest.json')).toString('utf8'));
if(manifest.environment!=='production'||manifest.businessVersion!==prior||!manifest.assets||Object.keys(manifest.assets).length<190)
 throw Error('SIGNED_SH71_NOT_CURRENT_ABORT');
rmSync(out,{force:true,recursive:true});mkdirSync(out,{recursive:true});
let pointer=0;const entries=Object.entries(manifest.assets);
await Promise.all(Array.from({length:8},async()=>{
 while(pointer<entries.length){
  const [p,expected]=entries[pointer++];
  if(!valid(p)||!/^[a-f0-9]{64}$/.test(expected))throw Error('INVALID_MANIFEST_ASSET:'+p);
  const bytes=await live(p);
  if(hash(bytes)!==expected)throw Error('PUBLISHED_ASSET_SHA_MISMATCH:'+p);
  write(p,bytes);
 }
}));
const json=p=>JSON.parse(read(p).toString('utf8'));
if(json('build-info.json').releaseVersion!==prior||json('release-status.json').version!==prior)
 throw Error('LIVE_BUILD_VERSION_MISMATCH');
const filter=readFileSync('owner-answer-filters-20261124.js');
const js=filter.toString('utf8');
if(!js.includes('lw-answer-filters-20261124')||!js.includes('Статус ответа')||!js.includes('row.style.display'))
 throw Error('FILTER_CANDIDATE_INVALID');
write('owner-answer-filters-20261124.js',filter);
let html=read('index.html').toString('utf8');
if(html.includes('owner-answer-filters-20261124.js'))throw Error('FILTER_ALREADY_PUBLISHED');
if(!html.includes('</body>'))throw Error('HTML_BODY_MISSING');
html=html.replace('</body>','<script defer src="./owner-answer-filters-20261124.js?v='+hash(filter).slice(0,12)+'"></script></body>');
const build=hash(sha+manifest.backendSourceCommit+version).slice(0,20);
if(!/^[a-f0-9]{20}$/.test(build))throw Error('INVALID_BUILD');
html=html.replace(/app\.js\?v=[a-f0-9]{12,20}/g,'app.js?v='+build);
html=html.replace(/portal-release-status-20261117\.js\?v=SH-01\.30\.71%20v/g,'portal-release-status-20261117.js?v=SH-01.30.72%20v');
write('index.html',html);
let app=read('app.js').toString('utf8');
if([...app.matchAll(/currentVersion:"[a-f0-9]{20}"/g)].length!==1)throw Error('APP_BUILD_MARKER_INVALID');
app=app.replace(/currentVersion:"[a-f0-9]{20}"/g,'currentVersion:"'+build+'"');
write('app.js',app);
const today=new Date().toISOString().slice(0,10);
const changes=['Фильтры сроков ответов: период, номер заказа, перевозчик и статус','Быстрый просмотр просроченных и ответов без ставки','Сброс фильтров и количество найденных строк'];
const info=json('build-info.json');Object.assign(info,{version:build,build,releaseVersion:version,releaseDate:today,releaseStatus:'PUBLISHED',frontendSourceCommit:sha});write('build-info.json',info);
const status=json('release-status.json');Object.assign(status,{version,date:today,status:'released',changes});write('release-status.json',status);
const site=json('site-status.json');const release={version,date:today,title:'Фильтры контроля ответов',changes};
Object.assign(site,{version:build,release,releaseStatus:'released',maintenance:false});
site.releases=[release,...(site.releases||[]).filter(x=>x.version!==version)].slice(0,100);write('site-status.json',site);
for(const [p] of entries)manifest.assets[p]=hash(read(p));
manifest.assets['owner-answer-filters-20261124.js']=hash(filter);
Object.assign(manifest,{businessVersion:version,frontendBuild:build,frontendSourceCommit:sha,publicationState:'PUBLISHED',releaseDate:today,ownerAnswerFilters:{sourcePullRequest:188,readOnly:true,scriptSha256:hash(filter)}});
for(const m of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g))if(!existsSync(resolve(out,m[1])))throw Error('MISSING_HTML_ASSET:'+m[1]);
write('production-release-manifest.json',manifest);write('.nojekyll','');
console.log('OWNER_ANSWER_FILTERS_SH72_PACKAGE_PASS',JSON.stringify({version,build,assetCount:Object.keys(manifest.assets).length,filterSha256:hash(filter)}));
