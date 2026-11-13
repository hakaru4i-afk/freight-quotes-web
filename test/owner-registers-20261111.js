/* OW-01.30.47 v / SH-01.30.50 v. Real private archives, distinct Owner screens. */
(()=>{'use strict';
const names={updates:['Реестр обновлений','Updates register','更新登记册'],remarks:['Реестр замечаний','Remarks register','问题登记册'],developments:['Реестр разработок','Development register','开发登记册'],cooperation:['Реестр предложений по сотрудничеству','Cooperation proposals register','合作申请登记册'],process:['Структура бизнес-процессов','Business processes','业务流程']};
const words=[{group:'06 · Реестры и процессы',help:'FAQ и инструкции по кабинетам',archive:'Все записи',operational:'Задания в работе',search:'Поиск: ID, версия, роль, статус, дата',refresh:'Обновить источник',empty:'Нет данных',loading:'Загрузка…',conflict:'Источник изменился. Загрузите актуальную версию.',error:'Источник недоступен. Повторите загрузку.',source:'Источник',all:'Все записи',old:'Сначала старые',recent:'Сначала новые'},
{group:'06 · Registers & processes',help:'FAQ & role instructions',archive:'All entries',operational:'Work in progress',search:'Search: ID, version, role, status, date',refresh:'Refresh source',empty:'No data',loading:'Loading…',conflict:'Source changed. Load the current version.',error:'Source unavailable. Retry loading.',source:'Source',all:'All records',old:'Oldest first',recent:'Newest first'},
{group:'06 · 登记册与流程',help:'常见问题与岗位说明',archive:'所有记录',operational:'进行中的任务',search:'搜索编号、版本、角色、状态、日期',refresh:'刷新来源',empty:'暂无数据',loading:'加载中…',conflict:'来源已更新，请加载最新版本。',error:'来源不可用，请重试。',source:'来源',all:'全部记录',old:'旧记录优先',recent:'新记录优先'}];
const locale=()=>/^zh/i.test(document.documentElement.lang)?2:/^en/i.test(document.documentElement.lang)?1:0;
const owner=()=>document.querySelector('.cabinet-app[data-cabinet-role="owner"]');
const el=(tag,text,attrs={})=>{const e=document.createElement(tag);if(text!==null)e.textContent=text;for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
let queued=false,key='',lastView='',loading=false,request=0,source=null,query='',sort='recent',filters={version:'',role:'',status:'',from:'',to:''};const nativeTitles=new WeakMap();
// The canonical archive remains read-only. Decisions are persisted through the existing
// Owner-only /api/portal-feedback lifecycle, not in browser storage.
let workItems=[],workBusy='',workReady=false,workError='',workNotice='';
const workWords=[
 {active:'Сейчас разрабатывается',empty:'Нет работ в активной разработке',start:'Взять в работу',working:'В работе',open:'Открыть задачу',details:'История и технические сведения',changed:'Сохранено на сервере',claimed:'Работа взята в разработку',planning:'Запланировано',ready:'Готово к проверке',released:'Выпущено',blocked:'Выпуск не разрешён',partial:'Частично готово',unverified:'Не проверено',proposed:'Зарегистрировано',rejected:'Отклонено',finished:'Работа завершена',sourceName:'Из какого реестра',subtitle:'Название, понятный статус и действия. Код скрыт в истории.'},
 {active:'Work in progress',empty:'No active development tasks',start:'Start work',working:'In progress',open:'Open task',details:'History and technical details',changed:'Saved to server',claimed:'Work started',planning:'Planned',ready:'Ready for verification',released:'Released',blocked:'Release blocked',partial:'Partially done',unverified:'Unverified',proposed:'Registered',rejected:'Rejected',finished:'Completed',sourceName:'Source register',subtitle:'Plain-language summary, status and actions. Technical metadata is in history.'},
 {active:'当前开发工作',empty:'暂无进行中的开发任务',start:'开始处理',working:'进行中',open:'打开任务',details:'历史和技术信息',changed:'已保存到服务器',claimed:'已开始开发',planning:'已计划',ready:'待验证',released:'已发布',blocked:'禁止发布',partial:'部分完成',unverified:'未验证',proposed:'已登记',rejected:'已拒绝',finished:'已完成',sourceName:'来源登记册',subtitle:'清晰的摘要、状态和操作。技术信息折叠在历史中。'}
];
const statusNames={sent:['Новое','New','新建'],read:['Прочитано','Read','已阅'],evaluated:['Оценено','Evaluated','已评估'],in_progress:['В работе','In progress','进行中'],release:['Готовится к выпуску','Preparing release','准备发布'],completed:['Завершено','Completed','已完成'],denied:['Отклонено','Rejected','已拒绝']};
const plain=x=>String(x??'').replace(/\s+/g,' ').trim();
const short=(x,max=190)=>plain(x).slice(0,max);
const archiveMarker=(id,recordId)=>'[ARCHIVE:'+id+':'+recordId+']';
const taskFor=(id,recordId)=>workItems.find(x=>String(x.description||'').includes(archiveMarker(id,recordId)));
function statusLabel(code,releaseStatus){
 const w=workWords[locale()],r=String(releaseStatus||'').toUpperCase(),s=String(code||'').toUpperCase();
 if(/^(RELEASED|PRODUCTION_RELEASED|DEPLOYED_PRODUCTION|PUBLISHED_PRODUCTION)$/.test(r))return w.released;
 if(r==='RELEASE_BLOCKED'||r==='BLOCKED')return w.blocked;
 if(s==='IN_PROGRESS'||s==='WORKING')return w.working;
 if(s==='DENIED'||s==='REJECTED'||s==='CANCELLED')return w.rejected;
 if(s==='PLANNED'||s==='DRAFT')return w.planning;
 if(s==='DONE'||s==='COMPLETE'||s==='COMPLETED'||s==='READY'||s==='FIXED'||s==='PASS'||s.includes('QA_VERIFIED'))return w.ready;
 if(s==='PARTIAL'||s==='BLOCKED'||s.includes('PENDING'))return w.partial;
 return w.proposed;
}
const workStatus=x=>statusNames[x?.status]?.[locale()]||statusLabel(x?.status);
function recordTitle(id,row){
 const translations={
  'SECURITY-GATE':['Проверка безопасности и правил доступа','Security and access review','安全与权限检查'],
  'MAP-GEOCODE':['Географические точки и построение маршрутов','Map points and routing','地点与路线'],
  'SURFACE-CONTRAST':['Читаемость текста и элементов','Interface readability','界面可读性'],
  'ALIGNMENT':['Согласование версий и тестовой среды','Environment alignment','环境版本同步'],
  'ARCHIVES':['Хранение архивов заявок','Archive records','历史记录'],
  'EDITOR':['Редактор бизнес-процессов','Business process editor','业务流程编辑'],
  'COOPERATION':['Предложения о сотрудничестве','Cooperation proposals','合作建议'],
  'CONTRAST':['Читаемость интерфейса','Interface readability','界面可读性']
 };
 const v=[row.title,row.name,row.summary,row.subject,row.label,row.description].find(x=>typeof x==='string'&&plain(x).length>5);
 if(v)return short(v,135);
 const key=String(row.id||'').toUpperCase();
 const match=Object.entries(translations).find(([term])=>key.includes(term));
 return match?match[1][locale()]:names[id][locale()]+' — '+short(row.id||'запись',95);
}
function recordDescription(row){
 const fields=[row.description,row.summary,row.details,row.note,row.documentationReview?.reason,row.decisionReason,row.result,row.reason].filter(x=>typeof x==='string'&&plain(x).length>12);
 return fields.length?short(fields[0],320):(['Запись зарегистрирована. Откройте историю, если нужны подробности.','This entry is registered. See history for details.','此条目已登记，详情请查看历史记录。'][locale()]);
}
function markdownTitle(text){const line=String(text).split('\n').find(x=>/^#{1,4} /.test(x))||String(text).split('\n').find(x=>plain(x))||'';return short(line.replace(/^#+\s*/,'').replace(/\\[\[\]()]/g,''),130);}
function markdownSummary(text){
 const lines=String(text).split('\n').filter(z=>plain(z)&&!/^\s*(?:[{}\[\]`]|---|##|\||source:|SHA-256|commit|https?:)/i.test(z)).map(z=>z.replace(/^\s*[-*>]+\s*/,''));return short(lines.find(z=>plain(z).length>25)||lines[1]||'',320);
}
async function feedbackRequest(body){
 const response=await fetch('/api/portal-feedback',{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const json=await response.json().catch(()=>({}));
 if(!response.ok||!json.ok)throw Error(json.error||'HTTP '+response.status);
 return json;
}
async function refreshWork(silent=false){
 try{const data=await feedbackRequest();if(!data.owner)throw Error('OWNER_ACCESS_REQUIRED');workItems=Array.isArray(data.items)?data.items:[];workError='';workReady=true;}
 catch(e){workError=String(e.message||e);workReady=true;if(!silent)throw e;}
}
function drawWork(host){
 const l=locale(),w=workWords[l],panel=el('section',null,{class:'ow-live-board'});
 panel.append(el('h3',w.active));
 const active=workItems.filter(x=>x.status==='in_progress'||x.status==='release');
 const metric=el('strong',String(active.length),{class:'ow-work-count'});panel.append(metric);
 const intro=el('p',w.subtitle,{class:'ow-board-help'});panel.append(intro);
 if(workError)panel.append(el('p',w.unverified+' · '+workError,{role:'alert',class:'ow-work-error'}));
 if(workNotice)panel.append(el('p',workNotice,{role:'status',class:'ow-work-success'}));
 if(active.length){
  const list=el('div',null,{class:'ow-active-list'});
  for(const item of active.slice(0,8)){
   const card=el('div',null,{class:'ow-active-item'}),body=el('div');
   const cleaned=plain(item.description).split('Источник реестра:')[0].replace(/ARCHIVE:[^\s]+/g,'').trim();
   body.append(el('strong',short(cleaned,120)||short(item.code,110)),el('small',workStatus(item)));
   const action=el('button',w.open,{type:'button'});action.onclick=()=>{navigate('');location.hash='#portal-feedback';};
   card.append(body,action);list.append(card);
  }panel.append(list);
 }else if(workReady&&!workError)panel.append(el('p',w.empty,{class:'ow-board-help'}));
 const open=el('button',['Центр доработок — все задания','Development center — all tasks','开发中心 — 全部任务'][l],{type:'button',class:'ow-board-link'});
 open.onclick=()=>{navigate('');location.hash='#portal-feedback';};panel.append(open);host.append(panel);
}
async function startWork(id,recordId,title,description){
 if(workBusy)return;
 const label=archiveMarker(id,recordId);
 workBusy=label;workError='';workNotice='';
 const original=source?.name;
 try{
  // Refresh before create: historical archives are read-only; linked jobs live on the server.
  await refreshWork();
  let item=taskFor(id,recordId);
  if(!item){
   const kind=id==='remarks'?'fix':'development';
   const text=title+'\n'+description+'\n\nИсточник реестра: '+label;
   const created=await feedbackRequest({action:'create',category:kind,description:text.slice(0,4900)});
   item=created.item;if(!item?.id)throw Error('TASK_CREATE_NO_ID');
  }
  // Respect backend transitions: a single conscious Owner decision advances the
  // item through its audited states; each response is checked before the next write.
  for(const [current,next] of [['sent','read'],['read','evaluated'],['evaluated','in_progress']]){
   if(item.status!==current)continue;
   const res=await feedbackRequest({action:'set_status',id:item.id,expectedStatus:current,status:next,note:'Решение владельца: взять в разработку из '+names[id][0]+' ('+recordId+')'});
   if(res.item?.status!==next)throw Error('STATUS_READBACK_MISMATCH');
   item=res.item;
  }
  await refreshWork();
  const readback=taskFor(id,recordId);
  if(!readback||readback.status!=='in_progress'&&readback.status!=='release')throw Error('TASK_NOT_IN_PROGRESS');
  workNotice=workWords[locale()].claimed;
 }catch(e){workError=String(e.message||e);try{await refreshWork(true);}catch{}}
 finally{
  workBusy='';
  const currentHost=document.getElementById('ow-workspace');
  if(currentHost&&original===selected()&&source?.name===original)paintArchive(currentHost,original);
 }
}

const selected=()=>new URL(location.href).searchParams.get('ownerView')||'';
function navigate(id){const u=new URL(location.href);if(id)u.searchParams.set('ownerView',id);else u.searchParams.delete('ownerView');history.pushState({},'',u);key='';source=null;query='';filters={version:'',role:'',status:'',from:'',to:''};request++;loading=false;schedule();window.dispatchEvent(new Event('ow-workspace-changed'));}
function sections(){if(!source)return[];return (source.legacyEntries||source.markdown.split(/(?=^## )/m).map((text,i)=>({id:'archive-'+i,markdown:text}))).map(x=>({id:x.id,text:x.markdown}));}
function paintArchive(host,id){
 host.dataset.archiveName=id;host.dataset.archiveReady=String(!loading&&!!source&&source.name===id);
 const l=locale(),w=words[l];host.replaceChildren(el('h2',names[id][l]));
 const tabs=el('div',null,{class:'ow-tabs'}),archive=el('button',w.archive,{type:'button','aria-pressed':'true'}),op=el('button',w.operational,{type:'button'});archive.onclick=()=>{query='';sort='recent';filters={version:'',role:'',status:'',from:'',to:''};paintArchive(host,id);};op.onclick=()=>{navigate('');location.hash='#portal-feedback';};tabs.append(archive,op);host.append(tabs);
 const toolbar=el('div',null,{class:'ow-toolbar'}),search=el('input',null,{type:'search',placeholder:w.search,'aria-label':w.search}),order=el('select',null,{'aria-label':w.recent});
 for(const[v,t]of [['recent',w.recent],['old',w.old]])order.append(el('option',t,{value:v}));order.value=sort;search.value=query;
 const refresh=el('button',w.refresh,{type:'button'});refresh.onclick=async()=>{await refreshWork(true);void load(id,host,source?.sha256);};search.oninput=()=>{query=search.value;drawRecords(records);};order.onchange=()=>{sort=order.value;drawRecords(records);};toolbar.append(search,order,refresh);host.append(toolbar);
 const filterbar=el('div',null,{class:'ow-toolbar','aria-label':['Фильтры архива','Archive filters','档案筛选'][l]});
 const allText=JSON.stringify(source?.entries||[])+'\n'+(source?.markdown||'');
 const roles={owner:['Владелец','Owner','所有者'],carrier:['Перевозчик','Carrier','承运人'],logistic:['ВЭД / логист','VED / Logistic','外贸 / 物流'],supplier:['Поставщик','Supplier','供应商'],designer:['Дизайнер','Designer','设计'],content:['Контент','Content','内容'],purchasing:['Закупки','Purchasing','采购'],certification:['Сертификация','Certification','认证']};
 for(const [key,label,values]of [['version',['Бизнес-версия','Business version','业务版本'],[...new Set(allText.match(/(?:OW|CR|VD|LG|SU|DS|CM|PU|CE|SH)-\d{2}\.\d{2}\.\d{2} v/g)||[])]],['role',['Роль','Role','角色'],Object.keys(roles)],['status',['Статус','Status','状态'],[...new Set([...allText.matchAll(/\b(?:PASS|FAIL|PARTIAL|BLOCKED|PLANNED|OPEN|DONE|FIXED|RELEASE_BLOCKED|HISTORICAL|NOT_VERIFIED)\b/g)].map(x=>x[0]))]]]){
  const wrap=el('label',label[l]),select=el('select',null,{'data-archive-filter':key});select.append(el('option',w.all,{value:''}));for(const value of values.sort())select.append(el('option',key==='role'?roles[value][l]:key==='status'?statusLabel(value):value,{value}));select.value=filters[key];select.onchange=()=>{filters[key]=select.value;drawRecords(records);};wrap.append(select);filterbar.append(wrap);
 }
 for(const [key,label]of [['from',['С даты','From date','起始日期']],['to',['По дату','To date','结束日期']]]){const wrap=el('label',label[l]),f=el('input',null,{type:'date','data-archive-filter':key});f.value=filters[key];f.oninput=()=>{filters[key]=f.value;drawRecords(records);};wrap.append(f);filterbar.append(wrap);}const extra=el('details',null,{class:'ow-extra-filters'});extra.append(el('summary',['Дополнительные фильтры','More filters','更多筛选'][l]),filterbar);host.append(extra);
 drawWork(host);
 const info=el('details',null,{class:'ow-extra-filters ow-source'}),infoTitle=el('summary',['Источник и дата обновления','Source and updated date','来源和更新日期'][l]);info.append(infoTitle);const detail=el('p',loading?w.loading:source?`${w.source}: ${source.sourcePath} · ${source.updatedAt} · ${source.sourceCommit} · SHA-256 ${source.sha256}`:w.empty);if(source&&!loading){detail.append(document.createTextNode(' · '),el('a',source.sourceCommit.slice(0,12),{href:'https://github.com/hakaru4i-afk/freight-quotes/commit/'+source.sourceCommit,target:'_blank',rel:'noopener'}));}info.append(detail);host.append(info);
 const records=el('div',null,{id:'ow-archive-records'});host.append(records);drawRecords(records);
 function drawRecords(target){
  target.replaceChildren();const term=query.toLocaleLowerCase();
  const matches=text=>{const lower=text.toLocaleLowerCase();if(!lower.includes(term)||filters.version&&!text.includes(filters.version)||filters.status&&!text.includes(filters.status))return false;if(filters.role&&!([filters.role,...roles[filters.role]].some(x=>lower.includes(x.toLocaleLowerCase()))))return false;const dates=text.match(/20\d{2}-\d{2}-\d{2}/g)||[];if((filters.from||filters.to)&&!dates.some(d=>(!filters.from||d>=filters.from)&&(!filters.to||d<=filters.to)))return false;return true;};
  const current=(source?.entries||[]).filter(x=>matches(JSON.stringify(x)));if(sort==='old')current.reverse();
  function card(recordId,title,description,code,raw,release,workType){
   const card=el('article',null,{class:'ow-work-card','data-record-id':recordId}),heading=el('div',null,{class:'ow-work-card-top'});
   heading.append(el('h3',title));
   const job=taskFor(id,recordId);
   const humanStatus=job?workStatus(job):statusLabel(code,release);
   const state=el('span',humanStatus,{class:'ow-human-status'});
   if((job?.status==='in_progress'||job?.status==='release'))state.dataset.state='working';
   else if(String(release||'').toUpperCase()==='RELEASE_BLOCKED')state.dataset.state='blocked';
   heading.append(state);card.append(heading,el('p',description,{class:'ow-human-description'}));
   const meta=el('div',null,{class:'ow-human-meta'});
   const parts=[names[id][l],job?'Задание '+job.code:'',String(code||'').toUpperCase()==='QA_VERIFIED'?'Проверено в QA; выпуск отдельно':''].filter(Boolean);
   meta.textContent=parts.join(' · ');card.append(meta);
   const controls=el('div',null,{class:'ow-human-actions'});
   const status=String(release||'').toUpperCase();
   const released=/^(RELEASED|PRODUCTION_RELEASED|DEPLOYED_PRODUCTION|PUBLISHED_PRODUCTION)$/.test(status);
   if(!released&&(!job||['sent','read','evaluated'].includes(job.status))){
    const start=el('button',workWords[l].start,{type:'button'});start.disabled=!!workBusy||!workReady||!!workError;
    start.onclick=()=>startWork(id,recordId,title,description);controls.append(start);
   }else if(job){
    const open=el('button',workWords[l].open,{type:'button'});open.onclick=()=>{navigate('');location.hash='#portal-feedback';};controls.append(open);
   }
   const history=el('details',null,{class:'ow-technical-history'});history.append(el('summary',workWords[l].details));
   history.append(el('pre',raw));controls.append(history);
   card.append(controls);target.append(card);
  }
  for(const row of current)card(row.id,recordTitle(id,row),recordDescription(row),row.status,row.id+' · '+row.businessVersion+'\n'+JSON.stringify(row,null,2),row.releaseStatus||row.release_status,'structured');
  const blocks=sections().filter(x=>matches(x.text));if(sort==='old')blocks.reverse();
  for(const b of blocks){const title=markdownTitle(b.text)||names[id][l];card(b.id,title,markdownSummary(b.text)||title,'OPEN',b.text,'','markdown');}
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
 finally{if(n===request){loading=false;if(!failed){await refreshWork(true);paintArchive(host,id);}}}
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
 if(id==='cooperation'){host.replaceChildren(el('h2',names[id][l]));drawWork(host);host.append(el('div',null,{id:'ow-cooperation-screen'}));window.dispatchEvent(new Event('ow-workspace-changed'));void refreshWork(true).then(()=>{if(selected()==='cooperation'){const board=host.querySelector('.ow-live-board');board?.remove();const insert=el('div',null);drawWork(insert);host.querySelector('#ow-cooperation-screen')?.before(insert.firstChild);}});}
 else if(id==='process'){host.replaceChildren(el('h2',names[id][l]));host.append(el('p',['Действующая схема и черновики изменений. Сохранение черновика не меняет работу сайта.','Approved process map and drafts. Saving a draft does not change the running site.','已批准的流程图和草稿。保存草稿不会改变运行中的系统。'][l],{class:'ow-board-help'}),el('div',null,{id:'ow-process-editor'}));window.dispatchEvent(new Event('ow-process-editor-open'));}
 else{if(source?.name!==id)source=null;paintArchive(host,id);if(!source&&!loading)void load(id,host);}
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});}
document.addEventListener('click',e=>{const a=e.target.closest?.('a[data-ow-register]');if(a&&owner()?.contains(a)){e.preventDefault();e.stopImmediatePropagation();navigate(a.dataset.owRegister);return;}if(e.target.closest?.('.cabinet-sidebar nav a')&&selected())navigate('');},true);
for(const event of ['hashchange','popstate','freight-access-updated'])window.addEventListener(event,schedule);
new MutationObserver(schedule).observe(document.getElementById('root')||document.body,{childList:true,subtree:true});new MutationObserver(()=>{key='';schedule();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});schedule();
window.owOwnerRegistersVersion='OW-01.30.47 v';
})();
