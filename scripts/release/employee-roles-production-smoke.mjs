import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync, existsSync, writeFileSync, rmSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {loginProductionOwner} from './production-owner-login.mjs';

const [mode,dir] = process.argv.slice(2);
const base='https://hakaru4i-afk.github.io/freight-quotes-web/';
const origin=new URL(base).origin;
const project='ooclsrndeygojtofuyte';
const root=resolve(dir);
const manifest=JSON.parse(readFileSync(resolve(root,'production-release-manifest.json')));
const prefix='https://'+project+'.supabase.co/functions/v1/';
const endpoint=prefix+manifest.apiFunction, previous=prefix+manifest.previous.apiFunction;
const roles=['carrier','logistic','supplier','designer','content','purchasing','certification'];
const key='freight-session-persistent-v1';
const sessionFile=resolve(process.env.RUNNER_TEMP,'freight-team-owner-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT);
const login=process.env.SMOKE_OWNER_LOGIN, password=process.env.SMOKE_OWNER_PASSWORD;
const admin=process.env.SUPABASE_ACCESS_TOKEN;
delete process.env.SMOKE_OWNER_LOGIN;
delete process.env.SMOKE_OWNER_PASSWORD;
delete process.env.SUPABASE_ACCESS_TOKEN;

async function call(route,token,payload,query='',target=endpoint){
 const headers={Origin:origin};
 if(token) headers.Authorization='Bearer '+token;
 if(payload) headers['Content-Type']='application/json';
 return await fetch(target+'/api/'+route+'?forceFunctionRegion=eu-central-1'+query,
  {headers,method:payload?'POST':'GET',body:payload?JSON.stringify(payload):undefined,redirect:'error',signal:AbortSignal.timeout(25000)});
}
async function body(response,status,label){
 assert.equal(response.status,status,label);
 return response.json();
}
async function confirmSession(token,role,target=endpoint){
 const profile=await body(await call('session',token,undefined,'',target),200,'Session status '+role);
 assert.equal(profile.role,role);
 assert.equal(profile.authenticated,true);
}
async function db(prefix){
 assert.ok(admin&&/^p0team-[a-f0-9]{20}-$/.test(prefix),'Database receipt credentials missing');
 const query=`select a.login, a.enabled, m.role, exists(select 1 from freight.access_users u where u.login=a.login) as custom_access,
  (select count(*)::int from freight.sessions s where s.user_id=a.user_id) as session_count
  from freight.accounts a left join freight.members m on m.email=a.login where left(a.login,${prefix.length})='${prefix}' order by a.login`;
 const r=await fetch('https://api.supabase.com/v1/projects/'+project+'/database/query',
  {method:'POST',headers:{Authorization:'Bearer '+admin,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:true}),
   redirect:'error',signal:AbortSignal.timeout(25000)});
 assert.equal(r.status,201,'Database role receipt');
 const rows=await r.json();
 assert.ok(Array.isArray(rows),'Database role receipt format');
 return rows;
}
async function openTeam(browser,token,width,accounts){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:'block'});
 const page=await context.newPage();
 await context.addInitScript(({token,key,origin})=>{if(location.origin===origin)localStorage.setItem(key,token)},{token,key,origin});
 const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.wasm':'application/wasm'};
 await context.route('**/*',async route=>{
  const req=route.request(), u=new URL(req.url()), mutation=!['GET','OPTIONS','HEAD'].includes(req.method());
  if(u.origin===new URL(endpoint).origin){
   if(!u.pathname.startsWith(new URL(endpoint).pathname+'/'))return route.abort();
   if(mutation){
    if(u.pathname!==new URL(endpoint+'/api/team').pathname||req.method()!=='POST')return route.abort();
    let p;
    try{p=req.postDataJSON()}catch{return route.abort()}
    if(p?.action!=='add'||!accounts.has(p.email)||accounts.get(p.email)!==p.role)return route.abort();
   }
   return route.continue();
  }
  if(mutation)return route.abort();
  if(mode==='candidate'&&req.url().startsWith(base)){
   const name=decodeURIComponent(u.pathname.slice(new URL(base).pathname.length))||'index.html';
   const file=resolve(root,name);
   if(!file.startsWith(root+'/'))return route.abort();
   try{return route.fulfill({contentType:mime[extname(file)]||'application/octet-stream',body:readFileSync(file)});}
   catch{return route.abort()}
  }
  return route.continue();
 });
 const gotCatalog=page.waitForResponse(r=>new URL(r.url()).pathname===new URL(endpoint+'/api/team').pathname&&
  r.request().method()==='GET'&&r.ok(),{timeout:55000});
 gotCatalog.catch(()=>{});
 await page.goto(base+'?employee-smoke='+Date.now(),{waitUntil:'domcontentloaded',timeout:40000});
 const sidebar=page.locator('.cabinet-sidebar').first();
 await sidebar.waitFor({state:'attached',timeout:50000});
 let menu=page.locator('.cabinet-sidebar a[href="#team"], .cabinet-sidebar button').filter({hasText:/Пользователи и доступ|Users and access/}).first();
 if(!await menu.isVisible()){
  const toggle=page.locator('button[aria-controls="cabinet-sidebar"], .cabinet-menu-toggle, .cabinet-sidebar-toggle, .cabinet-mobile-menu').first();
  if(await toggle.isVisible())await toggle.click();
 }
 if(await menu.isVisible())await menu.click();
 else await page.evaluate(()=>{location.hash='team'});
 const buttons=page.locator('.ow-users-create');
 await buttons.first().waitFor({state:'visible',timeout:50000});
 assert.deepEqual(await buttons.evaluateAll(nodes=>nodes.map(n=>n.dataset.userRole)),roles);
 assert.deepEqual((await (await gotCatalog).json()).creatableRoles,roles);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'Page must fit its viewport');
 return {context,page};
}
async function createFromForm(page,email,role,secret){
 await page.locator('.ow-users-create[data-user-role="'+role+'"]').click();
 const form=page.locator('.ow-users-dialog');
 await form.locator('input').nth(0).fill(email);
 await form.locator('input').nth(1).fill('P0 employee QA '+role);
 await form.locator('input[type=password]').fill(secret);
 const pending=page.waitForResponse(r=>new URL(r.url()).pathname===new URL(endpoint+'/api/team').pathname&&
  r.request().method()==='POST'&&r.request().postDataJSON()?.email===email,{timeout:30000});
 pending.catch(()=>{});
 await form.locator('button[type=submit]').click();
 const result=await body(await pending,200,'Team UI POST '+role);
 assert.ok(result.members.some(m=>m.email===email&&m.role===role),'Team UI receipt '+role);
 await form.waitFor({state:'hidden',timeout:10000});
}
const existing=existsSync(sessionFile);
if(mode==='cleanup'){
 if(existing){
  const token=readFileSync(sessionFile,'utf8');
  try{
   await body(await call('auth',token,{action:'logout'}),200,'Revoke smoke owner session');
   assert.equal((await body(await call('session',token),200,'Revoked owner session')).authenticated,false);
  }finally{rmSync(sessionFile,{force:true});}
 }
}else{
 assert.ok(['candidate','live'].includes(mode));
 let token;
 if(mode==='candidate'){
  assert.ok(!existing);
  token=await loginProductionOwner({endpoint:previous,login,password});
  writeFileSync(sessionFile,token,{mode:0o600,flag:'wx'});
  await confirmSession(token,'owner',previous);
 }else token=readFileSync(sessionFile,'utf8');
 await confirmSession(token,'owner');
 const runPrefix='p0team-'+randomBytes(10).toString('hex')+'-';
 const secret=randomBytes(24).toString('base64url');
 const accounts=new Map(roles.flatMap(role=>[['ui','api'].map(source=>[runPrefix+source+'-'+role,role])][0]));
 const attempted=new Set();
 const browser=await chromium.launch({headless:true});
 try {
  const catalog=await body(await call('team',token),200,'Owner catalog');
  assert.deepEqual(catalog.creatableRoles,roles);
  const pageWidths=[1440,390];
  for(const width of pageWidths){
   const {context,page}=await openTeam(browser,token,width,accounts);
   try{
    if(mode==='live')for(const [index,role] of roles.entries()){
     if((index%2===0)!==(width===1440))continue;
     const email=runPrefix+'ui-'+role;
     attempted.add(email);
     await createFromForm(page,email,role,secret);
    }
   }finally{await context.close();}
  }
  if(mode==='live'){
   const ownerChats=await body(await call('chats',token),200,'Owner chat list continuity');
   const foreign=ownerChats.chats?.find(chat=>chat.id&&chat.carrier_login);
   for(const role of roles){
    const email=runPrefix+'api-'+role;
    attempted.add(email);
    const data=await body(await call('team',token,{action:'add',email,name:'P0 employee QA '+role,role,password:secret}),200,'Team API POST '+role);
    assert.ok(data.members.some(m=>m.email===email&&m.role===role),'Team direct receipt '+role);
    const employee=await body(await call('auth',null,{action:'login',login:runPrefix+'ui-'+role,password:secret}),200,'Employee login '+role);
    assert.match(employee.sessionToken,/^[a-f0-9]{64}$/);
    try{
     await confirmSession(employee.sessionToken,role);
     const access=await body(await call('access',employee.sessionToken),200,'Employee access '+role);
     assert.equal(access.access.role,role);
     assert.ok(!access.access.owner&&['users.manage','access.manage','cabinets.preview'].every(p=>!access.access.permissions.includes(p)));
     const denied=runPrefix+'denied-'+role;
     attempted.add(denied);
     assert.equal((await call('team',employee.sessionToken,{action:'add',role:'carrier',email:denied,password:secret})).status,403,'Employee creation denied '+role);
     assert.equal((await call('team',employee.sessionToken)).status,403,'Employee list denied '+role);
     if(role!=='logistic'&&foreign)assert.ok([403,404].includes((await call('chats',employee.sessionToken,undefined,'&id='+encodeURIComponent(foreign.id))).status),'Foreign chat denied '+role);
    }finally{await body(await call('auth',employee.sessionToken,{action:'logout'}),200,'Employee logout '+role);}
    console.log('EMPLOYEE_PRODUCTION_ROLE_PASS',role,'ui=true api=true login=true role=true denied=true');
   }
   const rows=await db(runPrefix);
   assert.equal(rows.length,accounts.size,'Exactly 14 synthetic account rows');
   for(const {login,enabled,role,custom_access,session_count} of rows){
    assert.ok(accounts.has(login));
    assert.equal(enabled,1);
    assert.equal(role,accounts.get(login));
    assert.equal(custom_access,false);
    assert.equal(session_count,0);
   }
   console.log('EMPLOYEE_DATABASE_READBACK_PASS',rows.length);
  }
 }finally{
  await browser.close();
  if(attempted.size){
   const all=await db(runPrefix);
   const cleanup=await Promise.allSettled(all.map(async row=>{
    assert.ok(attempted.has(row.login),'Cleanup restricted to run accounts');
    await body(await call('team',token,{action:'remove',email:row.login}),200,'Deactivate synthetic account');
   }));
   const rows=await db(runPrefix);
   assert.ok(cleanup.every(result=>result.status==='fulfilled')&&rows.every(row=>row.enabled===0&&row.role===null&&row.session_count===0),'Synthetic account cleanup');
   console.log('EMPLOYEE_SYNTHETIC_ACCOUNTS_DEACTIVATED',rows.length);
  }
 }
 console.log('EMPLOYEE_BROWSER_PRODUCTION_PASS',mode,'1440x900','390x844');
}
