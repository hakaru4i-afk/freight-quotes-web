/* OW-01.30.47 v / SH-01.30.50 v. Real private archives, distinct Owner screens. */
(()=>{'use strict';
const names={updates:['Реестр обновлений','Updates register','更新登记册'],remarks:['Реестр замечаний','Remarks register','问题登记册'],developments:['Реестр разработок','Development register','开发登记册'],cooperation:['Реестр предложений по сотрудничеству','Cooperation proposals register','合作申请登记册'],process:['Структура бизнес-процессов','Business processes','业务流程']};
const words=[{group:'06 · Реестры и процессы',help:'FAQ и инструкции по кабинетам',archive:'Полный канонический архив',operational:'Оперативные записи',search:'Поиск: ID, версия, роль, статус, дата',refresh:'Обновить источник',empty:'Нет данных',loading:'Загрузка…',conflict:'Источник изменился. Загрузите актуальную версию.',error:'Источник недоступен. Повторите загрузку.',source:'Источник',all:'Все записи',old:'Сначала старые',recent:'Сначала новые'},
{group:'06 · Registers & processes',help:'FAQ & role instructions',archive:'Full canonical archive',operational:'Operational records',search:'Search: ID, version, role, status, date',refresh:'Refresh source',empty:'No data',loading:'Loading…',conflict:'Source changed. Load the current version.',error:'Source unavailable. Retry loading.',source:'Source',all:'All records',old:'Oldest first',recent:'Newest first'},
{group:'06 · 登记册与流程',help:'常见问题与岗位说明',archive:'完整权威档案',operational:'运营记录',search:'搜索编号、版本、角色、状态、日期',refresh:'刷新来源',empty:'暂无数据',loading:'加载中…',conflict:'来源已更新，请加载最新版本。',error:'来源不可用，请重试。',source:'来源',all:'全部记录',old:'旧记录优先',recent:'新记录优先'}];
const locale=()=>/^zh/i.test(document.documentElement.lang)?2:/^en/i.test(document.documentElement.lang)?1:0;
const owner=()=>document.querySelector('.cabinet-app[data-cabinet-role="owner"]');
const el=(tag,text,attrs={})=>{const e=document.createElement(tag);if(text!==null)e.textContent=text;for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
let queued=false,key='',lastView='',loading=false,request=0,source=null,query='',sort='recent',filters={version:'',role:'',status:'',from:'',to:''};const nativeTitles=new WeakMap();
const selected=()=>new URL(location.href).searchParams.get('ownerView')||'';
function navigate(id){const u=new URL(location.href);if(id)u.searchParams.set('ownerView',id);else u.searchParams.delete('ownerView');history.pushState({},'',u);key='';source=null;query='';filters={version:'',role:'',status:'',from:'',to:''};request++;loading=false;schedule();window.dispatchEvent(new Event('ow-workspace-changed'));}
function sections(){if(!source)return[];return (source.legacyEntries||source.markdown.split(/(?=^## )/m).map((text,i)=>({id:'archive-'+i,markdown:text}))).map(x=>({id:x.id,text:x.markdown}));}
function paintArchive(host,id){
 host.dataset.archiveName=id;host.dataset.archiveReady=String(!loading&&!!source&&source.name===id);
 const l=locale(),w=words[l];host.replaceChildren(el('h2',names[id][l]));
 const tabs=el('div',null,{class:'ow-tabs'}),archive=el('button',w.archive,{type:'button','aria-pressed':'true'}),op=el('button',w.operational,{type:'button'});op.onclick=()=>{navigate('');location.hash='#portal-feedback';};tabs.append(archive,op);host.append(tabs);
 const toolbar=el('div',null,{class:'ow-toolbar'}),search=el('input',null,{type:'search',placeholder:w.search,'aria-label':w.search}),order=el('select',null,{'aria-label':w.recent});
 for(const[v,t]of [['recent',w.recent],['old',w.old]])order.append(el('option',t,{value:v}));order.value=sort;search.value=query;
 const refresh=el('button',w.refresh,{type:'button'});refresh.onclick=()=>load(id,host,source?.sha256);search.oninput=()=>{query=search.value;drawRecords(records);};order.onchange=()=>{sort=order.value;drawRecords(records);};toolbar.append(search,order,refresh);host.append(toolbar);
 const filterbar=el('div',null,{class:'ow-toolbar','aria-label':['Фильтры архива','Archive filters','档案筛选'][l]});
 const allText=JSON.stringify(source?.entries||[])+'\n'+(source?.markdown||'');
 const roles={owner:['Владелец','Owner','所有者'],carrier:['Перевозчик','Carrier','承运人'],logistic:['ВЭД / логист','VED / Logistic','外贸 / 物流'],supplier:['Поставщик','Supplier','供应商'],designer:['Дизайнер','Designer','设计'],content:['Контент','Content','内容'],purchasing:['Закупки','Purchasing','采购'],certification:['Сертификация','Certification','认证']};
 for(const [key,label,values]of [['version',['Бизнес-версия','Business version','业务版本'],[...new Set(allText.match(/(?:OW|CR|VD|LG|SU|DS|CM|PU|CE|SH)-\d{2}\.\d{2}\.\d{2} v/g)||[])]],['role',['Роль','Role','角色'],Object.keys(roles)],['status',['Статус','Status','状态'],[...new Set([...allText.matchAll(/\b(?:PASS|FAIL|PARTIAL|BLOCKED|PLANNED|OPEN|DONE|FIXED|RELEASE_BLOCKED|HISTORICAL|NOT_VERIFIED)\b/g)].map(x=>x[0]))]]]){
  const wrap=el('label',label[l]),select=el('select',null,{'data-archive-filter':key});select.append(el('option',w.all,{value:''}));for(const value of values.sort())select.append(el('option',key==='role'?roles[value][l]:value,{value}));select.value=filters[key];select.onchange=()=>{filters[key]=select.value;drawRecords(records);};wrap.append(select);filterbar.append(wrap);
 }
 for(const [key,label]of [['from',['С даты','From date','起始日期']],['to',['По дату','To date','结束日期']]]){const wrap=el('label',label[l]),f=el('input',null,{type:'date','data-archive-filter':key});f.value=filters[key];f.oninput=()=>{filters[key]=f.value;drawRecords(records);};wrap.append(f);filterbar.append(wrap);}host.append(filterbar);
 const info=el('p',loading?w.loading:source?`${w.source}: ${source.sourcePath} · ${source.updatedAt} · ${source.sourceCommit} · SHA-256 ${source.sha256}`:w.empty,{class:'ow-source'});if(source&&!loading){info.append(document.createTextNode(' · '),el('a',source.sourceCommit.slice(0,12),{href:'https://github.com/hakaru4i-afk/freight-quotes/commit/'+source.sourceCommit,target:'_blank',rel:'noopener'}));}host.append(info);
 const records=el('div',null,{id:'ow-archive-records'});host.append(records);drawRecords(records);
 function drawRecords(target){
  target.replaceChildren();const term=query.toLocaleLowerCase();
  const matches=text=>{const lower=text.toLocaleLowerCase();if(!lower.includes(term)||filters.version&&!text.includes(filters.version)||filters.status&&!text.includes(filters.status))return false;if(filters.role&&!([filters.role,...roles[filters.role]].some(x=>lower.includes(x.toLocaleLowerCase()))))return false;const dates=text.match(/20\d{2}-\d{2}-\d{2}/g)||[];if((filters.from||filters.to)&&!dates.some(d=>(!filters.from||d>=filters.from)&&(!filters.to||d<=filters.to)))return false;return true;};
  const current=(source?.entries||[]).filter(x=>matches(JSON.stringify(x)));if(sort==='old')current.reverse();
  for(const row of current){const d=el('details',null,{class:'ow-record','data-record-id':row.id});d.append(el('summary',`${row.id} · ${row.businessVersion} · ${row.status}`));const body=el('pre',JSON.stringify(row,null,2)),links=el('p',null);if(Number.isSafeInteger(row.issue))links.append(el('a','Issue #'+row.issue,{href:'https://github.com/hakaru4i-afk/freight-quotes-web/issues/'+row.issue,target:'_blank',rel:'noopener'}));for(const p of row.processes||[]){links.append(document.createTextNode(' · '),el('a',p,{href:'./process-map.html#'+p,target:'_blank',rel:'noopener'}));}d.append(links,body);target.append(d);}
  const blocks=sections().filter(x=>matches(x.text));if(sort==='old')blocks.reverse();
  for(const b of blocks){const d=el('details',null,{class:'ow-record','data-record-id':b.id});d.append(el('summary',b.id+' · '+b.text.split('\n').find(x=>x.trim())?.replace(/^#+\s*/,'')||w.archive),el('pre',b.text));target.append(d);}
  if(!target.childElementCount)target.append(el('p',loading?w.loading:w.empty));
 }
}
async function load(id,host,expected){
 if(loading)return;loading=true;let failed=false;const n=++request;paintArchive(host,id);
 try{const r=await fetch('/api/engineering-registers?name='+encodeURIComponent(id)+(expected?'&expectedSha='+encodeURIComponent(expected):''),{cache:'no-store'});const data=await r.json();if(n!==request||selected()!==id)return;
  if(r.status===409){failed=true;const p=el('p',words[locale()].conflict,{role:'alert'}),button=el('button',words[locale()].refresh,{type:'button'});button.onclick=()=>{source=null;load(id,host);};host.append(p,button);return;}
  if(!r.ok||!data.ok)throw Error('HTTP '+r.status);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.markdown)))).map(x=>x.toString(16).padStart(2,'0')).join('');if(digest!==data.sha256)throw Error('SOURCE_DIGEST_MISMATCH');source=data;
 }catch(e){failed=true;if(n===request)host.append(el('p',words[locale()].error+' '+e.message,{role:'alert'}));}
 finally{if(n===request){loading=false;if(!failed)paintArchive(host,id);}}
}
function render(){
 const cab=owner();if(!cab)return;const l=locale(),w=words[l],nav=cab.querySelector('.cabinet-sidebar nav');if(!nav)return;
 for(const help of nav.querySelectorAll('a[href="#help"]')){const t=[...help.childNodes].find(n=>n.nodeType===3);if(t&&t.textContent!==w.help)t.textContent=w.help;}
 const id=selected();if(id!==lastView){lastView=id;request++;loading=false;source=null;}cab.dataset.owRegisterView=Object.hasOwn(names,id)?id:'';const title=cab.querySelector('.cabinet-topbar h1')?.firstChild;if(title?.nodeType===3){let state=nativeTitles.get(title);if(!state){state={native:title.textContent,custom:null};nativeTitles.set(title,state);}if(title.textContent!==state.custom)state.native=title.textContent;const label=Object.hasOwn(names,id)?names[id][l]:state.native;state.custom=Object.hasOwn(names,id)?label:null;if(title.textContent!==label)title.textContent=label;}
 for(const [i,n]of Object.keys(names).entries()){
  let a=nav.querySelector('[data-ow-register="'+n+'"]');if(!a){a=el('a',null,{'data-ow-register':n});a.append(el('span',n==='process'?'◇':n==='cooperation'?'✉':'▤',{'aria-hidden':'true'}),document.createTextNode(''));nav.append(a);}
  const u=new URL(location.href);u.searchParams.set('ownerView',n);a.href=u.pathname+u.search+u.hash;const text=[...a.childNodes].find(x=>x.nodeType===3);if(text.textContent!==names[n][l])text.textContent=names[n][l];a.setAttribute('aria-current',id===n?'page':'false');a.dataset.lwOwnerGroup='registers';a.style.setProperty('--lw-owner-order',String(106+i));if(i===0)a.dataset.lwOwnerGroupStart=w.group;
 }
 const content=cab.querySelector('.cabinet-content');if(!content)return;let host=content.querySelector('#ow-workspace');
 if(!Object.hasOwn(names,id)){host?.remove();key='';return;}
 if(!host){host=el('section',null,{id:'ow-workspace','aria-live':'polite'});content.append(host);}
 const next=id+'|'+l;if(key===next&&host.hasChildNodes())return;key=next;
 if(id==='cooperation'){host.replaceChildren(el('h2',names[id][l]),el('div',null,{id:'ow-cooperation-screen'}));window.dispatchEvent(new Event('ow-workspace-changed'));}
 else if(id==='process'){host.replaceChildren(el('h2',names[id][l]),el('div',null,{id:'ow-process-editor'}));window.dispatchEvent(new Event('ow-process-editor-open'));}
 else{if(source?.name!==id)source=null;paintArchive(host,id);if(!source&&!loading)void load(id,host);}
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});}
document.addEventListener('click',e=>{const a=e.target.closest?.('a[data-ow-register]');if(a&&owner()?.contains(a)){e.preventDefault();e.stopImmediatePropagation();navigate(a.dataset.owRegister);return;}if(e.target.closest?.('.cabinet-sidebar nav a')&&selected())navigate('');},true);
for(const event of ['hashchange','popstate','freight-access-updated'])window.addEventListener(event,schedule);
new MutationObserver(schedule).observe(document.getElementById('root')||document.body,{childList:true,subtree:true});new MutationObserver(()=>{key='';schedule();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});schedule();
window.owOwnerRegistersVersion='OW-01.30.47 v';
})();
