// Publish a UI-only CRM fix on top of the bytes actually served by production.
// Never substitute source/main assets for production content when the roots drift.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const host='https://hakaru4i-afk.github.io/freight-quotes-web/';
const root=resolve('.release-pages');
const candidate=readFileSync('release/owner-portal-feedback-center-20261122.js');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const expectedVersion='SH-01.30.61 v';
const safePath=path=>typeof path==='string' &&
  /^[a-zA-Z0-9._/-]+$/.test(path) &&
  !path.startsWith('/')&&!path.split('/').some(x=>x==='..'||x===''||x.startsWith('.'));
async function get(rel){
  if(!safePath(rel))throw Error('UNSAFE_LIVE_ASSET_PATH:'+rel);
  const url=new URL(rel,host);
  for(let attempt=1;attempt<=4;attempt++){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(30000),cache:'no-store'});
      if(!response.ok)throw Error('HTTP_'+response.status);
      return Buffer.from(await response.arrayBuffer());
    }catch(error){
      if(attempt===4)throw Error('LIVE_ASSET_UNAVAILABLE:'+rel+':'+error.message);
      await new Promise(done=>setTimeout(done,attempt*900));
    }
  }
}
const manifestBytes=await get('production-release-manifest.json');
const manifest=JSON.parse(manifestBytes.toString('utf8'));
if(manifest.environment!=='production'||manifest.businessVersion!==expectedVersion||
 !manifest.assets||Object.keys(manifest.assets).length<150)
 throw Error('LIVE_PRODUCTION_MANIFEST_NOT_APPROVED');
const entries=Object.entries(manifest.assets);
for(const [name,digest] of entries){
  if(!safePath(name)||!/^[a-f0-9]{64}$/.test(digest))
   throw Error('INVALID_MANIFEST_ENTRY:'+name);
}
let cursor=0;
async function worker(){
  while(cursor<entries.length){
    const [name,digest]=entries[cursor++];
    const bytes=await get(name);
    if(sha(bytes)!==digest)throw Error('LIVE_ASSET_HASH_MISMATCH:'+name);
    const target=resolve(root,name);
    if(!target.startsWith(root+'/'))throw Error('ASSET_PATH_ESCAPE');
    mkdirSync(dirname(target),{recursive:true});
    writeFileSync(target,bytes);
  }
}
await Promise.all(Array.from({length:8},worker));
const previous=readFileSync(resolve(root,'portal-feedback-center-20261107.js'));
if(sha(previous)!==manifest.assets['portal-feedback-center-20261107.js'])
 throw Error('BASE_OWNER_JS_HASH_MISMATCH');
if(!candidate.includes("action:'release_update'")||!candidate.includes('?releaseProgress='))
 throw Error('NEW_RELEASE_BUTTON_ACTION_MISSING');
const scriptHash=sha(candidate);
for(const name of ['portal-feedback-center-20261107.js','test/portal-feedback-center-20261107.js']){
 const dest=resolve(root,name);
 if(!existsSync(dest))throw Error('EXPECTED_OWNER_UI_ASSET_MISSING:'+name);
 writeFileSync(dest,candidate);
 if(Object.hasOwn(manifest.assets,name))manifest.assets[name]=scriptHash;
}
// Index from LIVE production is authoritative. The cache-busting URL changes
// so browsers load the newly approved UI even after an earlier visit.
for(const name of ['index.html','test/index.html']){
 const dest=resolve(root,name);
 if(name==='test/index.html'){
  const bytes=await get(name);
  writeFileSync(dest,bytes);
 }
 let html=readFileSync(dest,'utf8');
 const source=/src="\.\/portal-feedback-center-20261107\.js(?:\?v=[^"]+)?"/g;
 if([...html.matchAll(source)].length!==1)
  throw Error('OWNER_SCRIPT_REFERENCE_NOT_UNIQUE:'+name);
 html=html.replace(source,'src="./portal-feedback-center-20261107.js?v='+scriptHash.slice(0,12)+'"');
 writeFileSync(dest,html);
 if(Object.hasOwn(manifest.assets,name))manifest.assets[name]=sha(Buffer.from(html));
}
manifest.ownerUiHotfix={
 type:'UI_ONLY_OWNER_RELEASE_BUTTON',
 sourceCommit:process.env.GITHUB_SHA||'',
 previousRootScriptSha256:sha(previous),
 newRootScriptSha256:scriptHash,
 backendChanged:false,
 publishedAt:new Date().toISOString()
};
writeFileSync(resolve(root,'production-release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const file of ['build-info.json','release-status.json','site-status.json']){
 const obj=JSON.parse(readFileSync(resolve(root,file),'utf8'));
 if(file==='release-status.json'&&obj.version!==expectedVersion)throw Error('PRODUCTION_VERSION_CHANGED');
 if(file==='build-info.json'&&obj.environment!=='production')throw Error('NON_PRODUCTION_BUILD');
}
console.log('CRM_LIVE_ASSET_HASHES_VERIFIED',entries.length);
console.log('CRM_PRODUCTION_UI_ONLY_ARTIFACT_READY',scriptHash,'version unchanged',expectedVersion);
