import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {captureRoot, live} from './locked-pages-assets.mjs';
import {digest, project} from './locked-release.mjs';
import {assertPublishedProductionRoot} from '../../tests/helpers/production-release-boundary.mjs';

const manifestName = 'production-release-manifest.json';
const previousSlug = 'freight-api-release-15c2f0d2b470458b5abd3a55de791eb6';
const apiFunction = 'freight-api-release-b557565db44c76decd60ad929007866b';
const frontendSourceCommit = '586694826bf334799df3528d90af16f1d2960902';
const backendSourceCommit = '9e0624217a5df84c321db12df3248d8665cf8693';
const backendApiBundleSha256 = '9045f8278b2bf7e0e90145994815a8e1633dba441d0d0956814fc6c6296b3ed4';
const apiDeploymentId = 'ooclsrndeygojtofuyte_abdc682d-a705-456d-954d-ad8ecf21d507_1';
const businessVersion = 'SH-01.30.79 v';
const endpoint = 'https://' + project + '.supabase.co/functions/v1/' + apiFunction;
const script = 'owner-team-users-20261117.js';
const original = '.employee-roles-before';
const candidate = '.employee-roles-pages';
const json = data => Buffer.from(JSON.stringify(data, null, 2) + '\n');
const manifest = files => JSON.parse(files.get(manifestName));
const unique = (value, pattern, replacement) => {
  assert.equal([...value.matchAll(pattern)].length, 1, 'Ambiguous production asset marker ' + pattern);
  return value.replace(pattern, replacement);
};

async function verifyApi() {
  const request = path => fetch(endpoint + path + '?forceFunctionRegion=eu-central-1',
    {redirect:'error', signal:AbortSignal.timeout(20000)});
  const response = await request('/health');
  assert.equal(response.status, 200, 'Production API health');
  const health = await response.json();
  for (const [key, value] of Object.entries({
    ok:true, environment:'production', projectRef:project, release:businessVersion,
    apiFunction, deploymentId:apiDeploymentId, frontendSha:frontendSourceCommit,
    backendSha:backendSourceCommit
  })) assert.equal(health[key], value, 'Production API identity ' + key);
  assert.equal((await request('/api/team')).status, 403, 'Anonymous team access');
}

function readStaging(dir) {
  const files = [];
  function read(folder) {
    for (const entry of readdirSync(join(dir,folder),{withFileTypes:true})) {
      const name = folder + '/' + entry.name;
      assert.match(entry.name, /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/);
      if (entry.isDirectory()) read(name);
      else {
        assert.ok(entry.isFile() && /\.(?:js|mjs|css|html|json|svg|webp|png|jpe?g|gif|ico|wasm|gz|woff2?|ttf|otf|txt)$/i.test(name),name);
        files.push([name,readFileSync(join(dir,name))]);
      }
    }
  }
  read('test');
  assert.ok(files.length > 50, 'Staging artifact is incomplete');
  return files;
}

function write(dir, files) {
  for (const [path, bytes] of files) {
    const dst = join(dir,path);
    mkdirSync(dirname(dst),{recursive:true});
    writeFileSync(dst,bytes);
  }
}

async function prepare(stageDir, frontendDir) {
  await verifyApi();
  const root = await captureRoot();
  const baseline = assertPublishedProductionRoot(root);
  assert.equal(baseline.businessVersion,'SH-01.30.77 v');
  assert.equal(baseline.apiFunction,previousSlug);
  assert.equal(baseline.frontendBuild,'84b6105cccca1267d0bc');
  const stage = readStaging(stageDir);
  let i=0;
  await Promise.all(Array.from({length:8},async()=>{
    while(i<stage.length){
      const [path, bytes]=stage[i++];
      assert.equal(digest(await live(path)),digest(bytes),'Staging changed: '+path);
    }
  }));
  assert.ok((await live(manifestName)).equals(root.get(manifestName)), 'Production changed during snapshot');
  const all = new Map([...root,...stage,['.nojekyll',Buffer.alloc(0)]]);
  write(original,all);
  const set = (name,value) => all.set(name,typeof value==='string'?Buffer.from(value):value);
  const get = name => all.get(name).toString('utf8');
  const build = digest(frontendSourceCommit + backendSourceCommit + businessVersion).slice(0,20);
  const ui = readFileSync(join(frontendDir,script));
  assert.ok(ui.includes('const {creatableRoles}=await api()'));
  set(script,ui);
  const app = unique(get('app.js'),new RegExp(previousSlug+'(?=["\'])','g'),apiFunction);
  set('app.js',unique(app,/currentVersion:"[a-f0-9]{20}"/g,'currentVersion:"'+build+'"'));
  let html = unique(get('index.html'),/app\.js\?v=[a-f0-9]{12,40}/g,'app.js?v='+build);
  html = unique(html,/owner-team-users-20261117\.js\?v=[^"'\s&]+/g,script+'?v='+digest(ui).slice(0,20));
  html = unique(html,/(portal-release-status-[^"?\s]+\.js\?v=)[^"&\s]+/g,'$1'+encodeURIComponent(businessVersion));
  set('index.html',html);
  const now=new Date(), date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Minsk'}).format(now);
  const note={version:businessVersion,date,title:'Восстановлено создание сотрудников',changes:[
    'Владелец может создать сотрудника любой из семи ролей через раздел «Пользователи и доступ».',
    'Форма и API используют один справочник ролей. Действующие права доступа сохранены.'
  ]};
  const info=JSON.parse(get('build-info.json'));
  set('build-info.json',json({...info,version:build,build,releaseDate:date,releaseVersion:businessVersion,
    apiFunction,frontendSourceCommit,backendSourceCommit,backendApiVersion:1,backendApiBundleSha256}));
  set('release-status.json',json({...JSON.parse(get('release-status.json')),...note,status:'released'}));
  const status=JSON.parse(get('site-status.json'));
  set('site-status.json',json({...status,version:build,release:note,releases:[note,...status.releases]}));
  const actions={runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,workflowSha:process.env.GITHUB_SHA};
  const previous=Object.fromEntries(['businessVersion','frontendBuild','frontendSourceCommit','backendSourceCommit','apiFunction',
    'backendApiVersion','backendApiBundleSha256','apiDeploymentId'].map(k=>[k,baseline[k]]));
  set(manifestName,json({...baseline,actions,businessVersion,frontendBuild:build,frontendSourceCommit,backendSourceCommit,
    backendApiVersion:1,backendApiBundleSha256,apiDeploymentId,apiFunction,publishedAt:now.toISOString(),previous,
    emergencyEmployeeRoles:{backendPullRequest:168,baselineActions:baseline.actions,verificationActions:actions},
    assets:Object.fromEntries([...all].filter(([name])=>name!==manifestName&&name!=='.nojekyll').map(([name,bytes])=>[name,digest(bytes)]))}));
  assertPublishedProductionRoot(all);
  write(candidate,all);
  console.log('EMPLOYEE_PRODUCTION_PAIR_PREPARED',businessVersion,build,apiDeploymentId);
}

async function verify(dir) {
  const expected=readFileSync(join(dir,manifestName));
  const paths=[manifestName,'app.js','index.html',script,'build-info.json','release-status.json','site-status.json','test/app.js','test/staging-manifest.json'];
  for(let attempt=0;attempt<20;attempt++){
    const key=process.env.GITHUB_RUN_ID+'-employee-verify-'+attempt;
    const checks=await Promise.all(paths.map(async name=>(await live(name,{key})).equals(readFileSync(join(dir,name)))));
    if(checks.every(Boolean)){
      const released=manifest(new Map([[manifestName,expected]]));
      if(released.apiFunction===apiFunction) await verifyApi();
      console.log('EMPLOYEE_PAGES_READBACK_PASS',released.businessVersion,released.frontendBuild,released.apiDeploymentId);
      return;
    }
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  throw Error('Production Pages readback failed for '+dir);
}

const [mode,path,frontendDir] = process.argv.slice(2);
if(mode==='prepare') await prepare(path,frontendDir);
else if(mode==='verify') await verify(path || candidate);
else throw Error('Expected prepare or verify');
