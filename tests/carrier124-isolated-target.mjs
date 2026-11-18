import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

export const carrier124 = Object.freeze({
  run: 'carrier124nov18',
  project: 'ibclzdkxiozbzmniiygv',
  function: 'freight-api-qa-carrier124nov18',
  version: 1,
  bundle: '9f8fb2db4dfbf6cc713537a1793d3daf3868a3c79df81738e321776eb01de810',
  backendSource: 'bec4fa5596a32cfdba01253388f3039ad5ebdd42',
  frontendSource: '3df8ef57659d32a5a470048df00a17eb280ce3c4',
  frontendMetadata: '809c2d221dee37cb783ef56d70518531da84d593',
  frontendTestTree: '62d6664480899a1f5d84db4a02e3fc37c9ffecda'
});

const origin = 'https://' + carrier124.project + '.supabase.co';
const functionPath = '/functions/v1/' + carrier124.function;
export const carrier124Base = origin + functionPath;

export function assertCandidateCheckout() {
  const git = args => execFileSync('git', args, {encoding: 'utf8'}).trim();
  assert.equal(git(['rev-parse', carrier124.frontendMetadata + ':test']), carrier124.frontendTestTree, 'Unexpected frontend candidate');
  git(['diff', '--exit-code', carrier124.frontendMetadata, 'HEAD', '--', 'test', ':(exclude)test/staging-manifest.json']);
  assert.equal(git(['status', '--porcelain', '--untracked-files=all', '--', 'test']), '', 'Candidate test assets must be committed');
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
