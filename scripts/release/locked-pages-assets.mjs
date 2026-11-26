// Shared production asset and snapshot primitives. No CLI entrypoints or QA imports.
import {execFileSync} from 'node:child_process';
import {lstatSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {digest, requireCheck, sha64, site} from './locked-release.mjs';

const staticFile = /\.(?:js|mjs|css|html|json|svg|webp|png|jpe?g|gif|ico|wasm|gz|woff2?|ttf|otf|txt)$/i;
const publicDirs = new Set(['test', 'global-view', 'processes', 'process-history']);
const exclude = /(?:^|\/)(?:node_modules|reports|scripts|tests|docs|config|release|verified)(?:\/|$)|(?:^|[-_.])(?:secret|private-key|credential|session-token|password|database-url)(?:[-_.]|$)/i;
const manifestName='production-release-manifest.json';
const required=['index.html','app.js','style.css','build-info.json','site-status.json'];
const allowed=/\.(?:js|mjs|css|html|json|svg|webp|png|jpe?g|gif|ico|wasm|gz|woff2?|ttf|otf|txt)$/i;
export function rootInventory(manifest) {
 requireCheck(manifest?.environment==='production'&&manifest.publicationState==='PUBLISHED'&&manifest.assets&&typeof manifest.assets==='object','LIVE_PRODUCTION_INVENTORY_REQUIRED');
 const rows=[];
 for(const [name,hash] of Object.entries(manifest.assets)){
  if(name.startsWith('test/'))continue;
  const parts=name.split('/');
  requireCheck(parts.every(x=>x&&x!=='.'&&x!=='..'&&!x.startsWith('.')&&/^[A-Za-z0-9_.-]+$/.test(x))&&allowed.test(name)&&sha64.test(hash)&&
   (parts.length===1||['global-view','processes','process-history'].includes(parts[0]))&&name!==manifestName,'UNSAFE_PRODUCTION_INVENTORY_ENTRY');
  rows.push([name,hash]);
 }
 requireCheck(required.every(name=>rows.some(([p])=>p===name)),'INCOMPLETE_PRODUCTION_INVENTORY');
 return rows.sort(([a],[b])=>a.localeCompare(b));
}
// Stable cache key within one capture, bounded retries for transient network/CDN errors.
export async function live(path,{fetcher=fetch,delay=ms=>new Promise(done=>setTimeout(done,ms)),key=process.env.GITHUB_RUN_ID||'local'}={}){
 const url=new URL(path,site);url.searchParams.set('locked-stage',key);
 let failure;
 for(let attempt=1;attempt<=3;attempt++){
  try {
   const r=await fetcher(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
   if(!r.ok)throw Error('HTTP_'+r.status);
   return Buffer.from(await r.arrayBuffer());
  } catch(e){failure=e; if(attempt<3)await delay(attempt*1000);}
 }
 throw Error('LIVE_PRODUCTION_READ_FAILED:'+path+':'+(failure?.message||'NETWORK_ERROR'));
}
export async function captureRoot(read=live){
 const raw=await read(manifestName),manifest=JSON.parse(raw),entries=rootInventory(manifest);
 const files=new Map([[manifestName,raw]]);
 const failures=[];let index=0;
 await Promise.all(Array.from({length:6},async()=>{while(index<entries.length){
  const [name,expected]=entries[index++];
  try{const bytes=await read(name);
   requireCheck(digest(bytes)===expected,'LIVE_ROOT_DIGEST_MISMATCH:'+name);
   files.set(name,bytes);
  }catch(e){failures.push(String(e.message));}
 }}));
 requireCheck((await read(manifestName)).equals(raw),'LIVE_ROOT_CHANGED_DURING_CAPTURE');
 requireCheck(!failures.length,'LIVE_ROOT_CAPTURE_FAILED:'+failures.sort().join(';'));
 return files;
}
export function stagingFiles(candidate){
 const files=new Map([...readFiles(candidate)].filter(([name])=>name.startsWith('test/')));
 requireCheck(files.has('test/index.html')&&files.has('test/app.js')&&files.has('test/style.css'),'LOCKED_STAGING_SOURCE_INCOMPLETE');
 requireCheck(files.get('test/staging-transport-20261111.js')?.toString('utf8').includes('LOCKED_STAGING_ISOLATION_V1'),'STAGING_TRANSPORT_NOT_ISOLATED');
 return files;
}
export function readFiles(source) {
  const indexed = execFileSync('git', ['-C', source, 'ls-files', '-z'], {encoding: 'utf8'}).split('\0').filter(Boolean);
  const files = new Map();
  for (const name of indexed) {
    const parts = name.split('/');
    if (name !== '.nojekyll' && (parts.some(part => part.startsWith('.')) || exclude.test(name) || !staticFile.test(name) ||
        (parts.length > 1 && !publicDirs.has(parts[0])) || ['release-lock.json', manifestName].includes(name))) continue;
    const path = join(source, name);
    requireCheck(lstatSync(path).isFile(), 'UNSAFE_PAGES_SOURCE');
    files.set(name, readFileSync(path));
  }
  for (const name of ['app.js', 'index.html', 'build-info.json', 'release-status.json', 'site-status.json',
    'test/app.js', 'test/index.html', 'test/staging-manifest.json']) requireCheck(files.has(name), 'MISSING_LOCKED_PAGES_ASSET:' + name);
  return files;
}

