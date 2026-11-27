import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../test/portal-feedback-center-20261107.js',import.meta.url),'utf8');
const start=source.indexOf('const isArchived=item=>'),end=source.indexOf('function detail(){',start);
assert.ok(start>0&&end>start);
function probe(statusFilter,registry='all'){
 const items=['sent','read','evaluated','in_progress','release','completed','denied'].map(status=>({id:status,code:status,status,journal:'developments',description:'x',category:'development'}));
 const ctx={data:{owner:true,items,events:[]},statusFilter,registry,selected:'',statusLabels:Object.fromEntries(items.map(i=>[i.status,i.status])),registerLabels:{developments:'Development'},categoryLabels:{development:'Development'},byLang:'ru',esc:String,t:()=>({}),badge:()=>'',formatTime:()=>''};
 runInNewContext(source.slice(start,end)+'\nglobalThis.ids=visibleFeedbackItems().map(x=>x.id);globalThis.html=itemsList();',ctx);
 return {ids:Array.from(ctx.ids),html:ctx.html};
}
test('archive is the single terminal filter; individual active statuses remain available',()=>{
 assert.deepEqual(probe('archive').ids,['completed','denied']);
 assert.deepEqual(probe('active').ids,['sent','read','evaluated','in_progress','release']);
 assert.deepEqual(probe('in_progress').ids,['in_progress']);
 assert.deepEqual(probe('all').ids,['sent','read','evaluated','in_progress','release','completed','denied']);
 const html=probe('archive').html;
 assert.match(html,/<option value="archive" selected>/);
 assert.doesNotMatch(html,/<option value="(?:active|completed|denied)"/);
 const dropdown=html.match(/<select id="pf-status-filter">([\s\S]*?)<\/select>/)[1];
 assert.deepEqual([...dropdown.matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]),['all','sent','read','evaluated','in_progress','release','archive']);
 assert.deepEqual(['sent','read','evaluated','in_progress','release','archive'].flatMap(key=>probe(key).ids).sort(),probe('all').ids.sort());
});
test('closed tasks do not display old development progress or handoff; published tasks cannot be relaunched from the card',()=>{
 assert.match(source,/const progressPanel=!archived&&execution\?/);
 assert.match(source,/const handoff=Boolean\(!archived&&!publishedProof&&/);
 assert.match(source,/const githubRegistered=Boolean\(!archived&&!publishedProof&&/);
 assert.match(source,/const releaseEligible=data.owner&&!publishedProof&&!alreadyPublished&&/);
 assert.match(source,/const workflowPanel=!data.owner\|\|archived\|\|publishedProof\?/);
});
test('switching filters clears an invisible selection',()=>{
 assert.match(source,/statusFilter=ev.target.value;if\(!visibleFeedbackItems\(\).some\(i=>i.id===selected\)\)selected='';render\(\);/);
});
