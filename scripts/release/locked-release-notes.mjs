// Human-readable release notes are deliberately authored against the immutable release pair.
// The operational note file is NOT a Pages asset; only validated public text is copied.
import {readFileSync} from 'node:fs';
const versionPattern=/^SH-\d{2}\.\d{2}\.\d{2} v$/;
const sha=/^[a-f0-9]{40}$/;
const requireCheck=(ok,code)=>{if(!ok)throw Error(code);};
const text=(value,max)=>typeof value==='string'&&value.trim()===value&&value.length>=3&&value.length<=max&&!/[\u0000-\u001f\u007f<>]/.test(value);
const validNote=n=>n&&versionPattern.test(n.version||'')&&text(n.title,180)&&n.title!=='Обновление Freight Quotes'&&Array.isArray(n.changes)&&n.changes.length>=1&&n.changes.length<=30&&n.changes.every(x=>text(x,600));
export function readReleaseNotes(path='release/release-notes.json'){
 const config=JSON.parse(readFileSync(path,'utf8'));
 requireCheck(config?.schemaVersion===1&&Array.isArray(config.restore),'RELEASE_NOTES_CONFIG_INVALID');
 return config;
}
export function releaseNotesFor(config,lock,version){
 requireCheck(config?.schemaVersion===1&&Array.isArray(config.restore),'RELEASE_NOTES_CONFIG_INVALID');
 const n=config.next;
 requireCheck(validNote(n),'RELEASE_NOTES_REQUIRED');
 requireCheck(n.version===version&&sha.test(n.frontendSha||'')&&sha.test(n.backendSha||'')&&n.frontendSha===lock.frontendSha&&n.backendSha===lock.backendSha,'RELEASE_NOTES_PAIR_MISMATCH');
 return {version,title:n.title,changes:[...n.changes]};
}
export function restoreReleaseHistory(history,config){
 requireCheck(Array.isArray(history)&&Array.isArray(config?.restore),'RELEASE_NOTES_CONFIG_INVALID');
 const index=new Map();
 for(const n of config.restore){
  requireCheck(validNote(n)&&/^[1-9][0-9]{7,19}$/.test(n.releaseRun||'')&&!index.has(n.version),'HISTORICAL_RELEASE_NOTES_INVALID');
  index.set(n.version,n);
 }
 // Do not invent missing releases or replace existing nonempty historical descriptions.
 return history.map(entry=>{
  const n=index.get(entry?.version);
  if(!n||!Array.isArray(entry.changes)||entry.changes.length!==0)return entry;
  return {...entry,title:entry.title==='Обновление Freight Quotes'?n.title:entry.title,changes:[...n.changes]};
 });
}
