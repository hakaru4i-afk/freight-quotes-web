import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync('test/build-info.json','utf8')),html=readFileSync('test/index.html','utf8');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
for(const [canonical,served,sha] of [['late-bid-staging.js',manifest.lateBidUiScript,manifest.lateBidUiSha],['task2-guidance.js',manifest.task2.guidanceScript,manifest.task2.guidanceSha],['task2-panel.js',manifest.task2.frontendScript,manifest.task2.frontendSha]])test(canonical+' source, served artifact, manifest and cache key agree',()=>{
 const source=readFileSync('test/'+canonical),active=readFileSync('test/'+served);assert.deepEqual(active,source);assert.equal(blob(active),sha);assert.ok(html.includes(served+'?v='+sha.slice(0,12)));
});

test('all local stylesheet dependencies exist, including vendored Leaflet images',async()=>{
 const {readdir,readFile,access}=await import('node:fs/promises');const {resolve,dirname}=await import('node:path');
 async function visit(dir){for(const d of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,d.name);if(d.isDirectory()){if(!['process-history','processes'].includes(d.name))await visit(p);}else if(p.endsWith('.css')){const s=await readFile(p,'utf8');for(const m of s.matchAll(/url\(["']?([^"')]+)["']?\)/g)){const u=m[1].split('?')[0];if(/^(?:data:|https?:|\/|#)/.test(u))continue;await assert.doesNotReject(access(resolve(dirname(p),u)),'Missing CSS dependency '+p+': '+u);}}}}
 await visit(resolve('test'));
});


test('stylesheet order changes the build and update banner even with identical asset bytes',async t=>{
 const {mkdtempSync,cpSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {execFileSync}=await import('node:child_process');
 const root=mkdtempSync(join(tmpdir(),'freight-html-build-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(join(root,'scripts'));cpSync('scripts/stamp-staging-rc.mjs',join(root,'scripts/stamp-staging-rc.mjs'));cpSync('scripts/staging-asset-cache.mjs',join(root,'scripts/staging-asset-cache.mjs'));cpSync('test',join(root,'test'),{recursive:true});cpSync('.github',join(root,'.github'),{recursive:true});
 const run=flag=>execFileSync(process.execPath,[join(root,'scripts/stamp-staging-rc.mjs'),flag],{cwd:root,encoding:'utf8'});run('--write');const before=JSON.parse(readFileSync(join(root,'test/build-info.json')));let changed=readFileSync(join(root,'test/index.html'),'utf8');const style=changed.match(/<link rel="stylesheet" href="\.\/public-support-20261115\.css[^"]*">/)[0];changed=changed.replace(style,'').replace(/(<link rel="stylesheet" href="\.\/lw-hover-safe-20261108\.css[^"]*">)/,'$1'+style);writeFileSync(join(root,'test/index.html'),changed);run('--write');const after=JSON.parse(readFileSync(join(root,'test/build-info.json')));assert.notEqual(after.version,before.version);assert.deepEqual(readFileSync(join(root,'test/public-support-20261115.css')),readFileSync('test/public-support-20261115.css'));assert.ok(readFileSync(join(root,'test/app.js'),'utf8').includes('currentVersion:"'+after.version+'"'));run('--check');
});
