/* OW-AUDIT-20261117: owner-visible explanations only; audit records and permissions unchanged. */
const serviceNames={
  '/api/test-cabinets':'просмотр других кабинетов (функция владельца)',
  '/api/team':'пользователи и права доступа',
  '/api/password-resets':'сброс паролей сотрудников',
  '/api/requests':'заявки на перевозку',
  '/api/carrier':'кабинет перевозчика',
  '/api/bids':'черновики предложений перевозчика',
  '/api/quote':'подача ставки перевозчика',
  '/api/review':'рассмотрение предложений',
  '/api/offer-selection':'выбор победителя',
  '/api/registry':'реестр заявок',
  '/api/data':'реестр рабочих данных',
  '/api/task2':'исполнение и трекинг перевозок',
  '/api/shipments':'перевозки и движение грузов',
  '/api/route-distance':'расчёт маршрута и километража',
  '/api/chats':'чат по заявке',
  '/api/chat-files':'вложения из чата',
  '/api/documents':'документы по перевозке',
  '/api/documents/file':'скачивание документа',
  '/api/supplier-files':'файлы поставщика',
  '/api/supplier-orders':'задания поставщика',
  '/api/transport-applications':'транспортные заявки',
  '/api/tenders':'тендер и ставки',
  '/api/incidents':'инциденты',
  '/api/service-level':'оценки перевозчиков',
  '/api/auth':'авторизация и вход',
  '/api/workload':'рабочие задачи',
  '/api/access':'управление полномочиями',
  '/api/site-monitor':'журнал действий',
  '/api/portal-feedback':'сообщения и предложения',
  'Работа сайта':'журнал действий',
  'Перевозки':'перевозки и движение грузов',
  'Заявки':'заявки на перевозку',
  'Документы':'документы по перевозке',
  'Тендеры':'тендер и ставки',
  'Service Level':'оценки перевозчиков',
  'Главная':'главную страницу кабинета',
  'Помощь / FAQ':'инструкцию кабинета',
  'Пользователи и права':'пользователи и права доступа'
};
const actionNames={
  get:'получение или просмотр данных',read:'просмотр данных',post:'отправка запроса',
  patch:'изменение записи',put:'изменение записи',delete:'удаление записи',
  upload:'загрузка файла',download:'скачивание файла',login:'вход в кабинет',
  logout:'выход из кабинета',view:'открытие раздела',start:'начало работы',
  submit:'отправка данных',save:'сохранение',send:'отправка сообщения',
  create:'создание',update:'изменение',approve:'подтверждение',
  reject:'отклонение',cancel:'отмена',take:'взятие в работу'
};
const kindLabels={
  'Отказ в доступе':'denied','Ошибка проверки данных':'validation',
  'Ошибка сервера':'server_error','Ошибка интерфейса':'client_error',
  'Рабочее действие':'action','Открытие раздела':'page',
  'Вход в кабинет':'login','Выход из кабинета':'logout'
};
const safe=v=>String(v??'').trim();
const serviceFor=path=>serviceNames[path]||(/^\/api\/[a-z0-9/-]+$/.test(path)?'функцию портала':'раздел портала');
export function explainAuditEvent(event){
 const path=safe(event.path),status=Number(event.status||0),kind=event.kind||'';
 const action=safe(event.action).toLowerCase(),target=safe(event.target);
 const service=serviceFor(path);
 const operation=actionNames[action]||('операция «'+(action||'не указана')+'»');
 const targetText=target?' по заявке/объекту '+target:'';
 const result={title:'Обращение к разделу «'+service+'»',where:'Раздел: '+service,what:'Запрос: '+operation+targetText,why:'Точная причина не указана в сохранённой записи.',outcome:'Результат требует проверки.',origin:'По этой записи нельзя установить, нажимал ли пользователь кнопку вручную.'};
 if(path==='/api/test-cabinets'&&status===403){
   result.title='Автоматический запрос списка кабинетов владельца';
   result.what='При загрузке страницы прежний интерфейс запросил служебный список кабинетов, доступный только владельцу.';
   result.why='Сотрудник с ролью не владельца не имеет права получать этот список.';
   result.outcome='Сервер отклонил запрос. Список кабинетов не выдан, данные не изменены.';
   result.origin='Известная ошибка прежнего интерфейса: такой запрос выполнялся автоматически. Эта запись не доказывает попытку сотрудника войти в чужой кабинет.';
   return result;
 }
 if(status===403||kind==='denied'){
   result.title='Доступ к разделу «'+service+'» запрещён';
   result.why='Сервер запретил операцию. Точная причина (роль, состояние сеанса или правило безопасности) не сохранена в этой записи.';
   result.outcome='Операция отклонена; из этой записи не следует, что она была выполнена.';
 }else if(status===401){
   result.title='Пользователь не авторизован для доступа к «'+service+'»';
   result.why='Сервер не принял подтверждение входа для этого запроса.';
   result.outcome='Запрос не выполнен.';
 }else if(status===400||status===422||kind==='validation'){
   result.title='Данные для раздела «'+service+'» не прошли проверку';
   result.why='Сервер отклонил запрос. Конкретное некорректное поле в этой записи не указано.';
   result.outcome='Запрос не выполнен; нужно проверить введённые значения или состояние заявки.';
 }else if(status===404){
   result.title='Не удалось найти объект или раздел «'+service+'»';
   result.why='Объект не найден или недоступен для этой роли; различить эти причины по записи нельзя.';
   result.outcome='Запрос не выполнен.';
 }else if(status===409){
   result.title='Конфликт состояния в разделе «'+service+'»';
   result.why='Сохранение было отклонено из-за несовпадения текущего состояния данных.';
   result.outcome='Запрос не выполнен. Требуется обновить данные и повторно проверить действия.';
 }else if(status===429){
   result.title='Слишком много запросов к разделу «'+service+'»';
   result.why='Сработало ограничение частоты запросов.';
   result.outcome='Запрос временно отклонён.';
 }else if(status>=500||kind==='server_error'){
   result.title='Сбой сервера при обращении к разделу «'+service+'»';
   result.why='Произошла серверная ошибка; подробная техническая причина в этой записи отсутствует.';
   result.outcome='Успешное выполнение операции не подтверждено.';
 }else if(kind==='client_error'){
   result.title='Сбой интерфейса в разделе «'+service+'»';
   result.what='Браузер зарегистрировал ошибку при работе с разделом.';
   result.why='Это ошибка интерфейса; серверная операция могла не запускаться.';
   result.outcome='Нужно проверить экран, действия и исправность сети.';
 }else if(kind==='page'){
   result.title='Открыт раздел «'+service+'»';
   result.what='Браузер зарегистрировал открытие раздела.';
   result.why='Это информационная запись, не ошибка.';
   result.outcome='Само открытие не подтверждает выполнение какой-либо задачи.';
 }else if(kind==='login'){
   result.title='Вход в кабинет';
   result.why='Сервер принял вход.';
   result.outcome='Авторизация прошла успешно.';
 }else if(kind==='logout'){
   result.title='Выход из кабинета';
   result.why='Запрос выхода принят.';
   result.outcome='Сеанс завершён.';
 }else if(status>0&&status<400){
   result.title='Запрос к разделу «'+service+'» выполнен';
   result.why='Сервер обработал запрос без ошибки.';
   result.outcome='Сервер ответил успешно; подтверждение бизнес-результата проверяется отдельно.';
 }
 return result;
}
function logRow(row){
 if(row.dataset.ownerAuditExplained==='1')return;
 const cells=row.querySelectorAll(':scope > td');
 if(cells.length!==5)return;
 const title=cells[2].querySelector('b'),section=cells[2].querySelector('small');
 const details=cells[4].querySelector('details');
 if(!title||!details)return;
 const paras=[...details.querySelectorAll(':scope > p')];
 const http=paras.map(p=>p.textContent).find(x=>/^HTTP \d{3}$/.test(x||''));
 const path=safe(section?.textContent),kind=kindLabels[safe(title.textContent)]||'';
 const event={kind,path,action:safe(paras[0]?.textContent),status:http?Number(http.slice(5)):0,
  target:safe(paras[1]?.textContent&&!/^HTTP \d{3}$/.test(paras[1].textContent)?paras[1].textContent:'')};
 // The original row (including method, HTTP code, ID and raw path) remains intact.
 const note=explainAuditEvent(event);
 const summary=document.createElement('div');
 summary.className='ow-audit-explanation-title';
 summary.textContent=note.title;
 cells[2].prepend(summary);
 const reason=document.createElement('div');
 reason.className='ow-audit-explanation-result';
 reason.textContent=note.outcome;
 cells[3].append(reason);
 const long=document.createElement('div');
 long.className='ow-audit-explanation-detail';
 for(const [name,value] of [['Что запрашивалось',note.what],['Почему',note.why],['Что произошло',note.outcome],['Это действие пользователя?',note.origin]]){
   const p=document.createElement('p');
   const strong=document.createElement('strong');
   strong.textContent=name+': ';
   p.append(strong,document.createTextNode(value));
   long.append(p);
 }
 const first=details.querySelector('summary');
 if(first)first.after(long);
 const technical=document.createElement('p');
 technical.className='ow-audit-technical-line';
 technical.textContent='Исходная запись: '+path+(event.action?' · '+event.action:'')+(http?' · '+http:'');
 details.append(technical);
 row.dataset.ownerAuditExplained='1';
}
function apply(){
 const owner=document.querySelector('#root .cabinet-app[data-cabinet-role="owner"]');
 if(!owner)return;
 const monitor=owner.querySelector('section.site-monitor');
 if(!monitor)return;
 for(const row of monitor.querySelectorAll('tbody tr'))logRow(row);
}
if(typeof document!=='undefined'){
 let scheduled=false;
 const schedule=()=>{
  if(scheduled)return;scheduled=true;
  queueMicrotask(()=>{scheduled=false;apply()});
 };
 new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
 else schedule();
}
