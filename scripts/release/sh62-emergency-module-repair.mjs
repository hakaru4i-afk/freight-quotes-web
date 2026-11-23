// Emergency SH62 Pages repair: preserve every published asset, restore the missing app import.
// Does not change production data, backend, business version or authentication.
import {readFileSync,writeFileSync,readdirSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {createHash} from 'node:crypto';
const base='https://hakaru4i-afk.github.io/freight-quotes-web/';
const out=resolve('.release-pages');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=name=>readFileSync(resolve(out,name));
const safe=name=>/^[a-zA-Z0-9_./-]+$/.test(name)&&!name.startsWith('/')&&
 !name.split('/').some(x=>x==='..'||x===''||x.startsWith('.'));
async function download(name){
 if(!safe(name))throw Error('UNSAFE_ASSET:'+name);
 const r=await fetch(new URL(name,base),{cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('LIVE_ASSET_HTTP_'+r.status+':'+name);
 return Buffer.from(await r.arrayBuffer());
}
const meta=JSON.parse((await download('production-release-manifest.json')).toString('utf8'));
if(meta.businessVersion!=='SH-01.30.62 v'||meta.environment!=='production')
 throw Error('UNEXPECTED_SH62_BASE; DO NOT DEPLOY');
const original=Object.entries(meta.assets||{});
if(original.length<190)throw Error('MISSING_PRODUCTION_ASSET_LIST');
rmSync(out,{recursive:true,force:true});
mkdirSync(out,{recursive:true});
let cursor=0;
async function copyWorker(){
 while(cursor<original.length){
  const [name,digest]=original[cursor++];
  if(!safe(name)||! /^[a-f0-9]{64}$/.test(digest))throw Error('BAD_MANIFEST_ENTRY:'+name);
  const bytes=await download(name);
  if(sha(bytes)!==digest)throw Error('HASH_MISMATCH:'+name);
  const target=resolve(out,name);
  if(!target.startsWith(out+'/'))throw Error('ESCAPE:'+name);
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,bytes);
 }
}
await Promise.all(Array.from({length:8},copyWorker));
const app=read('app.js').toString('utf8');
const deps=[...app.matchAll(/\bfrom\s*["'](\.[^"']+)["']|\bimport\s*\(\s*["'](\.[^"']+)["']/g)]
 .map(x=>(x[1]||x[2]).split('?')[0].replace(/^\.\//,''));
const missing=[...new Set(deps)].filter(name=>!existsSync(resolve(out,name)));
if(missing.length!==1||missing[0]!=='offer-scoring.mjs')
 throw Error('UNEXPECTED_APP_IMPORTS:'+JSON.stringify(missing));
const restored=readFileSync('offer-scoring.mjs');
if(!restored.toString('utf8').includes('OFFER-SCORE-20261117-R3')||
 !restored.toString('utf8').includes('export function scoreOffers'))
 throw Error('UNREVIEWED_SCORING_MODULE');
writeFileSync(resolve(out,'offer-scoring.mjs'),restored);
meta.assets['offer-scoring.mjs']=sha(restored);
meta.emergencyHotfix={
 reason:'SH62 Pages package accidentally omitted app.js static import offer-scoring.mjs',
 repairedOn:'2026-11-23',
 repairSourceCommit:process.env.GITHUB_SHA||'',
 dataChanged:false,
 versionChanged:false,
 restoredModuleSha256:sha(restored)
};
const html=read('index.html').toString('utf8');
for(const match of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)){
 const name=match[1];
 if(!existsSync(resolve(out,name)))throw Error('MISSING_HTML_ASSET:'+name);
}
for(const name of deps){
 if(!existsSync(resolve(out,name)))throw Error('MISSING_STATIC_IMPORT:'+name);
}
if(existsSync('.nojekyll'))writeFileSync(resolve(out,'.nojekyll'),readFileSync('.nojekyll'));
writeFileSync(resolve(out,'production-release-manifest.json'),JSON.stringify(meta,null,2)+'\n');
const info=JSON.parse(read('build-info.json'));
if(info.releaseVersion!=='SH-01.30.62 v'||info.releaseStatus!=='PUBLISHED')
 throw Error('VERSION_DRIFT_DURING_REPAIR');
console.log('SH62_CRITICAL_IMPORT_RESTORED',JSON.stringify({restored:'offer-scoring.mjs',
 appImports:deps,assets:original.length+1,version:info.releaseVersion,sha256:sha(restored)}));
