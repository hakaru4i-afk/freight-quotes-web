import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../test/portal-feedback-center-20261107.js',import.meta.url),'utf8');
const start=source.indexOf('const isArchived=item=>'),end=source.indexOf('function detail(){',start);
assert.ok(start>0&&end>start);
function probe(statusFilter,registry='all',searchQuery='',customItems,executions=[],owner=true){
 const items=customItems||['sent','read','evaluated','in_progress','release','completed','denied'].map(status=>({id:status,code:status,status,journal:'developments',description:'x',category:'development'}));
 const ctx={data:{owner,items,events:[]},executionByFeedback:new Map(executions),statusFilter,registry,searchQuery,selected:'',statusLabels:Object.fromEntries(items.map(i=>[i.status,i.status])),registerLabels:{developments:'Development'},categoryLabels:{development:'Development'},byLang:'ru',esc:String,t:()=>({}),badge:()=>'',formatTime:()=>''};
 runInNewContext(source.slice(start,end)+'\nglobalThis.ids=visibleFeedbackItems().map(x=>x.id);globalThis.html=itemsList();globalThis.states=items.map(i=>feedbackLifecycle(i));',ctx);
 return {ids:Array.from(ctx.ids),html:ctx.html,states:Array.from(ctx.states)};
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
 assert.deepEqual([...dropdown.matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]),['all','sent','read','evaluated','awaiting_development','in_progress','release','archive']);
 assert.deepEqual(['sent','read','evaluated','awaiting_development','in_progress','release','archive'].flatMap(key=>probe(key).ids).sort(),probe('all').ids.sort());
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

test('backend PR evidence is visible without making a partial task ready for release',()=>{
 const first=source.indexOf('const taskStatusLabels='),last=source.indexOf('const readinessReasonKeys=',first);
 assert.ok(first>=0&&last>first);
 const e={status:'merged',number:158,headSha:'a'.repeat(40),merged:true,checks:{passed:5,total:5,pending:0,other:0}};
 for(const lang of ['ru','en','zh']){
  const ctx={byLang:lang,esc:String};
  runInNewContext(source.slice(first,last)+';globalThis.markup=backendEvidenceMarkup;globalThis.statusText=taskStatusText;',ctx);
  const execution={step:'branch_awaiting_codex',progress:0,checksPassed:false,backendEvidence:e};
  assert.match(ctx.markup(execution),/https:\/\/github\.com\/hakaru4i-afk\/freight-quotes\/pull\/158/);
  assert.match(ctx.markup(execution),/5\/5/);
  assert.notEqual(ctx.statusText(execution),ctx.statusText({...execution,backendEvidence:null}));
  assert.equal(ctx.markup({...execution,backendEvidence:{...e,number:'<script>'}}),'');
  assert.doesNotMatch(ctx.markup({...execution,backendEvidence:{...e,checks:{passed:5,total:2,pending:0,other:0}}}),/5\/2/);
  assert.equal(ctx.markup({}), '');
  assert.match(ctx.markup({backendEvidence:{status:'unavailable'}}),/Backend/);
 }
 assert.match(source,/esc\(progressText\)\+'<\/p>'\+backendEvidenceMarkup\(execution\)/);
});

const pageStart=source.indexOf('async function loadFeedbackPages('),pageEnd=source.indexOf('async function apiCall(',pageStart);
assert.ok(pageStart>0&&pageEnd>pageStart);
const context={};runInNewContext(source.slice(pageStart,pageEnd)+'\nglobalThis.loadPages=loadFeedbackPages;',context);
const numbered=(number,status='in_progress')=>({id:String(number),code:'IM-2026-'+String(number).padStart(6,'0'),status,journal:'developments',description:'x',category:'development'});
const allItems=Array.from({length:252},(_,i)=>numbered(252-i,i===250?'denied':'in_progress'));
const makePage=(offset,owner=true)=>({ok:true,owner,role:owner?'owner':'carrier',items:allItems.slice(offset,offset+200),events:allItems.slice(offset,offset+200).map(i=>({request_id:i.id,journal:i.journal})),hasMore:offset+200<allItems.length,nextOffset:offset+200<allItems.length?offset+200:null});
test('loads the entire authorized 252-card registry and all returned page events, including IM-000001',async()=>{
 const offsets=[];const data=await context.loadPages(async offset=>{offsets.push(offset);return makePage(offset)});
 assert.deepEqual(offsets,[0,200]);assert.equal(data.items.length,252);assert.equal(data.events.length,252);assert.equal(data.items.at(-1).code,'IM-2026-000001');assert.equal(data.hasMore,false);assert.equal(data.nextOffset,null);
 assert.deepEqual(probe('all','all','IM-2026-000001',data.items).ids,['1']);
 assert.deepEqual(probe('in_progress','all','1',data.items).ids,['1']);
 assert.deepEqual(probe('archive','all','2',data.items).ids,['2']);
 assert.deepEqual(probe('in_progress','all','2',data.items).ids,[]);
 assert.match(probe('all','all','1',data.items).html,/id="pf-number-search"/);
});
test('pagination keeps the server role and rejects invalid cursors, duplicate rows and failed later pages',async()=>{
 const own=await context.loadPages(async offset=>makePage(offset,false));assert.equal(own.owner,false);assert.equal(own.role,'carrier');
 await assert.rejects(context.loadPages(async offset=>({...makePage(offset),nextOffset:0})),/INVALID_FEEDBACK_CURSOR/);
 await assert.rejects(context.loadPages(async offset=>offset?makePage(0):makePage(offset)),/FEEDBACK_PAGE_CHANGED_REFRESH/);
 await assert.rejects(context.loadPages(async offset=>offset?makePage(offset,false):makePage(offset)),/FEEDBACK_ACCESS_CHANGED/);
 await assert.rejects(context.loadPages(async offset=>{if(offset)throw Error('HTTP 503');return makePage(offset)}),/HTTP 503/);
});

test('Owner intake rows awaiting dispatch are not counted as active development, preserve actual API status and terminal rows',()=>{
 const items=['queued','working','external','unknown','completed','denied','release','pending'].map(id=>({id,code:id,status:['completed','denied','release'].includes(id)?id:'in_progress',sender_role:id==='external'?'carrier':'owner',journal:'developments',description:'x',category:'development'}));
 const newTask={decision:'new',dispatchStatus:'not_requested'};
 const executions=[['queued',newTask],['working',{decision:'in_progress',dispatchStatus:'dispatched'}],['external',newTask],['completed',newTask],['denied',newTask],['release',newTask],['pending',{decision:'new',dispatchStatus:'pending'}]];
 assert.deepEqual(probe('awaiting_development','all','',items,executions).ids,['queued']);
 assert.deepEqual(probe('in_progress','all','',items,executions).ids,['working','external','unknown','pending']);
 assert.deepEqual(probe('archive','all','',items,executions).ids,['completed','denied']);
 assert.equal(items[0].status,'in_progress');
 assert.deepEqual(probe('all','all','',items,executions,false).states,items.map(i=>i.status));
 assert.match(probe('all','all','',items,executions).html,/Ожидает запуска разработки/);
});
