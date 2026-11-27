import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseNotesFor, restoreReleaseHistory} from '../scripts/release/locked-release-notes.mjs';
const lock={frontendSha:'a'.repeat(40),backendSha:'b'.repeat(40)};
const version='SH-01.30.77 v';
const valid={version,...lock,title:'Восстановление истории обновлений',changes:['Восстановлены описания проверенных выпусков.']};
const config=next=>({schemaVersion:1,next,restore:[]});
test('requires useful notes for exact next version and locked pair',()=>{
 assert.deepEqual(releaseNotesFor(config(valid),lock,version),{version,title:valid.title,changes:valid.changes});
 for(const next of [null,{...valid,changes:[]},{...valid,changes:['  ']},{...valid,title:'Обновление Freight Quotes'},{...valid,changes:['<script>']}]){
  assert.throws(()=>releaseNotesFor(config(next),lock,version),/RELEASE_NOTES_REQUIRED/);
 }
 for(const next of [{...valid,version:'SH-01.30.76 v'},{...valid,frontendSha:'c'.repeat(40)},{...valid,backendSha:'d'.repeat(40)}]){
  assert.throws(()=>releaseNotesFor(config(next),lock,version),/RELEASE_NOTES_PAIR_MISMATCH/);
 }
});
test('repairs only known empty history entries; dates/order and other metadata stay intact',()=>{
 const old={version:'SH-01.30.76 v',date:'2026-11-27',title:'Обновление Freight Quotes',changes:[],other:'keep'};
 const nonempty={version:'SH-01.30.75 v',date:'2026-11-27',title:'Existing',changes:['Existing description']};
 const unknown={version:'SH-01.30.70 v',date:'2026-11-24',title:'Unknown',changes:[]};
 const repair={version:old.version,releaseRun:'45986590250',title:'Исправление фильтров',changes:['Убраны дублирующие фильтры.']};
 const otherRepair={...repair,version:nonempty.version};
 const cfg={schemaVersion:1,next:valid,restore:[repair,otherRepair,{...repair,version:'SH-01.30.79 v'}]};
 const history=[old,nonempty,unknown];
 const result=restoreReleaseHistory(history,cfg);
 assert.deepEqual(result,[{...old,title:repair.title,changes:repair.changes},nonempty,unknown]);
 assert.deepEqual(old.changes,[]);
 assert.throws(()=>restoreReleaseHistory(history,{...cfg,restore:[repair,repair]}),/HISTORICAL_RELEASE_NOTES_INVALID/);
 assert.throws(()=>restoreReleaseHistory(history,{...cfg,restore:[{...repair,releaseRun:'unknown'}]}),/HISTORICAL_RELEASE_NOTES_INVALID/);
});
