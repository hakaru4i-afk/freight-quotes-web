/* Staging improvement center. Self-contained view; API enforces role/row authorization. */
(function(){
"use strict";
const rootId="portal-feedback-root",api="/api/portal-feedback";
const categoryLabels={improvement:"Доработка",fix:"Исправление",development:"Разработка"};
const registerLabels={remarks:"Реестр замечаний",developments:"Реестр разработок",updates:"Реестр обновлений"};
const statusLabels={sent:"Отправлено",read:"Прочитано",evaluated:"Оценено",in_progress:"В работе",release:"Выпуск",denied:"Отказано в разработке",completed:"Завершено"};
const transitions={sent:["read","denied"],read:["evaluated","denied"],evaluated:["in_progress","denied"],in_progress:["release","denied"],release:["completed","in_progress"],denied:[],completed:[]};
const titleTranslations={
 ru:{owner:"Центр доработок",author:"Предложения",new:"Создать заявку",category:"Тип обращения",choose:"Выберите тип",description:"Описание",prompt:"Опишите, что нужно изменить или разработать",submit:"Отправить",cancel:"Отмена",my:"Мои заявки",all:"Все обращения",empty:"Заявок пока нет",refresh:"Обновить",status:"Статус",register:"Реестр",created:"Создано",authorLabel:"Автор",note:"Комментарий / причина",selectStatus:"Новый статус",date:"Плановая дата публикации",save:"Изменить статус",history:"История обработки",open:"Подробнее",clear:"Выберите заявку из списка",error:"Не удалось выполнить действие",success:"Заявка отправлена и зарегистрирована",releaseHint:"Дата публикации будет видна автору и Владельцу",read:"Прочитать",summary:"Отправлено / В работе / Планируется выпуск",noAccess:"Не удалось подтвердить доступ",intro:"Обращения по улучшению сайта. Ставки и перевозки обрабатываются отдельно."},
 en:{owner:"Improvement center",author:"Suggestions",new:"Create request",category:"Request type",choose:"Select a type",description:"Description",prompt:"Describe the proposed improvement or fix",submit:"Submit",cancel:"Cancel",my:"My requests",all:"All requests",empty:"No requests yet",refresh:"Refresh",status:"Status",register:"Register",created:"Created",authorLabel:"Submitted by",note:"Comment / reason",selectStatus:"Next status",date:"Planned release date",save:"Update status",history:"History",open:"Details",clear:"Select a request",error:"Action failed",success:"Request submitted",releaseHint:"Publication date will be visible to the submitter",read:"Mark as read",summary:"Submitted / In progress / Release planned",noAccess:"Access could not be verified",intro:"Website improvement requests, separate from freight offers."},
 zh:{owner:"改进管理中心",author:"建议",new:"创建申请",category:"申请类型",choose:"选择类型",description:"说明",prompt:"请描述需要改进或修复的内容",submit:"提交",cancel:"取消",my:"我的申请",all:"所有申请",empty:"暂无申请",refresh:"刷新",status:"状态",register:"登记册",created:"创建时间",authorLabel:"提交人",note:"备注 / 原因",selectStatus:"新状态",date:"计划发布日期",save:"更新状态",history:"处理记录",open:"详情",clear:"请选择申请",error:"操作失败",success:"申请已提交",releaseHint:"发布日期对提交人可见",read:"标记已读",summary:"已提交 / 处理中 / 计划发布",noAccess:"无法验证访问权限",intro:"网站改进建议，与运输报价分开。"}
};
const byLang=(document.documentElement.lang||"ru").toLowerCase().startsWith("zh")?"zh":(document.documentElement.lang||"ru").toLowerCase().startsWith("en")?"en":"ru";
const t=()=>titleTranslations[byLang],esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let data={items:[],events:[],owner:false,role:""},loaded=false,showForm=false,draftCategory="",draftText="",selected="",registry="all",statusFilter="all",message="",error="",busy=false,lastRoot=null;
const formatTime=value=>value?new Date(value).toLocaleString(byLang==="zh"?"zh-CN":byLang==="en"?"en-GB":"ru-RU",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Minsk"}):"—";
const latestStatus=s=>statusLabels[s]||s;
const requestStatus=i=>i.status==="release"&&i.release_date?"Выпуск · "+i.release_date:latestStatus(i.status);
const categories=()=>({improvement:t().category==="Request type"?"Improvement":t().category==="申请类型"?"改进":categoryLabels.improvement,fix:byLang==="en"?"Fix":byLang==="zh"?"修复":categoryLabels.fix,development:byLang==="en"?"Development":byLang==="zh"?"开发":categoryLabels.development});
function root(){return document.getElementById(rootId);}
function notices(){return (error?'<div class="pf-error" role="alert">'+esc(error)+'</div>':"")+(message?'<div class="pf-success" role="status">'+esc(message)+'</div>':"");}
function form(){
 if(!showForm)return '<button type="button" class="pf-primary" data-pf="new">'+esc(t().new)+'</button>';
 return '<form id="pf-create" class="pf-form"><h3>'+esc(t().new)+'</h3><label>'+esc(t().category)+'<select name="category" required><option value="">'+esc(t().choose)+'</option>'+
 Object.entries(categories()).map(([key,label])=>'<option value="'+key+'"'+(draftCategory===key?' selected':'')+'>'+esc(label)+'</option>').join("")+'</select></label>'+
 (draftCategory?'<label>'+esc(t().description)+'<textarea name="description" required maxlength="5000" minlength="10" rows="6" placeholder="'+esc(t().prompt)+'">'+esc(draftText)+'</textarea><small>10–5000 '+(byLang==="en"?"characters":byLang==="zh"?"个字符":"символов")+'</small></label>':'')+
 '<div class="pf-actions"><button type="submit" class="pf-primary" '+(!draftCategory||busy?'disabled':'')+'>'+esc(t().submit)+'</button><button type="button" class="pf-secondary" data-pf="cancel">'+esc(t().cancel)+'</button></div></form>';
}
function badge(i){return '<span class="pf-status pf-status-'+esc(i.status)+'">'+esc(requestStatus(i))+'</span>';}
function itemsList(){
 let rows=data.items;
 if(data.owner){
  if(registry!=="all"){
   const ids=new Set(data.events.filter(e=>e.journal===registry).map(e=>e.request_id));
   rows=rows.filter(i=>registry==="updates"?ids.has(i.id):i.journal===registry);
  }
  if(statusFilter!=="all")rows=rows.filter(i=>i.status===statusFilter);
 }
 const filters=data.owner?'<div class="pf-filters"><label>'+esc(t().register)+'<select id="pf-register"><option value="all">'+esc(t().all)+'</option>'+
 Object.entries(registerLabels).map(([key,label])=>'<option value="'+key+'"'+(registry===key?' selected':'')+'>'+esc(label)+'</option>').join("")+'</select></label>'+
 '<label>'+esc(t().status)+'<select id="pf-status-filter"><option value="all">'+esc(t().all)+'</option>'+
 Object.entries(statusLabels).map(([k,label])=>'<option value="'+k+'"'+(statusFilter===k?' selected':'')+'>'+esc(label)+'</option>').join("")+'</select></label></div>':"";
 return filters+'<div class="pf-list">'+(rows.length?rows.map(i=>'<button type="button" class="pf-item '+(selected===i.id?'pf-selected':'')+'" data-pf-id="'+esc(i.id)+'" aria-label="'+esc(i.code)+'">'+
 '<span class="pf-item-top"><strong>'+esc(i.code)+'</strong>'+badge(i)+'</span><span class="pf-item-type">'+esc(categoryLabels[i.category]||i.category)+' · '+esc(registerLabels[i.journal]||"")+'</span>'+
 '<span class="pf-description">'+esc(i.description)+'</span><span class="pf-item-meta">'+esc(data.owner?i.sender_role+" · "+i.sender_login:formatTime(i.created_at))+'</span>'+
 (i.release_date?'<span class="pf-release">'+esc(t().date)+': '+esc(i.release_date)+'</span>':'')+
 '</button>').join(""):'<div class="pf-empty">'+esc(t().empty)+'</div>')+'</div>';
}
function detail(){
 const item=data.items.find(i=>i.id===selected);
 if(!item)return '<div class="pf-empty">'+esc(t().clear)+'</div>';
 const ev=data.events.filter(e=>e.request_id===item.id).slice().sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
 const choices=transitions[item.status]||[];
 const updateControls=data.owner&&choices.length?'<form id="pf-update" data-id="'+esc(item.id)+'" class="pf-form">'+
 '<label>'+esc(t().selectStatus)+'<select name="status" required><option value="">'+esc(t().choose)+'</option>'+
 choices.map(s=>'<option value="'+s+'">'+esc(statusLabels[s])+'</option>').join("")+'</select></label>'+
 '<label>'+esc(t().note)+'<textarea rows="3" name="note" maxlength="2000" placeholder="'+esc(t().note)+'"></textarea></label>'+
 '<label class="pf-date-field" hidden>'+esc(t().date)+'<input type="date" name="releaseDate" disabled/><small>'+esc(t().releaseHint)+'</small></label>'+
 '<button class="pf-primary" type="submit" '+(busy?'disabled':'')+'>'+esc(t().save)+'</button></form>':"";
 return '<article class="pf-detail"><div class="pf-item-top"><h3>'+esc(item.code)+'</h3>'+badge(item)+'</div>'+
 '<p class="pf-type">'+esc(categoryLabels[item.category])+' · '+esc(registerLabels[item.journal])+'</p>'+
 '<p class="pf-body">'+esc(item.description)+'</p>'+
 '<dl><dt>'+esc(t().authorLabel)+'</dt><dd>'+esc(item.sender_role+" · "+item.sender_login)+'</dd>'+
 '<dt>'+esc(t().created)+'</dt><dd>'+esc(formatTime(item.created_at))+'</dd>'+
 (item.release_date?'<dt>'+esc(t().date)+'</dt><dd>'+esc(item.release_date)+'</dd>':'')+
 (item.owner_note?'<dt>'+esc(t().note)+'</dt><dd>'+esc(item.owner_note)+'</dd>':'')+'</dl>'+
 updateControls+'<h4>'+esc(t().history)+'</h4><ol class="pf-history">'+ev.map(e=>'<li><span>'+esc(formatTime(e.created_at))+' · '+esc(statusLabels[e.status]||e.status)+'</span><small>'+esc(registerLabels[e.journal]||"")+' · '+esc(e.actor_login)+'</small><p>'+esc(e.description)+'</p></li>').join("")+'</ol></article>';
}
function render(){
 const r=root();if(!r)return;
 lastRoot=r;
 if(!loaded){r.innerHTML='<div class="pf-shell"><p>'+esc(t().refresh)+'…</p></div>';return;}
 const count=data.items.filter(i=>i.status==="sent").length,working=data.items.filter(i=>i.status==="in_progress").length,planned=data.items.filter(i=>i.status==="release").length;
 r.innerHTML='<div class="pf-shell"><header class="pf-header"><div><span class="pf-kicker">Маршрут · Development workflow</span><h1>'+esc(data.owner?t().owner:t().author)+'</h1><p>'+esc(t().intro)+'</p></div><button type="button" class="pf-secondary" data-pf="refresh">'+esc(t().refresh)+'</button></header>'+
 notices()+(data.owner?'<div class="pf-metrics"><div><strong>'+count+'</strong><span>'+esc(statusLabels.sent)+'</span></div><div><strong>'+working+'</strong><span>'+esc(statusLabels.in_progress)+'</span></div><div><strong>'+planned+'</strong><span>'+esc(statusLabels.release)+'</span></div></div>':'<div class="pf-compose">'+form()+'</div>')+
 '<div class="pf-workspace"><section class="pf-requests"><h2>'+esc(data.owner?t().all:t().my)+'</h2>'+itemsList()+'</section><section class="pf-details">'+detail()+'</section></div></div>';
}
async function apiCall(action,dataToSend){
 const opts=action==="load"?{cache:"no-store"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(dataToSend),cache:"no-store"};
 const res=await fetch(api,opts),out=await res.json().catch(()=>({}));
 if(!res.ok||!out.ok)throw Error(out.error||"HTTP "+res.status);
 return out;
}
async function load(){
 if(busy)return;
 try{const json=await apiCall("load");data=json;loaded=true;error="";if(selected&&!data.items.some(i=>i.id===selected))selected="";render();}
 catch(e){loaded=true;data={...data,items:[],events:[]};error=t().noAccess+": "+e.message;render();}
}
async function runAction(payload){
 if(busy)return;
 busy=true;error="";message="";render();
 try{const out=await apiCall("post",payload);busy=false;const preferred=out.item?.id||selected;await load();selected=preferred;if(payload.action==="create"){showForm=false;draftText="";draftCategory="";message=t().success;}else message=statusLabels[out.item?.status]||"";render();}
 catch(e){busy=false;error=t().error+": "+e.message;render();}
}
document.addEventListener("click",ev=>{
 const r=root();if(!r||!r.contains(ev.target))return;
 const id=ev.target.closest("[data-pf-id]")?.dataset.pfId;
 if(id){selected=id;render();const i=data.items.find(x=>x.id===id);if(data.owner&&i?.status==="sent")void runAction({action:"set_status",id,expectedStatus:"sent",status:"read",note:""});return;}
 const action=ev.target.closest("[data-pf]")?.dataset.pf;
 if(action==="new"){showForm=true;render();}
 if(action==="cancel"){showForm=false;draftCategory="";draftText="";render();}
 if(action==="refresh")void load();
});
document.addEventListener("input",ev=>{
 if(!root()?.contains(ev.target))return;
 if(ev.target.name==="description"&&ev.target.closest("#pf-create"))draftText=ev.target.value;
});
document.addEventListener("change",ev=>{
 if(!root()?.contains(ev.target))return;
 if(ev.target.name==="category"&&ev.target.closest("#pf-create")){draftCategory=ev.target.value;render();root()?.querySelector("#pf-create textarea")?.focus();}
 if(ev.target.id==="pf-register"){registry=ev.target.value;render();}
 if(ev.target.id==="pf-status-filter"){statusFilter=ev.target.value;render();}
 if(ev.target.name==="status"&&ev.target.closest("#pf-update")){
  const wrap=ev.target.closest("form").querySelector(".pf-date-field"),need=ev.target.value==="release";
  wrap.hidden=!need;const input=wrap.querySelector("input");input.disabled=!need;input.required=need;
 }
});
document.addEventListener("submit",ev=>{
 if(!root()?.contains(ev.target))return;
 if(ev.target.id==="pf-create"){ev.preventDefault();const f=ev.target;const desc=f.description?.value||draftText;void runAction({action:"create",category:f.category.value,description:desc});}
 if(ev.target.id==="pf-update"){ev.preventDefault();const f=ev.target,item=data.items.find(i=>i.id===f.dataset.id);if(!item)return;void runAction({action:"set_status",id:item.id,expectedStatus:item.status,status:f.elements.status.value,note:f.elements.note.value,releaseDate:f.elements.releaseDate.value});}
});
let pending=false;
const obs=new MutationObserver(()=>{
 if(pending)return;
 const r=root();
 if(!r||r===lastRoot)return;
 pending=true;requestAnimationFrame(()=>{pending=false;lastRoot=r;loaded=false;render();void load();});
});
obs.observe(document.documentElement,{childList:true,subtree:true});
if(root()){render();void load();}
})();