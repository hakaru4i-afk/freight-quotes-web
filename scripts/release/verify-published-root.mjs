import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync,lstatSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';

// Every existing root asset must retain its exact public bytes, not just its version label.
// This deliberately fails on unavailable, changed or unaccounted-for public files.
export async function verifyPublishedRoot(pagesDir, {
 baseUrl='https://hakaru4i-afk.github.io/freight-quotes-web/',
 fetcher=fetch, concurrency=6, retries=2
}={}){
 const root=resolve(pagesDir),files=[];
 const visit=dir=>{
  for(const ent of readdirSync(dir,{withFileTypes:true})){
   const path=resolve(dir,ent.name),rel=relative(root,path).split(sep).join('/');
   if(rel==='test'||rel.startsWith('test/'))continue;
   const stat=lstatSync(path);assert.ok(!stat.isSymbolicLink(),'PUBLIC_SYMLINK:'+rel);
   if(stat.isDirectory())visit(path);else if(stat.isFile()&&rel!=='.nojekyll')files.push(rel);
  }
 };visit(root);
 assert.ok(files.length>=5,'MISSING_ROOT_PRODUCTION_BASELINE');
 for(const name of ['index.html','app.js','build-info.json','site-status.json','production-release-manifest.json'])
  assert.ok(files.includes(name),'MISSING_PRODUCTION_ROOT_FILE:'+name);
 files.sort();
 const hash=b=>createHash('sha256').update(b).digest('hex');
 const results=new Array(files.length);
 let index=0;
 async function worker(){while(index<files.length){const id=index++,name=files[id];let fail;
   for(let attempt=0;attempt<=retries;attempt++){
    try {
     const url=new URL(name,baseUrl);url.searchParams.set('immutable_root',String(attempt));
     const response=await fetcher(url.href,{redirect:'error',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});
     assert.equal(response.status,200,'PUBLISHED_ROOT_HTTP_'+response.status+':'+name);
     const actual=hash(Buffer.from(await response.arrayBuffer())),expected=hash(readFileSync(resolve(root,name)));
     assert.equal(actual,expected,'PUBLISHED_ROOT_BYTES_CHANGED:'+name);
     results[id]={name,sha256:actual};fail=null;break;
    }catch(e){fail=e;}
   }
   if(fail)throw fail;
 }}
 await Promise.all(Array.from({length:Math.min(files.length,concurrency)},worker));
 return {verifiedFiles:results.length,rootSha256:hash(JSON.stringify(results)),files:results};
}
if(process.argv[1]&&process.argv[1].endsWith('verify-published-root.mjs')){
 assert.ok(process.argv[2],'USAGE: verify-published-root.mjs <prepared-site-dir>');
 const x=await verifyPublishedRoot(process.argv[2]);
 console.log(JSON.stringify({status:'SERVED_PRODUCTION_ROOT_UNCHANGED',verifiedFiles:x.verifiedFiles,rootSha256:x.rootSha256}));
}