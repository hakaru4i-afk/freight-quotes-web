import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

// Publish a staging QA bundle without changing one byte of the existing root site.
// Actual root served parity is a separate required pre- and post-deployment gate.
export const SOURCE_SHA = '6e0a465b2b031558989f62b38dc7939797434686';
export const API_SHA = '092decf57d97fabdefa35bba0593890f52d34ef6';
export const API_BUNDLE = '2875f4dc43dcc61a8b191edcf70281d7f1b8875847bc9e0b276160bdfe6b0b87';
const VERSION = 'SH-01.30.59 v';
const API_PROJECT = 'ibclzdkxiozbzmniiygv';
const API_FUNCTION = 'freight-api-qa-carrier124nov18';
const publicFile = /\.(?:js|mjs|css|html|json|svg|webp|png|jpe?g|gif|ico|wasm|gz|woff2?|ttf|otf|txt)$/i;
const excluded = /(?:^|\/)(?:\.git|\.github|node_modules|reports|scripts|tests|docs|config|release|\.release-pages|\.qa-pages)(?:\/|$)/;
const secrets = /(?:^|[-_.])(?:secret|private-key|credential|session-token|password|database-url)(?:[-_.]|$)/i;
const hash = b => createHash('sha256').update(b).digest('hex');
const blob = b => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');
const read = p => readFileSync(p);
const requireFile = p => { assert.ok(existsSync(p) && lstatSync(p).isFile() && !lstatSync(p).isSymbolicLink(), `MISSING_OR_UNSAFE:${p}`); return read(p); };

export function qaTransport() {
  return `/* SH59 locked QA20 binding: never send test API mutations to shared staging. */
(() => {
 'use strict';
 if (!/^(?:\\/freight-quotes-web\\/test\\/|\\/test\\/)/.test(location.pathname)) throw Error('QA20_WRONG_PAGE_PATH');
 if (window.__stagingTransportInstalled) throw Error('DUPLICATE_STAGING_TRANSPORT');
 window.__stagingTransportInstalled = true;
 const host = 'https://${API_PROJECT}.supabase.co';
 const target = host + '/functions/v1/${API_FUNCTION}';
 const raw = window.fetch.bind(window);
 window.fetch = function(input, init) {
  let url;
  try { url = new URL(input instanceof Request ? input.url : String(input), location.href); }
  catch { return raw(input, init); }
  // QA must never send requests to the real production Supabase project.
  if (url.hostname === 'ooclsrndeygojtofuyte.supabase.co')
    return Promise.reject(Error('QA20_PRODUCTION_API_BLOCKED'));
  if (url.origin === host) {
    if (/^\\/functions\\/v1\\/freight-api(?:\\/|$)/.test(url.pathname))
      url.pathname = url.pathname.replace(/^\\/functions\\/v1\\/freight-api(?=\\/|$)/, '/functions/v1/${API_FUNCTION}');
    else if (/^\\/(?:rest|storage)\\/v1(?:\\/|$)/.test(url.pathname))
      return Promise.reject(Error('QA20_SHARED_DATA_ENDPOINT_BLOCKED'));
  } else if (url.origin === location.origin && /^\\/api\\//.test(url.pathname)) {
    url = new URL(target + url.pathname + url.search);
  }
  if (url.origin === host && url.pathname.startsWith('/functions/v1/${API_FUNCTION}')) {
    url.searchParams.set('forceFunctionRegion','eu-central-1');
    return raw(input instanceof Request ? new Request(url.href, input) : url.href, init);
  }
  return raw(input, init);
 };
 window.__sh59Qa20 = Object.freeze({ version: '${VERSION}', apiVersion:20, isolated: true, productionAuthorized:false });
})();
`;
}

function copyPublic(src, dst, prefix='') {
  for (const ent of readdirSync(src,{withFileTypes:true})) {
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    if (excluded.test(rel) || secrets.test(rel)) continue;
    const from=resolve(src,ent.name), to=resolve(dst,ent.name), st=lstatSync(from);
    assert.ok(!st.isSymbolicLink(), `PUBLIC_SYMLINK:${rel}`);
    if (st.isDirectory()) { mkdirSync(to,{recursive:true}); copyPublic(from,to,rel); }
    else if (st.isFile() && (publicFile.test(ent.name) || rel === '.nojekyll')) cpSync(from,to);
  }
}

export function buildStagingOnlyPackage(rootSource, checkedTestSource, lockFile, destination) {
  const base=resolve(rootSource), tested=resolve(checkedTestSource), dest=resolve(destination);
  assert.ok(base !== dest && tested !== dest && !base.startsWith(dest+sep) && !tested.startsWith(dest+sep),'INVALID_OUTPUT_PATH');
  const lock=JSON.parse(requireFile(lockFile).toString('utf8'));
  assert.equal(lock.state,'TESTED_SOURCE_HANDOFF_NOT_DEPLOYED');
  assert.equal(lock.frontendSha,SOURCE_SHA,'WRONG_TESTED_FRONTEND');
  assert.equal(lock.backendSha,API_SHA,'WRONG_TESTED_BACKEND');
  assert.equal(lock.apiBundleSha256,API_BUNDLE,'WRONG_TESTED_BACKEND_BUNDLE');
  assert.equal(lock.apiVersion,20); assert.equal(lock.businessVersion,VERSION);
  assert.equal(lock.verifiedScenarios,37); assert.equal(lock.productionAuthorized,false);
  assert.equal(lock.requiresExplicitOwnerApproval,true);
  for(const name of ['index.html','app.js','staging-manifest.json']) {
    assert.equal(hash(requireFile(join(tested,name))),lock.assets['test/'+name],'LOCKED_ASSET_MISMATCH:'+name);
  }
  assert.ok(!existsSync(join(base,'.qa-pages')) || dest !== resolve(base,'.qa-pages'), 'CANNOT_NEST_OUTPUT_IN_SOURCE');
  rmSync(dest,{recursive:true,force:true});mkdirSync(dest,{recursive:true});
  // Copy the original production root exactly as-is. No rewriting production metadata.
  // Root publishing is allowlisted: temporary CI handoff imports and test evidence
  // must never become public website paths.
  for(const ent of readdirSync(base,{withFileTypes:true})) {
    if(ent.isDirectory()) {
      if(!new Set(['global-view','processes','process-history']).has(ent.name))continue;
      const dst=join(dest,ent.name);mkdirSync(dst,{recursive:true});
      copyPublic(join(base,ent.name),dst,ent.name);
    } else if(ent.isFile() && (publicFile.test(ent.name) || ent.name==='.nojekyll') && !secrets.test(ent.name)) {
      cpSync(join(base,ent.name),join(dest,ent.name));
    }
  }
  const originalRoot=['index.html','app.js','build-info.json','site-status.json','production-release-manifest.json'];
  for(const name of originalRoot)assert.ok(existsSync(join(dest,name)),'PRODUCTION_BASELINE_MISSING:'+name);
  // Public QA files are copied from the *signed and verified* source tree, not HEAD/main.
  const testDest=join(dest,'test'); rmSync(testDest,{recursive:true,force:true});mkdirSync(testDest,{recursive:true});
  copyPublic(tested,testDest);
  const htmlFile=join(testDest,'index.html'), transportName='staging-transport-20261111.js';
  const html=readFileSync(htmlFile,'utf8'), previous=requireFile(join(testDest,transportName));
  assert.match(previous.toString('utf8'),/Fixed staging host only/,'UNEXPECTED_TESTED_TRANSPORT');
  const script=Buffer.from(qaTransport()), key=blob(script).slice(0,12);
  const anchor=new RegExp('('+transportName.replaceAll('.','\\.')+'\\?v=)[a-f0-9]{12}');
  assert.equal([...html.matchAll(new RegExp(anchor,'g'))].length,1,'TRANSPORT_REFERENCE_NOT_UNIQUE');
  writeFileSync(join(testDest,transportName),script);
  writeFileSync(htmlFile,html.replace(anchor,'$1'+key));
  const receipt={kind:'SH59_ISOLATED_QA20_STAGING_PACKAGE',businessVersion:VERSION,
    testedFrontendSha:SOURCE_SHA,testedBackendSha:API_SHA,testedBackendBundleSha256:API_BUNDLE,
    apiFunction:API_FUNCTION,apiProject:API_PROJECT,isolatedQaApiVersion:20,
    originalE2EPass:37,stagingBundleRebindRequiresFreshE2E:true,
    productionAuthorized:false,productionTreeUnchanged:true,
    originalTestIndexSha256:lock.assets['test/index.html'],
    originalTestAppSha256:lock.assets['test/app.js'],
    patchedTransportSha256:hash(script),patchedIndexSha256:hash(readFileSync(htmlFile))};
  writeFileSync(join(testDest,'sh59-qa-pair.json'),JSON.stringify(receipt,null,2)+'\n');
  for(const name of originalRoot)
    assert.equal(hash(requireFile(join(base,name))),hash(requireFile(join(dest,name))),'PRODUCTION_ASSET_CHANGED:'+name);
  return receipt;
}
if(process.argv[1] && process.argv[1].endsWith('build-staging-only-package.mjs')) {
  const [source,tested,lock,out]=process.argv.slice(2);
  assert.ok(source&&tested&&lock&&out,'USAGE: build-staging-only-package.mjs baseline-root verified-test-folder lock.json output');
  const receipt=buildStagingOnlyPackage(source,tested,lock,out);
  console.log(JSON.stringify({result:'STAGING_PACKAGE_CREATED_NOT_DEPLOYED',receipt}));
}