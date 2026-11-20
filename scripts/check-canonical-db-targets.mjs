// Release gate: no published page may reach the wrong Supabase project,
// an obsolete QA Edge Function or a noncanonical Freight API endpoint.
// This is a read-only source audit; it never sends requests to a database.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const defaultRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
const sha256=value=>createHash('sha256').update(value).digest('hex');

export function executableScripts(html) {
 const assets=[...html.matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"'?#]+\.(?:js|mjs))(?:\?[^"']*)?["']/gi)].map(m=>m[1]);
 assert.ok(assets.includes('app.js'),'Canonical app.js not loaded');
 return [...new Set(assets)];
}
export function auditEnvironment({environment,html,files,target,other}) {
 assert.ok(target.projectRef!==other.projectRef,'Production/test DB separation is mandatory');
 assert.equal(target.apiFunction,'freight-api','Only canonical Freight API is an app endpoint');
 assert.equal(target.apiBase,`https://${target.projectRef}.supabase.co/functions/v1/freight-api`);
 assert.ok(html.includes(`https://${target.projectRef}.supabase.co`),environment+': CSP lacks expected project');
 assert.ok(!html.includes(`https://${other.projectRef}.supabase.co`),environment+': CSP references opposite environment');
 const assets=executableScripts(html);
 const forbiddenHosts=new Set();
 const invalidSlugs=new Set();
 const filesChecked=[];
 for(const name of [...assets,'staging-api-region.mjs']) {
  assert.ok(Object.prototype.hasOwnProperty.call(files,name),environment+': missing runtime script '+name);
  const body=String(files[name]);
  for(const match of body.matchAll(/https:\/\/([a-z0-9]{20})\.supabase\.co/gi)) {
   if(match[1]!==target.projectRef) forbiddenHosts.add(match[1]);
  }
  for(const match of body.matchAll(/\/functions\/v1\/(freight-api(?:-[a-z0-9-]+)?)/gi)) {
   if(match[1]!=='freight-api')invalidSlugs.add(match[1]);
  }
  filesChecked.push({name,sha256:sha256(body)});
 }
 assert.equal(forbiddenHosts.size,0,environment+': wrong Supabase project(s): '+[...forbiddenHosts].join(','));
 assert.equal(invalidSlugs.size,0,environment+': app points to QA/legacy API(s): '+[...invalidSlugs].join(','));
 assert.ok(files['app.js'].includes(target.apiBase),environment+': app.js not pinned to canonical API');
 return {environment,projectRef:target.projectRef,apiBase:target.apiBase,filesChecked,hash:sha256(html)};
}
export function auditRepository(root=defaultRoot) {
 const targets=JSON.parse(readFileSync(resolve(root,'config/canonical-db-targets.json'),'utf8'));
 assert.equal(targets.schemaVersion,1);
 const results=[];
 for(const environment of ['production','staging']){
  const dir=environment==='production'?root:resolve(root,'test');
  const other=targets[environment==='production'?'staging':'production'];
  const target=targets[environment];
  const html=readFileSync(resolve(dir,'index.html'),'utf8');
  const files={};
  for(const name of [...executableScripts(html),'staging-api-region.mjs']) {
   const file=resolve(dir,name);
   assert.ok(relative(dir,file)!=='..'&&!relative(dir,file).startsWith('..'+sep),'Script path escapes expected environment');
   assert.ok(existsSync(file),environment+': script file not found: '+name);
   files[name]=readFileSync(file,'utf8');
  }
  results.push(auditEnvironment({environment,html,files,target,other}));
 }
 return {status:'PASS',check:'CANONICAL_DB_TARGETS',results};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try {
  const output=auditRepository();
  console.log(JSON.stringify({status:output.status,check:output.check,results:output.results.map(({environment,projectRef,apiBase,filesChecked})=>({environment,projectRef,apiBase,scriptCount:filesChecked.length}))},null,2));
 } catch(error) {
  console.error('CANONICAL_DB_TARGETS_FAIL:',error.message);
  process.exitCode=1;
 }
}
