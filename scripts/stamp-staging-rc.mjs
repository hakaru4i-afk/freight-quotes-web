import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';import{dirname,resolve}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),read=name=>readFileSync(resolve(root,'test',name),'utf8'),write=(name,text)=>writeFileSync(resolve(root,'test',name),text);
const hash=value=>createHash('sha256').update(value).digest('hex'),blob=name=>{const bytes=readFileSync(resolve(root,'test',name));return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');};
let html=read('index.html'),app=read('app.js');const meta=JSON.parse(read('build-info.json')),status=JSON.parse(read('site-status.json'));
const files=[...new Set([...html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"\s]*)?"/g)].map(x=>x[1]).filter(x=>/\.(?:js|mjs|css)$/.test(x)).concat('staging-api-region.mjs','process-model-graph.mjs','alignment-role-help.json'))].sort();
const pattern=/currentVersion:"[a-f0-9]{20}"/g;if([...app.matchAll(pattern)].length!==1)throw Error('APP_BUILD_ID_NOT_UNIQUE');
const signature=Object.fromEntries(files.map(name=>[name,hash(name==='app.js'?app.replace(pattern,'currentVersion:"BUILD_ID"'):readFileSync(resolve(root,'test',name)))]));
const buildId=hash(JSON.stringify({assets:signature,backendBundle:meta.stabilizationQa20261110.sharedBackendBundleSha256})).slice(0,20);
const critical=files.filter(name=>html.includes('./'+name+'?v=')||html.includes('./'+name+'"'));
if(process.argv.includes('--write')){
 app=app.replace(pattern,'currentVersion:"'+buildId+'"');write('app.js',app);
 for(const name of critical){if(html.includes('./'+name+'"'))html=html.replace('./'+name+'"','./'+name+'?v='+blob(name).slice(0,12)+'"');const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const re=new RegExp('('+escaped+'\\?v=)[a-z0-9-]+','g');if([...html.matchAll(re)].length!==1)throw Error('CACHE_ENTRY_NOT_UNIQUE:'+name);html=html.replace(re,'$1'+blob(name).slice(0,12));}
 meta.servedAppBlobSha=blob('app.js');meta.task2.frontendSha=blob(meta.task2.frontendScript);meta.task2.styleSha=blob('task2.css');meta.carrierAcceptance.blobSha=blob(meta.carrierAcceptance.script);meta.stagingAssetBuildId=buildId;meta.version=buildId;meta.releaseVersion='SH-01.30.50 v';meta.primaryBusinessVersion='SH-01.30.50 v';
 meta.currentAssetSha256=Object.fromEntries(files.map(name=>[name,hash(readFileSync(resolve(root,'test',name)))]));status.version=buildId;
 for(const name of Object.keys(meta.task2.frontendCandidateComponents||{}))meta.task2.frontendCandidateComponents[name]={gitBlob:blob(name),sha256:hash(readFileSync(resolve(root,'test',name)))};
 write('index.html',html);write('build-info.json',JSON.stringify(meta,null,2)+'\n');write('site-status.json',JSON.stringify(status,null,2)+'\n');
}else{
 if(meta.version!==buildId||meta.releaseVersion!=='SH-01.30.50 v')throw Error('STALE_PRIMARY_VERSION');
 if(!app.includes('currentVersion:"'+buildId+'"')||meta.stagingAssetBuildId!==buildId||status.version!==buildId)throw Error('STALE_STAGING_BUILD_ID');
 for(const name of critical)if(!html.includes(name+'?v='+blob(name).slice(0,12)))throw Error('STALE_CACHE_KEY:'+name);
 for(const name of files)if(meta.currentAssetSha256?.[name]!==hash(readFileSync(resolve(root,'test',name))))throw Error('STALE_ASSET_DIGEST:'+name);
 for(const [name,expected] of Object.entries(meta.task2.frontendCandidateComponents||{}))if(expected.gitBlob!==blob(name)||expected.sha256!==hash(readFileSync(resolve(root,'test',name))))throw Error('STALE_CANDIDATE_COMPONENT:'+name);
 if(meta.servedAppBlobSha!==blob('app.js')||meta.task2.frontendSha!==blob(meta.task2.frontendScript)||meta.task2.styleSha!==blob('task2.css')||meta.carrierAcceptance.blobSha!==blob(meta.carrierAcceptance.script))throw Error('STALE_COMPONENT_BLOB');
}
console.log('STAGING_ASSET_VERSION_'+(process.argv.includes('--write')?'STAMPED':'CURRENT'),buildId);
