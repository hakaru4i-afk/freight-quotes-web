// Narrow, reviewed test-harness correction for one immutable runtime candidate.
// Never modifies runtime assets, release lock, evidence, or business assertions.
import {execFileSync} from 'node:child_process';
import {writeFileSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
export const repairedFrontend='d60cf62e63483f36befb0b226b65c3a2d3d458fd';
export const fixtureRevision='3744b4b3b8c1fbfe90d410045428c5c79623e4d9';
export const fixtures=Object.freeze({
 'tests/public-entry-browser.test.mjs':['ba46a424a144506e086b7e1f165b3117f2b02961','5c54dd6a0b4755a38c70eb34fe867b3e42b6e54a'],
 'tests/task1-create-form-browser.test.mjs':['8cdeffb744ee62651ac8a3174d59bd7839b17506','f9279c4e7005da16ff2d5fdcca9fb87c7e4affb6'],
 'tests/task12-role-robots.test.mjs':['dbe049cdada0e24ee031d926ae2128104e14b65f','931557323206b690a8fc5a0f5defd1b905fec8cf']
});
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function expectedFixtureRepair(frontendSha){
 return frontendSha===repairedFrontend?{revision:fixtureRevision,files:Object.fromEntries(Object.entries(fixtures).map(([p,b])=>[p,b[1]]))}:null;
}
export function verifyFixtureRepair(frontendSha,proof){
 const expected=expectedFixtureRepair(frontendSha);
 if(!expected){check(proof===undefined||proof===null,'UNEXPECTED_FIXTURE_REPAIR');return;}
 check(proof&&Object.keys(proof).sort().join(',')==='files,revision'&&proof.revision===expected.revision&&
  Object.keys(proof.files||{}).sort().join(',')===Object.keys(fixtures).sort().join(',')&&
  Object.entries(expected.files).every(([p,sha])=>proof.files[p]===sha),'FIXTURE_REPAIR_RECEIPT_MISMATCH');
}
export function fixtureRepair(mode,candidate,frontendSha,trusted='.'){
 const git=(dir,...args)=>execFileSync('git',['-C',dir,...args],{encoding:'utf8'}).trim();
 check(['apply','verify'].includes(mode),'INVALID_FIXTURE_REPAIR_MODE');
 check(git(candidate,'rev-parse','HEAD')===frontendSha,'FIXTURE_REPAIR_SOURCE_MISMATCH');
 const expected=expectedFixtureRepair(frontendSha);
 const changed=()=>git(candidate,'diff','--name-only','HEAD','--').split('\n').filter(Boolean).sort();
 if(!expected){check(changed().length===0,'REGRESSION_SOURCE_MODIFIED');return null;}
 if(mode==='apply'){
  check(changed().length===0,'FIXTURE_REPAIR_DIRTY_SOURCE');
  git(trusted,'merge-base','--is-ancestor',fixtureRevision,'HEAD');
  for(const [path,[oldSha,newSha]] of Object.entries(fixtures)){
   const target=resolve(candidate,path);
   check(lstatSync(target).isFile()&&!lstatSync(target).isSymbolicLink(),'INVALID_FIXTURE_PATH');
   check(git(candidate,'rev-parse','HEAD:'+path)===oldSha,'ORIGINAL_FIXTURE_MISMATCH');
   check(git(trusted,'rev-parse',fixtureRevision+':'+path)===newSha,'REVIEWED_FIXTURE_MISMATCH');
   const bytes=execFileSync('git',['-C',trusted,'show',fixtureRevision+':'+path]);
   writeFileSync(target,bytes);
  }
 }
 check(changed().join(',')===Object.keys(fixtures).sort().join(','),'UNAPPROVED_REGRESSION_SOURCE_CHANGE');
 for(const [path,[,sha]] of Object.entries(fixtures))
  check(git(candidate,'hash-object',path)===sha,'FIXTURE_REPAIR_HASH_MISMATCH');
 return expected;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const [mode,candidate,frontendSha,trusted]=process.argv.slice(2);
 console.log(JSON.stringify(fixtureRepair(mode,candidate,frontendSha,trusted)));
}
