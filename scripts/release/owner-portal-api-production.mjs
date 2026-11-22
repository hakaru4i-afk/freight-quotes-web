// Deterministic production-only Edge source preparation. Never deploy staging identities.
import{readFileSync,writeFileSync,mkdirSync,readdirSync}from'node:fs';
import{resolve,join}from'node:path';
import{createHash}from'node:crypto';
const input=resolve(process.argv[2]||'backend/src/transport-application');
const out=resolve(process.argv[3]||'supabase/functions/freight-api');
const version=process.env.PORTAL_RELEASE_VERSION||'';
if(!/^SH-\d{2}\.\d{2}\.\d{2} v$/.test(version))throw Error('RELEASE_VERSION_NOT_APPROVED');
const sha=x=>createHash('sha256').update(x).digest('hex');
const files=readdirSync(input).filter(x=>/\.(ts|mjs|json)$/.test(x)).sort();
if(!files.includes('index.ts')||!files.includes('deno.json')||files.length<20)throw Error('INCOMPLETE_BACKEND_SOURCE');
mkdirSync(out,{recursive:true});
const replace=(text,a,b,name)=>{
 const n=text.split(a).length-1;
 if(n!==1)throw Error('UNREVIEWED_PRODUCTION_TRANSFORMATION:'+name+':'+n);
 return text.replace(a,b);
};
const hashes={};
for(const f of files){
 let code=readFileSync(join(input,f),'utf8');
 if(f==='index.ts'){
  code=replace(code,'var EXPECTED_PROJECT = "ibclzdkxiozbzmniiygv";','var EXPECTED_PROJECT = "ooclsrndeygojtofuyte";',f);
  code=replace(code,'var DEPLOYMENT_ENV = "staging";','var DEPLOYMENT_ENV = "production";',f);
  code=replace(code,'var SOURCE_BUILD = "SH-01.30.52 v";','var SOURCE_BUILD = "'+version+'";',f);
  code=replace(code,'if (DEPLOYMENT_ENV !== "staging" || DATA_SCHEMA !== "freight") return;','if (!["staging","production"].includes(DEPLOYMENT_ENV) || DATA_SCHEMA !== "freight") return;',f);
  code=replace(code,'if (DEPLOYMENT_ENV !== "staging")\n          return reply({ error: "Физическое удаление пока доступно только в тестовой среде" }, 403);','if (!["staging","production"].includes(DEPLOYMENT_ENV))\n          return reply({ error: "Операция недоступна в этой среде" }, 403);',f);
  for(const required of ['var DATA_SCHEMA = "freight";','var STORAGE_BUCKET = "freight-documents";','var API_FUNCTION = "freight-api";','var QA_RUN = "";','startOwnerPortalRelease','ownerPortalReleaseProgress'])
   if(!code.includes(required))throw Error('MISSING_APPROVED_RUNTIME_IDENTITY:'+required);
 }
 if(f==='partner-inquiry-attachments.ts')code=replace(code,'deploymentEnv!=="staging"','!["staging","production"].includes(deploymentEnv)',f);
 if(f==='process-editor.ts')code=replace(code,"environment!=='staging'","!['staging','production'].includes(environment)",f);
 if(code.includes('ibclzdkxiozbzmniiygv')&&f==='index.ts')throw Error('STAGING_PROJECT_IN_PRODUCTION_ENTRY');
 writeFileSync(join(out,f),code);
 hashes[f]=sha(code);
}
writeFileSync('owner-release-api-proof.json',JSON.stringify({mode:'OFFLINE_PREPARED',productionProject:'ooclsrndeygojtofuyte',version,sourceBackendSha:process.env.PORTAL_BACKEND_SHA,hashes},null,2)+'\n');
console.log('PRODUCTION_API_SOURCE_PREPARED',version,files.length,'files; NOT_DEPLOYED');
