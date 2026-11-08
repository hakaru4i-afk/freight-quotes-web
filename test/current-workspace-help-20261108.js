/* LW-GUIDE-02: current role FAQ and inline visible field help, staging only. */
(()=>{"use strict";
const DATA={
ru:{
title:"Инструкции и FAQ · Logistics Workspace",
flow:"Действующий цикл: заявка владельца → ставки перевозчиков → выбор одной ставки → исполнение победителем → завершение.",
faq:[
["Как начать работу?","Войдите с данными администратора. Слева доступны только разделы вашей роли. Начните с «Главная» и назначенных задач."],
["Чем заявка отличается от перевозки?","Заявка собирает ставки. Исполнение начинается отдельно после выбора победителя. Это разные меню и статусы."],
["Кто выбирает победителя?","Только Владелец выбирает одну конкретную ставку; участие и допуск не означают победу."],
["Что происходит после дедлайна?","До выбора победителя можно подать позднюю ставку; Владелец решает учитывать её. Просрочка и Service Level учитываются отдельно."],
["Как работать с документами?","Загружайте файлы в конкретный заказ/заявку, проверяйте их сохранение и скачивание. Чужие файлы недоступны."],
["Чем отличаются номера?","TR — неизменный регистрационный номер. Номер заказа компании, номер заказа поставщика и номера Bitrix — разные поля."],
["Где транспортная заявка и ВЭД?","Создание транспортной заявки отложено. Автоматические задачи ВЭД исключены из текущего активного сценария."],
["Как сообщить об ошибке?","Откройте «Предложения», выберите «Исправление», «Доработка» или «Разработка», опишите экран и ожидаемый результат. Владелец изменит статус в «Центре доработок»."],
["Как заполнить Excel-шаблон?","Скачайте шаблон в форме, заполните колонки в Excel или WPS, загрузите файл и проверьте перенос. Импорт не отправляет ставку: после него нажмите штатную кнопку отправки."],
["Что означают статусы предложений?","Отправлено → Прочитано → Оценено → В работе → Выпуск (с датой) → Завершено. Возможен «Отказано в разработке». Завершение отмечают после проверки."],
["Как новому партнёру связаться с компанией?","На публичной странице есть форма «Сотрудничество». Владелец получает обращение и отдельно решает вопрос о доступе."]
],
roles:{
owner:["Создайте перевозку: заполните номера заказа/Bitrix, сроки, груз, вес/объём, Incoterms и вложения.","Опубликуйте запрос и проверьте журнал адресатов.","Сравните предложения по маршрутам, срокам, суммам и валютам; поздние ставки рассматривайте отдельно.","Выберите ровно одну ставку и проверьте корректный архив проигравших.","Контролируйте документы, ход перевозки, итоговые суммы и закрытие.","Просматривайте обращения потенциальных партнёров в «Помощь / FAQ»."],
carrier:["Откройте «Мои заявки», условия и вложения.","Укажите маршрут, станции, транспорт (авто/ЖД/море/авиа), цену, валюту, сроки; отказ — только с причиной.","Для нескольких ставок добавьте отдельные варианты; после Excel/CSV проверьте каждое поле.","До выбора победителя поздняя ставка доступна с отметкой о просрочке.","После победы «Взять в работу» в «Мои заявки», затем «Мои перевозки» для исполнения, трекинга и файлов. Транспортная заявка сейчас отложена.","Проигравшие не исполняют перевозку.","Для обращения по сайту откройте «Предложения», выберите тип и напишите описание."],
logistic:["Работайте с доступными реестрами и ставками.","Сверяйте маршрут, сроки, статусы и вложения.","Не утверждайте ставку вместо Владельца; задачи ВЭД пока не создаются."],
supplier:["Откройте назначенный заказ поставщика.","Загрузите запрошенные документы, укажите фактическую готовность, если поле доступно.","При запросе добавьте фото погрузки и проверьте сохранение.","Не используйте чужие заявки; о недоступных полях сообщите Владельцу."],
designer:["Откройте назначенные задания, если раздел доступен.","Проверьте материалы товара и требования.","Прикрепите результат и отметьте выполнение через доступные элементы."],
content:["Откройте доступные задания по контенту.","Проверьте карточку товара, изображения и документы.","Укажите результат и запросите недостающие материалы там, где разрешено."],
purchasing:["Откройте доступные заказы.","Проверьте готовность и документы поставщика.","Сообщайте о недостающей функции Владельцу."],
certification:["Проверьте назначенные документы по товару.","Загрузите результат только в доступной форме.","ВЭД не участвует в текущем процессе."]
}},
en:{
title:"Instructions & FAQ · Logistics Workspace",flow:"Current workflow: Owner request → carrier quotes → one winning offer → execution → closure.",
faq:[
["How do I start?","Sign in with administrator-issued credentials. Use the left menu for your assigned role."],
["Request versus shipment?","The request collects rates. Shipment execution starts separately once the Owner selects a winner."],
["Who chooses the winner?","Only the Owner selects a specific winning offer."],
["Late quotes?","A late quote may be sent before the winner is chosen; the Owner decides if it is considered. Service Level still applies."],
["How do files work?","Upload files to their request/order and verify saving and downloads. Other users' private files are restricted."],
["Which numbers matter?","TR registration, company order, supplier order and Bitrix tasks are separate references."],
["Transport application and foreign trade?","The transport application is deferred and foreign-trade tasks are excluded from the active workflow."],
["Found a bug?","Open Suggestions, select Fix, Improvement or Development, and describe the screen and expected result. The Owner processes it in Improvement Center."],
["How do I use the Excel template?","Download the form template, fill separate columns in Excel or WPS, upload and review the transfer. Import does not submit an offer; press Submit afterwards."],
["What are suggestion statuses?","Submitted → Read → Evaluated → In progress → Release (with a date) → Completed, or Rejected. Completion requires verification."],
["How do new partners join?","Use the public Partnership form. The Owner receives requests and grants accounts separately."]
],
roles:{
owner:["Create a request with order, Bitrix, dates, cargo, Incoterms and files.","Publish and review carrier notification log.","Compare routes, timings, prices and currencies.","Select one offer and verify losing statuses.","Monitor execution, tracking and closure.","Review partner inquiries in Help / FAQ."],
carrier:["Open assigned requests and attachments.","Enter stations, route, road/rail/sea/air, amount, currency and dates; give a reason to decline.","For variants use separate offers and check Excel/CSV import.","Late offers are possible until winner selection.","If awarded, accept in My Requests, then use My Shipments for execution, tracking and files. Transport-application drafting is deferred.","Unselected carriers cannot execute.","Report portal issues using the Suggestions form."],
logistic:["Review permitted requests and offers.","Check route, timing and files.","Do not select the winner; no active foreign-trade handoff."],
supplier:["Open assigned orders.","Enter readiness and attach documents where enabled.","Attach loading photos if requested.","Report unavailable fields to the Owner."],
designer:["Open assigned tasks.","Check materials and instructions.","Upload output and mark completed where enabled."],
content:["Review assigned product content.","Check files and photos.","Request missing materials through authorized controls."],
purchasing:["Review permitted supplier orders.","Check readiness and documents.","Escalate missing features."],
certification:["Review assigned documents.","Upload evidence in permitted fields.","No active foreign-trade task routing."]
}},
zh:{
title:"操作说明与常见问题 · Logistics Workspace",flow:"当前流程：负责人询价 → 承运商报价 → 选择唯一报价 → 执行运输 → 完成。",
faq:[
["如何开始？","使用管理员提供的账号登录，从左侧菜单查看允许的任务。"],
["询价和运输的区别？","询价收集报价，选出唯一中标报价后进入独立的运输执行流程。"],
["谁选中标报价？","只有负责人有权选择具体的中标报价。"],
["可以逾期报价吗？","选定中标报价前可以逾期提交，由负责人决定是否考虑，服务水平规则仍有效。"],
["如何上传文件？","上传到对应订单并确认保存，不得查看他人的受限文件。"],
["编号有什么区别？","TR 登记号、公司订单号、供应商订单号和 Bitrix 任务编号各不相同。"],
["运输申请和外贸任务呢？","运输申请暂缓，外贸任务已从当前流程移除。"],
["发现问题怎么办？","在“建议”中选择修复、改进或开发，描述页面和期望结果。所有者在改进中心处理。"],
["如何使用 Excel 模板？","下载表格模板，在 Excel 或 WPS 中逐列填写，上传后检查。导入不会自动提交报价，还需要点击提交。"],
["建议状态如何变化？","已提交 → 已阅读 → 已评估 → 处理中 → 发布（附日期）→ 已完成；也可能被拒绝。验证后才能标记完成。"],
["如何成为合作伙伴？","使用公开合作表单；负责人审核后单独开通账号。"]
],
roles:{
owner:["创建询价并填写订单、Bitrix、货物、时间和附件。","发布并查看承运商通知。","比较路线、时效、报价和币种。","选择唯一中标报价。","跟踪运输和结案。","在帮助栏目查看合作申请。"],
carrier:["打开指定询价及附件。","填写路线、运输方式、报价、币种和时效。","核对 Excel/CSV 导入及多个方案。","中选前可逾期报价。","中标后在“我的申请”接单，在“我的运输”处理追踪和文件；运输申请目前暂缓。","未中选不能执行运输。","通过“建议”提交网站修复或改进要求。"],
logistic:["查看权限内的报价和申请。","核对路线、时效和文件。","不可代替负责人选择报价。"],
supplier:["打开分配的订单。","在可用字段填写备货时间和文件。","按要求上传装货照片。","向负责人反馈缺失功能。"],
designer:["查看指定设计任务。","核对产品资料。","提交材料和结果。"],
content:["检查分配的内容任务。","核对图片和资料。","通过已授权的功能申请补齐材料。"],
purchasing:["查看允许的供应商订单。","核对备货和文件。","向负责人反馈缺失功能。"],
certification:["查看分配的商品文件。","按权限上传证明。","当前不自动生成外贸任务。"]
}}
};
const H=[
[/service.?level|уровень сервиса|оценка sl|服务水平/,["SL перевозчика: штрафы учитываются по событиям, не меняйте их через текстовое поле.","Carrier SL: penalties are event based, not edited via this field.","承运商服务等级按事件扣分，不在此字段更改。"]],
[/итогов.*сумм|final.?amount|final.?cost|最终运费/,["Подтверждённая итоговая стоимость и валюта; не подменяйте исходную ставку.","Confirmed final cost and currency, separate from the original offer.","最终确认的运费及币种，不能覆盖原报价。"]],
[/страхован|insurance|保险/,["Уточните страховку: включена ли в ставку, каковы лимит и условия.","Specify insurance cover and whether it is included in this quote.","说明保险范围及是否包含在报价中。"]],
[/действительн.*ставк|valid.?until|quote.?validity|报价有效期/,["Дата окончания действия предложения перевозчика.","Expiry date of the carrier quotation.","承运商报价有效期截止日。"]],
[/пто|таможн|customs|海关/,["Укажите подтверждённые место, дату и таможенный этап. В текущем процессе задачи ВЭД не создаются.","Enter confirmed customs location, date and status; no VED tasks in this flow.","填写已确认的海关地点、日期和状态；当前不生成外贸任务。"]],

[/bitrix|битрикс|任务/,["Номер задачи Bitrix, например 5316; несколько номеров внесите отдельно.","Bitrix task number, e.g. 5316; list others separately.","Bitrix 任务号，例如 5316。"]],
[/номер заказа поставщика|supplier.?order|供应商订单/,["Номер заказа поставщика из проформы, отдельно от заказа компании.","Supplier's order number from the proforma.","供应商文件中的订单号。"]],
[/номер заказа|order.?code|订单号/,["Внутренний номер заказа компании, как в исходных документах.","Company order number from documents.","公司内部订单号。"]],
[/готовност|ready|备货/,["Дата готовности товара, плановая либо фактическая по названию поля.","Planned or actual cargo readiness as specified.","按字段填写计划或实际备货日期。"]],
[/дедлайн|ставки принимаются|deadline|截止/,["Конец обычного приёма ставок по времени Минска.","Standard quote deadline, Minsk time.","明斯克时间的报价截止日期。"]],
[/incoterm|инкотерм|贸易条款/,["Условие Incoterms 2020 и конкретное место поставки.","Incoterms 2020 rule and named place.","Incoterms 2020 和约定地点。"]],
[/вес|weight|重量/,["Вес всей партии в кг вместе с упаковкой.","Total gross weight including packing, kg.","含包装的总毛重（kg）。"]],
[/объ.?м|volume|体积/,["Общий объём партии в м³.","Total consignment volume in m³.","货物总体积（m³）。"]],
[/груз|cargo|货物/,["Название товара и описание партии по спецификации.","Goods description matching the specification.","按规格书填写货物说明。"]],
[/опасн|hazard|危险/,["Отметьте опасность согласно документам; не угадывайте.","Use actual hazardous goods documents.","根据真实文件判断危险品。"]],
[/погруз|origin|起运/,["Адрес фактического забора, город и страна.","Real pickup location, city and country.","真实装货地址、城市和国家。"]],
[/назначен|destination|目的/,["Конечная станция/порт или адрес доставки.","Final station, port or delivery address.","目的站、港口或地址。"]],
[/промежут|waypoint|途经/,["Порты, станции и переходы по маршруту по порядку.","Intermediate ports/stations in order.","按顺序填写中转点。"]],
[/маршрут|route|路线/,["Последовательность станций, портов и пунктов движения.","Ordered route points.","按顺序填写运输路线。"]],
[/валют|currency|币种/,["Реальная валюта предложения, не обязательно USD.","Quote currency, not necessarily USD.","报价币种，不一定是美元。"]],
[/ставк|сумм|amount|rate|报价/,["Цена именно этого варианта ставки; дополнительные расходы отдельно.","Price for this quote variant; extras separately.","该方案报价，附加费另填。"]],
[/вид транспорт|transport.?mode|运输方式/,["Выберите авто, ЖД, море или авиа.","Choose road, rail, sea or air.","选择公路、铁路、海运或空运。"]],
[/eta|прибыт|arrival|到达/,["Плановая дата прибытия, не факт.","Estimated arrival, not actual arrival.","预计到达，不是实际到达。"]],
[/фактическ.*выход|actual.?departure|实际发运/,["Фактическое время отправления по подтверждению.","Actual confirmed departure.","实际确认的发运时间。"]],
[/контейнер|container|集装箱/,["Реальный номер контейнера, если известен. Пустое поле не останавливает исполнение; при закрытии может понадобиться решение владельца.","Actual container number if known. Missing data does not block execution; closure may require Owner decision.","如已知填写真实箱号；缺失不阻碍执行，结案可能需要所有者确认。"]],
[/местополож|location|位置/,["Текущее место груза и дата сведений.","Cargo location and observation date.","货物位置及更新时间。"]],
[/причин|reason|原因/,["Конкретная причина отказа или переноса.","Specific decline or reschedule reason.","拒绝或延期的具体原因。"]],
[/претензи|claim|索赔/,["Событие, доказательства и сумма требования.","Incident, evidence and claimed amount.","事件、证据及金额。"]],
[/вложени|файл|документ|upload|file|附件|文件/,["Загрузите документ именно этого заказа; проверьте результат.","Upload this order's document and verify saving.","上传对应订单文件并确认保存。"]],
[/фото|photo|图片/,["Чёткое фото фактической погрузки или товара.","Clear actual loading/product photo.","清晰的实际装货照片。"]],
[/контакт|contact|联系人/,["Имя и рабочий телефон/email ответственного.","Contact name and reachable email/phone.","联系人及可用电话或邮箱。"]],
[/тип обращения|request.?type|category|类别/,["Выберите «Доработка», «Исправление» или «Разработка».","Choose Improvement, Fix or Development.","选择改进、修复或开发类型。"]],
[/описани|description|说明/,["Опишите экран, действие, ошибку и ожидаемый результат без паролей.","Describe the screen, action, problem and expected result; no passwords.","描述页面、操作、问题和期望结果，不要提供密码。"]],
[/статус|status|状态/,["Укажите фактический статус; «Завершено» — только после проверки.","Select actual status; mark Completed only after verification.","选择实际状态；仅验证后标记完成。"]],
[/дата выпуска|release.?date|发布日期/,["Укажите назначенную дату публикации обновления.","Enter the scheduled release date.","填写已安排的发布日期。"]],
[/срок|date|日期/,["Проверьте дату, часовой пояс и является ли срок плановым или фактическим.","Check date, time zone, and whether planned or actual.","核对日期、时区及计划/实际类型。"]],
[/коммент|примечан|note|备注/,["Только фактическое пояснение, без паролей.","Relevant factual note, no passwords.","实际说明，不要填写密码。"]]
];
const lang=()=>{let l=(document.documentElement.lang||"ru").toLowerCase();return l.startsWith("en")?"en":l.startsWith("zh")?"zh":"ru"};
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const role=()=>{const raw=String(document.querySelector(".cabinet-app")?.getAttribute("data-cabinet-role")||window.freightAccess?.role||"").toLowerCase();if(/purchase|procure|закуп/.test(raw))return "purchasing";if(/content|контент/.test(raw))return "content";if(/designer|дизайн/.test(raw))return "designer";if(/certificate|certification|ved|вэд/.test(raw))return "certification";if(/owner|владел/.test(raw))return "owner";if(/carrier|перевоз/.test(raw))return "carrier";if(/supplier|постав/.test(raw))return "supplier";if(/logistic|логист/.test(raw))return "logistic";return raw;};
const roleTitles={
owner:["Владелец","Owner","所有者"],carrier:["Перевозчик","Carrier","承运商"],logistic:["Логист","Logistician","物流专员"],supplier:["Поставщик","Supplier","供应商"],designer:["Дизайнер","Designer","设计师"],content:["Контент-менеджер","Content manager","内容经理"],purchasing:["Менеджер по закупкам","Purchasing manager","采购经理"],certification:["Сертификация","Certification","认证"]};
const roleQuestions={
owner:{ru:[["Как допустить позднюю ставку?","Отдельно решите, учитывать ли предложение с просрочкой. Допуск не означает победу."],["Что происходит после выбора?","Только одна ставка становится победителем, остальные закрывают раунд и уходят в архив."]],en:[["Late offer?","Decide separately whether to consider it; admission does not award a winner."],["After awarding?","Only one offer wins; the others close and archive."]],zh:[["逾期报价怎么办？","单独决定是否审核，准入不代表中标。"],["选择中标方后？","仅一份报价中标，其余报价关闭并归档。"]]},
carrier:{ru:[["Импорт Excel отправляет ставку?","Нет. Проверьте сумму, валюту, маршрут и даты, затем нажмите «Отправить»."],["После победы что делать?","Нажмите «Взять в работу» в «Мои заявки», далее исполнение в «Мои перевозки». Отдельная транспортная заявка отложена."],["После дедлайна можно ответить?","До выбора победителя можно подать позднюю ставку. Владелец отдельно решает, учитывать ли её."]],en:[["Does Excel import submit?","No. Check price, currency, route and dates, then submit."],["After winning?","Start Work in My Requests, then execution in My Shipments; the transport application is deferred."],["Late quotes?","Allowed before winner selection; the Owner decides whether to consider them."]],zh:[["导入 Excel 就提交了吗？","不会。核对金额、币种、路线和日期，然后点击提交。"],["中标后怎么办？","在我的申请中开始处理，再到我的运输执行；运输申请暂缓。"],["逾期报价？","选定中标方前可提交，由所有者决定是否采纳。"]]},
supplier:{ru:[["Какую готовность указывать?","Подтверждённую фактическую готовность товара; не заменяйте её плановой без пояснения."]],en:[["What readiness date?","Enter confirmed actual readiness, not an unverified forecast."]],zh:[["备货日期？","填写实际确认的备货日期，不要直接使用未确认的计划日期。"]]},
purchasing:{ru:[["Какие номера заказа?","Номер поставщика — из проформы; номер компании и Bitrix заполняются отдельно."]],en:[["Which order numbers?","Supplier number is from the proforma; company and Bitrix numbers are separate."]],zh:[["订单号如何填写？","供应商订单号来自形式发票，公司编号及 Bitrix 分别填写。"]]},
content:{ru:[["Когда отмечать выполнение?","После фактической проверки и передачи материалов по назначенному заданию."]],en:[["When to complete?","After checking and delivering assigned materials."]],zh:[["何时完成？","核实并交付分配的材料后。"]]},
designer:{ru:[["Куда прикреплять результат?","В назначенное задание, в доступном вам разделе документов."]],en:[["Where to upload?","Use the documents section of your assigned task."]],zh:[["成果上传到哪里？","上传至所分配任务的文件部分。"]]},
logistic:{ru:[["Можно выбирать победителя?","Нет. Победителя выбирает Владелец; задачи ВЭД в текущем цикле не создаются."]],en:[["Can I award a carrier?","No. Only the Owner selects a winner; no VED tasks in the active process."]],zh:[["可以选中标方吗？","不可以。只有所有者可选定；当前无外贸任务。"]]},
certification:{ru:[["Какие документы доступны?","Только материалы назначенных вам задач в рамках предоставленных прав."]],en:[["Which files can I see?","Only files associated with assigned and authorized tasks."]],zh:[["可以访问哪些文件？","仅可访问已分配且已授权任务的文件。"]]}
};
const ownerNavigationGuide={
ru:{
title:"Карта разделов кабинета владельца · 08.11.2026",
sections:[
["Рабочий стол","Новый тёмный рабочий стол: показатели заявок, очереди решений, тендеров и перевозок, распределение по транспорту, маршруты, таблица и срочные действия. Цифры поступают из тестовой базы; «—» означает, что данные не загрузились. Кнопка «Новая заявка» открывает существующую форму, а не создаёт второй процесс."],
["01 · Заявки и ставки","Новая заявка → Реестр заявок → Рассмотрение ставок → Сроки и ответы → Тендеры. «Рассмотрение» выбирает ставку; «Сроки и ответы» контролирует дедлайны и ответы."],
["02 · Исполнение","Исполнение перевозок → Чаты по заявкам → Претензии и акты → Инциденты. Претензия относится к конкретной перевозке, журнал инцидентов — к учёту случаев."],
["03 · Контрагенты","Поставщики и документы; Дизайн и контент. Это разные задания и документы, их не объединяем."],
["04 · Контроль и аналитика","На главной блок Service Level показывает средний балл перевозчиков и количество в группах 76–100%, 51–75%, 0–50%. «Журнал и оценки SL» открывает подробности, основания штрафов и разблокировку. Аналитика, SLA и работа сайта остаются отдельными функциями; SLA не заменяет сроки в заявке."],
["05 · Управление","Пользователи и доступ; Уровни доступа; Центр доработок. Первый раздел — учётные записи, второй — права, третий — замечания/разработки."],
["Справка","Помощь / FAQ. Отдельная транспортная заявка скрыта из активного меню: её процесс отложен, исходный код сохранён."]
]},
en:{
title:"Owner workspace navigation · 08 Nov 2026",
sections:[
["Workspace","The redesigned dark dashboard shows live requests, pending decisions, tenders, shipments, transport types, routes and action queue. A dash means data is unavailable, not zero. New Request opens the existing workflow."],
["01 · Requests & quotes","New Request → Request Register → Offer Review → Deadlines & Replies → Tenders. Review selects rates; deadlines track responses."],
["02 · Execution","Shipment Execution → Request Chats → Claims & Acts → Incidents. Claims belong to a shipment; incidents have a separate log."],
["03 · Partners","Suppliers & Documents; Design & Content are separate authorized workflows."],
["04 · Oversight & analytics","The home Service Level panel shows average carrier score and carrier counts across 76–100%, 51–75% and 0–50%. Open the SL journal for penalties, detailed scores and Owner unlock controls. Analytics, SLA and site monitoring remain separate."],
["05 · Administration","Users & Access; Access Levels; Improvement Center. Accounts, permissions and improvement reports are separate."],
["Help","Help / FAQ. The separate transport application is deferred and hidden from the active menu; its sources remain preserved."]
]},
zh:{
title:"所有者工作台导航 · 2026年11月8日",
sections:[
["工作台","新的深色主页展示真实的询价、待办、招标、运输、运输方式、路线和紧急事项；“—”代表数据不可用，不是零。新询价按钮进入现有表单。"],
["01 · 询价与报价","新询价 → 询价登记 → 报价评审 → 截止及答复 → 招标。报价评审用于选价，截止及答复用于监控响应。"],
["02 · 运输执行","运输执行 → 询价聊天 → 索赔与凭证 → 事件登记。索赔针对具体运输，事件登记是独立日志。"],
["03 · 合作伙伴","供应商及文件；设计及内容属于不同的授权流程。"],
["04 · 分析与监控","首页 Service Level 显示承运商平均得分及 76–100%、51–75%、0–50% 三档人数。进入 SL 日志查看扣分、详情和所有者解锁功能；SLA 与截止日期监控仍为独立模块。"],
["05 · 管理","用户及访问；权限级别；改进中心。账户、权限和改进建议各自独立。"],
["帮助","帮助与常见问题。独立运输申请已从当前菜单隐藏，功能留待后续开发。"]
]}
};
const generic={ru:"Укажите достоверное значение и проверьте его перед сохранением.",en:"Enter accurate information and verify before saving.",zh:"填写真实信息并在保存前核对。"};
let queued=false,hintId=0;
function update(){
const l=lang(),data=DATA[l],r=role(),host=document.querySelector('.cabinet-panel[data-section="help"]');
if(host){let box=host.querySelector("#lw-current-help"),key=l+"-"+r;
if(!box){box=document.createElement("section");box.id="lw-current-help";host.prepend(box)}
if(box.dataset.version!==key){box.dataset.version=key;
box.innerHTML="<h2>"+escapeHtml(data.title)+"</h2><p>"+escapeHtml(data.flow)+"</p>"+
(data.roles[r]?"<h3>"+escapeHtml((roleTitles[r]||[r,r,r])[l==="ru"?0:l==="en"?1:2])+" · "+escapeHtml(l==="ru"?"Инструкция по кабинету":l==="en"?"Role guide":"岗位操作指南")+"</h3><ol>"+data.roles[r].map(a=>"<li>"+escapeHtml(a)+"</li>").join("")+"</ol>":"")+(roleQuestions[r]?.[l]?"<h3>"+escapeHtml(l==="ru"?"FAQ по кабинету":l==="en"?"Role FAQ":"岗位常见问题")+"</h3>"+roleQuestions[r][l].map(([q,a])=>"<details><summary>"+escapeHtml(q)+"</summary><p>"+escapeHtml(a)+"</p></details>").join(""):"")+
(r==="owner"?"<section class=\"lw-owner-guide\"><h3>"+escapeHtml(ownerNavigationGuide[l].title)+"</h3><dl>"+ownerNavigationGuide[l].sections.map(([section,body])=>"<dt>"+escapeHtml(section)+"</dt><dd>"+escapeHtml(body)+"</dd>").join("")+"</dl></section>":"")+"<h3>FAQ</h3>"+data.faq.map(([q,a])=>"<details><summary>"+escapeHtml(q)+"</summary><p>"+escapeHtml(a)+"</p></details>").join("");}}
const root=document.querySelector(".cabinet-app");if(!root)return;
let n=0;for(const field of root.querySelectorAll("input,textarea,select")){
if(n++>800)break;
if(["hidden","password","submit","button","reset"].includes(field.type)||field.closest("#lw-current-help,#lw-owner-inquiries,.cabinet-sidebar,.language-control"))continue;
if(!field.getClientRects().length)continue;
const label=field.closest("label")||field.labels?.[0]||field.closest(".field,.form-field,.t2-field");
const named=field.getAttribute?.("aria-label")||field.getAttribute?.("data-label")||field.placeholder||field.name||"";if(!label&&!named)continue;
let helper=field.nextElementSibling;if(!helper?.classList.contains("lw-field-help")){
helper=document.createElement("small");helper.className="lw-field-help";field.insertAdjacentElement("afterend",helper);}
const info=((label?.textContent||named).replace(helper.textContent,"")+" "+(field.name||"")+" "+(field.placeholder||"")).slice(0,260);
const rule=H.find(row=>row[0].test(info));const hint=field.type==="checkbox"?(l==="ru"?"Отметьте после выполнения указанного условия.":l==="en"?"Check only when the stated condition is met.":"仅满足条件后勾选。"):field.type==="radio"?(l==="ru"?"Выберите соответствующий фактам вариант.":l==="en"?"Choose the correct option.":"选择符合实际情况的选项。"):(rule?rule[1][l==="ru"?0:l==="en"?1:2]:generic[l]);field.title=hint;
if(helper.textContent!==hint)helper.textContent=hint; if(!helper.id)helper.id="lw-field-help-"+(++hintId);const described=(field.getAttribute?.("aria-describedby")||"").split(/\s+/).filter(Boolean);if(!described.includes(helper.id))field.setAttribute?.("aria-describedby",[...described,helper.id].join(" "));
}}
function tick(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update()})}
window.lwCurrentHelpEnabled=true;
new MutationObserver(tick).observe(document.getElementById("root")||document.body,{subtree:true,childList:true});
new MutationObserver(tick).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
window.addEventListener("hashchange",tick);
window.addEventListener("freight-access-updated",tick);
tick();
})();