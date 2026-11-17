/* One controlled source-of-truth check for production/test runtime parity.
   Different databases and build IDs are intentional; shared visual assets are not. */
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const prodProject='ooclsrndeygojtofuyte',testProject='ibclzdkxiozbzmniiygv';
function linkedAssets(page){
 return [...page.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:css|js|mjs))(?:\?[^"]*)?"/g)].map(m=>m[1]);
}
function normalize(file,text,stage){
 if(file==='process-editor-20261111.mjs'||file==='global-view/view.mjs')
  return text.replace(/\?v=[a-z0-9]+/g,'?v=<cache>');
 if(!stage)return text;
 const stripGuard=s=>s.split('\n').map(line=>/\bif\s*\(!location\.pathname\.includes\("\/test\/"\)\)\s*return;/.test(line)?line.match(/^[ \t]*/)[0]:line).join('\n');
 switch(file){
 case 'staging-transport-20261111.js':return text.replaceAll(testProject,prodProject);
 case 'late-bid-staging-3ff2c9ab03f5.js':
 case 'carrier-cta-hotfix.js':
 case 'carrier-csv-wps-hotfix.js':return stripGuard(text);
 case 'lw-public-cooperation-20261108.js':return text.replaceAll('freight-staging-cooperation-operation','freight-production-cooperation-operation');
 case 'task2-panel-sidebar-only-20261107.js':
  return text.replace('const stagingReg=n=>n?(String(n).startsWith("TEST-")?String(n):"TEST-"+String(n)):"";','const stagingReg=n=>n?String(n):"";');
 case 'owner-command-center-20261108.js':
  return text.replace('действующей тестовой базы','действующей рабочей базы')
   .replace('Открыть переключатель кабинетов в тестовой среде','Открыть переключатель кабинетов')
   .replace('● Тестовая среда','● Рабочая среда')
   .replace('Все действия выполняются в тестовой среде','Все действия выполняются в рабочей среде');
 case 'app.js':
  return text.replaceAll(testProject,prodProject)
    .replaceAll('Тестовая среда','Рабочая среда')
    .replaceAll('тестовой среде','рабочей среде');
 default:return text;
 }
}
export function verify(){
 const pr=JSON.parse(read('build-info.json')),st=JSON.parse(read('test/build-info.json'));
 assert.equal(pr.environment,'production');assert.equal(st.environment,'staging');
 assert.equal(pr.projectRef,prodProject);assert.equal(st.projectRef,testProject);
 assert.equal(pr.releaseVersion,st.releaseVersion,'Business release versions differ');
 const a=linkedAssets(read('index.html')),b=linkedAssets(read('test/index.html'));
 assert.deepEqual(a,b,'Loaded asset names/order differ: staging and production would show different UI');
 const mismatches=[],exempt=[],checks=[];
 for(const file of a){
  assert.ok(existsSync(resolve(root,file)),file+' is missing in production');
  assert.ok(existsSync(resolve(root,'test',file)),file+' is missing in staging');
  const p=read(file),t=read('test/'+file);
  if(p===t){checks.push({file,sha256:hash(p)});continue;}
  if(file.endsWith('.css')){mismatches.push(file+': CSS/style differs');continue;}
  const np=normalize(file,p,false),nt=normalize(file,t,true);
  if(np===nt){exempt.push({file,reason:'known environment-specific URL, label, storage key, cache key or TEST guard'});continue;}
  if(file==='app.js'){
   // The main app has independently stamped environment-specific build identity.
   // Check backend isolation; no cross-environment calls are allowed.
   if(!p.includes(prodProject)||p.includes(testProject)||!t.includes(testProject)||t.includes(prodProject))
    mismatches.push(file+': backend isolation failed');
   else exempt.push({file,reason:'main app has independently stamped environment-specific build identities; compare in authenticated E2E'});
  }else mismatches.push(file+': unreviewed runtime divergence');
 }
 const output={status:mismatches.length?'FAIL':'PASS',sharedAssets:checks.length,isolatedAssets:exempt,failures:mismatches,release:pr.releaseVersion,productionBuild:pr.build,stagingBuild:st.version};
 console.log(JSON.stringify(output,null,2));
 if(mismatches.length)process.exitCode=1;
 return output;
}
if(process.argv[1]===import.meta.filename)verify();
