import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {fetchComplete} from './helpers/real-http-response.mjs';
test('a status-only denial consumes its complete real body and preserves bytes and headers',async t=>{
 let finish,seen;const headersSeen=new Promise(r=>seen=r),body=Buffer.from('Доступ запрещён');
 const server=createServer((req,res)=>{res.writeHead(403,{'Content-Type':'text/plain; charset=utf-8','X-Response-Proof':'real-http'});res.write(body.subarray(0,1));finish=()=>res.end(body.subarray(1));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{finish?.();server.closeAllConnections();server.close();});
 let complete=false;const pending=fetchComplete('http://127.0.0.1:'+server.address().port,{},()=>seen()).then(r=>{complete=true;return r;});
 await headersSeen;assert.equal(complete,false,'Headers alone cannot complete the check');finish();
 const response=await pending;assert.equal(response.status,403);assert.equal(response.headers.get('x-response-proof'),'real-http');assert.deepEqual(Buffer.from(await response.arrayBuffer()),body);
});
test('a stalled real body respects the original abort signal without retrying',async t=>{
 let requests=0;const server=createServer((req,res)=>{requests++;res.writeHead(403);res.write('unfinished');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 await assert.rejects(fetchComplete('http://127.0.0.1:'+server.address().port,{signal:AbortSignal.timeout(100)}));assert.equal(requests,1);
});
