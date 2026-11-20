import test from 'node:test';
import assert from 'node:assert/strict';
import {auditEnvironment,executableScripts} from '../scripts/check-canonical-db-targets.mjs';

const production={projectRef:'ooclsrndeygojtofuyte',apiFunction:'freight-api',apiBase:'https://ooclsrndeygojtofuyte.supabase.co/functions/v1/freight-api'};
const staging={projectRef:'ibclzdkxiozbzmniiygv',apiFunction:'freight-api',apiBase:'https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api'};
const fixture=(target,overrides={})=>({
 environment:target===production?'production':'staging',
 target,other:target===production?staging:production,
 html:`<meta http-equiv="Content-Security-Policy" content="connect-src https://${target.projectRef}.supabase.co"><script src="./app.js?v=1"></script><script src="./staging-transport-20261111.js?v=1"></script>`,
 files:{
  'app.js':`const base='${target.apiBase}';`,
  'staging-transport-20261111.js':`const prefix='https://${target.projectRef}.supabase.co/functions/v1/freight-api/api/';`,
  'staging-api-region.mjs':`const prefix='${target.apiBase}/api/';`
 },
 ...overrides
});
test('published production points only to production Supabase',()=>{
 const result=auditEnvironment(fixture(production));
 assert.equal(result.projectRef,production.projectRef);
 assert.equal(result.filesChecked.length,3);
});
test('published test site points only to isolated staging Supabase',()=>{
 assert.equal(auditEnvironment(fixture(staging)).apiBase,staging.apiBase);
});
test('a production asset cannot silently fall back to staging database',()=>{
 const x=fixture(production);
 x.files['staging-transport-20261111.js']+=`fetch('https://${staging.projectRef}.supabase.co/rest/v1/requests')`;
 assert.throws(()=>auditEnvironment(x),/wrong Supabase project/);
});
test('test site cannot call production database',()=>{
 const x=fixture(staging);
 x.files['app.js']+=`fetch('https://${production.projectRef}.supabase.co/functions/v1/freight-api')`;
 assert.throws(()=>auditEnvironment(x),/wrong Supabase project/);
});
test('live entry points cannot target old QA function',()=>{
 const x=fixture(staging);
 x.files['app.js']+=';const old="/functions/v1/freight-api-qa-rc20261110"';
 assert.throws(()=>auditEnvironment(x),/QA\/legacy API/);
});
test('missing canonical app endpoint is fatal rather than triggering fallback',()=>{
 const x=fixture(production);
 x.files['app.js']="const base='https://example.invalid/api'";
 assert.throws(()=>auditEnvironment(x),/not pinned to canonical API/);
});
test('duplicate script tags do not create duplicate checks',()=>{
 const page='<script src="./app.js?v=1"></script><script src="./app.js?v=2"></script>';
 assert.deepEqual(executableScripts(page),['app.js']);
});
test('unknown or swapped project IDs are rejected',()=>{
 const x=fixture(production);
 x.files['staging-api-region.mjs']+="fetch('https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/freight-api')";
 assert.throws(()=>auditEnvironment(x),/wrong Supabase project/);
});
