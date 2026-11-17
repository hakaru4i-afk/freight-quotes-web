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

// Human-readable HTTP diagnostics. The status alone never proves intent or a specific permission rule.
const httpMeanings={
  400:['Запрос отклонён: ошибка данных или формата','Сервер не смог принять запрос. Конкретное поле без серверной причины неизвестно.'],
  401:['Для запроса требуется повторная авторизация','Сервер не принял подтверждение входа. Сеанс мог истечь.'],
  402:['Запрос требует выполнения условия оплаты','Сервер вернул код 402; конкретное условие в записи не указано.'],
  403:['Действие запрещено правилами доступа','Сервер отказал в операции. Это не является доказательством намеренного обхода защиты.'],
  404:['Раздел или запись не найдены','Объект отсутствует либо скрыт правилами доступа; по одному коду различить нельзя.'],
  405:['Данный способ обращения к разделу не разрешён','Сервер не принимает использованный метод запроса.'],
  406:['Формат ответа не поддерживается','Сервер не может предоставить ответ в запрошенном формате.'],
  408:['Истекло время ожидания запроса','Сервер не дождался завершения запроса.'],
  409:['Состояние данных изменилось: конфликт операции','Операция столкнулась с текущим состоянием записи или процесса.'],
  410:['Запрашиваемый объект больше недоступен','Сервер сообщил, что ресурс удалён или более не предоставляется.'],
  412:['Условие сохранения не выполнено','Предварительная проверка версии или состояния не прошла.'],
  413:['Переданный файл или запрос слишком большой','Размер переданных данных превысил допустимый предел.'],
  415:['Формат файла или запроса не поддерживается','Сервер не принимает этот тип содержимого.'],
  422:['Введённые данные не прошли проверку','Данные получены, но не соответствуют требованиям операции.'],
  423:['Запись заблокирована для изменения','Операция не выполнена из-за блокировки ресурса.'],
  424:['Не выполнена зависимая операция','Запрос не завершён из-за ошибки связанной операции.'],
  426:['Требуется обновление способа подключения','Сервер требует другой протокол подключения.'],
  429:['Временно превышен лимит запросов','Сработало ограничение частоты; защиту не отключаем.'],
  431:['Слишком большие заголовки запроса','Сервер не смог обработать заголовки запроса.'],
  451:['Доступ ограничен по правовым основаниям','Сервер сообщил об ограничении доступа по юридической причине.'],
  500:['Внутренняя ошибка сервера','Сервер не смог завершить обработку. Причина требует технической диагностики.'],
  501:['Функция не реализована на сервере','Сервер не поддерживает запрошенную операцию.'],
  502:['Сбой связи между серверами','Промежуточный сервер получил некорректный ответ.'],
  503:['Сервис временно недоступен','Возможны обслуживание, перегрузка или временный отказ.'],
  504:['Превышено время ожидания ответа сервера','Промежуточный сервер не дождался ответа.'],
  507:['Недостаточно места для обработки','Сервер сообщил о нехватке хранилища.'],
  508:['Обнаружен цикл обработки запроса','Сервер прервал повторяющуюся обработку.']
};
const knownEventFamilies=[
  ['Вход и сеансы','Успешный/неудачный вход, выход, истечение сеанса, блокировка после ошибок, сброс пароля, параллельные сеансы'],
  ['Права и безопасность','Создание/удаление пользователя, изменение роли, разрешение/запрет доступа, RLS, изменение полномочий, превышение лимита'],
  ['Заявки','Создание, изменение, удаление, публикация, архив, изменение дедлайна, вложения'],
  ['Ставки и тендеры','Черновик, поздняя ставка, отказ с причиной, подача, правка, рассмотрение, блокировка выбора, победитель, тендер, протокол'],
  ['Перевозка и ВЭД','Принятие, трекинг, маршрут и километраж, ETA, перенос, контейнер, проверка документов, таможня, ПТО, закрытие, претензия'],
  ['Файлы и переписка','Загрузка, скачивание, удаление, запрос документа, отправка сообщения, ошибка вложения'],
  ['Система','Открытие раздела, ошибка интерфейса, сеть, тайм-аут, ошибка сервера, интеграция, обновление версии, недоступность сервиса']
];

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
 if(httpMeanings[status] && status!==403 && status!==401 && status!==400 && status!==404 && status!==409 && status!==422 && status!==429 && status<500){
   result.title=httpMeanings[status][0]+' — «'+service+'»';
   result.why=httpMeanings[status][1];
   result.outcome='Запрос не подтверждён как выполненный. Смотрите исходную запись и серверную диагностику.';
 }else if(status===403||kind==='denied'){
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
   if(httpMeanings[status])result.title=httpMeanings[status][0]+' — «'+service+'»';
   result.title='Сбой сервера при обращении к разделу «'+service+'»';
   result.why=httpMeanings[status]?.[1]||'Произошла серверная ошибка; подробная техническая причина в этой записи отсутствует.';
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
 // Informative catalogue only: it does NOT claim that every family is currently collected by the backend.
 if(!monitor.querySelector('[data-owner-audit-catalogue]')){
   const details=document.createElement('details');
   details.dataset.ownerAuditCatalogue='1';
   details.className='ow-audit-event-catalogue';
   const heading=document.createElement('summary');
   heading.textContent='Какие события бывают и что фиксируется';
   details.append(heading);
   const disclaimer=document.createElement('p');
   disclaimer.textContent='Это перечень событий для полного аудита. Появление категории здесь не означает, что сервер уже сохраняет каждое событие. Фильтр выше работает только с фактически записанными типами.';
   details.append(disclaimer);
   const list=document.createElement('ul');
   for(const [name,examples] of knownEventFamilies){
     const item=document.createElement('li');
     const strong=document.createElement('strong');
     strong.textContent=name+': ';
     item.append(strong,document.createTextNode(examples));
     list.append(item);
   }
   details.append(list);
   const footer=document.createElement('p');
   footer.textContent='Сведения о намерениях пользователя, точной причине запрета и результате операции показываются только при наличии подтверждённых полей события. Коды HTTP сохранены для технического анализа.';
   details.append(footer);
   const table=monitor.querySelector('table');
   if(table)table.before(details);else monitor.append(details);
 }
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
