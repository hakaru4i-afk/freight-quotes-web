import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('test/app.js','utf8');
const begin=source.indexOf('async function ne(C)');
const code=source.slice(begin,source.indexOf('async function j(C)',begin));
async function submit(approved){
  const requests=[],prompts=[];
  const noop=()=>{};
  const scope={N:'delete',D:{kind:'request',id:'round-a',order_code:'QA-A'},F:'Synthetic test',S:'',
    window:{confirm:text=>{prompts.push(text);return approved;},dispatchEvent:noop},
    A:noop,w:noop,X:noop,E:noop,W:noop,R:noop,M:noop,G:async()=>{},he:async()=>{},
    Fr:async(path,body)=>{requests.push({path,body});return{};}};
  const submit=new Function('scope','with(scope){'+code+';return ne;}')(scope);
  await submit({preventDefault:noop});return{requests,prompts};
}
test('canceling the final warning sends no delete request',async()=>{
  const result=await submit(false);assert.equal(result.requests.length,0);assert.equal(result.prompts.length,1);
  assert.match(result.prompts[0],/QA-A/);
});
test('accepting sends confirmation tied to the displayed order and source',async()=>{
  const result=await submit(true);assert.equal(result.requests.length,1);
  assert.equal(result.requests[0].path,'/api/registry');
  assert.deepEqual(result.requests[0].body.deleteConfirmation,{confirmed:true,orderCode:'QA-A',kind:'request',id:'round-a'});
});
