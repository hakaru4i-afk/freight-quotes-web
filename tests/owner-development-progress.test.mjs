import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';

const file=name=>readFileSync('test/'+name,'utf8');
const candidates=[
 'owner-registers-20261111.js',
 'owner-command-center-20261108.js',
 'owner-registers-20261111.css',
 'owner-command-center-20261108.css'
];

test('Owner progress scripts parse and use only server-backed six-stage lifecycle',()=>{
 const registry=file(candidates[0]),dashboard=file(candidates[1]);
 new Script(registry);new Script(dashboard);
 for(const source of [registry,dashboard]){
  for(const pair of ['sent:1','read:2','evaluated:3','in_progress:4','release:5','completed:6']){
   assert.ok(source.includes(pair),'Missing real status '+pair);
  }
  assert.match(source,/role:['"]progressbar['"]|role="progressbar"/);
  assert.match(source,/started_at/);
  assert.match(source,/120/,'Two-hour SLA must be visible');
 }
 assert.match(registry,/setInterval\(\(\)=>void pollLiveRegisters\(\),30000\)/);
 assert.match(dashboard,/setInterval\(async\(\)=>/);
 assert.match(dashboard,/request\('\/api\/portal-feedback'\)/);
 assert.doesNotMatch(dashboard,/localStorage|sessionStorage/);
});

test('Staging HTML cache keys match exact changed assets',()=>{
 const html=file('index.html');
 for(const name of candidates){
  const source=readFileSync('test/'+name);
  const blob=createHash('sha1').update('blob '+source.length+'\\0').update(source).digest('hex');
  const expected='./'+name+'?v='+blob.slice(0,12);
  assert.ok(html.includes(expected),'stale staging cache key: '+name);
 }
});

test('Progress styling remains readable for desktop and mobile',()=>{
 const center=file(candidates[2]),dashboard=file(candidates[3]);
 for(const s of [center,dashboard]){
  assert.match(s,/ow-task-progress-track/);
  assert.match(s,/ow-task-overdue/);
  assert.match(s,/prefers-reduced-motion/);
 }
});
