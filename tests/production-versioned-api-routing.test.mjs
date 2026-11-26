import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../staging-transport-20261111.js',import.meta.url),'utf8');
const host='https://ooclsrndeygojtofuyte.supabase.co/functions/v1/';
const slug='freight-api-release-'+'a'.repeat(32);
function fixture(){
 const calls=[],window={fetch:(...args)=>{calls.push(args);return Promise.resolve(new Response(null,{status:204}));}};
 vm.runInNewContext(source,{window,Request,URL,location:{href:'https://hakaru4i-afk.github.io/freight-quotes-web/'}});
 return {window,calls};
}
test('legacy and immutable production route, preserve query and fetch once',async()=>{
 for(const name of ['freight-api',slug]){
 const {window,calls}=fixture();await window.fetch(host+name+'/api/session?x=1');
 assert.equal(calls.length,1);const url=new URL(calls[0][0]);assert.equal(url.searchParams.get('x'),'1');assert.equal(url.searchParams.get('forceFunctionRegion'),'eu-central-1');assert.equal(url.pathname,'/functions/v1/'+name+'/api/session');
 }
});
test('POST preserves original method, authorization and body',async()=>{
 const {window,calls}=fixture();await window.fetch(new Request(host+slug+'/api/chat',{method:'POST',headers:{authorization:'Bearer test'},body:'{"text":"test"}'}));
 assert.equal(calls.length,1);const req=calls[0][0];assert.equal(req.method,'POST');assert.equal(req.headers.get('authorization'),'Bearer test');assert.equal(await req.text(),'{"text":"test"}');assert.equal(new URL(req.url).searchParams.get('forceFunctionRegion'),'eu-central-1');
});
test('does not modify staging, malformed slug or unrelated origin',async()=>{
 for(const url of ['https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api/api/session',host+'freight-api-release-bad/api/session','https://example.com/functions/v1/'+slug+'/api/session']){
 const {window,calls}=fixture();await window.fetch(url);assert.equal(calls.length,1);assert.equal(calls[0][0],url);
 }
});
