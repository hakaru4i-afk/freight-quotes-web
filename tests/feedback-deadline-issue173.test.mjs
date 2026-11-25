import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const paths=[
 'portal-feedback-center-20261107.js',
 'test/portal-feedback-center-20261107.js',
 'release/owner-portal-feedback-center-20261122.js'
];
// Approved Issue #173 candidate was promoted to production in SH64.
const source=readFileSync('release/candidates/issue173-deadline-20261123.js','utf8');

function probe(script=source){
 const fixed=new Date('2026-11-23T08:00:00Z');
 class FakeDate extends Date{
  constructor(...args){super(...(args.length?args:[fixed.toISOString()]));}
  static now(){return fixed.getTime();}
 }
 const context={
  document:{documentElement:{lang:'ru'},getElementById:()=>null,addEventListener:()=>{},visibilityState:'hidden'},
  MutationObserver:class{observe(){}},
  setInterval:()=>{},requestAnimationFrame:()=>{},Intl,Date:FakeDate,console
 };
 const instrumented=script.replace(/\}\)\(\);\s*$/,'globalThis.__probe={requestStatus,minskToday,deadlineState};})();');
 assert.notEqual(instrumented,script,'deadline test functions must be exposed only inside the test VM');
 runInNewContext(instrumented,context);
 return context.__probe;
}

test('published bytes match the approved release and staging retains the Issue #173 behavior',()=>{
 const published=readFileSync(paths[0],'utf8');
 assert.equal(readFileSync(paths[2],'utf8'),published,paths[2]);
 const stage=probe(readFileSync(paths[1],'utf8'));
 assert.equal(stage.requestStatus({status:'release',release_date:'2026-11-22'}),'Выпуск');
 assert.equal(stage.deadlineState({status:'in_progress',release_date:'2026-11-22'},{}),'Просрочено');
 const manifest=JSON.parse(readFileSync('production-release-manifest.json','utf8'));
 if(manifest.businessVersion==='SH-01.30.64 v')assert.equal(source,published,'SH64 must include the approved Issue 173 asset');
 else{
  assert.match(manifest.businessVersion,/^SH-01\.30\.(?:6[5-9]|[7-9][0-9]) v$/);
  assert.notEqual(source,published,'Later reviewed releases preserve historic SH64 evidence separately');
 }
});

test('legacy release_date is labelled as a deadline, never a publication date',()=>{
 assert.match(source,/date:"Дедлайн исполнения"/);
 assert.match(source,/date:"Completion deadline"/);
 assert.match(source,/date:"完成截止日期"/);
 assert.doesNotMatch(source,/Плановая дата публикации|Planned release date|计划发布日期/);
 assert.match(source,/name="releaseDate" value=/);
 assert.doesNotMatch(source,/name="releaseDate" disabled/);
 assert.match(source,/!codexNetworkBlocked/);
 assert.match(source,/Задача сохранена в GitHub/);

 const x=probe();
 assert.equal(x.requestStatus({status:'release',release_date:'2026-11-22'}),'Выпуск');
});

test('deadline changes to overdue only after Minsk calendar day has ended',()=>{
 const x=probe();
 assert.equal(x.minskToday(),'2026-11-23');
 assert.equal(x.deadlineState({status:'in_progress',release_date:'2026-11-23'},{}),'В работе');
 assert.equal(x.deadlineState({status:'in_progress',release_date:'2026-11-22'},{}),'Просрочено');
 assert.equal(x.deadlineState({status:'release',release_date:'2026-11-23'},{checksPassed:true,step:'ready_for_review'}),'Готово к выпуску');
 assert.equal(x.deadlineState({status:'in_progress',release_date:'2026-11-24'},{step:'codex_failed'}),'Заблокировано: тесты не пройдены');
 assert.equal(x.deadlineState({status:'completed',release_date:'2026-11-22'},{}),'');
});
