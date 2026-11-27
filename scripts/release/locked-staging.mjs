import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {digest,qaProject,qaFunction,readLock,requireCheck} from './locked-release.mjs';
import {checkoutSha,runReceipt,readJson} from './locked-evidence-run.mjs';
import {captureRoot, stagingFiles, live} from './locked-pages-assets.mjs';
export {captureRoot, stagingFiles, rootInventory, live} from './locked-pages-assets.mjs';
import {attestQaApi,attestRuntime,verifyDownloadedPackage,createStagingPair,stagingIdentityAssets,stagingPairFile,stagingPairBytes} from './locked-qa-runtime.mjs';
import {buildQaApi,qaInputSha256,verifyQaPackageProof} from './locked-qa-package.mjs';
import {findStagingProof} from './locked-qa-provenance.mjs';

const manifestName='production-release-manifest.json';
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
   // Staging can attest a new provider identity if it independently serves the exact same package.
   deployment=await attestQaApi(lock,prior.package,env.SUPABASE_ACCESS_TOKEN);
   await verifyAnonymousDenial();
   proof=prior.package;
   console.log('ISOLATED_QA_ARTIFACT_REUSED',deployment.version,deployment.bundle);
  } catch(error) {
   if(error.message!=='SERVED_QA_API_SOURCE_MISMATCH') throw error;
   console.log('ISOLATED_QA_PREVIOUS_PACKAGE_CHANGED');
  }
 }
 if(!proof) {
  proof=buildQaApi(source,api,lock);
  deployment=await deployQa(api,lock,proof,env.SUPABASE_ACCESS_TOKEN);
 }
 writeFileSync(receipt,JSON.stringify({...runReceipt(lock,'qa-staging'),package:proof,deployment})+'\n',{flag:'wx',mode:0o600});
}

function writeStagingPair(frontend,pages,receipt,lock) {
 const build=readJson(receipt),run=runReceipt(lock,'qa-staging');
 requireCheck(Object.entries(run).every(([key,value])=>build[key]===value)&&build.package?.sourceCommit===lock.backendSha,'QA_STAGING_BUILD_ATTEMPT_MISMATCH');
 checkoutSha(frontend,lock.frontendSha,{cleanPath:'test'});
 const assets=stagingIdentityAssets(frontend),packaged=stagingIdentityAssets(pages);
 for(const [name,bytes] of Object.entries(assets))requireCheck(bytes.equals(packaged[name]),'STAGING_PACKAGE_ASSET_MISMATCH:'+name);
 writeFileSync(join(pages,'test',stagingPairFile),stagingPairBytes(createStagingPair(lock,build.deployment,assets)),{flag:'wx'});
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
 else if(mode==='write-pair')writeStagingPair(a,b,c,lock);
 else if(mode==='verify-api')await verifyStagingApi(a,b,c,d,lock,process.env);
 else throw Error('UNKNOWN_LOCKED_STAGING_COMMAND');
}
