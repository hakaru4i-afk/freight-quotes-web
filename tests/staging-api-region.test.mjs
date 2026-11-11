import test from 'node:test';import assert from 'node:assert/strict';
import{stagingRegionalUrl}from'../test/staging-api-region.mjs';
const base='https://ibclzdkxiozbzmniiygv.supabase.co/functions/v1/freight-api';
test('regional routing preserves document identity, Unicode and download format',()=>{
 const input=new URL(base+'/api/documents/file');input.searchParams.set('id','a/b + 中文');input.searchParams.set('format','xlsx');
 const out=new URL(stagingRegionalUrl(input.href));assert.equal(out.origin,input.origin);assert.equal(out.pathname,input.pathname);assert.equal(out.searchParams.get('id'),'a/b + 中文');assert.equal(out.searchParams.get('format'),'xlsx');assert.equal(out.searchParams.get('forceFunctionRegion'),'eu-central-1');
});
test('regional parameter is unique and cannot be overridden by a stale URL',()=>{
 const out=new URL(stagingRegionalUrl(base+'/api/session?forceFunctionRegion=us-east-1&forceFunctionRegion=us-west-1'));
 assert.deepEqual(out.searchParams.getAll('forceFunctionRegion'),['eu-central-1']);
});
test('routing refuses production, foreign origin and non-API requests',()=>{
 for(const input of [base.replace('ibclzdkxiozbzmniiygv','ooclsrndeygojtofuyte')+'/api/session','https://example.invalid/api/session',base+'/health','/api/session',null])assert.throws(()=>stagingRegionalUrl(input),/STAGING_API_SCOPE_REQUIRED/);
});
test('published module hash and imported cache revision match the reviewed source',async()=>{
 const {readFileSync}=await import('node:fs');const {createHash}=await import('node:crypto');const digest=createHash('sha256').update(readFileSync('test/staging-api-region.mjs')).digest('hex');const metadata=JSON.parse(readFileSync('test/build-info.json','utf8'));
 assert.equal(metadata.stagingApiRegion.moduleSha256,digest);assert.ok(readFileSync('test/app.js','utf8').includes('./staging-api-region.mjs?v='+digest.slice(0,12)));assert.equal(metadata.stagingApiRegion.automaticWriteRetry,false);
});
