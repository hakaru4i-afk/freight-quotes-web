import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const target = Object.freeze({
  run: 'carrier124nov18',
  project: 'ibclzdkxiozbzmniiygv',
  function: 'freight-api-qa-carrier124nov18'
});
const pairFile=process.env.QA_CARRIER124_PAIR_FILE;
const pair=pairFile?JSON.parse(readFileSync(pairFile,'utf8')):null;
if(pair){
  assert.equal(pair.function,target.function,'Only the assigned QA function is allowed');
  assert.equal(pair.match,true,'Provider file readback is required');
  assert.equal(pair.readbackCount,25);
  assert.ok(Number.isInteger(pair.version)&&pair.version>0);
  assert.match(pair.bundle,/^[a-f0-9]{64}$/);
  for(const key of ['backendSource','frontendSource','frontendMetadata','frontendTestTree'])assert.match(pair[key],/^[a-f0-9]{40}$/,key);
}
export const carrier124=Object.freeze({...pair,...target});

const origin = 'https://' + carrier124.project + '.supabase.co';
const functionPath = '/functions/v1/' + carrier124.function;
export const carrier124Base = origin + functionPath;

export function assertCandidateCheckout() {
  assert.ok(pair,'QA_CARRIER124_PAIR_FILE must be the receipt of a verified isolated deployment');
  const manifest=JSON.parse(readCandidateAsset('test/staging-manifest.json'));
  assert.equal(manifest.publicationState,'CANDIDATE_NOT_RELEASED');
  assert.equal(manifest.frontendCommit,pair.frontendSource);
  assert.equal(manifest.backendSourceCommit,pair.backendSource);
  if(manifest.sh59IsolatedQa){
    const qa=manifest.sh59IsolatedQa;
    assert.equal(qa.function,pair.function,'Unexpected isolated function');
    assert.equal(qa.version,pair.version,'Unexpected isolated version');
    assert.equal(qa.providerBundleSha256,pair.bundle,'Unexpected isolated bundle');
    assert.equal(qa.sourceFilesVerified,pair.readbackCount,'Unexpected provider file count');
  }
  const git = args => execFileSync('git', args, {encoding: 'utf8'}).trim();
  assert.equal(git(['rev-parse', carrier124.frontendMetadata + ':test']), carrier124.frontendTestTree, 'Unexpected frontend candidate');
  git(['diff','--exit-code',carrier124.frontendMetadata,'HEAD','--','test',':(exclude)test/staging-manifest.json']);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'test']), '', 'Candidate test assets must be committed');
}

export function readCandidateAsset(path) {
  assert.ok(pair,'Missing verified pair receipt');
  assert.match(path,/^test\//);
  assert.ok(!path.includes('\0') && !path.split('/').includes('..'));
  return execFileSync('git',['show',carrier124.frontendMetadata+':'+path],{maxBuffer:16*1024*1024,stdio:['ignore','pipe','ignore']});
}

export function isolatedBrowserApiPath(url, localOrigin) {
  if (url.origin === localOrigin && url.pathname.startsWith('/api/')) return url.pathname;
  if (url.origin !== origin) return null;
  for (const prefix of ['/functions/v1/freight-api', functionPath]) {
    if (url.pathname.startsWith(prefix + '/api/')) return url.pathname.slice(prefix.length);
  }
  return null;
}

export function isolatedApiUrl(path, search = '') {
  assert.match(path, /^\/api\/[a-z0-9][a-z0-9/-]*$/, 'Unexpected API route');
  const url = new URL(carrier124Base + path);
  assert.equal(url.pathname, functionPath + path);
  url.search = search;
  url.searchParams.set('forceFunctionRegion', 'eu-central-1');
  return url;
}
