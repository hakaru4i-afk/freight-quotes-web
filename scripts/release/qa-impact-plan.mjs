import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

// Planning only: never a substitute for the protected release gate.
export const ROLES=['owner','logistic','carrier','supplier','designer','content','purchasing','certification'];
const graph={
 'ved-chat': ['chat-access','notifications','audit','shipment-read'],
 'chat-access': ['tenant-isolation'],
 'notifications': ['audit'],
 'shipment-read': ['tenant-isolation'],
 'geo': ['tracking','shipment-read','audit'],
 'tracking': ['tenant-isolation','notifications'],
 'reports': ['report-export','tenant-isolation','audit'],
 'report-export': ['tenant-isolation'],
 'carrier-import': ['offer-validation','tenant-isolation','audit'],
 'offer-validation': ['selection','notifications'],
 'selection': ['shipment-read','tenant-isolation'],
 'documents': ['document-access','shipment-read','audit'],
 'document-access': ['tenant-isolation','notifications'],
 'tenant-isolation': [],audit: []
};
const roles={
 'ved-chat':['logistic','owner','carrier'], 'chat-access':['logistic','owner','carrier'],
 notifications:['logistic','owner','carrier'],audit:['owner'], 'shipment-read':['logistic','owner','carrier'],
 geo:['owner','logistic','carrier'],tracking:['owner','logistic','carrier'],
 reports:ROLES,'report-export':ROLES,'carrier-import':['carrier'],'offer-validation':['carrier','owner'],
 selection:['owner','carrier','logistic'],documents:['owner','logistic','carrier','supplier'],
 'document-access':['owner','logistic','carrier','supplier'],'tenant-isolation':ROLES
};
// Reviewed exact module paths only. Shared/monolithic code, new files, tests
// without a mapped source, configuration, migration, auth or CI default to FULL.
const modules={
 frontend:{
 'lw-ved-shared-chat-20261109.js':'ved-chat',
 'test/lw-ved-shared-chat-20261109.js':'ved-chat',
 'carrier-csv-wps-hotfix.js':'carrier-import',
 'test/carrier-csv-wps-hotfix.js':'carrier-import',
 'issue28-document-navigation-20261107.js':'documents',
 'test/issue28-document-navigation-20261107.js':'documents'
 },
 backend:{
 'src/transport-application/geocoding.mjs':'geo',
 'src/transport-application/shipment-geocoding.mjs':'geo',
 'src/transport-application/shipment-geopoints.mjs':'geo',
 'src/transport-application/shipment-list-read.mjs':'shipment-read'
 }
};
const sha=/^[a-f0-9]{40}$/;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const validPair=p=>p&&['frontend','backend'].every(k=>typeof p[k]==='string'&&sha.test(p[k]));
const sorted=s=>[...s].sort();
export function parseRaw(raw){
 if(raw==='')return [];
 if(typeof raw!=='string'||!raw.endsWith('\0'))throw Error('INVALID_RAW_DIFF');
 const parts=raw.slice(0,-1).split('\0');
 if(parts.length%2)throw Error('INVALID_RAW_DIFF');
 const result=[];
 for(let i=0;i<parts.length;i+=2){
  const m=/^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([AMD])$/.exec(parts[i]);
  if(!m||!parts[i+1]||/[\r\n]/.test(parts[i+1]))throw Error('INVALID_RAW_DIFF');
  result.push({path:parts[i+1],status:m[3],oldMode:m[1],newMode:m[2]});
 }
 return result;
}
export function planImpact({base,head,frontend,backend,weekly=false,forceFull=false}){
 if(!validPair(base)||!validPair(head))throw Error('INVALID_EXACT_PAIR');
 const reasons=[],seeds=new Set(),paths=[];
 if(weekly)reasons.push('weekly-full');
 if(forceFull)reasons.push('explicit-full');
 for(const repo of ['frontend','backend']){
  const rows=repo==='frontend'?frontend:backend;
  if(!Array.isArray(rows)||(base[repo]!==head[repo]&&rows.length===0)||(base[repo]===head[repo]&&rows.length>0))throw Error('DIFF_PAIR_MISMATCH:'+repo);
  for(const entry of rows){
   const {path,status,oldMode,newMode}=entry;
   paths.push(repo+':'+path);
   if(status!=='M'||oldMode!=='100644'||newMode!=='100644'){reasons.push('unreviewed-change:'+repo+':'+path);continue;}
   if(/(^|\/)(owner[-_]|owner\/)/i.test(path)){reasons.push('owner-direct:'+repo+':'+path);continue;}
   if(repo==='frontend'&&/^(README\.md|docs\/[^\n]+\.md)$/.test(path))continue;
   // Global stylesheet is not a proven local UI change.
   const node=Object.hasOwn(modules[repo],path)?modules[repo][path]:null;
   if(!node){reasons.push('unmapped:'+repo+':'+path);continue;}
   seeds.add(node);
  }
 }
 const nodes=new Set(seeds);
 const queue=[...nodes];
 while(queue.length){const n=queue.shift();for(const d of graph[n]||[])if(!nodes.has(d)){nodes.add(d);queue.push(d);}}
 const mode=reasons.length?'FULL':seeds.size?'TARGETED':'QUICK';
 const impacted=new Set(mode==='FULL'?ROLES:[]);
 for(const node of nodes)for(const role of roles[node]||[])impacted.add(role);
 const required=new Set(['smoke:all-roles','source-integrity']);
 if(mode==='FULL')required.add('full:37');
 if(mode==='TARGETED')for(const node of nodes)required.add('scenario:'+node);
 const plan={version:1,base,head,mode,paths:paths.sort(),reasons:reasons.sort(),components:sorted(nodes),roles:sorted(impacted),required:sorted(required)};
 return {...plan,id:digest(plan)};
}
function readDiff(dir,base,head){
 const git=args=>execFileSync('git',args,{cwd:dir,encoding:'utf8',maxBuffer:32*1024*1024});
 git(['merge-base','--is-ancestor',base,head]);
 return parseRaw(git(['diff','--raw','-z','--no-renames','--no-ext-diff','--ignore-submodules=none',base,head,'--']));
}
// This validates planning receipts only; deployment/evidence trust remains with
// the protected release system. A missing, stale or skipped receipt never passes.
export function checkImpactReceipts(plan,receipts,runtime){
 if(!plan||!Array.isArray(plan.required)||!Array.isArray(receipts)||typeof runtime!=='string'||!runtime)return 'BLOCKED';
 const {id,...body}=plan;
 if(id!==digest(body))return 'BLOCKED';
 for(const key of plan.required){
  const found=receipts.filter(r=>r?.scenario===key&&r.planId===id&&r.runtime===runtime&&r.frontendSha===plan.head.frontend&&r.backendSha===plan.head.backend);
  if(found.length!==1||found[0].result!=='PASS')return 'BLOCKED';
 }
 return 'PLAN_RECEIPTS_PASS_NOT_RELEASE_APPROVAL';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [fd,bd,fb,fh,bb,bh,flag,...extra]=process.argv.slice(2);
 if(extra.length||!fd||!bd||![fb,fh,bb,bh].every(x=>sha.test(x||''))||(flag&& !['--weekly','--full'].includes(flag)))throw Error('INVALID_ARGUMENTS');
 console.log(JSON.stringify(planImpact({base:{frontend:fb,backend:bb},head:{frontend:fh,backend:bh},frontend:readDiff(fd,fb,fh),backend:readDiff(bd,bb,bh),weekly:flag==='--weekly',forceFull:flag==='--full'}),null,2));
}
