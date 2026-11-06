const put=(id,v)=>{const node=document.getElementById(id);if(node)node.textContent=String(v??'Не подтверждено')};
async function load(){
 try{
  const response=await fetch('./qa-public-status.json',{cache:'no-store'});
  if(!response.ok)throw Error('Public QA status unavailable');
  const d=await response.json();
  if(d.environment!=='staging'||d.visibility!=='public-redacted'||d.schema!==1)throw Error('Unsafe QA manifest');
  put('release',d.release.version+' · опубликована для проверки');
  put('build','API '+d.release.apiVersion+' · дата отчёта '+d.asOfDate+' · ручная приёмка: '+d.release.manualAcceptance);
  put('acceptance',d.task2.ownerAccepted+' из '+d.task2.totalGroups+' групп принято');
  put('scope','Полная приёмка остаётся открытой; частные PASS не означают 26/26');
  put('security',d.roleIsolation.status==='PASS'?'Подтверждено':'Частично проверено');
  put('limits','Все роли, чужие заявки, файлы, чаты и экспорт: '+d.roleIsolation.allEndpointsAllRoles);
  put('releaseNote',d.release.scope+'. '+d.release.checkSummary+'.');
  put('privacy','Сырые QA-артефакты не публикуются. Полная история замечаний и разработок хранится в закрытых реестрах.');
 }catch{
  put('release','Нет подтверждённого статуса');put('acceptance','Не подтверждено');put('security','Не подтверждено');
  put('releaseNote','Публичный отчёт недоступен. Это не считается успешной проверкой.');
 }
}
load();
