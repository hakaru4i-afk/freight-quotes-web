import test from'node:test';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{createHash}from'node:crypto';import{assertProductionReleaseIntegrity,assertProductionFeatureBoundary,assertHistoricalProductionRelease,assertPublishedProductionRoot,assertProductionSourceFeatureBoundary}from'./helpers/production-release-boundary.mjs';
test('production promotion requires exact production identity and every declared asset byte',()=>{
 const root=mkdtempSync(join(tmpdir(),'production-release-boundary-'));try{
 mkdirSync(join(root,'test'));const put=(p,v)=>writeFileSync(join(root,p),typeof v==='string'?v:JSON.stringify(v)),build='a'.repeat(20),version='SH-01.30.52 v';put('test/build-info.json',{environment:'staging',projectRef:'ibclzdkxiozbzmniiygv',primaryBusinessVersion:version,stagingAssetBuildId:'b'.repeat(20)});put('app.js','const host="ooclsrndeygojtofuyte"; /* promoted feature */');put('index.html','<script src="app.js?v='+build+'"></script>');put('build-info.json',{environment:'production',projectRef:'ooclsrndeygojtofuyte',sourceStagingBuild:'b'.repeat(20),releaseVersion:version,build});put('site-status.json',{version:build,release:{version}});
 assert.throws(()=>assertProductionFeatureBoundary('promoted feature','promoted feature',root),/complete release manifest/);
 const assets=Object.fromEntries(['app.js','index.html','build-info.json','site-status.json','test/build-info.json'].map(p=>[p,createHash('sha256').update(readFileSync(join(root,p))).digest('hex')]));put('production-release-manifest.json',{environment:'production',businessVersion:version,frontendBuild:build,sourceStagingBuild:'b'.repeat(20),sourceStagingFrontendCommit:'c'.repeat(40),assets});assertProductionReleaseIntegrity(root);
 const liveRoot=new Map(['production-release-manifest.json',...Object.keys(assets).filter(path=>!path.startsWith('test/'))].map(path=>[path,readFileSync(join(root,path))]));
 assert.equal(assertPublishedProductionRoot(liveRoot).businessVersion,version);
 liveRoot.set('app.js',Buffer.from('const host="ooclsrndeygojtofuyte"; /* changed served asset */'));
 assert.throws(()=>assertPublishedProductionRoot(liveRoot),/Unreviewed production asset: app.js/);
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
test('the immutable historical production package matches every published digest',()=>{
 const {commit,manifest}=assertHistoricalProductionRelease();
 assert.match(commit,/^[a-f0-9]{40}$/);
 assert.equal(manifest.publicationState,'PUBLISHED');
});

test('the served root accepts the new release identity only for its exact deployment and schema', () => {
  const identity = {
    frontendSourceCommit: 'a'.repeat(40),
    backendSourceCommit: 'b'.repeat(40),
    backendApiVersion: 76,
    backendApiBundleSha256: 'c'.repeat(64),
    apiFunction: 'freight-api-release-' + 'd'.repeat(32),
  };
  const environment = 'production';
  const projectRef = 'ooclsrndeygojtofuyte';
  const businessVersion = 'SH-01.30.73 v';
  const frontendBuild = 'e'.repeat(20);
  const files = new Map(Object.entries({
    'app.js': Buffer.from(`const project = '${projectRef}';`),
    'index.html': Buffer.from(`<script src="app.js?v=${frontendBuild}"></script>`),
    'build-info.json': Buffer.from(JSON.stringify({...identity, environment, projectRef,
      releaseVersion: businessVersion, build: frontendBuild})),
    'site-status.json': Buffer.from(JSON.stringify({version: frontendBuild, release: {version: businessVersion}})),
  }));
  const assets = Object.fromEntries([...files].map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')]));
  const manifest = {...identity, schemaVersion: 3, environment, businessVersion, frontendBuild, assets,
    apiDeploymentId: `${projectRef}_12c37738-f58c-4166-a315-4ef169652cd6_76`, databaseSchemaVersion: '20261126080000'};
  const setManifest = value => files.set('production-release-manifest.json', Buffer.from(JSON.stringify(value)));
  setManifest(manifest);
  assert.deepEqual(assertPublishedProductionRoot(files), manifest);
  setManifest({...manifest, apiDeploymentId: manifest.apiDeploymentId.replace(/_76$/, '_75')});
  assert.throws(() => assertPublishedProductionRoot(files));
});

test('changes to candidate source cannot change the previously published manifest or promote a new marker', t => {
  const root = mkdtempSync(join(tmpdir(), 'production-release-history-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], {encoding:'utf8'}).trim();
  const write = (path, content) => writeFileSync(join(root,path), typeof content === 'string' ? content : JSON.stringify(content));
  const digest = path => createHash('sha256').update(readFileSync(join(root,path))).digest('hex');
  const manifestFile = 'production-release-manifest.json';
  const build = 'a'.repeat(20);
  const version = 'SH-01.30.71 v';
  const stagingBuild = 'b'.repeat(20);
  git('init', '--quiet');
  mkdirSync(join(root,'test'));
  write('app.js','/* previously approved */ const project="ooclsrndeygojtofuyte";');
  write('index.html',`<script src="app.js?v=${build}"></script>`);
  write('build-info.json',{environment:'production',projectRef:'ooclsrndeygojtofuyte',releaseVersion:version,build,sourceStagingBuild:stagingBuild});
  write('site-status.json',{version:build,release:{version}});
  write('test/build-info.json',{environment:'staging',projectRef:'ibclzdkxiozbzmniiygv'});
  const assets = Object.fromEntries(['app.js','index.html','build-info.json','site-status.json','test/build-info.json'].map(path => [path,digest(path)]));
  const manifest = {environment:'production',publicationState:'PUBLISHED',businessVersion:version,
    frontendBuild:build,sourceStagingBuild:stagingBuild,sourceStagingFrontendCommit:'c'.repeat(40),assets};
  write(manifestFile,manifest);
  git('add','.');
  git('commit','--quiet','-m','Published package');
  const released = git('rev-parse','HEAD');

  write('app.js','/* previously approved, new marker */ const project="ooclsrndeygojtofuyte";');
  write(manifestFile,{...manifest,assets:{...assets,'app.js':digest('app.js')}});
  git('add','.');
  git('commit','--quiet','-m','Changed candidate');

  assert.equal(assertHistoricalProductionRelease(root).commit,released);
  assertProductionSourceFeatureBoundary('app.js','previously approved',root);
  assert.throws(() => assertProductionSourceFeatureBoundary('app.js','new marker',root), /complete release manifest/);
});
