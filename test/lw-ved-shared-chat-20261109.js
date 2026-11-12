/* VED-CHAT-01: actual shared Owner/Carrier/VED conversation via /api/chats. No canned templates. */
(()=>{"use strict";
const SELECTOR=".lw-ved-chat-mount";
const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const trim=v=>String(v||"").trim();
const labelTime=value=>{
 if(!value)return "";
 const d=new Date(value);
 return Number.isNaN(d.valueOf())?String(value).slice(0,30):d.toLocaleString("ru-RU",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",year:"numeric",timeZone:"Europe/Minsk"});
};
let active=null;
async function api(path,body){
 const cfg=body===undefined?{method:"GET",credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json"}}:
  body instanceof FormData?{method:"POST",credentials:"same-origin",body}:
  {method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)};
 const res=await fetch(path,cfg);
 const data=await res.json().catch(()=>({error:"Сервер не вернул ответ"}));
 if(!res.ok||data.error)throw Error(data.error||"HTTP "+res.status);
 return data;
}
function notify(root,message,error=false){
 const el=root.querySelector("[data-vc-status]");
 if(el){el.textContent=message;el.dataset.error=error?"true":"false";}
}
function renderShell(root,order){
 root.innerHTML='<div class="lw-ved-chat-layout">'+
   '<div class="lw-ved-chat-header"><div><strong>Чат перевозки · '+escape(order)+'</strong>'+
   '<small>Общая переписка с владельцем и выбранным перевозчиком</small></div>'+
   '<button type="button" data-vc-refresh>Обновить</button></div>'+
   '<div class="lw-ved-chat-thread" role="log" aria-label="История сообщений" aria-live="polite">'+
   '<p class="lw-ved-chat-placeholder">Загружаем переписку…</p></div>'+
   '<form data-vc-send class="lw-ved-chat-composer">'+
   '<label>Ваше сообщение<textarea name="body" rows="3" maxlength="6000" placeholder="Напишите сообщение…" aria-label="Сообщение"></textarea></label>'+
   '<label class="lw-ved-chat-files">Прикрепить файлы (до 5)<input name="files" type="file" multiple></label>'+
   '<div class="lw-ved-chat-send-row"><span data-vc-status role="status" aria-live="polite"></span>'+
   '<button type="submit" data-vc-submit>Отправить</button></div></form></div>';
}
function renderMessages(root,payload){
 if(!root.isConnected)return;
 const thread=root.querySelector(".lw-ved-chat-thread");
 if(!thread)return;
 const wasNearBottom=thread.scrollHeight-thread.scrollTop-thread.clientHeight<85;
 const messages=Array.isArray(payload.messages)?payload.messages:[];
 const html=messages.length?messages.map(m=>{
  const mine=String(m.sender_id||"")===String(payload.viewer||"");
  const name=trim(m.sender_name)||({owner:"Владелец",carrier:"Перевозчик",logistic:"ВЭД"})[m.sender_role]||trim(m.sender_role)||"Участник";
  const files=(Array.isArray(m.files)?m.files:[]).map(f=>'<a class="lw-ved-chat-file" download href="/api/chat-files?id='+encodeURIComponent(String(f.id||""))+'">📎 '+escape(f.name||"Файл")+'</a>').join("");
  return '<article class="lw-ved-chat-message'+(mine?" mine":"")+'"><div class="lw-ved-chat-meta"><strong>'+
   escape(name)+'</strong><time>'+escape(labelTime(m.created))+'</time></div>'+
   (m.body?'<p>'+escape(m.body)+'</p>':"")+(files?'<div class="lw-ved-chat-attachments">'+files+'</div>':"")+'</article>';
 }).join(""):'<p class="lw-ved-chat-placeholder">Сообщений пока нет. Напишите первое сообщение.</p>';
 const current=thread.innerHTML;
 if(current!==html){thread.innerHTML=html;if(wasNearBottom||!root.dataset.chatRendered)thread.scrollTop=thread.scrollHeight;}
 root.dataset.chatRendered="yes";
 const form=root.querySelector("[data-vc-send]");
 const canWrite=Boolean(payload.writable);
 if(form){form.hidden=!canWrite;form.querySelector("button[type=submit]").disabled=!canWrite;}
 if(!canWrite){
  const msg=payload.reason||"Переписка доступна только для просмотра";
  notify(root,msg,false);
 }
}
async function resolve(order){
 const list=await api("/api/chats");
 const chat=(list.chats||[]).find(x=>x.order_code===order&&x.source_kind==="request");
 if(chat)return chat.id;
 const candidate=(list.awards||[]).find(x=>x.order_code===order&&x.source_kind==="request");
 if(!candidate)throw Error("Общий чат недоступен: перевозка ещё не принята в работу либо доступ ограничен.");
 const opened=await api("/api/chats",{action:"open",kind:"request",sourceId:candidate.source_id,awardId:candidate.award_id});
 if(!opened.id)throw Error("Сервер не подтвердил открытие чата.");
 return opened.id;
}
async function refresh(root,{first=false}={}){
 if(!root?.isConnected||!root.dataset.vedChatId||root.dataset.vedLoading==="true")return;
 root.dataset.vedLoading="true";
 try{
  const requestChatId=root.dataset.vedChatId;
  const result=await api("/api/chats?id="+encodeURIComponent(requestChatId));
  if(root.isConnected&&root.dataset.vedChatId===requestChatId){
   renderMessages(root,result);
   if(result.lastSeq>0&&result.writable!==undefined){
    api("/api/chats",{action:"read",id:root.dataset.vedChatId,seq:result.lastSeq}).catch(()=>{});
   }
   if(first)notify(root,"");
  }
 }catch(e){if(root.isConnected)notify(root,"Не удалось обновить чат: "+e.message,true);}
 finally{if(root.isConnected)root.dataset.vedLoading="false";}
}
async function init(root){
 const order=trim(root.dataset.lwVedChatOrder);
 if(!order)return;
 root.dataset.vedInit=order;
 root.dataset.vedChatId="";
 renderShell(root,order);
 active=root;
 try{
  const id=await resolve(order);
  if(!root.isConnected||root.dataset.vedInit!==order)return;
  root.dataset.vedChatId=id;
  await refresh(root,{first:true});
 }catch(e){if(root.isConnected){root.querySelector(".lw-ved-chat-thread").innerHTML='<p class="lw-ved-chat-placeholder">'+escape(e.message)+'</p>';root.querySelector("[data-vc-send]").hidden=true;notify(root,e.message,true);}}
}
let scanScheduled=false;
const PAGE_ID="lw-ved-chat-page";
function vedCabinet(){
 if(document.querySelector('.cabinet-app[data-addressed-logistic="true"]'))return null;
 return [...document.querySelectorAll(".cabinet-app")].find(c=>
  c.dataset.cabinetRole==="ved"||
  (c.dataset.cabinetRole==="logistic"&&/ВЭД/.test(c.querySelector(".cabinet-role")?.textContent||""))||
  /Кабинет ВЭД/.test(c.querySelector(".cabinet-role")?.textContent||"")
 )||null;
}
let pageListLoaded=0,pageBusy=false;
function setupPage(){
 const cabinet=vedCabinet();if(!cabinet)return;
 const nav=cabinet.querySelector(".cabinet-sidebar nav");
 if(nav&&!nav.querySelector('a[href="#chats"]')){
  const link=document.createElement("a");link.href="#chats";link.textContent="Чаты по заявкам";link.className="lw-ved-chat-menu-link";
  const after=nav.querySelector('a[href="#approved-shipments"]');
  if(after)after.insertAdjacentElement("afterend",link);else nav.append(link);
 }
 const home=cabinet.querySelector('.cabinet-panel[data-section="overview"]');
 if(!home)return;
 let page=cabinet.querySelector("#"+PAGE_ID);
 if(!page){
  page=document.createElement("section");
  page.id=PAGE_ID;page.className="cabinet-panel lw-ved-chat-page";
  page.innerHTML='<div class="lw-ved-chat-page-heading"><h2>Чаты по заявкам</h2><p>Реальная переписка по принятым перевозкам: Владелец · Перевозчик · ВЭД. Без шаблонных сообщений.</p></div>'+
   '<div class="lw-ved-chat-orders"><div data-vc-orders>Открываем список чатов…</div><button type="button" data-vc-list-refresh>Обновить список</button></div>'+
   '<div class="lw-ved-chat-mount" data-lw-ved-chat-order=""></div>';
  home.parentElement.append(page);
 }
 const current=location.hash==="#chats";
 cabinet.classList.toggle("lw-ved-chat-active",current);
 if(current&&(!pageListLoaded||Date.now()-pageListLoaded>60000)&&!pageBusy)loadPageChats(page);
}
async function loadPageChats(page,prefer=""){
 if(pageBusy)return;pageBusy=true;
 const list=page.querySelector("[data-vc-orders]");if(list)list.textContent="Проверяем доступные перевозки…";
 try{
  const result=await api("/api/chats");
  if(!page.isConnected)return;
  const dedupe=new Map();
  for(const x of [...(result.chats||[]),...(result.awards||[])]){
   if(x.source_kind!=="request"||!x.order_code)continue;
   if(!dedupe.has(x.order_code))dedupe.set(x.order_code,x);
  }
  const options=[...dedupe.values()];
  const chosen=prefer||page.querySelector(SELECTOR)?.dataset.lwVedChatOrder||options[0]?.order_code||"";
  if(list)list.innerHTML=options.length?options.map(x=>
   '<button type="button" data-vc-order="'+escape(x.order_code)+'"'+
   (x.order_code===chosen?' class="is-current"':"")+'>'+
   '<span>'+escape(x.order_code)+'</span>'+(Number(x.unread)>0?'<b>'+Number(x.unread)+'</b>':"")+
   '</button>').join(""):'<p>Пока нет перевозок с доступной перепиской.</p>';
  const mount=page.querySelector(SELECTOR);
  if(mount&&chosen&&dedupe.has(chosen)&&mount.dataset.lwVedChatOrder!==chosen){
   mount.dataset.lwVedChatOrder=chosen;
   mount.dataset.vedInit="";
   init(mount);
  }
  pageListLoaded=Date.now();
 }catch(e){if(list)list.textContent="Не удалось получить список чатов: "+e.message;}
 finally{pageBusy=false;}
}
document.addEventListener("click",event=>{
 const order=event.target.closest("#"+PAGE_ID+" [data-vc-order]");
 if(order){
  const page=order.closest("#"+PAGE_ID);
  const mount=page?.querySelector(SELECTOR);
  if(mount){
   for(const option of page.querySelectorAll("[data-vc-order]"))option.classList.toggle("is-current",option===order);
   mount.dataset.lwVedChatOrder=order.dataset.vcOrder;
   mount.dataset.vedInit="";
   init(mount);
  }
 }
 const reload=event.target.closest("#"+PAGE_ID+" [data-vc-list-refresh]");
 if(reload)loadPageChats(reload.closest("#"+PAGE_ID));
});

function scan(){
 setupPage();
 for(const el of document.querySelectorAll(SELECTOR)){
  const order=trim(el.dataset.lwVedChatOrder);
  if(order&&el.dataset.vedInit!==order)init(el);
 }
}
function schedule(){
 if(scanScheduled)return;
 scanScheduled=true;
 requestAnimationFrame(()=>{scanScheduled=false;scan();});
}
document.addEventListener("submit",async ev=>{
 const form=ev.target.closest(SELECTOR+" [data-vc-send]");
 if(!form)return;ev.preventDefault();
 const root=form.closest(SELECTOR);
 if(!root?.dataset.vedChatId){notify(root,"Переписка ещё не открыта. Повторите через кнопку «Обновить».",true);return;}
 const body=trim(form.querySelector('[name="body"]').value),files=Array.from(form.querySelector('[name="files"]').files||[]);
 if(!body&&!files.length){notify(root,"Напишите сообщение или прикрепите файл.",true);return;}
 if(files.length>5||files.some(f=>f.size>10*1024*1024)||files.reduce((n,f)=>n+f.size,0)>20*1024*1024){
  notify(root,"Не более 5 файлов: до 10 МБ каждый и 20 МБ всего.",true);return;
 }
 const button=form.querySelector("[data-vc-submit]");button.disabled=true;button.textContent="Отправляем…";
 try{
  const fd=new FormData();fd.set("id",root.dataset.vedChatId);fd.set("requestId",crypto.randomUUID());fd.set("body",body);
  for(const file of files)fd.append("files",file,file.name);
  const response=await api("/api/chats",fd);
  if(!response.ok)throw Error("Отправка не подтверждена сервером");
  form.reset();notify(root,"Сообщение отправлено.");
  await refresh(root);
  window.dispatchEvent(new Event("lw-tasks-changed"));
 }catch(e){notify(root,"Не отправлено: "+e.message,true);}
 finally{button.disabled=false;button.textContent="Отправить";}
});
document.addEventListener("click",e=>{
 const button=e.target.closest(SELECTOR+" [data-vc-refresh]");
 if(button)refresh(button.closest(SELECTOR));
});
document.addEventListener("keydown",e=>{
 if(e.target.matches(SELECTOR+' textarea[name="body"]')&&e.key==="Enter"&&!e.shiftKey){
  e.preventDefault();e.target.closest("form")?.requestSubmit();
 }
});
new MutationObserver(schedule).observe(document.getElementById("root")||document.documentElement,{childList:true,subtree:true});
document.addEventListener("DOMContentLoaded",schedule);
window.addEventListener("hashchange",()=>{pageListLoaded=0;schedule();});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&active?.isConnected)refresh(active);});
setInterval(()=>{if(!document.hidden&&active?.isConnected)refresh(active);},20000);
schedule();
})();