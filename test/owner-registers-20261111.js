/* OW-01.30.47 v / SH-01.30.50 v. Real private archives, distinct Owner screens. */
(()=>{'use strict';
const names={updates:['Реестр обновлений','Updates register','更新登记册'],remarks:['Реестр замечаний','Remarks register','问题登记册'],developments:['Реестр разработок','Development register','开发登记册'],cooperation:['Реестр предложений по сотрудничеству','Cooperation proposals register','合作申请登记册'],process:['Структура бизнес-процессов','Business processes','业务流程']};
const words=[{group:'06 · Реестры и процессы',help:'FAQ и инструкции по кабинетам',archive:'Полный канонический архив',operational:'Оперативные записи',search:'Поиск: ID, версия, роль, статус, дата',refresh:'Обновить источник',empty:'Нет данных',loading:'Загрузка…',conflict:'Источник изменился. Загрузите актуальную версию.',error:'Источник недоступен. Повторите загрузку.',source:'Источник',all:'Все записи',old:'Сначала старые',recent:'Сначала новые'},
{group:'06 · Registers & processes',help:'FAQ & role instructions',archive:'Full canonical archive',operational:'Operational records',search:'Search: ID, version, role, status, date',refresh:'Refresh source',empty:'No data',loading:'Loading…',conflict:'Source changed. Load the current version.',error:'Source unavailable. Retry loading.',source:'Source',all:'All records',old:'Oldest first',recent:'Newest first'},
{group:'06 · 登记册与流程',help:'常见问题与岗位说明',archive:'完整权威档案',operational:'运营记录',search:'搜索编号、版本、角色、状态、日期',refresh:'刷新来源',empty:'暂无数据',loading:'加载中…',conflict:'来源已更新，请加载最新版本。',error:'来源不可用，请重试。',source:'来源',all:'全部记录',old:'旧记录优先',recent:'新记录优先'}];
const locale=()=>/^zh/i.test(document.documentElement.lang)?2:/^en/i.test(document.documentElement.lang)?1:0;
const owner=()=>document.querySelector('.cabinet-app[data-cabinet-role="owner"]');
const el=(tag,text,attrs={})=>{const e=document.createElement(tag);if(text!==null)e.textContent=text;for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
let queued=false,key='',loading=false,request=0,source=null,query='',sort='recent';
const selected=()=>new URL(location.href).searchParams.get('ownerView')||'';
function navigate(id){const u=new URL(location.href);if(id)u.searchParams.set('ownerView',id);else u.searchParams.delete('ownerView');history.pushState({},'',u);key='';source=null;query='';request++;loading=false;schedule();window.dispatchEvent(new Event('ow-workspace-changed'));}
function sections(){if(!source)return[];return (source.legacyEntries||source.markdown.split(/(?=^## )/m).map((text,i)=>({id:'archive-'+i,markdown:text}))).map(x=>({id:x.id,text:x.markdown}));}
function paintArchive(host,id){
 const l=locale(),w=words[l];host.replaceChildren(el('h2',names[id][l]));
 const tabs=el('div',null,{class:'ow-tabs'}),archive=el('button',w.archive,{type:'button','aria-pressed':'true'}),op=el('button',w.operational,{type:'button'});op.onclick=()=>{navigate('');location.hash='#portal-feedback';};tabs.append(archive,op);host.append(tabs);
 const toolbar=el('div',null,{class:'ow-toolbar'}),search=el('input',null,{type:'search',placeholder:w.search,'aria-label':w.search}),order=el('select',null,{'aria-label':w.recent});
 for(const[v,t]of [['recent',w.recent],['old',w.old]])order.append(el('option',t,{value:v}));order.value=sort;search.value=query;
 const refresh=el('button',w.refresh,{type:'button'});refresh.onclick=()=>load(id,host,source?.sha256);search.oninput=()=>{query=search.value;drawRecords(records);};order.onchange=()=>{sort=order.value;drawRecords(records);};toolbar.append(search,order,refresh);host.append(toolbar);
 const info=el('p',loading?w.loading:source?`${w.source}: ${source.sourcePath} · ${source.sourceCommit} · SHA-256 ${source.sha256}`:w.empty,{class:'ow-source'});host.append(info);
 const records=el('div',null,{id:'ow-archive-records'});host.append(records);drawRecords(records);
 function drawRecords(target){
  target.replaceChildren();const term=query.toLocaleLowerCase(),current=(source?.entries||[]).filter(x=>JSON.stringify(x).toLocaleLowerCase().includes(term));
  for(const row of current){const d=el('details',null,{class:'ow-record','data-record-id':row.id});d.append(el('summary',`${row.id} · ${row.businessVersion} · ${row.status}`));const body=el('pre',JSON.stringify(row,null,2));d.append(body);target.append(d);}
  const blocks=sections().filter(x=>x.text.toLocaleLowerCase().includes(term));if(sort==='old')blocks.reverse();
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
 const id=selected();cab.dataset.owRegisterView=Object.hasOwn(names,id)?id:'';
 for(const [i,n]of Object.keys(names).entries()){
  let a=nav.querySelector('[data-ow-register="'+n+'"]');if(!a){a=el('a',null,{'data-ow-register':n});a.append(el('span',n==='process'?'◇':n==='cooperation'?'✉':'▤',{'aria-hidden':'true'}),document.createTextNode(''));nav.append(a);}
  const u=new URL(location.href);u.searchParams.set('ownerView',n);a.href=u.pathname+u.search+u.hash;const text=[...a.childNodes].find(x=>x.nodeType===3);if(text.textContent!==names[n][l])text.textContent=names[n][l];a.setAttribute('aria-current',id===n?'page':'false');a.dataset.lwOwnerGroup='registers';a.style.setProperty('--lw-owner-order',String(106+i));if(i===0)a.dataset.lwOwnerGroupStart=w.group;
 }
 const content=cab.querySelector('.cabinet-content');if(!content)return;let host=content.querySelector('#ow-workspace');
 if(!Object.hasOwn(names,id)){host?.remove();key='';return;}
 if(!host){host=el('section',null,{id:'ow-workspace','aria-live':'polite'});content.append(host);}
 const next=id+'|'+l;if(key===next)return;key=next;
 if(id==='cooperation'){host.replaceChildren(el('h2',names[id][l]),el('div',null,{id:'ow-cooperation-screen'}));window.dispatchEvent(new Event('ow-workspace-changed'));}
 else if(id==='process'){host.replaceChildren(el('h2',names[id][l]),el('div',null,{id:'ow-process-editor'}));window.dispatchEvent(new Event('ow-process-editor-open'));}
 else{if(source?.name!==id)source=null;paintArchive(host,id);if(!source&&!loading)void load(id,host);}
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});}
document.addEventListener('click',e=>{const a=e.target.closest?.('a[data-ow-register]');if(a&&owner()?.contains(a)){e.preventDefault();e.stopImmediatePropagation();navigate(a.dataset.owRegister);return;}if(e.target.closest?.('.cabinet-sidebar nav a')&&selected())navigate('');},true);
for(const event of ['hashchange','popstate','freight-access-updated'])window.addEventListener(event,()=>{key='';schedule();});
new MutationObserver(schedule).observe(document.getElementById('root')||document.body,{childList:true,subtree:true});new MutationObserver(()=>{key='';schedule();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});schedule();
window.owOwnerRegistersVersion='OW-01.30.47 v';
})();
