/* Owner answer-deadline table filters. Presentation only; no API or bid mutations. */
(()=>{
  "use strict";
  const ID="lw-answer-filters-20261124";
  const state={from:"",to:"",query:"",carrier:"",status:"all"};
  const text=node=>(node?.textContent||"").trim();
  const norm=value=>String(value||"").toLocaleLowerCase("ru").trim();
  const minskToday=()=>{
    const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Europe/Minsk",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const part=key=>parts.find(x=>x.type===key)?.value||"";
    return [part("year"),part("month"),part("day")].join("-");
  };
  const findTable=()=>{
    const headings=[...document.querySelectorAll("h1,h2,h3,h4")];
    const heading=headings.find(h=>text(h)==="Контроль ответов по заявкам");
    if(!heading)return null;
    const section=heading.closest("section,.card,.cabinet-panel")||heading.parentElement;
    const tables=[...section.querySelectorAll("table")];
    return tables.find(table=>[...table.querySelectorAll("thead th")].some(th=>/ПЕРЕВОЗЧИК|CARRIER/i.test(text(th))))||null;
  };
  let activeTable=null,controls=null,count=null;
  const apply=()=>{
    if(!activeTable?.isConnected)return;
    const rows=[...activeTable.querySelectorAll("tbody tr")];
    const today=minskToday();
    let visible=0;
    rows.forEach(row=>{
      const cells=[...row.children].filter(x=>x.tagName==="TD");
      if(cells.length<6)return;
      const order=norm(text(cells[0])),carrier=norm(text(cells[1]));
      const deadline=text(cells[2]).match(/\d{4}-\d{2}-\d{2}/)?.[0]||"";
      const status=norm(text(cells[3])),reply=norm(text(cells[4]));
      const unanswered=/не получен|не было|no response|not received/.test(status+" "+reply);
      const late=/просроч|с опоздан|late|overdue/.test(status+" "+reply);
      const timely=/вовремя|on time/.test(reply);
      const reviewed=/обработан|рассмотрен|допущен|reviewed|processed/.test(status);
      let matches=(!state.from||!!deadline&&deadline>=state.from)&&(!state.to||!!deadline&&deadline<=state.to)
        &&(!state.query||order.includes(norm(state.query)))&&(!state.carrier||carrier.includes(norm(state.carrier)));
      if(state.status==="today")matches=matches&&deadline===today;
      if(state.status==="overdue")matches=matches&&!!deadline&&deadline<today&&unanswered;
      if(state.status==="unanswered")matches=matches&&unanswered;
      if(state.status==="late")matches=matches&&late;
      if(state.status==="timely")matches=matches&&timely;
      if(state.status==="reviewed")matches=matches&&reviewed;
      row.hidden=!matches;
      row.style.display=matches?"":"none";
      if(matches)visible++;
    });
    if(count)count.textContent="Показано: "+visible+" из "+rows.length;
  };
  const makeField=(label,element)=>{
    const wrapper=document.createElement("label");
    wrapper.style.cssText="display:flex;flex-direction:column;gap:5px;font-size:12px;min-width:135px;flex:1 1 155px;color:inherit";
    const heading=document.createElement("span");heading.textContent=label;
    element.style.cssText="width:100%;min-height:37px;box-sizing:border-box;border:1px solid #8da3b9;border-radius:7px;padding:6px 9px;background:#f9fcff;color:#132c46;font:inherit;font-size:13px";
    wrapper.append(heading,element);return wrapper;
  };
  const input=(type,key,placeholder)=>{
    const el=document.createElement("input");el.type=type;el.value=state[key];if(placeholder)el.placeholder=placeholder;
    el.addEventListener("input",()=>{state[key]=el.value;apply();});return el;
  };
  const mount=()=>{
    const table=findTable();if(!table)return;
    if(table===activeTable&&controls?.isConnected)return;
    activeTable=table;
    const old=document.getElementById(ID);if(old)old.remove();
    const box=document.createElement("div");box.id=ID;
    box.style.cssText="display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 12px;margin:14px 0;padding:14px;border:1px solid #42627f;border-radius:10px;background:rgba(12,38,65,.35);color:#f2f7fb";
    box.append(makeField("Срок с",input("date","from")),makeField("Срок по",input("date","to")),
      makeField("Номер заказа",input("search","query","Поиск по номеру")),
      makeField("Перевозчик",input("search","carrier","Логин перевозчика")));
    const select=document.createElement("select");
    for(const [value,label] of [["all","Все ответы"],["today","Дедлайн сегодня"],["overdue","Просрочены без ответа"],["unanswered","Нет ответа"],["late","Ответ с опозданием"],["timely","Ответ вовремя"],["reviewed","Обработаны / допущены"]]){
      const option=new Option(label,value);select.add(option);
    }
    select.value=state.status;select.addEventListener("change",()=>{state.status=select.value;apply();});
    box.append(makeField("Статус ответа",select));
    const actions=document.createElement("div");actions.style.cssText="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-bottom:2px";
    const reset=document.createElement("button");reset.type="button";reset.textContent="Сбросить";reset.style.cssText="min-height:37px;padding:7px 13px;cursor:pointer;border-radius:7px;border:1px solid #a5b9cf;background:#e6eef5;color:#14314d";
    reset.addEventListener("click",()=>{Object.assign(state,{from:"",to:"",query:"",carrier:"",status:"all"});box.querySelectorAll("input").forEach(el=>el.value="");select.value="all";apply();});
    count=document.createElement("span");count.setAttribute("aria-live","polite");count.style.fontSize="12px";
    actions.append(reset,count);box.append(actions);
    const wrapper=table.closest(".tablewrap");
    if(wrapper?.parentNode)wrapper.parentNode.insertBefore(box,wrapper);
    else table.parentNode?.insertBefore(box,table);
    controls=box;apply();
  };
  let scheduled=false;
  const schedule=()=>{
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;mount();if(controls?.isConnected)apply();});
  };
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule,{once:true});
  else schedule();
})();
