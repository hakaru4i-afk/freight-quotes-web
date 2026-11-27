import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../staging-transport-20261111.js',import.meta.url),'utf8');
const host='https://ooclsrndeygojtofuyte.supabase.co/functions/v1/';
const slug='freight-api-release-'+'a'.repeat(32);
function fixture(){
 const calls=[],window={fetch:(...args)=>{calls.push(args);return Promise.resolve(new Response(null,{status:204}));}};
 vm.runInNewContext(source,{window,Request,URL,location:{href:'https://hakaru4i-afk.github.io/freight-quotes-web/'}});
 return {window,calls};
}
test('legacy and immutable production route, preserve query and fetch once',async()=>{
 for(const name of ['freight-api',slug]){
 const {window,calls}=fixture();await window.fetch(host+name+'/api/session?x=1');
 assert.equal(calls.length,1);const url=new URL(calls[0][0]);assert.equal(url.searchParams.get('x'),'1');assert.equal(url.searchParams.get('forceFunctionRegion'),'eu-central-1');assert.equal(url.pathname,'/functions/v1/'+name+'/api/session');
 }
});
test('POST preserves original method, authorization and body',async()=>{
 const {window,calls}=fixture();await window.fetch(new Request(host+slug+'/api/chat',{method:'POST',headers:{authorization:'Bearer test'},body:'{"text":"test"}'}));
 assert.equal(calls.length,1);const req=calls[0][0];assert.equal(req.method,'POST');assert.equal(req.headers.get('authorization'),'Bearer test');assert.equal(await req.text(),'{"text":"test"}');assert.equal(new URL(req.url).searchParams.get('forceFunctionRegion'),'eu-central-1');
});
test('does not modify staging, malformed slug or unrelated origin',async()=>{
 for(const url of ['https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/api/session',host+'freight-api-release-bad/api/session','https://example.com/functions/v1/'+slug+'/api/session']){
 const {window,calls}=fixture();await window.fetch(url);assert.equal(calls.length,1);assert.equal(calls[0][0],url);
 }
});

import {stagingRegionalUrl} from '../staging-api-region.mjs';
test('the actual imported app module accepts legacy and immutable API before fetch',()=>{
 for(const name of ['freight-api',slug])for(const endpoint of ['session','data','auth','chats']){
  const u=new URL(stagingRegionalUrl(host+name+'/api/'+endpoint+'?x=1'));
  assert.equal(u.pathname,'/functions/v1/'+name+'/api/'+endpoint);assert.equal(u.searchParams.get('x'),'1');assert.equal(u.searchParams.get('forceFunctionRegion'),'eu-central-1');
 }
});
test('imported module fails closed for wrong project, credentials and malformed slug',()=>{
 for(const url of ['https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/api/session',host+'freight-api-release-bad/api/session','https://example.com/functions/v1/'+slug+'/api/session','https://user@ooclsrndeygojtofuyte.supabase.co/functions/v1/'+slug+'/api/session',host+slug+'/health'])assert.throws(()=>stagingRegionalUrl(url),/PRODUCTION_API_SCOPE_REQUIRED/);
});

test('release smoke uses normal API credentials in the protected deployment step, headless browser, and cleanup on every outcome',()=>{
 const wf=readFileSync(new URL('../.github/workflows/owner-portal-release.yml',import.meta.url),'utf8');
 const browser=readFileSync(new URL('../scripts/release/production-authenticated-browser.mjs',import.meta.url),'utf8');
 const login=readFileSync(new URL('../scripts/release/production-owner-login.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(wf,/secrets\.PRODUCTION_SMOKE_SESSION|OWNER_MAC_CONSOLE_MUST_BE_ACTIVE/);
 assert.match(wf,/name: github-pages/);
 assert.ok(wf.indexOf('validateSmokeCredentials(process.env')<wf.indexOf('locked-release-api.mjs publish'));
 assert.match(wf,/playwright install --with-deps chromium/);
 assert.match(wf,/playwright install chromium/);
 assert.match(wf,/SMOKE_OWNER_LOGIN: \$\{\{ secrets\.SMOKE_OWNER_LOGIN \|\| secrets\.SMOKE_OWNER_EMAIL \}\}/);
 assert.match(wf,/SMOKE_OWNER_PASSWORD: \$\{\{ secrets\.SMOKE_OWNER_PASSWORD \}\}/);
 assert.match(browser,/headless:true/);
 assert.match(browser,/loginProductionOwner\(\{endpoint,login,password\}\)/);
 assert.match(login,/action:'login'/);
 assert.match(login,/redirect:'error'/);
 assert.doesNotMatch(login,/service_role|Authorization:/i);
 assert.match(browser,/profile\.role,'owner'/);
 assert.match(browser,/mode:0o600,flag:'wx'/);
 assert.match(browser,/authenticated===false/);
 assert.match(browser,/action:'logout'/);
 assert.match(wf,/Revoke the run-scoped login and delete local session state\n        if: always\(\)/);
 const deploy=wf.search(/uses: actions\/deploy-pages@[0-9a-f]{40}\b/);
 const candidate=wf.indexOf('production-authenticated-browser.mjs candidate');
 assert.ok(candidate>=0 && candidate<deploy);
 assert.match(wf,/production-authenticated-browser.mjs live/);
 assert.match(wf,/artifact_name: rollback-pages/);
 assert.doesNotMatch(wf,/upload-pages-artifact[\s\S]{0,150}freight-prod-smoke/);
});


test('production smoke retains fail-closed mutation and route guards with redacted request diagnostics',()=>{
 const browser=readFileSync(new URL('../scripts/release/production-authenticated-browser.mjs',import.meta.url),'utf8');
 assert.match(browser,/legacy=true;recordBlocked\('api-route-mismatch',req,u\);return route.abort\(\)/);
 assert.match(browser,/mutation=true;recordBlocked\('browser-mutation',req,u\);return route.abort\(\)/);
 assert.match(browser,/assert.ok\(!legacy&&!mutation,'PRODUCTION_SMOKE_UNEXPECTED_ROUTE_OR_MUTATION'\)/);
 assert.match(browser,/JSON.stringify\(\{kind,method,route:known.includes\(route\)\?route:'other',action\}\)/);
 assert.match(browser,/PRODUCTION_SMOKE_BLOCKED_REQUEST/);
});
