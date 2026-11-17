import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,cpSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'release-metadata-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 for(const d of ['scripts','test'])mkdirSync(join(root,d));
 cpSync('scripts/sync-release-metadata.py',join(root,'scripts/sync-release-metadata.py'));
 const put=(p,v)=>writeFileSync(join(root,p),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
 const get=p=>JSON.parse(readFileSync(join(root,p),'utf8'));
 for(const [prefix,environment,projectRef,version,state]of [['','production','ooclsrndeygojtofuyte','SH-01.30.59 v','released'],['test/','staging','ibclzdkxiozbzmniiygv','SH-01.30.60 v','checking']]){
  const release={version,title:environment,changes:[environment+' own notes'],date:'2026-11-17'};
  put(prefix+'site-status.json',{release,releases:[release],releaseStatus:state});
  put(prefix+'release-status.json',{version,ownerVersion:'OW-01.30.52 v',status:state,date:release.date,changes:release.changes});
  put(prefix+'build-info.json',{environment,projectRef,primaryBusinessVersion:version,releaseVersion:version,ownerReleaseVersion:'OW-01.30.52 v',build:'original-build',builtAt:'historical-date',releaseStatus:'PUBLISHED'});
  put(prefix+'index.html','<script src="portal-release-status-20261117.js?v=old"></script>');
 }
 put('production-release-manifest.json',{businessVersion:'SH-01.30.59 v',frontendBuild:'original-build'});
 put('test/staging-manifest.json',{releaseStatus:'RELEASE_BLOCKED',apiVersion:108});
 const snapshot=()=>Object.fromEntries(['','test/'].flatMap(p=>readdirSync(join(root,p)).filter(n=>n.endsWith('.json')||n.endsWith('.html')).map(n=>[p+n,readFileSync(join(root,p+n),'utf8')])));
 const run=(...args)=>spawnSync('python3',[join(root,'scripts/sync-release-metadata.py'),...args],{encoding:'utf8'});
 return{put,get,snapshot,run};
}
test('default and --check are read-only even when metadata needs changes',t=>{
 const f=fixture(t),before=f.snapshot();
 for(const args of [[],['--check']]){const r=f.run(...args);assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).status,'STALE');assert.deepEqual(f.snapshot(),before);}
});
test('late staging HTML validation failure prevents every earlier production write',t=>{
 const f=fixture(t);f.put('test/index.html','missing release script');const before=f.snapshot(),r=f.run('--write');
 assert.equal(r.status,1);assert.match(r.stdout,/MISSING_OR_REPEATED_RELEASE_SCRIPT:staging/);assert.deepEqual(f.snapshot(),before);
});
test('published manifest drift is not relabelled or repaired as approval',t=>{
 const f=fixture(t);f.put('production-release-manifest.json',{businessVersion:'SH-01.30.52 v',frontendBuild:'original-build'});const before=f.snapshot(),r=f.run('--write');
 assert.equal(r.status,1);assert.match(r.stdout,/PUBLISHED_MANIFEST_MISMATCH/);assert.deepEqual(f.snapshot(),before);
});
test('unreviewed staging primary version is rejected without partial writes',t=>{
 const f=fixture(t);const info=f.get('test/build-info.json');info.primaryBusinessVersion='SH-01.30.52 v';f.put('test/build-info.json',info);const before=f.snapshot(),r=f.run('--write');
 assert.equal(r.status,1);assert.match(r.stdout,/UNREVIEWED_PRIMARY_BUSINESS_VERSION:staging/);assert.deepEqual(f.snapshot(),before);
});
test('an approved production asset cannot be re-stamped outside its release packet',t=>{
 const f=fixture(t),manifest=f.get('production-release-manifest.json');
 manifest.assets={'index.html':createHash('sha256').update(f.snapshot()['index.html']).digest('hex')};f.put('production-release-manifest.json',manifest);
 const before=f.snapshot(),r=f.run('--write');assert.equal(r.status,1);assert.match(r.stdout,/IMMUTABLE_PRODUCTION_ASSET_REQUIRES_RELEASE:index.html/);assert.deepEqual(f.snapshot(),before);
});
test('explicit local sync preserves independent candidate notes, state, historical build and release gate',t=>{
 const f=fixture(t),before=f.snapshot();assert.equal(f.run('--write').status,0);
 assert.equal(f.get('release-status.json').version,'SH-01.30.59 v');
 assert.equal(f.get('test/release-status.json').version,'SH-01.30.60 v');
 assert.equal(f.get('test/release-status.json').status,'checking');
 for(const p of ['site-status.json','test/site-status.json','test/staging-manifest.json','production-release-manifest.json'])assert.equal(f.snapshot()[p],before[p]);
 assert.equal(f.get('test/build-info.json').builtAt,'historical-date');assert.equal(f.get('test/build-info.json').build,'original-build');
 assert.equal(f.run('--check').status,0);const after=f.snapshot();assert.equal(f.run('--write').status,0);assert.deepEqual(f.snapshot(),after);
});
