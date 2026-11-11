// Shared graph semantics for the approved viewer and draft editor.
export function processEdges(p){
 if(p.id==='OVERVIEW')return p.edges;
 const back={P01:[3,0,'Неполный комплект → исправление'],P02:[3,2,'Неверные поля → исправление'],P04:[1,1,'Повтор: уже принято'],P05:[1,0,'Недоступен расчёт: повтор, без вымысла'],P07:[5,2,'Возврат владельцем: changes_requested'],P09:[1,0,'Условия не выполнены: исправить'],P10:[3,0,'Повтор cron: без второго штрафа']}[p.id];
 if(p.id==='P08')return [1,2,3].map(i=>({from:0,to:i,label:'Только своя роль / логин'}));
 if(p.id==='P05')return [{from:0,to:1,label:'Контрольная точка'},{from:1,to:3,label:'Подтверждено <1000 км'},{from:1,to:2,label:'Невозможно рассчитать'},{from:2,to:3,label:'Owner: причина, основание, аудит'},{from:3,to:4,label:'Одна задача; ВЭД выполняет проверку'},{from:4,to:5,label:'ПТО и ВЭД подтверждены'}];
 if(p.id==='P03')return [{from:0,to:1,label:'Перед выбором'},{from:1,to:3,label:'Активных черновиков нет'},{from:1,to:2,label:'Выбор заблокирован'},{from:2,to:1,label:'После завершения / снятия'},{from:3,to:4,label:'Один победитель'},{from:4,to:5,label:'Если тендер завершён'}];
 if(p.id==='P06')return [{from:0,to:1,label:'После принятия'}, {from:1,to:4,label:'Комплект достаточен'}, {from:1,to:2,label:'Не хватает документов'}, {from:2,to:3,label:'Адресный получатель'}, {from:3,to:4,label:'Файл связан с задачей'}, {from:4,to:5,label:'Проверка завершена'}];
 return [...p.nodes.slice(1).map((_,i)=>({from:i,to:i+1,label:'Условия шага выполнены'})),...(back?[{from:back[0],to:back[1],label:back[2]}]:[])];
}
