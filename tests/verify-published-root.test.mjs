import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {verifyPublishedRoot} from '../scripts/release/verify-published-root.mjs';
const files=['index.html','app.js','build-info.json','site-status.json','production-release-manifest.json'];
async function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'served-root-'));try{mkdirSync(join(dir,'test'));for(const p of files)writeFileSync(join(dir,p),p+'-PUBLISHED');writeFileSync(join(dir,'test','app.js'),'ONLY_NEW_TEST');return await fn(dir)}finally{rmSync(dir,{recursive:true,force:true})}}
test('verifies all root bytes while ignoring /test contents',async()=>fixture(async dir=>{
 const r=await verifyPublishedRoot(dir,{fetcher:async url=>({status:200,arrayBuffer:async()=>Buffer.from(decodeURI(new URL(url).pathname.slice(1)).split('/').at(-1)+'-PUBLISHED')})});
 assert.equal(r.verifiedFiles,5);
}));
test('detects any changed production root bytes',async()=>fixture(async dir=>{
 await assert.rejects(()=>verifyPublishedRoot(dir,{fetcher:async()=>({status:200,arrayBuffer:async()=>Buffer.from('WRONG')})}),/PUBLISHED_ROOT_BYTES_CHANGED/);
}));
test('detects missing served root assets',async()=>fixture(async dir=>{
 await assert.rejects(()=>verifyPublishedRoot(dir,{fetcher:async()=>({status:404,arrayBuffer:async()=>Buffer.from('')})}),/PUBLISHED_ROOT_HTTP_404/);
}));