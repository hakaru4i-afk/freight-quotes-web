import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const ui=readFileSync('release/candidates/owner-issue173-publication-receipt-20261123.js','utf8');
test('Old failed PR is shown as historical after verified SH64 production receipt',()=>{
 const src=ui.replace(/\}\)\(\);\s*$/,'globalThis.__test={issue173Published,executionByFeedback,setReceipt:x=>publishedReceipt=x};})();');
 assert.notEqual(src,ui);
 const context={document:{documentElement:{lang:'ru'},getElementById:()=>null,addEventListener:()=>{},baseURI:'https://example.org/freight-quotes-web/',visibilityState:'hidden'},MutationObserver:class{observe(){}},setInterval:()=>{},requestAnimationFrame:()=>{},console,Intl,Date,URL};
 vm.runInNewContext(src,context);
 const p=context.__test;
 const item={id:'task',sender_role:'owner',description:'Срок исполнения [WORK:owner-directive:20261122:deadline-not-release]'};
 p.executionByFeedback.set('task',{register:'remarks',recordId:'RM-20261122-DEADLINE-01',step:'task_e2e_failed',checksPassed:false});
 const receipt=JSON.parse(readFileSync('production-release-manifest.json','utf8'));
 assert.match(receipt.businessVersion,/^SH-01\.30\.(?:6[5-9]|[7-9][0-9]) v$/);
 p.setReceipt(receipt);
 assert.equal(p.issue173Published(item),true);
 assert.equal(p.issue173Published({...item,description:'unrelated task'}),false);
 p.setReceipt({...receipt,issue173DeadlineFix:null});
 assert.equal(p.issue173Published(item),false);
});
test('Historical task cannot be released again while maintaining strict gate for other tasks',()=>{
 assert.match(ui,/const releaseEligible=data.owner&&!alreadyPublished/);
 assert.match(ui,/const isReleaseReady=.*checksPassed===true&&execution\?\.step==='ready_for_review'/);
 assert.match(ui,/fetchPublishedReceipt\(\)/);
 assert.match(ui,/alreadyPublished\?'<section class="pf-published-receipt">/);
});
