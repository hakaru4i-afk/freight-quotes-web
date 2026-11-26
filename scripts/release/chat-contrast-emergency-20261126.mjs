// Owner emergency #217: patch only the verified published CSS, preserve API and staging.
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {captureRoot,live} from './locked-staging.mjs';
import {digest} from './locked-release.mjs';
const marker='/* CHAT-CONTRAST-20261126:';
const source='1469b6a83ba2feb74b9f0d1039ed9956f40f4360';
const file='lw-contrast-canonical-20261111.css';
const manifestName='production-release-manifest.json';
const stageManifest='test/staging-manifest.json';
const [mode]=process.argv.slice(2);
const safeStage=p=>/^test\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:js|mjs|css|html|json|svg|webp|png|jpe?g|gif|ico|wasm|gz|woff2?|ttf|otf|txt)$/i.test(p)&&!p.split('/').some(x=>x.startsWith('.')||['scripts','tests','docs','config','reports','release','verified','node_modules'].includes(x));
const write=(dir,p,b)=>{const dst=join(dir,p);mkdirSync(dirname(dst),{recursive:true});writeFileSync(dst,b);};
const patch=readFileSync(file,'utf8').split(marker);
assert.equal(patch.length,2,'HOTFIX_SOURCE_MISSING');
const css=marker+patch[1];
for(const name of ['.chat-workspace','.lw-ved-chat-layout','.sw-chat-messages','.t2-chat'])assert.ok(css.includes(name));
assert.ok(!/url\s*\(|@import|<\/style/i.test(css),'UNEXPECTED_CSS_NETWORK_OR_MARKUP');
if(mode==='prepare'){
 const root=await captureRoot(), rawStage=await live(stageManifest), stage=JSON.parse(rawStage);
 assert.ok(stage.environment==='staging'&&stage.assetHashes,'STAGING_INVENTORY_UNAVAILABLE');
 const stageFiles=new Map([[stageManifest,rawStage]]);
 const entries=Object.entries(stage.assetHashes).filter(([p])=>safeStage(p)&&p!==stageManifest);
 assert.ok(entries.length>50,'STAGING_INVENTORY_INCOMPLETE');
 let i=0;
 await Promise.all(Array.from({length:8},async()=>{while(i<entries.length){
  const [p,h]=entries[i++];assert.match(h,/^[a-f0-9]{64}$/);
  const b=await live(p);assert.equal(digest(b),h,'STAGING_ASSET_MISMATCH:'+p);stageFiles.set(p,b);
 }}));
 for(const p of ['test/index.html','test/app.js','test/staging-transport-20261111.js'])assert.ok(stageFiles.has(p),'STAGING_ASSET_MISSING:'+p);
 assert.ok((await live(stageManifest)).equals(rawStage),'STAGING_CHANGED_DURING_CAPTURE');
 const manifest=JSON.parse(root.get(manifestName));
 assert.ok((await live(manifestName)).equals(root.get(manifestName)),'PRODUCTION_CHANGED_DURING_CAPTURE');
 assert.ok(!manifest.chatContrastHotfix,'HOTFIX_ALREADY_PUBLISHED');
 for(const dir of ['.chat-before','.chat-pages']){rmSync(dir,{recursive:true,force:true});mkdirSync(dir);}
 for(const [p,b] of [...root,...stageFiles,['.nojekyll',Buffer.alloc(0)]])for(const dir of ['.chat-before','.chat-pages'])write(dir,p,b);
 const oldCss=root.get('bundle.css').toString('utf8'),oldSource=root.get(file).toString('utf8');
 assert.ok(!oldCss.includes(marker)&&!oldSource.includes(marker),'HOTFIX_ALREADY_PRESENT');
 const heading='/* --- SOURCE '+file+' --- */\n';
 const needle=heading+oldSource+'\n';
 assert.equal(oldCss.split(needle).length,2,'LIVE_BUNDLE_SOURCE_MISMATCH');
 const sourceBytes=Buffer.from(oldSource+'\n'+css);
 const bundle=Buffer.from(oldCss.replace(needle,heading+sourceBytes.toString('utf8')+'\n'));
 let html=root.get('index.html').toString('utf8');
 const re=/bundle\.css\?v=[a-f0-9]{12,40}/g;
 assert.equal([...html.matchAll(re)].length,1,'LIVE_BUNDLE_REFERENCE_MISMATCH');
 html=html.replace(re,'bundle.css?v='+digest(bundle).slice(0,16));
 for(const [p,b] of [[file,sourceBytes],['bundle.css',bundle],['index.html',Buffer.from(html)]]){
  manifest.assets[p]=digest(b);write('.chat-pages',p,b);
 }
 manifest.chatContrastHotfix={sourceCommit:source,sourcePullRequest:217,workflowCommit:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,scope:'CSS_ONLY',apiChanged:false,databaseChanged:false,baseFrontendSourceCommit:manifest.frontendSourceCommit,baseManifestSha256:digest(root.get(manifestName)),bundleSha256:digest(bundle),date:new Date().toISOString()};
 write('.chat-pages',manifestName,JSON.stringify(manifest,null,2)+'\n');
 // Verify full root integrity with the current boundary helper.
 const {assertPublishedProductionRoot}=await import('../../tests/helpers/production-release-boundary.mjs');
 const next=new Map(root);for(const p of [file,'bundle.css','index.html',manifestName])next.set(p,readFileSync(join('.chat-pages',p)));
 assertPublishedProductionRoot(next);
 console.log('CHAT_HOTFIX_PACKAGE_PASS',manifest.chatContrastHotfix, 'staging files',stageFiles.size);
}else if(mode==='verify'){
 for(const p of [manifestName,'index.html','bundle.css',file,stageManifest,'test/index.html','test/app.js']){
  const expected=readFileSync(join('.chat-pages',p));
  let ok=false;
  for(let i=0;i<20;i++){try{if((await live(p,{key:process.env.GITHUB_RUN_ID+'-verify-'+i})).equals(expected)){ok=true;break;}}catch{}await new Promise(r=>setTimeout(r,3000));}
  assert.ok(ok,'PUBLISHED_ASSET_MISMATCH:'+p);
 }
 console.log('CHAT_HOTFIX_LIVE_PASS');
}else throw Error('UNKNOWN_MODE');
