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
  '/api/owner-register-execution':'Центр доработок и приёмка',
  '/api/engineering-registers':'инженерные реестры',
  '/api/process-models':'модели бизнес-процессов',
  '/api/support-requests':'обращения в поддержку',
  '/api/partner-inquiries':'обращения партнёров',
  '/api/partner-inquiries/attachments':'вложения обращений партнёров',
  '/api/transport-files':'транспортные файлы',
  '/api/shipment-execution':'исполнение перевозки',
  '/api/shipment-booking':'бронирование перевозки',
  '/api/fulfillment':'исполнение обязательств',
  '/api/late-bid-drafts':'черновики поздних ставок',
  '/api/pending-tasks':'рабочие задачи',
  '/api/offer-analysis':'анализ предложений',
  '/api/session':'проверка сеанса',
  '/api/site-events':'события интерфейса',
  '/api/reports':'отчёты',
  '/api/decline':'отказ от участия',
  '/api/request-status':'статус заявки',
  '/api/sla':'сроки и качество обслуживания',
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
  reject:'отклонение',cancel:'отмена',take:'взятие в работу',open_request:'получение конкретной заявки',read_protocol:'получение протокола тендера'
};
const nativeLabels=Object.freeze({
  "native_auth_failed_three_times": "Три неудачные попытки входа",
  "native_auth_recovery_requested": "Запрос восстановления пароля",
  "native_auth_recovery_completed": "Сброс пароля",
  "native_auth_parallel_session_started": "Создан параллельный сеанс",
  "native_auth_session_limit_pruned": "Лишние сеансы отозваны",
  "native_auth_expired_sessions_cleaned": "Истёкшие сеансы удалены",
  "native_auth_session_expired": "Срок действия сеанса истёк",
  "native_tender_created": "Тендер создан",
  "native_tender_initial": "Начальная ставка тендера",
  "native_tender_offer_review": "Ставка тендера рассмотрена",
  "native_tender_extended": "Тендер продлён",
  "native_tender_offer": "Ставка тендера зарегистрирована",
  "native_tender_closed_early": "Тендер закрыт досрочно",
  "native_tender_closed": "Тендер закрыт",
  "native_tender_finalized": "Результат тендера зафиксирован",
  "native_tender_cancelled": "Тендер отменён",
  "native_sl_winner_failure": "SL: срыв перевозки",
  "native_sl_winner_failure_after": "SL: срыв после начала перевозки",
  "native_sl_owner_annulment": "SL: отмена начисления",
  "native_sl_no_response": "SL: отсутствие ответа",
  "native_sl_timely_response": "SL: ответ в срок",
  "native_sl_late_response_after_no_response": "SL: поздний ответ",
  "native_sl_completed_on_time": "SL: выполнение в срок",
  "native_sl_completion_revoked": "SL: бонус отозван",
  "native_sl_incident_resolved": "SL: инцидент урегулирован",
  "native_sl_incident_void": "SL: инцидент аннулирован",
  "native_sl_completion_restored": "SL: бонус восстановлен",
  "native_sl_owner_unlock": "SL: разблокировка",
  "native_shipment_owner_data": "Данные перевозки изменены",
  "native_shipment_route": "Маршрут сохранён",
  "native_shipment_progress": "Трекинг обновлён",
  "native_execution_application_take": "Транспортная заявка взята в работу",
  "native_execution_application_correction_request": "Запрошена корректировка",
  "native_execution_application_save": "Транспортная заявка сохранена",
  "native_execution_application_submit": "Транспортная заявка отправлена",
  "native_execution_application_edit": "Транспортная заявка изменена",
  "native_execution_application_review": "Транспортная заявка рассмотрена",
  "native_execution_application_approve": "Транспортная заявка согласована",
  "native_execution_application_change": "Условия заявки изменены",
  "native_execution_application_reject": "Транспортная заявка отклонена",
  "native_execution_transport_files": "Транспортные файлы зарегистрированы",
  "native_execution_execution_progress": "Этап исполнения обновлён",
  "native_execution_execution_waiver": "Исключение в исполнении",
  "native_execution_execution_departure_approve": "Отправление согласовано",
  "native_execution_execution_customs_approve": "Таможенные документы согласованы",
  "native_execution_execution_customs_return": "Таможенные документы возвращены",
  "native_execution_execution_clearance": "Таможенное оформление зафиксировано",
  "native_execution_execution_warehouse": "Прибытие на склад",
  "native_execution_execution_complete": "Исполнение завершено",
  "native_execution_claim_open": "Претензия открыта",
  "native_execution_claim_save": "Претензия сохранена",
  "native_execution_claim_send": "Претензия отправлена",
  "native_execution_claim_accept": "Претензия принята",
  "native_execution_claim_partial": "Претензия частично принята",
  "native_execution_claim_dispute": "Претензия оспорена",
  "native_execution_claim_propose": "Решение по претензии предложено",
  "native_execution_claim_approve": "Решение согласовано",
  "native_execution_claim_return": "Претензия возвращена",
  "native_execution_claim_reject": "Решение отклонено",
  "native_execution_claim_fulfill": "Исполнение претензии",
  "native_execution_claim_resolve": "Претензия урегулирована",
  "native_execution_claim_route": "Способ урегулирования зафиксирован",
  "native_completion_close": "Закрытие перевозки",
  "native_completion_reopen": "Возобновление перевозки",
  "native_completion_complete": "Завершение перевозки",
  "native_completion_confirm": "Подтверждение завершения",
  "native_completion_submit": "Отправка на приёмку",
  "native_completion_approve": "Приёмка согласована",
  "native_completion_reject": "Приёмка отклонена",
  "native_completion_review": "Приёмка рассмотрена"
});
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
  ['Вход и сеансы','Успешный/неудачный вход, выход, истечение сеанса, три неудачные попытки входа, запрос восстановления, сброс пароля, параллельные сеансы'],
  ['Права и безопасность','Создание/удаление пользователя, изменение роли, разрешение/запрет доступа, RLS, изменение полномочий, превышение лимита'],
  ['Заявки','Создание, изменение, удаление, публикация, архив, изменение дедлайна, вложения'],
  ['Ставки и тендеры','Черновик, поздняя ставка, отказ с причиной, подача, правка, рассмотрение, блокировка выбора, победитель, тендер, протокол'],
  ['Перевозка и ВЭД','Принятие, трекинг, маршрут и километраж, ETA, перенос, контейнер, проверка документов, таможня, ПТО, закрытие, претензия'],
  ['Файлы и переписка','Загрузка, скачивание, удаление, запрос документа, отправка сообщения, ошибка вложения'],
  ['Система','Открытие раздела, ошибка интерфейса, сеть, тайм-аут, ошибка сервера, интеграция, обновление версии, недоступность сервиса']
];

const safe=v=>String(v??'').trim();
const roleNames={owner:'Владелец',logistic:'Логист / ВЭД',carrier:'Перевозчик',supplier:'Поставщик',designer:'Дизайнер',content:'Контент',purchasing:'Закупки',certification:'Сертификация'};
const serverReasons={
 PUBLICATION_NOT_VERIFIED:'Сервер не подтвердил доказательство публикации.',
 PUBLICATION_PROOF_UNAVAILABLE:'Сервер не смог получить доказательство публикации.',
 TASK_EXECUTION_NOT_LINKED:'Задача не связана с зарегистрированным выполнением.',
 TASK_NOT_ACTIVE:'Задача не находится в допустимом активном состоянии.',
 TASK_LINK_NOT_FOUND:'Связь с зарегистрированной задачей не найдена.',
 TASK_STATUS_CHANGED:'Состояние задачи изменилось.',
 TASK_CLOSED:'Задача уже закрыта.',
 TASK_NOT_READY:'Задача не готова к следующему этапу.',
 EXPLICIT_SCOPE_ACCEPTANCE_REQUIRED:'Не подтверждены объём приёмки и остаточные риски.',
 HISTORICAL_RECORD:'Историческая запись не допускает эту операцию.',
 OWNER_ONLY:'Операция разрешена только владельцу.',
 INVALID_ACTION:'Сервер не распознал действие.',
 INVALID_BODY:'Неверная структура запроса.',
 INVALID_JSON:'Не удалось разобрать JSON запроса.',
 TOO_LARGE:'Превышен допустимый размер.',
 METHOD_NOT_ALLOWED:'Этот HTTP-метод не разрешён.',
 REGIONAL_EXECUTION_UNAVAILABLE:'Не удалось выполнить запрос в требуемом регионе.'
};
const phaseNames={handler:'Обработка запроса',access_denied:'Проверка доступа',early_denial:'Отказ до обработчика',transaction_rollback:'Откат транзакции',post_commit_error:'Ошибка после сохранения',post_commit_pending:'Ожидается завершение после сохранения',domain_commit:'Серверное бизнес-событие'};
function applyObservedDetails(result,event){
 if(event.source!=='server')return result;
 const code=safe(event.serverCode),phase=safe(event.phase);
 if(Object.hasOwn(serverReasons,code))result.why=serverReasons[code];
 if(phase==='transaction_rollback')result.outcome='Транзакция откатилась: изменения в рамках этой транзакции не сохранены.';
 if(phase==='post_commit_error')result.outcome='Транзакция уже зафиксирована, но последующая обработка завершилась ошибкой. Не повторяйте действие автоматически.';
 if(phase==='post_commit_pending')result.outcome='Транзакция сохранена; последующая очистка файлов ещё выполняется.';
 const actual=roleNames[event.role],effective=roleNames[event.effectiveRole];
 if(actual&&effective&&event.role!==event.effectiveRole)result.origin='Фактическая роль: '+actual+'. Роль просматриваемого кабинета: '+effective+'. Запись не доказывает, что запрос был инициирован вручную.';
 return result;
}
const serviceFor=path=>serviceNames[path]||(/^\/api\/[a-z0-9/-]+$/.test(path)?'функцию портала':'раздел портала');
export function explainAuditEvent(event){
 const path=safe(event.path),status=Number(event.status||0),kind=event.kind||'';
 const action=safe(event.action).toLowerCase(),target=safe(event.target);
 const service=serviceFor(path);
 const operation=actionNames[action]||('операция «'+(action||'не указана')+'»');
 const targetText=target?' по заявке/объекту '+target:'';
 const result={title:'Обращение к разделу «'+service+'»',where:'Раздел: '+service,what:'Запрос: '+operation+targetText,why:'Точная причина не указана в сохранённой записи.',outcome:'Результат требует проверки.',origin:'По этой записи нельзя установить, нажимал ли пользователь кнопку вручную.'};
 if(isNativeEvent(event)){
   result.title=nativeLabels[action];
   result.what='Событие: '+nativeLabels[action]+targetText;
   result.why='Запись сформирована сервером вместе с бизнес-операцией, а не браузером.';
   result.outcome='Серверное событие зафиксировано. Отдельный HTTP-код не присваивается; ответ ищите по общему ID запроса.';
   result.origin='Источник — серверный обработчик. Нажатие кнопки и намерения пользователя по этой записи не устанавливаются.';
   return result;
 }
 if(path==='/api/test-cabinets'&&status===403&&!event.reasonCode){
   result.title='Автоматический запрос списка кабинетов владельца';
   result.what='При загрузке страницы прежний интерфейс запросил служебный список кабинетов, доступный только владельцу.';
   result.why='Список доступен только владельцу. Сотрудник с другой ролью не имеет права получать его.';
   result.outcome='Сервер отклонил запрос. Список кабинетов не выдан, данные не изменены.';
   result.origin='Известная ошибка прежнего интерфейса: такой запрос выполнялся автоматически. Эта запись не доказывает попытку сотрудника войти в чужой кабинет.';
   return result;
 }
 if(httpMeanings[status] && status!==403 && status!==401 && status!==400 && status!==404 && status!==409 && status!==422 && status!==429 && status<500){
   result.title=httpMeanings[status][0]+' — «'+service+'»';
   result.why=httpMeanings[status][1];
   result.outcome='Запрос не подтверждён как выполненный. Смотрите исходную запись и серверную диагностику.';
 }else if(status===403||(kind==='denied'&&!status)){
   result.title='Доступ к разделу «'+service+'» запрещён';
   result.why='Сервер запретил операцию. Точная причина (роль, состояние сеанса или правило безопасности) не сохранена в этой записи.';
   result.outcome='Операция отклонена; из этой записи не следует, что она была выполнена.';
 }else if(status===401){
   result.title='Пользователь не авторизован для доступа к «'+service+'»';
   result.why='Сервер не принял подтверждение входа для этого запроса.';
   result.outcome='Запрос не выполнен.';
 }else if(status===400||status===422||(kind==='validation'&&!status)){
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
 }else if(status>=500||(kind==='server_error'&&!status)){
   result.title=status!==500&&httpMeanings[status]?httpMeanings[status][0]+' — «'+service+'»':'Сбой сервера при обращении к разделу «'+service+'»';
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
 }else if(status===202){
   result.title='Запрос принят к дальнейшей обработке — «'+service+'»';
   result.why='Сервер принял запрос, но ещё не подтвердил завершение.';
   result.outcome='Операция ожидает завершения; HTTP 202 не означает готовый бизнес-результат.';
 }else if(status>=300&&status<400){
   result.title='Перенаправление запроса — «'+service+'»';
   result.why='Сервер направил запрос дальше.';
   result.outcome='Окончательный бизнес-результат этой записью не подтверждён.';
 }else if(status>0&&status<300){
   result.title='Запрос к разделу «'+service+'» выполнен';
   result.why='Сервер обработал запрос без ошибки.';
   result.outcome='Сервер ответил успешно; подтверждение бизнес-результата проверяется отдельно.';
 }
 return applyObservedDetails(result,event);
}
const isNativeEvent=e=>e.source==='server'&&e.phase==='domain_commit'&&e.serverCode==='DOMAIN_EVENT_CONFIRMED'&&Number(e.status||0)===0&&Object.hasOwn(nativeLabels,safe(e.action).toLowerCase());
function logRow(row){
 if(row.dataset.ownerAuditExplained==='1')return;
 const cells=row.querySelectorAll(':scope > td');
 if(cells.length!==5)return;
 const title=cells[2].querySelector('b'),section=cells[2].querySelector('small');
 const details=cells[4].querySelector('details');
 if(!title||!details)return;
 const paras=[...details.querySelectorAll(':scope > p')];
 const http=paras.map(p=>p.textContent).find(x=>/^HTTP \d{3}$/.test(x||''));
 const path=safe(row.dataset.siteAuditPath||section?.textContent),kind=row.dataset.siteAuditKind||kindLabels[safe(title.textContent)]||'';
 const target=details.querySelector('[data-site-audit-target]')?.textContent||((paras[1]?.textContent&&!/^(?:HTTP \d{3}$|ID:)/.test(paras[1].textContent))?paras[1].textContent:'');
 const event={kind,path,action:safe(paras[0]?.textContent),status:http?Number(http.slice(5)):0,target:safe(target),
  source:row.dataset.siteAuditSource,role:row.dataset.siteAuditRole,effectiveRole:row.dataset.siteAuditEffectiveRole,
  reasonCode:row.dataset.siteAuditReasonCode,serverCode:row.dataset.siteAuditServerCode,phase:row.dataset.siteAuditPhase};
 // The original row (including method, HTTP code, ID and raw path) remains intact.
 const note=explainAuditEvent(event);
 const summary=document.createElement('div');
 summary.className='ow-audit-explanation-title';
 summary.textContent=note.title;
 cells[2].prepend(summary);
 const reason=document.createElement('div');
 reason.className='ow-audit-explanation-result';
 reason.textContent=note.outcome;
 if(isNativeEvent(event))cells[3].textContent='Событие сервера';
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
 if(event.source==='server'){
   const facts=[
     ['Код HTTP-результата',event.reasonCode],
     ['Причина сервера',event.serverCode],
     ['Этап',phaseNames[event.phase]],
     ['Фактическая роль',roleNames[event.role]],
     ['Роль кабинета',roleNames[event.effectiveRole]]
   ];
   for(const [label,value] of facts){
     if(!value)continue;
     if(label.startsWith('Код')||label==='Причина сервера')if(!/^[A-Z0-9_]{1,80}$/.test(value))continue;
     const p=document.createElement('p');
     p.className='ow-audit-technical-line';
     p.textContent=label+': '+value;
     details.append(p);
   }
 }
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
   disclaimer.textContent='Сервер фиксирует результат обращений к зарегистрированным API, действия и ошибки, а также скачивания. Успешный фоновый опрос и неизвестные пути не дублируются. Категория сама по себе не доказывает, что конкретное действие совершено.';
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
