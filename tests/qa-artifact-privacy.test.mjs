import test from'node:test';import assert from'node:assert/strict';import{readFileSync,mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{spawnSync}from'node:child_process';import{createHash}from'node:crypto';
test('artifact sanitization removes private register images and retains other real evidence and original hashes',()=>{
 const workflow=readFileSync('.github/workflows/sanitize-completed-qa-artifact.yml','utf8');const match=workflow.match(/name: Preserve synthetic evidence[\s\S]*?<<'PY'\n([\s\S]*?)^          PY/m);assert.ok(match);
 const code=match[1].split('\n').map(l=>l.replace(/^          /,'')).join('\n'),dir=mkdtempSync(join(tmpdir(),'qa-artifact-privacy-'));
 try{mkdirSync(join(dir,'original/nov14-published'),{recursive:true});const files={'nov14-published/owner-register-remarks-390.png':'private synthetic register','nov14-published/owner-cabinet-read-1440.png':'private synthetic cabinet','nov14-published/carrierA-nov14-carrier-390.png':'synthetic carrier tracking','security-gate-real.json':'{"result":"PASS"}'};for(const [p,b]of Object.entries(files))writeFileSync(join(dir,'original',p),b);
 const r=spawnSync('python3',['-c',code],{cwd:dir,env:{...process.env,QA_RUN_ID:'123'},encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const receipt=JSON.parse(readFileSync(join(dir,'sanitized/sanitization-receipt.json'),'utf8'));assert.equal(receipt.sourceRun,'123');assert.equal(receipt.excludedPrivateImages.length,2);for(const [p,b]of Object.entries(files)){const hidden=p.includes('/owner-');assert.equal(existsSync(join(dir,'sanitized',p)),!hidden);if(hidden)assert.equal(receipt.excludedPrivateImages.find(x=>x.file===p).sha256,createHash('sha256').update(b).digest('hex'));else assert.equal(readFileSync(join(dir,'sanitized',p),'utf8'),b);}
 assert.ok(workflow.indexOf('id: preserved')<workflow.indexOf('gh api --method DELETE'));assert.match(workflow,/if: success\(\) && steps\.preserved\.outputs\.artifact-id != ''/);assert.match(workflow,/meta\['path'\]=='.github\/workflows\/isolated-qa-oidc-browser.yml'/);
 const published=readFileSync('.github/workflows/isolated-qa-oidc-browser.yml','utf8');for(const dir of['published','ordinary'])for(const name of['owner-register-*.png','owner-cabinet-read*.png'])assert.ok(published.includes('!reports/nov14-'+dir+'/'+name));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('OIDC artifact retains non-Owner FAQ matrix images while excluding all Owner matrix views',()=>{
 const workflow=readFileSync('.github/workflows/isolated-qa-oidc-browser.yml','utf8');
 const paths=workflow.match(/name: isolated-qa-redacted-evidence[\s\S]*?path: \|\n([\s\S]*?)\n\s+retention-days:/)?.[1].split('\n').map(s=>s.trim()).filter(Boolean);assert.ok(paths);
 const dir=mkdtempSync(join(tmpdir(),'qa-matrix-artifact-'));
 try{
  mkdirSync(join(dir,'reports/isolated-rc'),{recursive:true});
  const actors=['carrierA','carrierB','ved','logistic','supplier','supplierB','designer','content','purchasing','certification'];
  const expected=actors.flatMap(actor=>['ru','en','zh'].flatMap(lang=>[1366,390].map(width=>'reports/isolated-rc/'+actor+'-matrix-'+lang+'-'+width+'.png')));
  const hidden=['reports/isolated-rc/owner-matrix-ru-1366.png','reports/isolated-rc/owner-matrix-en-390-updates.png','reports/isolated-rc/owner-matrix-zh-390-process.png'];
  for(const name of [...expected,...hidden])writeFileSync(join(dir,name),'synthetic evidence');
  const code='import json,glob,sys\npatterns=json.loads(sys.argv[1]); found=set()\nfor p in patterns:\n if not p.startswith("!"): found.update(glob.glob(p,recursive=True))\nfor p in patterns:\n if p.startswith("!"): found.difference_update(glob.glob(p[1:],recursive=True))\nprint(json.dumps(sorted(found)))';
  const r=spawnSync('python3',['-c',code,JSON.stringify(paths)],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),expected.sort());
 }finally{rmSync(dir,{recursive:true,force:true});}
});
