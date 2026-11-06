import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// A fail-closed gate for NEW or CHANGED public QA artifacts.
// It is not an authorization test of the backend API.
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const FORBIDDEN_EXT=/\.(?:env(?:\..*)?|pem|p12|pfx|key|har|log|jsonl|sql|dump|sqlite|db|bak|zip|7z|rar|pdf|docx?|xlsx?|xls|csv|tsv|pcap)$/i;
const RAW_QA=/(?:^|\/)(?:raw(?:-qa)?|private-qa|qa-raw|qa-artifacts|qa-evidence|qa-exports|screenshots?|recordings?|database-dumps?)(?:\/|$)/i;
const QA_IMAGE=/(?:^|\/)(?:qa[^\/]*|artifacts?|evidence|logs)\/.*\.(?:png|jpe?g|webp|gif|bmp|tiff?)$/i;
const SENSITIVE_KEY=/(?:^|_)(?:password|passwd|secret|token|cookie|authorization|session|email|phone|address|person|customer|carrier_login|recipient|sender|user_id|auth|access_key|private_key|apikey|api_key|jwt|raw|payload|storage_url|object_key)(?:$|_)/i;
const SECRET_CONTENT=[
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bsb_secret_[a-z0-9_-]{12,}\b/i,
  /\bservice[_-]?role\s*[:=]\s*['"]?eyJ[A-Za-z0-9_-]{20,}/i,
  /\b(?:authorization|bearer)\s*[:= ]\s*(?:Bearer\s+)?eyJ[A-Za-z0-9_-]{20,}/i,
  /\b(?:sessionToken|access_token|refresh_token)\s*['"]?\s*[:=]\s*['"][A-Za-z0-9._~-]{20,}/i,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i,
  /\b(?:postgres(?:ql)?):\/\/[^\s]+/i,
  /\bhttps?:\/\/[^\s]*\/storage\/v1\/object\/sign\//i
];
export function inspectSummary(data){
  const errors=[];
  if(!data||typeof data!=='object'||Array.isArray(data))return ['Expected summary object'];
  if(data.schema!==1||data.environment!=='staging'||data.visibility!=='public-redacted')errors.push('Invalid public QA schema');
  if(data.release?.status!=='PUBLISHED_STAGING_MANUAL_ACCEPTANCE_OPEN')errors.push('Unverified release claim');
  if(!/^\d+\.\d+\.\d+$/.test(data.release?.version||''))errors.push('Invalid version');
  if(!/^[0-9a-f]{40}$/i.test(data.release?.frontendCommit||''))errors.push('Missing source commit');
  if(!Number.isSafeInteger(data.release?.apiVersion))errors.push('Missing API version');
  if(data.task2?.totalGroups!==26||!Number.isInteger(data.task2?.ownerAccepted)||data.task2.ownerAccepted<0||data.task2.ownerAccepted>26)errors.push('Invalid accepted group count');
  if(!['PARTIAL','OPEN','PASS'].includes(data.roleIsolation?.status))errors.push('Invalid security assessment');
  function scan(x,k=''){
    if(SENSITIVE_KEY.test(k))errors.push('Sensitive field: '+k);
    if(x&&typeof x==='object'){for(const [key,value] of Object.entries(x))scan(value,key)}
    else if(typeof x==='string'&&SECRET_CONTENT.some(re=>re.test(x)))errors.push('Possible private data in '+k);
  }
  scan(data);
  return [...new Set(errors)];
}
export function inspectChangedFiles(files){
  const errors=[];
  for(const name of files){
    const p=name.replaceAll('\\','/');
    if(p.startsWith('../')||path.isAbsolute(p)){errors.push('Illegal path: '+p);continue}
    if(FORBIDDEN_EXT.test(p)||RAW_QA.test(p)||QA_IMAGE.test(p))errors.push('Raw or binary QA file cannot be public: '+p);
    if(!/\.(?:json|mjs|js|md|txt|html|css|yml|yaml)$/i.test(p))continue;
    const file=path.join(ROOT,p);
    if(!fs.existsSync(file))continue;
    const bytes=fs.readFileSync(file);
    if(bytes.length>4*1024*1024){errors.push('Oversized changed public text file: '+p);continue}
    const content=bytes.toString('utf8');
    if(SECRET_CONTENT.slice(0,4).some(re=>re.test(content)))errors.push('Possible credential in public file: '+p);
  }
  return [...new Set(errors)];
}
export function changedFiles(base){
  if(!base)return [];
  const output=execFileSync('git',['diff','--name-only','--diff-filter=ACMRT',base+'...HEAD'],{cwd:ROOT,encoding:'utf8'});
  return output.split(/\r?\n/).filter(Boolean);
}
export function verify(base){
  const status=JSON.parse(fs.readFileSync(path.join(ROOT,'test/qa-public-status.json'),'utf8'));
  const history=JSON.parse(fs.readFileSync(path.join(ROOT,'test/site-status.json'),'utf8'));
  const historyString=JSON.stringify(history);
  const rawOrderCode=/(?:C26EM\\d{6}|WS26\\d{4,}|LT26\\d{6,}|(?:заявк[а-я]*|заказ[а-я]*)\\s*(?:№\\s*)?\\d{1,6})/i;
  const historyErrors=rawOrderCode.test(historyString)?['Business order references in public release history'] : [];
  const errors=[...inspectSummary(status),...inspectChangedFiles(changedFiles(base)),...historyErrors];
  if(errors.length){for(const e of errors)console.error('BLOCK:',e);return 1}
  console.log('PASS: public QA summary contains no private fields; changed raw QA files forbidden.');
  return 0;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=verify(process.argv[2]);
