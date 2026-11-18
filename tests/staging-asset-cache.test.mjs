import test from 'node:test';import assert from 'node:assert/strict';
import {stampAssetReference,stagingHtmlStructure,assertStagingReleaseLabels} from '../scripts/staging-asset-cache.mjs';
test('current release history accepts its stored label without duplicating or relabelling historical releases',()=>{
 const version='SH-01.30.59 v';
 for(const label of [version,version+' · тестовая'])assert.doesNotThrow(()=>assertStagingReleaseLabels({release:{version},releases:[{version:label}]},version));
 for(const label of ['SH-01.30.52 v',version+' · production'])assert.throws(()=>assertStagingReleaseLabels({release:{version},releases:[{version:label}]},version),/STALE/);
 assert.throws(()=>assertStagingReleaseLabels({release:{version:'SH-01.30.52 v'},releases:[{version}]},version),/STALE/);
});
test('every historical cache label is replaced completely while revision and neighbours survive',()=>{
 for(const query of ['?v=SH-01.30.53-v','?v=SH-01.30.59%20v&rev=unified','?v=offer-eval-r3-20261117-integrated','?v=aabbccddeeff','']){
  const before='<script src="./app.js'+query+'"></script><script src="./other-app.js?v=keep"></script>';
  const after=stampAssetReference(before,'app.js','123456abcdef');
  assert.ok(after.includes('./app.js?v=123456abcdef'+(query.includes('rev=')?'&rev=unified':'')));
  assert.ok(after.includes('./other-app.js?v=keep'));
  assert.equal(stagingHtmlStructure(before),stagingHtmlStructure(after));
 }
});
test('missing or duplicate entries and invalid digests fail without returning a partial plan',()=>{
 for(const html of ['<script src="./other.js"></script>','<script src="./app.js"></script><script src="./app.js?v=x"></script>'])assert.throws(()=>stampAssetReference(html,'app.js','123456abcdef'),/NOT_UNIQUE/);
 assert.throws(()=>stampAssetReference('<script src="./app.js"></script>','app.js','release-name'),/INVALID/);
});
test('structural identity retains source order, revisions and stylesheet choices',()=>{
 const a='<link href="./style.css?v=OLD&rev=1"><script src="./app.js?v=OLD"></script>';
 assert.notEqual(stagingHtmlStructure(a),stagingHtmlStructure(a.replace('rev=1','rev=2')));
 assert.notEqual(stagingHtmlStructure(a),stagingHtmlStructure(a.replace('style.css','other.css')));
});
