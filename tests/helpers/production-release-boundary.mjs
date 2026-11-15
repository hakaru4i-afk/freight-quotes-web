import assert from'node:assert/strict';import{readFileSync,existsSync,lstatSync}from'node:fs';import{resolve,sep}from'node:path';import{createHash}from'node:crypto';
export function assertProductionReleaseIntegrity(root=process.cwd()){
 const read=p=>readFileSync(resolve(root,p),'utf8'),manifest=JSON.parse(read('production-release-manifest.json')),info=JSON.parse(read('build-info.json')),stage=JSON.parse(read('test/build-info.json')),status=JSON.parse(read('site-status.json'));
 assert.equal(manifest.environment,'production');assert.equal(info.environment,'production');assert.equal(info.projectRef,'ooclsrndeygojtofuyte');assert.equal(manifest.businessVersion,stage.primaryBusinessVersion);assert.equal(info.releaseVersion,manifest.businessVersion);assert.equal(status.release.version,manifest.businessVersion);assert.equal(info.build,manifest.frontendBuild);assert.equal(status.version,manifest.frontendBuild);assert.equal(manifest.sourceStagingBuild,stage.stagingAssetBuildId);assert.match(manifest.sourceStagingFrontendCommit,/^[a-f0-9]{40}$/);
 for(const required of['app.js','index.html','build-info.json','site-status.json'])assert.match(manifest.assets?.[required]||'',/^[a-f0-9]{64}$/);
 for(const [name,digest]of Object.entries(manifest.assets)){
  const path=resolve(root,name);assert.ok(!name.startsWith('/')&&path.startsWith(resolve(root)+sep),'Asset path must stay inside the release');assert.ok(!lstatSync(path).isSymbolicLink(),'Release assets must be ordinary files');assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),digest,'Unreviewed production asset: '+name);
 }
 assert.ok(read('app.js').includes('ooclsrndeygojtofuyte'));assert.ok(!read('app.js').includes('ibclzdkxiozbzmniiygv'),'Production must not call staging');assert.ok(read('index.html').includes('app.js?v='+manifest.frontendBuild));return manifest;
}
export function assertProductionFeatureBoundary(content,marker,root=process.cwd()){
 if(!content.includes(marker))return;
 assert.ok(existsSync(resolve(root,'production-release-manifest.json')),'A staging feature may enter production only through a complete release manifest');assertProductionReleaseIntegrity(root);
}
