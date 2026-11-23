/* OW-01.30.47 v / SH-01.30.50 v. Real private archives, distinct Owner screens. */
(()=>{'use strict';
const names={updates:['Реестр обновлений','Updates register','更新登记册'],remarks:['Реестр замечаний','Remarks register','问题登记册'],developments:['Реестр разработок','Development register','开发登记册'],acceptance:['Реестр приёмки владельцем','Owner acceptance register','所有者验收登记册'],cooperation:['Реестр предложений по сотрудничеству','Cooperation proposals register','合作申请登记册'],process:['Структура бизнес-процессов','Business processes','业务流程']};
const words=[{group:'06 · Реестры и процессы',help:'FAQ и инструкции по кабинетам',archive:'Все записи',operational:'Задания в работе',search:'Поиск: ID, версия, роль, статус, дата',refresh:'Обновить источник',empty:'Нет данных',loading:'Загрузка…',conflict:'Источник изменился. Загрузите актуальную версию.',error:'Источник недоступен. Повторите загрузку.',source:'Источник',all:'Все записи',old:'Сначала старые',recent:'Сначала новые'},
{group:'06 · Registers & processes',help:'FAQ & role instructions',archive:'All entries',operational:'Work in progress',search:'Search: ID, version, role, status, date',refresh:'Refresh source',empty:'No data',loading:'Loading…',conflict:'Source changed. Load the current version.',error:'Source unavailable. Retry loading.',source:'Source',all:'All records',old:'Oldest first',recent:'Newest first'},
{group:'06 · 登记册与流程',help:'常见问题与岗位说明',archive:'所有记录',operational:'进行中的任务',search:'搜索编号、版本、角色、状态、日期',refresh:'刷新来源',empty:'暂无数据',loading:'加载中…',conflict:'来源已更新，请加载最新版本。',error:'来源不可用，请重试。',source:'来源',all:'全部记录',old:'旧记录优先',recent:'新记录优先'}];
const locale=()=>/^zh/i.test(document.documentElement.lang)?2:/^en/i.test(document.documentElement.lang)?1:0;
const owner=()=>document.querySelector('.cabinet-app[data-cabinet-role="owner"]');
const el=(tag,text,attrs={})=>{const e=document.createElement(tag);if(text!==null)e.textContent=text;for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
let queued=false,key='',lastView='',loading=false,request=0,source=null,query='',sort='recent',filters={version:'',role:'',status:'',priority:'',area:'',from:'',to:'',view:'all'};const nativeTitles=new WeakMap();
// The canonical archive remains read-only. Decisions are persisted through the existing
// Owner-only /api/portal-feedback lifecycle, not in browser storage.
let workItems=[],workEvents=[],workBusy='',workReady=false,workError='',workNotice='';
let executionStateByKey=new Map(),executionError='',executionRegister='',executionBusy=false;
const workWords=[
 {active:'Сейчас разрабатывается',empty:'Нет работ в активной разработке',start:'Взять в работу',working:'В работе',open:'Открыть задачу',details:'История и технические сведения',changed:'Сохранено на сервере',claimed:'Работа взята в разработку',planning:'В проекте',ready:'Готово к проверке',released:'Выпущено',blocked:'Выпуск не разрешён',partial:'Частично готово',unverified:'Не проверено',proposed:'Зарегистрировано',rejected:'Отклонено',finished:'Работа завершена',sourceName:'Из какого реестра',subtitle:'Название, понятный статус и действия. Код скрыт в истории.'},
 {active:'Work in progress',empty:'No active development tasks',start:'Start work',working:'In progress',open:'Open task',details:'History and technical details',changed:'Saved to server',claimed:'Work started',planning:'Planned',ready:'Ready for verification',released:'Released',blocked:'Release blocked',partial:'Partially done',unverified:'Unverified',proposed:'Registered',rejected:'Rejected',finished:'Completed',sourceName:'Source register',subtitle:'Plain-language summary, status and actions. Technical metadata is in history.'},
 {active:'当前开发工作',empty:'暂无进行中的开发任务',start:'开始处理',working:'进行中',open:'打开任务',details:'历史和技术信息',changed:'已保存到服务器',claimed:'已开始开发',planning:'已计划',ready:'待验证',released:'已发布',blocked:'禁止发布',partial:'部分完成',unverified:'未验证',proposed:'已登记',rejected:'已拒绝',finished:'已完成',sourceName:'来源登记册',subtitle:'清晰的摘要、状态和操作。技术信息折叠在历史中。'}
];
const statusNames={sent:['Новое','New','新建'],read:['Прочитано','Read','已阅'],evaluated:['Оценено','Evaluated','已评估'],in_progress:['В работе','In progress','进行中'],release:['Готовится к выпуску','Preparing release','准备发布'],completed:['Завершено','Completed','已完成'],denied:['Отклонено','Rejected','已拒绝']};

// Progress is the count of confirmed workflow stages, not an estimate of coding time.
// Every stage comes from the Owner-only, server-stored work-item status.
const workStages={sent:1,read:2,evaluated:3,in_progress:4,release:5,completed:6};
const workStageNames=[
 ['Зарегистрировано','Прочитано','Оценено','В разработке','Проверка и выпуск','Принято владельцем'],
 ['Registered','Read','Evaluated','In development','Verification and release','Accepted by Owner'],
 ['已登记','已阅读','已评估','开发中','测试与发布','所有者已验收']
];
function workMeter(item){
 const l=locale(),raw=String(item?.status||''),stage=workStages[raw]||0;
 const names=workStageNames[l],percent=Math.round(stage/6*100);
 const caption=stage?(names[stage-1]+' · '+stage+'/6 · '+percent+'%'):['Этап не подтверждён','Stage unverified','阶段未验证'][l];
 const wrap=el('div',null,{class:'ow-task-progress','data-work-status':raw,'data-stage':String(stage)});
 const label=el('div',null,{class:'ow-task-progress-label'});
 label.append(el('span',caption));
 const when=Date.parse(item?.started_at||item?.startedAt||'');
 if(Number.isFinite(when)&&['in_progress','release'].includes(raw)){
  const elapsed=Math.max(0,Math.round((Date.now()-when)/60000)),hours=Math.floor(elapsed/60),minutes=String(elapsed%60).padStart(2,'0');
  const expired=elapsed>120,clock=el('small',(expired?['Срок 2 ч превышен: ','Over 2-hour limit: ','超过2小时限制：'][l]:['С начала: ','Elapsed: ','已用时：'][l])+hours+':'+minutes,{class:expired?'ow-task-overdue':'ow-task-clock'});
  label.append(clock);
 }
 wrap.append(label);
 const meter=el('div',null,{class:'ow-task-progress-track',role:'progressbar','aria-label':['Этапы задачи','Task stages','任务阶段'][l],'aria-valuemin':'0','aria-valuemax':'6','aria-valuenow':String(stage)});
 meter.append(el('span',null,{class:'ow-task-progress-fill',style:'width:'+percent+'%'}));
 wrap.append(meter);
 return wrap;
}

const plain=x=>String(x??'').replace(/\s+/g,' ').trim();
const short=(x,max=190)=>plain(x).slice(0,max);
const archiveMarker=(id,recordId)=>'[ARCHIVE:'+id+':'+recordId+']';
const taskFor=(id,recordId)=>{
 const row=source?.records?.find(x=>x.id===recordId),marker=row?.sourceTaskKey?'[WORK:'+row.sourceTaskKey+']':'';
 return workItems.find(x=>x.sender_role==='owner'&&(String(x.description||'').includes(archiveMarker(id,recordId))||marker&&String(x.description||'').includes(marker)));
};
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
 try{
  const items=[],events=[];let offset=0;
  for(;;){const response=await fetch('/api/portal-feedback?offset='+offset,{cache:'no-store'}),data=await response.json();
   if(!response.ok||!data.ok||!data.owner)throw Error('OWNER_ACCESS_REQUIRED');
   items.push(...(data.items||[]));events.push(...(data.events||[]));
   if(!data.hasMore)break;offset=data.nextOffset;
  }
  workItems=items;workEvents=events;workError='';workReady=true;
 }catch(e){workError=String(e.message||e);workReady=true;if(!silent)throw e;}
}
async function refreshExecution(register){
 if(executionBusy||!['remarks','developments','updates'].includes(register))return;
 executionBusy=true;
 try{
  const response=await fetch('/api/owner-register-execution?register='+encodeURIComponent(register),{cache:'no-store'});
  const data=await response.json();
  if(!response.ok||!data.ok)throw Error(data.error||'HTTP '+response.status);
  if(selected()!==register)return;
  executionStateByKey=new Map((data.items||[]).filter(x=>x.register===register&&x.recordId).map(x=>[register+':'+x.recordId,x]));
  executionRegister=register;executionError='';
 }catch(e){executionError=String(e.message||e);executionStateByKey=new Map();}
 finally{executionBusy=false;}
}
async function executeRecordAction(payload){
 const id=payload.register;
 if(!['remarks','developments','updates'].includes(id)||workBusy)throw Error('ACTION_BUSY');
 workBusy=id+':'+payload.recordId;executionError='';workNotice='';
 const call=async body=>{
  const response=await fetch('/api/owner-register-execution',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let data;try{data=await response.json()}catch{data={error:'HTTP '+response.status}}
  if(!response.ok||!data.ok)throw Error((data.error||'HTTP '+response.status)+(data.detail?' · '+data.detail:''));
  return data;
 };
 try{
  const first=await call(payload);
  // The Owner sets a deadline and triggers dispatch only from the Improvement Center.
  if(payload.action==='transfer'&&!first.transferred&&!first.already)throw Error('TRANSFER_NOT_CONFIRMED');
  workNotice='Решение сохранено на сервере. Статус GitHub подтверждён отдельно.';
 }catch(e){executionError=String(e.message||e);throw e;}
 finally{
  workBusy='';await refreshWork(true);await refreshExecution(id);
  const host=document.getElementById('ow-workspace');if(host&&selected()===id)paintArchive(host,id);
 }
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
   body.append(workMeter(item));
   const action=el('button',w.open,{type:'button'});action.onclick=()=>{navigate('');location.hash='#portal-feedback';};
   card.append(body,action);list.append(card);
  }panel.append(list);
 }else if(workReady&&!workError)panel.append(el('p',w.empty,{class:'ow-board-help'}));
 const open=el('button',['Центр доработок — все задания','Development center — all tasks','开发中心 — 全部任务'][l],{type:'button',class:'ow-board-link'});
 open.onclick=()=>{navigate('');location.hash='#portal-feedback';};panel.append(open);host.append(panel);
}
async function startWork(id,recordId,title,description){
 if(workBusy)return;
 const row=source?.records?.find(x=>x.id===recordId);
 if(!row)return;
 const existing=taskFor(id,recordId);
 if(existing&&['in_progress','release'].includes(existing.status)){workNotice='Задача уже находится в работе';paintArchive(document.getElementById('ow-workspace'),id);return;}
 const accepted=await confirmWork(row);
 if(!accepted)return;
 workBusy=archiveMarker(id,recordId);workError='';workNotice='';const original=id;
 try{
  const result=await feedbackRequest({action:'start_register',register:id,recordId});
  await refreshWork();
  const readback=taskFor(id,recordId);
  if(!readback||!['in_progress','release'].includes(readback.status))throw Error('TASK_NOT_IN_PROGRESS');
  workNotice=result.message||'Задача взята в работу';
 }catch(e){workError=String(e.message||e);await refreshWork(true);}
 finally{workBusy='';const host=document.getElementById('ow-workspace');if(host&&selected()===original)paintArchive(host,id);}
}
function confirmWork(row){
 return new Promise(resolve=>{
  const dialog=el('dialog',null,{class:'ow-work-confirm','aria-label':'Подтвердить выбор задачи'});
  dialog.append(el('h2','Взять в работу: '+row.title),el('p',row.description),el('p','Последствия: '+row.impact));
  const actions=el('div',null,{class:'ow-human-actions'}),yes=el('button','Подтвердить',{type:'button'}),no=el('button','Отмена',{type:'button'});
  const done=value=>{dialog.close();dialog.remove();resolve(value);};yes.onclick=()=>done(true);no.onclick=()=>done(false);dialog.oncancel=e=>{e.preventDefault();done(false);};actions.append(yes,no);dialog.append(actions);document.body.append(dialog);dialog.showModal();yes.focus();
 });
}

const selected=()=>new URL(location.href).searchParams.get('ownerView')||'';
function navigate(id){const u=new URL(location.href);if(id)u.searchParams.set('ownerView',id);else u.searchParams.delete('ownerView');history.pushState({},'',u);key='';source=null;query='';filters={version:'',role:'',status:'',priority:'',area:'',from:'',to:'',view:'all'};request++;loading=false;schedule();window.dispatchEvent(new Event('ow-workspace-changed'));}
function sections(){if(!source)return[];return (source.legacyEntries||source.markdown.split(/(?=^## )/m).map((text,i)=>({id:'archive-'+i,markdown:text}))).map(x=>({id:x.id,text:x.markdown}));}
const humanStatuses={accepted:'Принято владельцем',new:'Новое',awaiting_decision:'Ожидает решения',in_progress:'В работе',fixed_review:'Исправлено, ожидает проверки',checking:'Проверяется',ready:'Готово к выпуску',published:'Опубликовано',production_verified:'Проверено в рабочей среде',rejected:'Отклонено',deferred:'Отложено'};
const priorityNames={P0:'Критический',P1:'Высокий',P2:'Обычный',P3:'Низкий'};
const roleNames={owner:'Владелец',carrier:'Перевозчик',ved:'ВЭД',logistic:'ВЭД / логист',supplier:'Поставщик',visitor:'Посетитель',designer:'Дизайнер',content:'Контент',purchasing:'Закупки',certification:'Сертификация'};
const recordState=(row,job)=>{
 const current=row?.status||'new';
 // Business publication is distinct from work-item status. A completed
 // engineering task cannot silently erase a verified production release.
 if(current==='published'||current==='production_verified')return current;
 if(job?.status==='denied')return 'rejected';
 if(job?.status==='in_progress')return 'in_progress';
 if(job?.status==='release')return 'checking';
 // Owner has completed the work item, not necessarily its release QA.
 if(job?.status==='completed')return ['fixed_review','checking','ready'].includes(current)?current:'accepted';
 return current;
};
const finished=(s,job)=>job?.status==='completed';
function paintArchive(host,id){
 host.dataset.archiveName=id;host.dataset.archiveReady=String(!loading&&!!source&&source.name===id);
 host.replaceChildren(el('h2',names[id][locale()]));
 const toolbar=el('div',null,{class:'ow-toolbar ow-stable-toolbar'}),search=el('input',null,{type:'search',placeholder:'Поиск по названию и описанию','aria-label':'Поиск по названию и описанию'});
 search.value=query;const refresh=el('button','Обновить',{type:'button'});refresh.onclick=()=>void load(id,host);
 const sortControl=el('select',null,{'aria-label':'Порядок записей'});for(const [v,t]of [['recent','Сначала новые'],['old','Сначала старые']])sortControl.append(el('option',t,{value:v}));sortControl.value=sort;
 toolbar.append(search,sortControl,refresh);host.append(toolbar);
 const rows=source?.records||[],views=el('div',null,{class:'ow-tabs','aria-label':'Показать записи'});
 const currentState=(row,job)=>{const e=executionStateByKey.get(id+':'+row.id);return e?.decision==='deferred'?'deferred':e?.decision==='rejected'?'rejected':e?.decision==='review_pending'?'checking':e?.decision==='accepted'?'accepted':e?.decision==='in_progress'?'in_progress':recordState(row,job);};
 for(const [value,title]of [['all','Все'],['today','Сегодня'],['new','Новые'],['working','В работе'],['done','Выполненные'],['selected','Выбранные владельцем'],['archive','Архив']]){
  const button=el('button',title,{type:'button','aria-pressed':String(filters.view===value),'data-register-view':value});button.onclick=()=>{filters.view=value;paintArchive(host,id);};views.append(button);
 }
 host.append(views);
 const filterbar=el('div',null,{class:'ow-toolbar ow-register-filters'});
 const values={status:Object.keys(humanStatuses),priority:Object.keys(priorityNames),role:[...new Set(rows.flatMap(x=>x.roles||[]))],area:[...new Set(rows.map(x=>x.area))],version:[...new Set(rows.map(x=>x.version))]};
 for(const [key,title]of [['status','Статус'],['priority','Приоритет'],['role','Кабинет'],['area','Раздел портала'],['version','Версия']]){
  const wrap=el('label',title),select=el('select',null,{'data-archive-filter':key});select.append(el('option','Все',{value:''}));
  for(const v of values[key])select.append(el('option',key==='status'?humanStatuses[v]:key==='priority'?priorityNames[v]:key==='role'?roleNames[v]||v:v,{value:v}));select.value=filters[key]||'';select.onchange=()=>{filters[key]=select.value;draw();};wrap.append(select);filterbar.append(wrap);
 }
 for(const [key,title]of [['from','С даты'],['to','По дату']]){const wrap=el('label',title),input=el('input',null,{type:'date','data-archive-filter':key});input.value=filters[key];input.oninput=()=>{filters[key]=input.value;draw();};wrap.append(input);filterbar.append(wrap);}
 const extra=el('details',null,{class:'ow-extra-filters'});extra.append(el('summary','Фильтры'),filterbar);host.append(extra);
 const count=el('p',null,{class:'ow-register-count',role:'status'}),notice=el('p',workNotice||workError||executionError,{role:workError||executionError?'alert':'status'}),target=el('div',null,{id:'ow-archive-records'});host.append(count,notice,target);
 search.oninput=()=>{query=search.value;draw();};sortControl.onchange=()=>{sort=sortControl.value;draw();};
 function draw(){
  target.replaceChildren();const term=query.toLocaleLowerCase(),view=filters.view;
  const transferred=row=>{
   const work=taskFor(id,row.id),exec=executionStateByKey.get(id+':'+row.id);
   return Boolean(exec?.feedbackId||work&&['in_progress','release','completed'].includes(work.status));
  };
  const unfinished=rows.filter(row=>!row.archived&&!transferred(row)&&!finished(currentState(row,taskFor(id,row.id)),taskFor(id,row.id))).length;
  count.textContent='Незавершённых записей: '+unfinished;
  const visible=rows.filter(row=>{
   const job=taskFor(id,row.id),status=currentState(row,job),date=/^\d{4}-\d{2}-\d{2}/.test(row.detectedAt||'')?String(row.detectedAt).slice(0,10):'';
   return (row.title+' '+row.description).toLocaleLowerCase().includes(term)&&(!filters.status||status===filters.status)&&(!filters.priority||row.priority===filters.priority)&&(!filters.role||row.roles.includes(filters.role))&&(!filters.area||row.area===filters.area)&&(!filters.version||row.version===filters.version)&&(!filters.from||date>=filters.from)&&(!filters.to||date<=filters.to)&&
    (view==='all'||view==='today'&&date===minskDay()||view==='archive'&&(row.archived||job?.status==='denied'||finished(status,job))||view==='new'&&!row.archived&&['new','awaiting_decision'].includes(status)||view==='working'&&status==='in_progress'||view==='done'&&finished(status,job)||view==='selected'&&!!job);
  }).sort((a,b)=>String(/^\d{4}-/.test(a.detectedAt)?a.detectedAt:'').localeCompare(String(/^\d{4}-/.test(b.detectedAt)?b.detectedAt:''))*(sort==='old'?1:-1));
  if(view==='done'&&!visible.length)target.append(el('p','Пока нет работ, лично подтверждённых владельцем. Технические исправления находятся в «Реестре приёмки владельцем».',{class:'ow-board-help'}));
  for(const row of visible){
   const job=taskFor(id,row.id),state=currentState(row,job),execution=executionStateByKey.get(id+':'+row.id),card=el('article',null,{class:'ow-work-card','data-record-id':row.id}),heading=el('div',null,{class:'ow-work-card-top'});
   const badge=el('span',humanStatuses[state]||'Ожидает решения',{class:'ow-human-status'});if(state==='in_progress')badge.dataset.state='working';heading.append(el('h3',row.title),badge);card.append(heading);if(row.historyOnly)card.append(el('p','Историческая запись. Текущий статус не подтверждён; активная работа не создаётся.',{class:'ow-board-help'}));
   const facts=el('dl',null,{class:'ow-register-facts'}),fact=(label,value)=>{if(!value)return;facts.append(el('dt',label),el('dd',value));};
   fact('Раздел портала',row.area);fact('Участники',(row.roles||[]).map(x=>roleNames[x]||x).join(', '));fact('Приоритет',priorityNames[row.priority]);
   card.append(facts,el('p',row.description,{class:'ow-human-description'}));
   if(row.expected||row.impact){card.append(el('strong',['Ожидаемый результат','Expected result','预期结果'][locale()],{class:'ow-expected-title'}),el('p',row.expected||row.impact,{class:'ow-expected-result'}));}
   const more=el('details',null,{class:'ow-record-details'});more.append(el('summary','Подробнее'));
   const details=el('dl',null,{class:'ow-register-facts'}),detail=(label,value)=>{if(value)details.append(el('dt',label),el('dd',value));};
   detail(id==='developments'?'Что требуется улучшить':id==='updates'?'Что изменилось':'Описание',row.description);detail('Правильная работа',row.expected);detail(id==='developments'?'Польза изменения':'Последствия',row.impact);detail('Причина исправления',row.reason);detail('Дата обнаружения',row.technical?.datePrecision==='unknown'?'В исходной записи не указана':row.technical?.datePrecision==='day'?new Date(row.detectedAt).toLocaleDateString('ru-RU'):row.detectedAt?new Date(row.detectedAt).toLocaleString('ru-RU',{timeZone:'Europe/Minsk'}):'');detail('Версия',row.version);detail('Ответственный',row.responsible);detail('Проверка',row.verification);more.append(details);card.append(more);
   // Stage 1 preview: identical task controls in updates, remarks and developments.
   // No database write or GitHub workflow is performed by these three buttons.
   if(transferred(row)){
    const link=el('a','Задача перенесена в Центр доработок — открыть',{href:'#portal-feedback',class:'ow-board-link'});
    link.onclick=e=>{e.preventDefault();navigate('');location.hash='#portal-feedback';};card.append(link);
   }else{
    const taskControls=window.OWRegisterTaskActions?.render({register:id,row,job,state,execution,onAction:executeRecordAction});
    if(!taskControls)throw Error('OWNER_REGISTER_TASK_UI_MISSING');
    card.append(taskControls);
   }
   const actions=el('div',null,{class:'ow-human-actions'});
   const history=el('details',null,{class:'ow-technical-history'});history.append(el('summary','История изменений'));
   const events=workEvents.filter(x=>x.request_id===job?.id);
   for(const event of events)history.append(el('p',new Date(event.created_at).toLocaleString('ru-RU',{timeZone:'Europe/Minsk'})+' · '+event.description+' · '+event.actor_login));
   if(!events.length)history.append(el('p','Решение владельца ещё не зафиксировано. Источник и прежние проверки — в технической информации.'));
   if(job){const open=el('a','Открыть существующую задачу',{href:'#portal-feedback'});open.onclick=e=>{e.preventDefault();navigate('');location.hash='#portal-feedback';};history.append(open);}
   actions.append(history);card.append(actions);
   const technical=el('details',null,{class:'ow-technical-history'});technical.append(el('summary','Техническая информация'),el('pre',JSON.stringify({id:row.id,sourceTaskKey:row.sourceTaskKey,...row.technical},null,2)));card.append(technical);target.append(card);
  }
  if(!visible.length)target.append(el('p',loading?'Загрузка…':'Подходящих записей нет'));
  if(view==='archive'){const original=el('details',null,{class:'ow-technical-history'});original.append(el('summary','Полный исходный архив и техническая история'),el('pre',source?.markdown||'Архив загружается…'));target.append(original);}
 }
 draw();
}

async function load(id,host,expected){
 if(loading)return;loading=true;let failed=false;const n=++request;paintArchive(host,id);
 try{const r=await fetch('/api/engineering-registers?name='+encodeURIComponent(id)+(expected?'&expectedSha='+encodeURIComponent(expected):''),{cache:'no-store'});const data=await r.json();if(n!==request||selected()!==id)return;
  if(r.status===409){failed=true;const p=el('p',words[locale()].conflict,{role:'alert'}),button=el('button',words[locale()].refresh,{type:'button'});button.onclick=()=>{source=null;load(id,host);};host.append(p,button);return;}
  if(!r.ok||!data.ok)throw Error('HTTP '+r.status);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.markdown)))).map(x=>x.toString(16).padStart(2,'0')).join('');if(digest!==data.sha256)throw Error('SOURCE_DIGEST_MISMATCH');source=data;
 }catch(e){failed=true;if(n===request)host.append(el('p',words[locale()].error+' '+e.message,{role:'alert'}));}
 finally{if(n===request){loading=false;if(!failed){await refreshWork(true);await refreshExecution(id);paintArchive(host,id);}}}
}

let acceptanceRows=[],acceptanceReady=false,acceptanceBusy=false,acceptanceError='',acceptanceView='today',acceptanceNote='',acceptanceRevisions={},acceptanceExecutions=new Map();
const minskDay=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Minsk',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
const acceptanceTaskFor=row=>{
 const marker=row.sourceTaskKey?'[WORK:'+row.sourceTaskKey+']':'';
 return workItems.find(x=>x.sender_role==='owner'&&
   (String(x.description||'').includes(archiveMarker(row.register,row.id))||
    (marker&&String(x.description||'').includes(marker))));
};
const acceptanceExecutionFor=row=>acceptanceExecutions.get(row.register+':'+row.id);
const acceptedByOwner=row=>acceptanceTaskFor(row)?.status==='completed'||acceptanceExecutionFor(row)?.decision==='accepted';
function approvalState(row,job){
 if(job?.status==='completed')return 'Опубликовано и в архиве';
 if(job?.status==='denied')return 'Отклонено';
 const exec=acceptanceExecutionFor(row);
 if(exec?.decision==='accepted')return 'Принято; ожидает публикации';
 if(exec?.decision==='review_pending')return 'На приёмке владельца';
 if(job?.status==='release')return 'Устаревший статус: требуется сверка';
 if(job?.status==='in_progress')return 'В работе';
 if(['fixed_review','checking','ready','published','production_verified'].includes(row.status))
   return 'Техническое исправление · приёмка не подтверждена';
 return 'Зарегистрировано / ожидает работ';
}
async function refreshAcceptance(){
 if(acceptanceBusy)return;acceptanceBusy=true;acceptanceError='';
 const host=document.getElementById('ow-workspace');
 try{
  const records=[],nextRevisions={},nextExecutions=new Map();
  for(const id of ['remarks','developments','updates']){
   const response=await fetch('/api/engineering-registers?name='+id,{cache:'no-store'});
   const data=await response.json();
   if(!response.ok||!data.ok||data.name!==id)throw Error('Не удалось получить приватный источник: '+id+' (HTTP '+response.status+')');
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.markdown)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   if(sha!==data.sha256)throw Error('Несовпадение контрольной суммы: '+id);
   records.push(...(data.records||[]));
   nextRevisions[id]=data.liveRevision||'';
   const er=await fetch('/api/owner-register-execution?register='+id,{cache:'no-store'});
   const ex=await er.json();
   if(!er.ok||!ex.ok)throw Error('Не удалось подтвердить статусы приёмки: '+id);
   for(const entry of ex.items||[])if(entry.recordId)nextExecutions.set(id+':'+entry.recordId,entry);
  }
  await refreshWork();
  acceptanceRevisions=nextRevisions;
  acceptanceExecutions=nextExecutions;
  acceptanceRows=records;
  acceptanceReady=true;acceptanceNote='';
 }catch(e){acceptanceError=String(e.message||e);acceptanceReady=true;}
 finally{acceptanceBusy=false;if(host&&selected()==='acceptance')paintAcceptance(host);}
}
async function createAcceptanceJob(row){
 if(acceptanceBusy)return;
 const accepted=await confirmWork(row);
 if(!accepted)return;
 acceptanceBusy=true;acceptanceError='';
 try{
  const response=await fetch('/api/owner-register-execution',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'transfer',register:row.register,recordId:row.id})});
  const result=await response.json();
  if(!response.ok||!result.ok)throw Error(result.error||'TRANSFER_FAILED');
  await refreshWork(true);
  acceptanceNote='Задача связана с реестром. Приёмка, обязательный комментарий и архивирование выполняются в Центре доработок.';
 }catch(e){acceptanceError=String(e.message||e);}
 finally{acceptanceBusy=false;const host=document.getElementById('ow-workspace');if(host&&selected()==='acceptance')paintAcceptance(host);}
}
function paintAcceptance(host){
 host.dataset.archiveName='acceptance';
 host.dataset.archiveReady=String(acceptanceReady&&!acceptanceBusy&&!acceptanceError);
 host.replaceChildren(el('h2','Реестр приёмки владельцем'));
 host.append(el('p','Четвёртый инженерный журнал. Сюда собираются замечания, разработки и обновления. «Выполнено» означает только личное подтверждение владельца, сохранённое сервером.',{class:'ow-board-help'}));
 const controls=el('div',null,{class:'ow-tabs','aria-label':'Период и статус приёмки'});
 for(const [key,label] of [['today','Сегодня'],['pending','Ожидают подтверждения'],['accepted','Приняты владельцем'],['all','Все работы']]){
  const b=el('button',label,{type:'button','aria-pressed':String(acceptanceView===key)});
  b.onclick=()=>{acceptanceView=key;paintAcceptance(host);};controls.append(b);
 }
 const refresh=el('button','Обновить',{type:'button'});refresh.disabled=acceptanceBusy;refresh.onclick=()=>void refreshAcceptance();controls.append(refresh);host.append(controls);
 if(acceptanceError)host.append(el('p',acceptanceError,{role:'alert'}));
 if(acceptanceNote)host.append(el('p',acceptanceNote,{role:'status'}));
 if(!acceptanceReady){host.append(el('p','Загружаются защищённые журналы…'));return;}
 const day=minskDay();
 const selectedRows=acceptanceRows.filter(row=>{
  const job=acceptanceTaskFor(row);
  if(acceptanceView==='today')return String(row.detectedAt||'').slice(0,10)===day;
  if(acceptanceView==='accepted')return acceptedByOwner(row);
  if(acceptanceView==='pending')return job?.status==='release'||(['fixed_review','checking','ready','published','production_verified'].includes(row.status)&&job?.status!=='completed');
  return true;
 }).sort((a,b)=>String(b.detectedAt||'').localeCompare(String(a.detectedAt||''))||String(a.id).localeCompare(String(b.id)));
 const count=selectedRows.length,accepted=selectedRows.filter(acceptedByOwner).length;
 host.append(el('p','Записей: '+count+' · Принято владельцем: '+accepted+' · Без подтверждения: '+(count-accepted),{class:'ow-register-count'}));
 const wrap=el('div',null,{id:'ow-acceptance-records'});
 for(const row of selectedRows){
  const job=acceptanceTaskFor(row),card=el('article',null,{class:'ow-work-card','data-record-id':row.id});
  const heading=el('div',null,{class:'ow-work-card-top'});
  heading.append(el('h3',row.title),el('span',approvalState(row,job),{class:'ow-human-status'}));card.append(heading);
  card.append(el('p',row.id+' · '+({remarks:'Замечания',developments:'Разработки',updates:'Обновления'}[row.register]||row.register)+' · '+String(row.detectedAt||'').slice(0,10)+' · '+(row.version||'версия уточняется'),{class:'ow-board-help'}));
  card.append(el('p',row.description,{class:'ow-human-description'}));
  const more=el('details',null,{class:'ow-record-details'});
  more.append(el('summary','Ожидаемый результат и проверка'),el('p',row.expected||''),el('p',row.verification||'Проверка не подтверждена'));
  card.append(more);
  const controls=el('div',null,{class:'ow-human-actions'});
  if(job?.status==='release'){
   controls.append(el('p','Приёмка и возврат на доработку доступны в Центре доработок. Комментарий обязателен; статус выпуска подтверждается GitHub.',{class:'ow-board-help'}));
  }else if(!job&&!row.historyOnly&&!['published','production_verified','accepted'].includes(row.status)){
   const start=el('button','Связать с задачей',{type:'button'});start.disabled=acceptanceBusy;
   start.onclick=()=>void createAcceptanceJob(row);controls.append(start);
  }
  if(job){
   const open=el('button','Открыть Центр доработок',{type:'button'});
   open.onclick=()=>{navigate('');location.hash='#portal-feedback';};
   controls.append(open);
  }
  card.append(controls);wrap.append(card);
 }
 if(!selectedRows.length)wrap.append(el('p','Для выбранного фильтра записей нет. Исторические задачи доступны во вкладке «Все работы».'));
 host.append(wrap);
}

function render(){
 const cab=owner();if(!cab)return;const l=locale(),w=words[l],nav=cab.querySelector('.cabinet-sidebar nav');if(!nav)return;
 for(const help of nav.querySelectorAll('a[href="#help"]')){const t=[...help.childNodes].find(n=>n.nodeType===3);if(t&&t.textContent!==w.help)t.textContent=w.help;}
 const id=selected();if(id!==lastView){lastView=id;request++;loading=false;source=null;acceptanceReady=false;acceptanceRows=[];}cab.dataset.owRegisterView=Object.hasOwn(names,id)?id:'';const title=cab.querySelector('.cabinet-topbar h1')?.firstChild;if(title?.nodeType===3){let state=nativeTitles.get(title);if(!state){state={native:title.textContent,custom:null};nativeTitles.set(title,state);}if(title.textContent!==state.custom)state.native=title.textContent;const label=Object.hasOwn(names,id)?names[id][l]:state.native;state.custom=Object.hasOwn(names,id)?label:null;if(title.textContent!==label)title.textContent=label;}
 for(const [i,n]of Object.keys(names).entries()){
  let a=nav.querySelector('[data-ow-register="'+n+'"]');if(!a){a=el('a',null,{'data-ow-register':n});a.append(el('span',n==='process'?'◇':n==='cooperation'?'✉':'▤',{'aria-hidden':'true'}),document.createTextNode(''));nav.append(a);}
  const u=new URL(location.href);u.searchParams.set('ownerView',n);a.href=u.pathname+u.search+u.hash;const text=[...a.childNodes].find(x=>x.nodeType===3);if(text.textContent!==names[n][l])text.textContent=names[n][l];a.setAttribute('aria-current',id===n?'page':'false');a.dataset.lwOwnerGroup='registers';a.style.setProperty('--lw-owner-order',String(106+i));if(i===0)a.dataset.lwOwnerGroupStart=w.group;
 }
 const content=cab.querySelector('.cabinet-content');if(!content)return;let host=content.querySelector('#ow-workspace');
 if(!Object.hasOwn(names,id)){host?.remove();key='';return;}
 if(!host){host=el('section',null,{id:'ow-workspace','aria-live':'polite'});content.append(host);}
 const next=id+'|'+l;if(key===next&&host.hasChildNodes())return;key=next;
 if(id==='acceptance'){paintAcceptance(host);if(!acceptanceReady&&!acceptanceBusy)void refreshAcceptance();}
 else if(id==='cooperation'){host.replaceChildren(el('h2',names[id][l]),el('div',null,{id:'ow-cooperation-screen'}));window.dispatchEvent(new Event('ow-workspace-changed'));}
 else if(id==='process'){host.replaceChildren(el('h2',names[id][l]));host.append(el('p',['Действующая схема и черновики изменений. Сохранение черновика не меняет работу сайта.','Approved process map and drafts. Saving a draft does not change the running site.','已批准的流程图和草稿。保存草稿不会改变运行中的系统。'][l],{class:'ow-board-help'}),el('div',null,{id:'ow-process-editor'}));window.dispatchEvent(new Event('ow-process-editor-open'));}
 else{if(source?.name!==id)source=null;paintArchive(host,id);if(!source&&!loading)void load(id,host);}
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});}
setInterval(()=>{if(document.visibilityState==='hidden'||!owner())return;const id=selected();if(!['remarks','developments','updates'].includes(id)||!source||source.name!==id||loading||executionBusy)return;void refreshExecution(id).then(()=>{const host=document.getElementById('ow-workspace');if(host&&selected()===id)paintArchive(host,id);});},60000);
document.addEventListener('click',e=>{const a=e.target.closest?.('a[data-ow-register]');if(a&&owner()?.contains(a)){e.preventDefault();e.stopImmediatePropagation();navigate(a.dataset.owRegister);return;}if(e.target.closest?.('.cabinet-sidebar nav a')&&selected())navigate('');},true);
for(const event of ['hashchange','popstate','freight-access-updated'])window.addEventListener(event,schedule);
// Lightweight metadata polling; Owner's live registry never needs a frontend rebuild
// to display a new record. Keep unsaved dialogs intact and avoid false zero counts.
let livePollBusy=false;
async function pollLiveRegisters(){
 if(livePollBusy||document.visibilityState==='hidden'||document.querySelector('dialog[open]'))return;
 const id=selected(),host=document.getElementById('ow-workspace');
 if(!host||!['remarks','developments','updates','acceptance'].includes(id))return;
 if(id==='acceptance'&&(!acceptanceReady||acceptanceBusy))return;
 if(id!=='acceptance'&&(!source||source.name!==id||loading))return;
 livePollBusy=true;
 try{
  for(const name of (id==='acceptance'?['remarks','developments','updates']:[id])){
   const response=await fetch('/api/engineering-registers?name='+name+'&meta=1',{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const meta=await response.json();
   if(!meta.ok||!meta.liveRevision)continue;
   const known=id==='acceptance'?acceptanceRevisions[name]:source?.liveRevision;
   if(meta.liveRevision!==known){
    if(id==='acceptance')await refreshAcceptance();
    else await load(id,host);
    break;
   }
  }
 }catch(e){console.warn('Owner register live refresh unavailable',String(e?.message||e))}
 finally{livePollBusy=false}
}
setInterval(()=>void pollLiveRegisters(),30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void pollLiveRegisters()});
new MutationObserver(schedule).observe(document.getElementById('root')||document.body,{childList:true,subtree:true});new MutationObserver(()=>{key='';schedule();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});schedule();
window.owOwnerRegistersVersion='OW-REG-20261117-ACCEPTANCE';
})();
