import{readFileSync,writeFileSync,readdirSync,existsSync}from'node:fs';import{createHash}from'node:crypto';import{dirname,resolve}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),read=name=>readFileSync(resolve(root,'test',name),'utf8'),write=(name,text)=>writeFileSync(resolve(root,'test',name),text);
const hash=value=>createHash('sha256').update(value).digest('hex'),blob=name=>{const bytes=readFileSync(resolve(root,'test',name));return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');};
let html=read('index.html'),app=read('app.js');const meta=JSON.parse(read('build-info.json')),status=JSON.parse(read('site-status.json'));
for(const [name,dependencies]of [['process-model-diff.mjs',['process-model-graph.mjs']],['process-editor-20261111.mjs',['process-model-graph.mjs','process-model-diff.mjs']]]){let content=read(name);for(const dependency of dependencies){const exact="from './"+dependency+"?v="+blob(dependency).slice(0,12)+"'",re=new RegExp("from '\\./"+dependency.replaceAll('.', '\\.')+"(?:\\?v=[a-f0-9]+)?'");if(process.argv.includes('--write'))content=content.replace(re,exact);else if(!content.includes(exact))throw Error('STALE_MODULE_CACHE:'+name+':'+dependency);}if(process.argv.includes('--write'))write(name,content);}
const primaryVersion=meta.primaryBusinessVersion;
if(!/^SH-\d{2}\.\d{2}\.\d{2} v$/.test(primaryVersion||''))throw Error('INVALID_PRIMARY_BUSINESS_VERSION');
// Alias files are generated from reviewed canonical sources. A normal stamp
// must refuse divergent code; explicit synchronization follows reconciliation.
for(const [canonical,served] of [['late-bid-staging.js',meta.lateBidUiScript],['task2-guidance.js',meta.task2.guidanceScript],['task2-panel.js',meta.task2.frontendScript]]){
 const source=read(canonical),active=read(served);
 if(source!==active){
  if(process.argv.includes('--write')&&process.argv.includes('--sync-artifacts'))write(served,source);
  else throw Error('DIVERGENT_CANONICAL_ARTIFACT:'+canonical+':'+served+'; reconcile source before --write --sync-artifacts');
 }
}
for(const [name,deps]of [['global-view/globe.mjs',['route-model.mjs']],['global-view/map.mjs',['route-model.mjs']],['global-view/view.mjs',['distance.mjs','route-model.mjs','globe.mjs','map.mjs']]]){
 let content=read(name);for(const dependency of deps){const version=blob('global-view/'+dependency).slice(0,12),re=new RegExp("((?:from\\s*|import\\s*\\()\\s*['\"]\\./"+dependency.replaceAll('.', '\\.')+")(?:\\?v=[^'\"]+)?(['\"])",'g');
 if(process.argv.includes('--write'))content=content.replace(re,'$1?v='+version+'$2');else if(!content.includes('./'+dependency+'?v='+version))throw Error('STALE_MODULE_CACHE:'+name+':'+dependency);
 }if(process.argv.includes('--write'))write(name,content);
}
// Human release notes and the QA journal must be reviewed with the business version.
// Never silently relabel older release notes as a new release.
if(status.release?.version!==primaryVersion||status.releases?.[0]?.version!==primaryVersion+' · тестовая')throw Error('STALE_VISIBLE_RELEASE_NOTES');
const observer=JSON.parse(read('qa-observer.json'));
if(observer.primaryBusinessVersion!==primaryVersion||observer.versionPair?.ref!=='staging-manifest.json')throw Error('STALE_QA_OBSERVER_VERSION_PAIR');
const files=[...new Set([...html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"\s]*)?"/g)].map(x=>x[1]).filter(x=>/\.(?:js|mjs|css)$/.test(x)).concat('staging-api-region.mjs','process-model-graph.mjs','process-model-diff.mjs','alignment-role-help.json','global-view/route-model.mjs','global-view/distance.mjs','global-view/globe.mjs','global-view/map.mjs'))].sort();
const pattern=/currentVersion:"[a-f0-9]{20}"/g;if([...app.matchAll(pattern)].length!==1)throw Error('APP_BUILD_ID_NOT_UNIQUE');
const signature=Object.fromEntries(files.map(name=>[name,hash(name==='app.js'?app.replace(pattern,'currentVersion:"BUILD_ID"'):readFileSync(resolve(root,'test',name)))]));
const buildId=hash(JSON.stringify({assets:signature,backendBundle:meta.stabilizationQa20261110.sharedBackendBundleSha256})).slice(0,20);
const critical=files.filter(name=>html.includes('./'+name+'?v=')||html.includes('./'+name+'"'));
if(process.argv.includes('--write')){
 if(meta.stagingAssetBuildId!==buildId||!meta.assetBuildRecordedAt)meta.assetBuildRecordedAt=new Date().toISOString();
 app=app.replace(pattern,'currentVersion:"'+buildId+'"');write('app.js',app);
 for(const name of critical){if(html.includes('./'+name+'"'))html=html.replace('./'+name+'"','./'+name+'?v='+blob(name).slice(0,12)+'"');const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const re=new RegExp('('+escaped+'\\?v=)[a-z0-9-]+','g');if([...html.matchAll(re)].length!==1)throw Error('CACHE_ENTRY_NOT_UNIQUE:'+name);html=html.replace(re,'$1'+blob(name).slice(0,12));}
 meta.servedStyleBlobSha=blob('style.css');meta.lateBidUiSha=blob(meta.lateBidUiScript);meta.task2.guidanceSha=blob(meta.task2.guidanceScript);meta.task2.i18n.sourceSha=blob('task2-i18n.js');meta.task2.isolatedQaBundleSha256=meta.stabilizationQa20261110.isolatedQaBundleSha256;
 meta.servedAppBlobSha=blob('app.js');meta.task2.frontendSha=blob(meta.task2.frontendScript);meta.task2.styleSha=blob('task2.css');meta.carrierAcceptance.blobSha=blob(meta.carrierAcceptance.script);meta.stagingAssetBuildId=buildId;meta.version=buildId;meta.releaseVersion=primaryVersion;
 meta.currentAssetSha256=Object.fromEntries(files.map(name=>[name,hash(readFileSync(resolve(root,'test',name)))]));status.version=buildId;
 for(const name of Object.keys(meta.task2.frontendCandidateComponents||{}))meta.task2.frontendCandidateComponents[name]={gitBlob:blob(name),sha256:hash(readFileSync(resolve(root,'test',name)))};
 write('index.html',html);write('build-info.json',JSON.stringify(meta,null,2)+'\n');write('site-status.json',JSON.stringify(status,null,2)+'\n');
}else{
 if(meta.version!==buildId||meta.releaseVersion!==primaryVersion)throw Error('STALE_PRIMARY_VERSION');
 if(!app.includes('currentVersion:"'+buildId+'"')||meta.stagingAssetBuildId!==buildId||status.version!==buildId)throw Error('STALE_STAGING_BUILD_ID');
 for(const name of critical)if(!html.includes(name+'?v='+blob(name).slice(0,12)))throw Error('STALE_CACHE_KEY:'+name);
 for(const name of files)if(meta.currentAssetSha256?.[name]!==hash(readFileSync(resolve(root,'test',name))))throw Error('STALE_ASSET_DIGEST:'+name);
 for(const [name,expected] of Object.entries(meta.task2.frontendCandidateComponents||{}))if(expected.gitBlob!==blob(name)||expected.sha256!==hash(readFileSync(resolve(root,'test',name))))throw Error('STALE_CANDIDATE_COMPONENT:'+name);
 if(meta.servedStyleBlobSha!==blob('style.css')||meta.lateBidUiSha!==blob(meta.lateBidUiScript)||meta.task2.guidanceSha!==blob(meta.task2.guidanceScript)||meta.task2.i18n.sourceSha!==blob('task2-i18n.js')||meta.task2.isolatedQaBundleSha256!==meta.stabilizationQa20261110.isolatedQaBundleSha256)throw Error('STALE_ACTIVE_COMPONENT_METADATA');
 if(meta.servedAppBlobSha!==blob('app.js')||meta.task2.frontendSha!==blob(meta.task2.frontendScript)||meta.task2.styleSha!==blob('task2.css')||meta.carrierAcceptance.blobSha!==blob(meta.carrierAcceptance.script))throw Error('STALE_COMPONENT_BLOB');
}
// Workflow smoke checks must use the same cache contract as the published HTML.
for(const name of readdirSync(resolve(root,'.github/workflows')).filter(n=>/\.ya?ml$/.test(n))){
 const content=readFileSync(resolve(root,'.github/workflows',name),'utf8');
 for(const match of content.matchAll(/([A-Za-z0-9_-]+\.(?:js|mjs|css))\?v=([a-zA-Z0-9-]+)/g)){
  const asset=match[1];if(existsSync(resolve(root,'test',asset))&&match[2]!==blob(asset).slice(0,12))throw Error('STALE_WORKFLOW_CACHE_REF:'+name+':'+asset);
 }
}
console.log('STAGING_ASSET_VERSION_'+(process.argv.includes('--write')?'STAMPED':'CURRENT'),buildId);
