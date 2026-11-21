import test from'node:test';import assert from'node:assert/strict';import{mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,symlinkSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{createHash}from'node:crypto';import{assertProductionReleaseIntegrity,assertProductionFeatureBoundary}from'./helpers/production-release-boundary.mjs';
test('production promotion requires exact production identity and every declared asset byte',()=>{
 const root=mkdtempSync(join(tmpdir(),'production-release-boundary-'));try{
 mkdirSync(join(root,'test'));const put=(p,v)=>writeFileSync(join(root,p),typeof v==='string'?v:JSON.stringify(v)),build='a'.repeat(20),version='SH-01.30.52 v';put('test/build-info.json',{environment:'staging',projectRef:'ibclzdkxiozbzmniiygv',primaryBusinessVersion:version,stagingAssetBuildId:'b'.repeat(20)});put('app.js','const host="ooclsrndeygojtofuyte"; /* promoted feature */');put('index.html','<script src="app.js?v='+build+'"></script>');put('build-info.json',{environment:'production',projectRef:'ooclsrndeygojtofuyte',sourceStagingBuild:'b'.repeat(20),releaseVersion:version,build});put('site-status.json',{version:build,release:{version}});
 assert.throws(()=>assertProductionFeatureBoundary('promoted feature','promoted feature',root),/complete release manifest/);
 const assets=Object.fromEntries(['app.js','index.html','build-info.json','site-status.json'].map(p=>[p,createHash('sha256').update(readFileSync(join(root,p))).digest('hex')]));put('production-release-manifest.json',{environment:'production',businessVersion:version,frontendBuild:build,sourceStagingBuild:'b'.repeat(20),sourceStagingFrontendCommit:'c'.repeat(40),assets});assertProductionReleaseIntegrity(root);
 // A manifest must not read outside the release via a symlinked asset directory.
 const external=mkdtempSync(join(tmpdir(),'release-escape-'));
 try{
  writeFileSync(join(external,'escape.js'),'outside');
  symlinkSync(external,join(root,'linked-assets'),'dir');
  const escaped=JSON.parse(readFileSync(join(root,'production-release-manifest.json')));
  escaped.assets['linked-assets/escape.js']=createHash('sha256').update('outside').digest('hex');
  put('production-release-manifest.json',escaped);
  assert.throws(()=>assertProductionReleaseIntegrity(root),/symlinked parent directory/);
  delete escaped.assets['linked-assets/escape.js'];put('production-release-manifest.json',escaped);
 }finally{rmSync(external,{recursive:true,force:true});}
 // A changed release label must stay blocked even in an otherwise valid synthetic fixture.
 put('build-info.json',{environment:'production',projectRef:'ooclsrndeygojtofuyte',sourceStagingBuild:'b'.repeat(20),releaseVersion:'SH-01.30.59 v',build});
 assert.throws(()=>assertProductionReleaseIntegrity(root),/PRODUCTION_RELEASE_VERSION_MISMATCH/);
 put('build-info.json',{environment:'production',projectRef:'ooclsrndeygojtofuyte',sourceStagingBuild:'b'.repeat(20),releaseVersion:version,build});
 put('app.js','tampered');assert.throws(()=>assertProductionReleaseIntegrity(root),/Unreviewed production asset/);
 put('app.js','ibclzdkxiozbzmniiygv');const m=JSON.parse(readFileSync(join(root,'production-release-manifest.json')));m.assets['app.js']=createHash('sha256').update('ibclzdkxiozbzmniiygv').digest('hex');put('production-release-manifest.json',m);assert.throws(()=>assertProductionReleaseIntegrity(root));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('the production release tree is internally consistent when a promotion manifest is present',()=>{if(existsSync('production-release-manifest.json'))assertProductionReleaseIntegrity();});
