import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {digest,qaProject,qaFunction,site,readLock,requireCheck,sha64} from './locked-release.mjs';
import {checkoutSha,runReceipt,readJson} from './locked-evidence-run.mjs';
import {readFiles} from './locked-release-pages.mjs';
import {attestQaApi,attestRuntime,verifyDownloadedPackage} from './locked-qa-runtime.mjs';
import {buildQaApi,qaInputSha256,verifyQaPackageProof} from './locked-qa-package.mjs';
import {findStagingProof} from './locked-qa-provenance.mjs';

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
export async function packageStage(candidate,out,receipt,lock){
 checkoutSha(candidate,lock.frontendSha,{cleanPath:'test'});
 const root=await captureRoot(),stage=stagingFiles(candidate);
 mkdirSync(out);
 for(const [name,bytes] of [...root,...stage,['.nojekyll',Buffer.alloc(0)]]){
  const dest=join(out,name);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,bytes);
 }
 writeFileSync(receipt,JSON.stringify({...lock,productionManifestSha256:digest(root.get(manifestName)),rootAssets:root.size,stagingAssets:stage.size,productionAuthorized:false})+'\n',{flag:'wx'});
}
export async function assertRootUnchanged(receipt,lock,read=live){
 requireCheck(receipt.frontendSha===lock.frontendSha&&receipt.backendSha===lock.backendSha&&receipt.productionAuthorized===false,'STAGING_RECEIPT_LOCK_MISMATCH');
 const files=await captureRoot(read);
 requireCheck(digest(files.get(manifestName))===receipt.productionManifestSha256&&files.size===receipt.rootAssets,'PRODUCTION_ROOT_CHANGED');
 return files.size;
}
async function provider(url,token,options={}){
 const response=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,...options.headers},redirect:'error',signal:AbortSignal.timeout(options.method==='POST'?180000:30000)});
 requireCheck(response.ok,'QA_PROVIDER_HTTP_'+response.status);
 return response;
}
async function verifyAnonymousDenial() {
 const url='https://'+qaProject+'.supabase.co/functions/v1/'+qaFunction;
 const denial=await fetch(url+'/api/owner-register-execution?register=remarks',{redirect:'error',signal:AbortSignal.timeout(20000)});
 requireCheck(denial.status===401||denial.status===403,'QA_PRIVATE_REGISTER_ACCESS_NOT_DENIED');
}

export async function deployQa(api,lock,proof,token){
 requireCheck(token,'QA_PROVIDER_CREDENTIAL_REQUIRED');
 requireCheck(proof.sourceCommit===lock.backendSha&&digest(readFileSync(join(api,'index.ts')))===proof.entrySha256&&
  digest(readFileSync(join(api,'deno.json')))===proof.configSha256,'QA_PACKAGE_LOCK_MISMATCH');
 const base='https://api.supabase.com/v1/projects/'+qaProject+'/functions/';
 const previous=await (await provider(base+qaFunction,token)).json();
 requireCheck(previous.slug===qaFunction&&previous.status==='ACTIVE'&&previous.verify_jwt===false,'EXISTING_ISOLATED_QA_REQUIRED');
 const matches=async metadata=>{
  const body=await provider(base+qaFunction+'/body',token,{headers:{Accept:'multipart/form-data'}});
  requireCheck(body.headers.get('content-type')?.startsWith('multipart/form-data;'),'QA_PACKAGE_READBACK_INVALID');
  await verifyDownloadedPackage(await body.formData(),api,metadata);
 };
 let same=false;try{await matches(previous);same=true;}catch(e){if(e.message!=='SERVED_QA_API_SOURCE_MISMATCH'&&e.message!=='UNEXPECTED_QA_API_DOWNLOAD_PART')throw e;}
 if(!same){
  const form=new FormData();
  form.set('metadata',JSON.stringify({name:qaFunction,entrypoint_path:'index.ts',import_map_path:'deno.json',verify_jwt:false}));
  for(const name of ['index.ts','deno.json'])form.append('file',new Blob([readFileSync(join(api,name))],{type:'application/octet-stream'}),name);
  await provider(base+'deploy?slug='+encodeURIComponent(qaFunction),token,{method:'POST',body:form});
 }
 for(let i=0;i<18;i++){
  try{
   const deployment=await attestQaApi(lock,proof,token);
   await verifyAnonymousDenial();
   console.log('ISOLATED_QA_DEPLOYED_AND_READ_BACK',deployment.version,deployment.bundle);
   return deployment;
  }catch(e){if(i===17)throw e;await new Promise(done=>setTimeout(done,6000));}
 }
}

async function prepareStagingApi(source,api,receipt,lock,env) {
 const input=qaInputSha256(source,lock);
 const prior=findStagingProof(lock,input,env.GH_TOKEN,{requireFrontend:false});
 let proof, deployment;
 if(prior) {
  try {
   deployment=await attestQaApi(lock,prior.package,env.SUPABASE_ACCESS_TOKEN,prior.deployment);
   await verifyAnonymousDenial();
   proof=prior.package;
   console.log('ISOLATED_QA_ARTIFACT_REUSED',deployment.version,deployment.bundle);
  } catch(error) {
   if(error.message!=='SERVED_QA_API_DEPLOYMENT_DRIFT') throw error;
   console.log('ISOLATED_QA_PREVIOUS_DEPLOYMENT_CHANGED');
  }
 }
 if(!proof) {
  proof=buildQaApi(source,api,lock);
  deployment=await deployQa(api,lock,proof,env.SUPABASE_ACCESS_TOKEN);
 }
 writeFileSync(receipt,JSON.stringify({...runReceipt(lock,'qa-staging'),package:proof,deployment})+'\n',{flag:'wx',mode:0o600});
}

async function verifyStagingApi(frontend,source,receipt,output,lock,env) {
 const build=readJson(receipt);
 const run=runReceipt(lock,'qa-staging');
 requireCheck(Object.entries(run).every(([key,value])=>build[key]===value),'QA_STAGING_BUILD_ATTEMPT_MISMATCH');
 const proof=verifyQaPackageProof(build.package,lock,qaInputSha256(source,lock));
 const runtime=await attestRuntime(lock,frontend,proof,env.SUPABASE_ACCESS_TOKEN,build.deployment);
 writeFileSync(output,JSON.stringify({...runtime,...run,package:proof,generatedAt:runtime.observedAt})+'\n',{flag:'wx',mode:0o600});
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const [mode,a,b,c,d]=process.argv.slice(2),lock=readLock();runReceipt(lock,'qa-staging');
 if(mode==='package')await packageStage(a,b,c,lock);
 else if(mode==='verify-root')console.log('PRODUCTION_ROOT_UNCHANGED',await assertRootUnchanged(readJson(a),lock));
 else if(mode==='prepare-api')await prepareStagingApi(a,b,c,lock,process.env);
 else if(mode==='verify-api')await verifyStagingApi(a,b,c,d,lock,process.env);
 else throw Error('UNKNOWN_LOCKED_STAGING_COMMAND');
}
