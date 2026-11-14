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
