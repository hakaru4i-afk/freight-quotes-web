#!/usr/bin/env node
// Read-only plan by default. --run invokes only pre-existing targeted Node tests.
// Zero third-party dependencies; never installs, deploys, or modifies a database.
import { existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const suites={
  carrier:['tests/issue47-carrier-round-status.test.mjs','tests/issue47-carrier-workspace-deadlines.test.mjs','tests/issue47-late-ui.test.mjs','tests/carrier-dashboard-browser.test.mjs'],
  map:['tests/global-view-route.test.mjs','tests/map-geocode-fallback.test.mjs','tests/map50-owner-km-before-bid.test.mjs'],
  owner:['tests/owner-register-publication.test.mjs','tests/owner-registers-20261111.test.mjs','tests/owner-audit-explanations-20261117.test.mjs','tests/owner-team-users-browser.test.mjs'],
  release:['tests/staging-asset-cache.test.mjs','tests/staging-asset-contract.test.mjs','tests/production-release-integrity.test.mjs','tests/staging-alignment.test.mjs'],
  roles:['tests/issue47-agreed-roles-and-owner-registers.test.mjs','tests/role-help-20261111.test.mjs','tests/qa-anonymous-roles.test.mjs'],
  documents:['tests/issue17-formal-document-ui.test.mjs','tests/task2-execution-robots.test.mjs']
};
const patterns={
  carrier:/(^|\/)(carrier-|late-bid|issue47-(?:carrier|late|bid)|transport-application|app\.js|task2)/i,
  map:/(^|\/)(global-view|map50|map-geocode|distance|geocode|route-model)/i,
  owner:/(^|\/)(owner-|portal-feedback|engineering-register|audit)/i,
  release:/(^|\/)(build-info|release-|site-status|staging-|production-release|sync-release|qa-publication|manifest)/i,
  roles:/(^|\/)(role-help|owner-team|qa-anonymous)/i,
  documents:/(^|\/)(document|issue17|storage)/i
};
function usage(status=0){
  console.log('Usage:\n' +
   ' node tools/qa-fast.mjs --doctor\n' +
   ' node tools/qa-fast.mjs --list\n' +
   ' node tools/qa-fast.mjs --suite carrier[,map,owner,release,roles,documents] [--run]\n' +
   ' node tools/qa-fast.mjs --changed main [--run]\n' +
   'Default: plan only. No full E2E or release actions.');
  process.exit(status);
}
function version(cmd,args=[]){
  const r=spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:10000});
  return r.error?'unavailable: '+String(r.error.code||r.error.message):(r.stdout||r.stderr).trim().split('\n')[0]||'exit='+r.status;
}
function doctor(){
  console.log(JSON.stringify({mode:'doctor',tools:{
    node:process.version,
    git:version('git',['--version']),
    python:version('python',['--version']),
    chromium:version('chromium',['--version']),
    pythonPlaywright:version('python',['-c','import importlib.metadata; print(importlib.metadata.version("playwright"))'])
  },note:'Read-only. Environments vary; use existing tools before installation.'},null,2));
}
function git(...args){
  return execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']}).trim().split('\n').filter(Boolean);
}
function changed(base){
  if(!/^[a-zA-Z0-9][\w./-]*$/.test(base)||base.includes('..'))throw Error('Unsafe git ref');
  const refs=[base,base.startsWith('origin/')?base:'origin/'+base];
  let resolved=null;
  for(const ref of refs){try{git('rev-parse','--verify','--quiet',ref+'^{commit}');resolved=ref;break;}catch{}}
  if(!resolved)throw Error('Cannot resolve '+base+'. Use --suite for a shallow checkout, or fetch the base branch.');
  const paths=new Set();
  try{for(const p of git('diff','--name-only','--diff-filter=ACMRD',resolved+'...HEAD'))paths.add(p);}
  catch{throw Error('Cannot compare '+resolved+'...HEAD; use --suite or fix branch ancestry.');}
  for(const args of [['diff','--name-only','--diff-filter=ACMRD','HEAD'],['ls-files','--others','--exclude-standard']])
    try{for(const p of git(...args))paths.add(p);}catch{}
  return [...paths].sort();
}

function main(){
  const args=process.argv.slice(2);
  const validFlags=new Set(['--doctor','--list','--run','--help','-h']);
  for(let i=0;i<args.length;i++){
    if(args[i]==='--suite'||args[i]==='--changed'){
      if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing argument after '+args[i]);
      i++;continue;
    }
    if(!validFlags.has(args[i]))throw Error('Unknown option: '+args[i]);
  }
  if(args.includes('--help')||args.includes('-h')){usage();return;}
  if(args.includes('--doctor')){
    if(args.length!==1)throw Error('--doctor cannot be combined with other options');
    return doctor();
  }
  if(args.includes('--list')){
    if(args.length!==1)throw Error('--list cannot be combined with other options');
    console.log(JSON.stringify({suites:Object.fromEntries(Object.entries(suites).map(([k,v])=>[k,{
      available:v.filter(t=>existsSync(resolve(root,t))),missing:v.filter(t=>!existsSync(resolve(root,t)))
    }]))},null,2));
    return;
  }
  const run=args.includes('--run'),si=args.indexOf('--suite'),ci=args.indexOf('--changed');
  if((si>=0)===(ci>=0))usage(2);
  const files=ci>=0?changed(args[ci+1]):[];
  const selected=si>=0?[...new Set(args[si+1].split(',').map(t=>t.trim()).filter(Boolean))]:Object.keys(suites).filter(k=>files.some(p=>patterns[k].test(p)));
  for(const name of selected)if(!Object.hasOwn(suites,name))throw Error('Unknown suite: '+name);
  const tests=[...new Set(selected.flatMap(k=>suites[k]))];
  const present=tests.filter(p=>existsSync(resolve(root,p)));
  const missing=tests.filter(p=>!existsSync(resolve(root,p)));
  console.log(JSON.stringify({mode:run?'run':'plan',selected,changedFiles:files,existingTests:present,missingTests:missing,
    coverage:missing.length?'PARTIAL':'TARGETED_ONLY',productionWrites:false,fullAuthenticatedE2E:false},null,2));
  if(!run)return;
  if(!present.length)throw Error('NO_MATCHING_TESTS: cannot claim PASS');
  const r=spawnSync(process.execPath,['--test',...present],{cwd:root,stdio:'inherit',timeout:120000});
  if(r.error)throw r.error;
  if(r.status!==0)process.exitCode=r.status||1;
  else console.log(missing.length?'TARGETED_TESTS_PASS_WITH_MISSING_TESTS (not full coverage)':'TARGETED_TESTS_PASS (not full E2E)');
}

try{main()}catch(e){console.error('QA_TOOLBOX_ERROR: '+e.message);process.exitCode=2}
