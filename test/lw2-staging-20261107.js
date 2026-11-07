
/* Staging only: Logistics Workspace 2.0 carrier dashboard. No mutations of business APIs. */
(()=>{"use strict";
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const modes=[
   {key:"auto",name:"Авто",caption:"Автоперевозки",icon:"🚚",color:"#21d7a1",test:/авто|truck|road|car\b|automobile|фура/i},
   {key:"rail",name:"Ж/Д",caption:"Железнодорожные",icon:"🚆",color:"#40aeff",test:/ж.д|ж\/д|железнодор|rail|train|поезд/i},
   {key:"sea",name:"Море",caption:"Морские",icon:"🚢",color:"#a779ff",test:/мор|sea|ocean|ship|vessel|судно/i},
   {key:"air",name:"Авиа",caption:"Авиаперевозки",icon:"✈",color:"#ffb85c",test:/авиа|air|flight|самол[её]т/i},
   {key:"multi",name:"Мультимодал",caption:"Смешанные",icon:"⇄",color:"#e9a2d3",test:/мульт|multi|смешан/i}
 ];
 let loaded=false,stats=null,renderedKey="",waiting=false;
 let records=[];
 const info={ready:false,error:"",counts:{},transit:0,other:0,docs:null,newOrders:null,arrival:null};
 function findNav(label){
   const nodes=[...document.querySelectorAll(".cabinet-sidebar button,.carrier-sidebar button,.carrier-nav button,aside button,nav button")];
   const equals=nodes.find(n=>n.textContent.trim().toLowerCase()===label.toLowerCase());
   return equals||nodes.find(n=>n.textContent.trim().toLowerCase().includes(label.toLowerCase()));
 }
 function go(name){
   const mapped={orders:["Мои заявки","Заявки"],docs:["Транспортные заявки","Документы"],ships:["Мои перевозки","Исполнение перевозок"],feedback:["Предложения"]};
   const list=mapped[name]||[];
   for(const n of list){const b=findNav(n);if(b){b.click();return;}}
   const hashes={orders:"#carrier-orders",docs:"#transport-applications",ships:"#approved-shipments",feedback:"#portal-feedback"};
   if(hashes[name])location.hash=hashes[name];
 }
 function classify(mode){
   const val=String(mode||"");
   return (modes.find(m=>m.test.test(val))||null)?.key||"unknown";
 }
 function sourceCount(name){
   const metrics=[...document.querySelectorAll(".carrier-metrics .metric")];
   const el=metrics.find(x=>x.textContent.toLowerCase().includes(name.toLowerCase()));
   if(!el)return null;
   const match=(el.querySelector("strong")?.textContent||el.textContent).match(/\d+/);
   return match?Number(match[0]):null;
 }
 async function getData(){
   if(loaded)return;loaded=true;
   try{
     const res=await fetch("/api/task2",{cache:"no-store",credentials:"same-origin"});
     if(!res.ok)throw Error("API "+res.status);
     const payload=await res.json();
     if(payload.role!=="carrier"||!Array.isArray(payload.items))throw Error("Данные перевозчика недоступны");
     records=payload.items;
     const active=records.filter(x=>x.process_status!=="completed");
     const counts={};
     for(const row of active){const k=classify(row.mode);counts[k]=(counts[k]||0)+1;}
     let transit=0;
     let detailsRead=0;
     // Real departures only: a shipment under preparation is not counted as "in transit".
     const started=active.filter(x=>x.process_status==="in_progress");
     const completed=await Promise.all(started.slice(0,24).map(async x=>{
       try {
         const r=await fetch("/api/task2?order="+encodeURIComponent(x.order_code),{cache:"no-store",credentials:"same-origin"});
         if(!r.ok)return false;
         const d=await r.json();detailsRead++;
         const state=d.state||{};
         return !!state.actual_departure&&state.status!=="completed";
       }catch{return false;}
     }));
     transit=completed.filter(Boolean).length;
     info.ready=true;info.counts=counts;
     info.transit=transit;
     info.other=Math.max(0,active.length-transit);
     info.partial=started.length>24||detailsRead<started.length;
     render();
   }catch(e){info.error="Данные перевозок пока недоступны";render();}
 }
 function render(){
   const host=document.getElementById("lw2-dashboard");if(!host)return;
   const counts=info.counts,total=Object.values(counts).reduce((a,b)=>a+b,0);
   const unknown=counts.unknown||0;
   const categories=modes.filter(m=>counts[m.key]>0||m.key!=="multi").map(m=>({ ...m,count:counts[m.key]||0,percent:total?100*(counts[m.key]||0)/total:0}));
   let angle=0;
   const stops=categories.filter(x=>x.count).map(x=>{const from=angle;angle+=x.percent;return x.color+" "+from+"% "+angle+"%";});
   if(unknown&&total){const from=angle;angle+=100*unknown/total;stops.push("#8fa7b4 "+from+"% "+angle+"%");}
   const donut=stops.length?"conic-gradient("+stops.join(",")+")":"#304556";
   const v=info.ready?String(info.transit):"—",other=info.ready?String(info.other):"—";
   const nr=sourceCount("Непрочитанных заявок");
   const newVal=nr===null?"—":String(nr);
   const pending=sourceCount("Ожидают вашей ставки");
   const docs=info.docs===null?"—":String(info.docs);
   host.innerHTML=
     '<div class="lw2-kpis" aria-label="Показатели рабочего кабинета">'+
       kpi("orders","▱",newVal,"Непрочитанные заявки")+
       kpi("docs","▤",docs,"Транспортные заявки")+
       kpi("ships","🚚",v,"В пути")+
       kpi("ships","▱",other,"Другие этапы")+
     '</div>'+
     '<section class="lw2-panel"><div class="lw2-heading"><div><h2>Распределение транспорта</h2><span class="lw2-hint">По выбранным перевозкам этого кабинета · авто, Ж/Д, море, авиа</span></div>'+
       '<div class="lw2-pills"><span class="lw2-hint">'+(info.ready?"Действующих: "+total:"Данные проверяются")+'</span>'+
       '<button class="lw2-tab" type="button" data-lw2-refresh aria-label="Обновить информацию">Обновить ↻</button></div></div>'+
       '<div class="lw2-distribution"><div class="lw2-donut-zone"><div class="lw2-donut" style="background:'+esc(donut)+'">'+
       '<div class="lw2-hole"><strong>'+ (info.ready?total:"—")+'</strong><small>активных перевозок</small></div></div>'+
       '<div class="lw2-legend">'+categories.map(x=>'<div class="lw2-legend-row"><span class="lw2-dot" style="background:'+x.color+'"></span><span>'+esc(x.name)+'</span><strong>'+(info.ready?x.count:"—")+'</strong></div>').join("")+'</div></div>'+
       '<div class="lw2-type-grid">'+categories.map(x=>'<div class="lw2-type" style="--lw2-c:'+x.color+'"><span class="lw2-type-icon" aria-hidden="true">'+x.icon+'</span><div class="lw2-type-name">'+esc(x.caption)+'</div>'+
       '<strong>'+(info.ready?Math.round(x.percent)+"%":"—")+'</strong><small>'+(info.ready?x.count+" перевозок":"Нет данных")+'</small>'+
       '<div class="lw2-type-track"><span style="width:'+Math.max(0,Math.min(100,x.percent))+'%"></span></div></div>').join("")+'</div></div>'+
       (unknown?'<div class="lw2-note">Ещё '+unknown+' перевозок без однозначно определённого вида транспорта.</div>':"")+
       (info.partial?'<div class="lw2-note">Часть состояний в пути требует дополнительной проверки.</div>':"")+
       (info.error?'<div class="lw2-note">'+esc(info.error)+'; значения не заменяются условными цифрами.</div>':"")+'</section>'+
       '<div class="lw2-bottom"><section class="lw2-panel"><div class="lw2-heading"><h2>Грузы в пути</h2></div>'+
       '<p class="lw2-muted">'+(info.ready?esc(String(info.transit))+" подтверждённых отправлений, движение которых ещё не завершено.":"Откройте «Мои перевозки», чтобы просмотреть актуальные статусы и местоположение.")+'</p>'+
       '<div class="lw2-actions"><button class="lw2-action" data-lw2-go="ships" type="button">Открыть перевозки ↗</button></div></section>'+
       '<section class="lw2-panel lw2-feedback"><div class="lw2-heading"><h2>Центр предложений</h2></div>'+
       '<p class="lw2-muted">Есть идея, как улучшить портал? Предложите доработку, сообщите об ошибке или поделитесь пожеланием.</p>'+
       '<div class="lw2-actions"><button class="lw2-action" data-lw2-go="feedback" type="button">Предложить улучшение ↗</button></div></section></div>';
 }
 function kpi(go,icon,value,label){return '<button class="lw2-kpi" data-lw2-go="'+go+'" type="button"><span class="lw2-kpi-icon" aria-hidden="true">'+icon+'</span><span class="lw2-kpi-data"><strong>'+value+'</strong><small>'+label+'</small></span></button>';}
 function setup(){
   const portal=document.querySelector(".carrier-portal");
   if(!portal)return;
   const hero=portal.querySelector(".workspace-hero");
   if(!hero||!hero.getClientRects().length)return;
   const main=hero.closest(".carrier-main")||hero.parentElement;
   if(!main)return;
   hero.setAttribute("data-lw2-hero","");
   const title=hero.querySelector("h1");
   if(title&&!title.textContent.includes("Добрый день"))title.textContent="Добрый день!";
   const headline=hero.querySelector(".eyebrow");
   if(headline)headline.textContent="РАБОЧЕЕ ПРОСТРАНСТВО";
   const lead=hero.querySelector(".intro");
   if(lead)lead.textContent="Заявки, транспортные документы, перевозки и контроль сроков — в одном рабочем пространстве.";
   const old=main.querySelector(".carrier-metrics");
   if(old)old.setAttribute("data-lw2-old-metrics","");
   if(!document.getElementById("lw2-dashboard")){
     const box=document.createElement("section");box.id="lw2-dashboard";box.className="lw2-dashboard";box.setAttribute("aria-label","Рабочая сводка Logistics Workspace 2.0");hero.insertAdjacentElement("afterend",box);
     box.addEventListener("click",e=>{
       const b=e.target.closest("[data-lw2-go],[data-lw2-refresh]");if(!b)return;
       if(b.dataset.lw2Go)go(b.dataset.lw2Go);
       if(b.hasAttribute("data-lw2-refresh")){loaded=false;getData();}
     });
     render();getData();
   }
 }
 let scheduled=false;
 function tick(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;setup();});}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",tick);else tick();
 new MutationObserver(tick).observe(document.documentElement,{subtree:true,childList:true});
 window.addEventListener("hashchange",tick);
})();
