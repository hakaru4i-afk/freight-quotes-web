import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./task12-published-qa20.e2e.mjs',import.meta.url),'utf8');
test('published browser uses the actual trusted OIDC pair backendSource field',()=>{
  assert.match(source,/assert\.match\(proof\.backendSource,/);
  assert.match(source,/assert\.equal\(proof\.backendSource,liveReceipt\.testedBackendSha,/);
  assert.match(source,/assert\.equal\(proof\.bundle,liveReceipt\.testedBackendBundleSha256,/);
  assert.match(source,/assert\.equal\(proof\.version,liveReceipt\.isolatedQaApiVersion,/);
  assert.match(source,/assert\.equal\(proof\.match,true,/);
  assert.match(source,/isolatedQaSourceCommit:proof\.backendSource/);
  assert.doesNotMatch(source,/assert\.match\(proof\.sourceCommit,/);
});
