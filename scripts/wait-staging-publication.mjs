// Pages may still serve the preceding commit when a main push starts CI.
// Wait for exact candidate bytes; a timeout remains a failed publication.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const root=new URL('../test/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('build-info.json',root),'utf8'));
const names=['index.html','build-info.json','app.js','qa-observer.json',manifest.lateBidUiScript,manifest.task2.frontendScript,manifest.task2.guidanceScript];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected=new Map(await Promise.all(names.map(async name=>[name,digest(await readFile(new URL(name,root)))])));
const deadline=Date.now()+6*60*1000;
for(let attempt=1;;attempt++){
 const pending=(await Promise.all(names.map(async name=>{
  try{
   const response=await fetch('https://hakaru4i-afk.github.io/freight-quotes-web/test/'+name,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
   return response.ok&&digest(Buffer.from(await response.arrayBuffer()))===expected.get(name)?null:name;
  }catch{return name;}
 }))).filter(Boolean);
 if(!pending.length){console.log('EXACT_STAGING_PUBLICATION_PASS',names.length,'files; attempt',attempt);break;}
 if(Date.now()>=deadline)throw Error('STAGING_PUBLICATION_TIMEOUT: '+pending.join(', '));
 console.log('STAGING_PUBLICATION_PENDING',attempt,pending.join(', '));
 await delay(Math.min(15000,Math.max(0,deadline-Date.now())));
}
