import test from 'node:test';
import assert from 'node:assert/strict';

// Synthetic anonymous requests only: no credentials, no user/customer records.
// This verifies the custom authorization gateway, NOT full role-to-role isolation.
const api='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api';
const paths=[
  '/api/access',
  '/api/registry',
  '/api/carrier',
  '/api/data',
  '/api/transport-applications',
  '/api/chats',
  '/api/documents?order=NONEXISTENT-QA',
  '/api/documents/file?id=00000000-0000-0000-0000-000000000000',
  '/api/task2'
];
for(const p of paths){
  test('No anonymous disclosure on '+p,async()=>{
    const resp=await fetch(api+p,{headers:{Origin:'https://hakaru4i-afk.github.io','Cache-Control':'no-store'},signal:AbortSignal.timeout(15000)});
    assert.ok([401,403].includes(resp.status),'expected unauthorized response, got '+resp.status);
    const text=await resp.text();
    assert.ok(text.length<2000,'unauthenticated error body should be small');
    assert.ok(!/"(?:bids|notifications|documents|members|users|profiles|files)"\s*:/.test(text),'unexpected sensitive payload');
  });
}
test('Non-owner preview header cannot grant an anonymous role',async()=>{
  const resp=await fetch(api+'/api/access',{headers:{Origin:'https://hakaru4i-afk.github.io','x-freight-preview-login':'@role:carrier'},signal:AbortSignal.timeout(15000)});
  assert.equal(resp.status,403);
});
test('Unauthenticated write cannot update transport document',async()=>{
  const resp=await fetch(api+'/api/transport-applications',{method:'POST',headers:{Origin:'https://hakaru4i-afk.github.io','Content-Type':'application/json'},body:JSON.stringify({kind:'request',id:'NONEXISTENT-QA',action:'submit',details:{}}),signal:AbortSignal.timeout(15000)});
  assert.ok([401,403].includes(resp.status),'expected auth rejection');
});
