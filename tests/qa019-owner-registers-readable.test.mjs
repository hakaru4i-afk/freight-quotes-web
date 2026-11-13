import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=name=>readFileSync(new URL('../test/'+name,import.meta.url),'utf8');
const source=file('owner-registers-20261111.js'),css=file('owner-registers-20261111.css');
const cooperation=file('lw-public-cooperation-20261108.js'),html=file('index.html');
const command=file('owner-command-center-20261108.js');

test('QA-019 readable owner archives: no raw JSON as primary entry',()=>{
 assert.doesNotThrow(()=>new Function(source));
 assert.match(source,/function recordTitle\(/);
 assert.match(source,/function recordDescription\(/);
 assert.match(source,/function statusLabel\(/);
 assert.match(source,/class:'ow-work-card'/);
 assert.match(source,/ow-technical-history/);
 assert.match(source,/history\.append\(el\('pre',raw\)\)/);
 assert.doesNotMatch(source,/d\.append\(links,body\)/);
 assert.match(css,/\.ow-work-card/);
});
test('QA-019 take work persists in existing Owner workflow and readbacks',()=>{
 assert.match(source,/async function startWork\(/);
 assert.match(source,/const archiveMarker=/);
 assert.match(source,/\[ARCHIVE:/);
 assert.match(source,/\/api\/portal-feedback/);
 assert.match(source,/action:'create'/);
 assert.match(source,/action:'set_status'/);
 assert.match(source,/expectedStatus:current/);
 assert.match(source,/await refreshWork\(\)/);
 assert.match(source,/TASK_NOT_IN_PROGRESS/);
 assert.match(source,/OWNER_ACCESS_REQUIRED/);
 assert.doesNotMatch(source,/localStorage/);
});
test('QA-019 cooperation proposals use existing partner API, not new unguarded endpoint',()=>{
 assert.doesNotThrow(()=>new Function(cooperation));
 assert.match(cooperation,/data-lw-take-work/);
 assert.match(cooperation,/status:'in_progress',expectedStatus:item\.status/);
 assert.match(cooperation,/\/api\/partner-inquiries/);
 assert.match(cooperation,/STATUS_READBACK_MISMATCH/);
});
test('QA-019 pinned staging assets are exact 12-character blob hashes',()=>{
 for(const name of ['owner-registers-20261111.js','owner-registers-20261111.css','lw-public-cooperation-20261108.js']){
  const found=html.match(new RegExp(name.replaceAll('.','\\.')+'\\?v=([a-f0-9]{12})'));
  assert.ok(found,'missing pinned '+name);
 }
});

test('QA-019 Owner landing displays active development tasks with server data',()=>{
 assert.doesNotThrow(()=>new Function(command));
 assert.match(command,/function developmentMarkup\(/);
 assert.match(command,/request\("\/api\/portal-feedback"\)/);
 assert.match(command,/status==='in_progress'\|\|x\.status==='release'/);
 assert.match(command,/developmentMarkup\(\)/);
 assert.match(command,/safeRoute\(id\)/);
});
