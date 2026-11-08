/* Staging help refresh 2026-11-08: current process, contextual role FAQ, field-level guidance. */
(function () {
  "use strict";
  const VERSION="help-20261108-01";
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const lang=()=>{const x=(document.documentElement.lang||"ru").toLowerCase();return x.startsWith("zh")?"zh":x.startsWith("en")?"en":"ru";};
  const tr=(ru,en,zh)=>({ru,en,zh});
  const roles={
    owner:tr("Владелец","Owner","所有者"),
    carrier:tr("Перевозчик","Carrier","承运商"),
    supplier:tr("Поставщик","Supplier","供应商"),
    content:tr("Контент-менеджер","Content manager","内容经理"),
    purchase:tr("Менеджер по закупкам","Purchasing manager","采购经理"),
    logistic:tr("Логист","Logistics","物流专员"),
    ved:tr("ВЭД (отложено)","Foreign trade (deferred)","外贸（暂缓）"),
    general:tr("Общая инструкция","General guide","通用指南")
  };
  const generalSteps=[
    tr("Владелец создаёт и публикует «Новую перевозку». Номер TR, номер заказа и номера Битрикс — разные реквизиты.","Owner creates and publishes a New Shipment. TR, order number and Bitrix references are separate identifiers.","所有者创建并发布新运输任务。TR 登记号、订单号和 Bitrix 任务号是不同字段。"),
    tr("Перевозчики получают запрос, рассчитывают варианты, указывают стоимость, валюту, транспорт, маршрут и сроки, затем отправляют предложения.","Carriers receive the request, enter price, currency, mode, route and dates, and submit their offers.","承运商收到询价后填写报价、币种、运输方式、路线和日期，然后提交。"),
    tr("После дедлайна ставка может быть подана до выбора победителя, но помечается как поздняя. Владелец решает, учитывать ли её.","A late offer can be submitted until the winner is selected; it is marked late and the Owner decides whether to consider it.","截止后至选定中标方前仍可提交逾期报价；由所有者决定是否纳入评审。"),
    tr("Только Владелец выбирает одного победителя. Победитель принимает перевозку через «Мои заявки»; исполнение и трекинг — в «Мои перевозки».","Only the Owner selects one winner. The winner accepts it in My Requests; execution and tracking are in My Shipments.","只有所有者可选定唯一中标方。承运商在“我的申请”接受后，通过“我的运输”执行及跟踪。"),
    tr("Создание и согласование транспортной заявки перевозчиком временно исключены из активного процесса. ВЭД не является обязательным участником текущего цикла.","Carrier transport-application drafting and approval are deferred. Foreign-trade staff are not a required participant in the current flow.","承运商运输申请的创建与审批暂缓；目前业务流程不要求外贸人员参与。")
  ];
  const roleSteps={
    owner:[
      tr("Откройте «Новая перевозка», заполните обязательные реквизиты и приложите документы, затем опубликуйте запрос.","Open New Shipment, complete required fields and attachments, then publish the request.","打开“新运输”，填写必填字段、添加附件后发布。"),
      tr("В «Рассмотрении ставок» сравните варианты и поздние предложения; выберите одного победителя. Обоснование выбора необязательно.","Compare offers, including late ones, in Offer Review; select one winner. The reason is optional.","在报价评审中比较正常及逾期报价，选定一名中标方；选择理由可选填。"),
      tr("Контролируйте сроки и статусы; в «Центре доработок» обрабатывайте обращения и назначайте выпуск.","Monitor deadlines and statuses; process improvement requests and plan releases in Improvement Center.","查看截止时间和状态；在改进中心处理建议及安排发布。")
    ],
    carrier:[
      tr("«Мои заявки» — новые запросы, черновики, отправленные ставки и выигранные перевозки; сначала нажмите «Взять в работу».","My Requests contains new requests, drafts, submitted offers and awarded shipments; first select Start Work.","“我的申请”包含新任务、草稿、已提交报价及中标运输；先点击“开始处理”。"),
      tr("Заполните цену и валюту, тип транспорта, точки маршрута и даты. Для длинной формы используйте Excel-шаблон (Microsoft Excel или WPS), проверьте перенос и отдельно нажмите отправку.","Enter rate and currency, mode, route and dates. Use the Excel template (Excel or WPS) for long forms, review imported values and submit separately.","填写价格、币种、运输方式、路线和日期。长表单可用 Excel/WPS 模板，导入后核对并单独提交。"),
      tr("При победе примите перевозку в «Мои заявки», далее работайте в «Мои перевозки»: документы, этапы, местоположение и сроки. Транспортную заявку сейчас не создавайте — функция отложена.","If awarded, accept in My Requests and continue in My Shipments: documents, stages, tracking and deadlines. Transport-application drafting is deferred.","中标后在“我的申请”接受，并在“我的运输”处理文件、节点和日期。运输申请功能暂缓。"),
      tr("Для сообщения об ошибке или улучшении откройте «Предложения», выберите «Исправление»/«Доработка»/«Разработка» и отправьте описание.","Report a problem or improvement in Suggestions: choose Fix, Improvement or Development, describe it, and submit.","在“建议”中选择修复、改进或开发，填写描述后提交。")
    ],
    supplier:[
      tr("Откройте назначенный заказ и сверьте его номер с приложенной проформой и данными владельца.","Open the assigned order and compare its number with the attached pro forma and Owner data.","打开分配的订单，并核对形式发票与所有者提供的信息。"),
      tr("Загрузите запрошенные документы, заполните фактическую готовность груза; при доступном требовании приложите фото погрузки.","Upload requested documents and enter actual cargo readiness; provide loading photos when requested in the form.","上传所需文件并填写实际备货日期；按界面要求上传装货照片。"),
      tr("Общайтесь только в чате соответствующего заказа; не изменяйте реквизиты, закреплённые за Владельцем.","Use the chat of the corresponding order; do not change Owner-controlled fields.","仅在相关订单的聊天中沟通，不修改所有者锁定的字段。")
    ],
    content:[
      tr("Откройте назначенные материалы, проверьте файлы и комплектность содержимого.","Open assigned materials and check files and completeness.","打开分配的资料，检查文件及完整性。"),
      tr("Отмечайте выполненные проверки доступными флажками и уточняйте недостающее в чате с поставщиком.","Mark completed checks using the available checkboxes and ask the supplier about missing materials in chat.","使用复选框确认已完成的检查，并通过聊天向供应商索取缺失资料。")
    ],
    purchase:[
      tr("Проверяйте назначенные закупочные задачи, номера заказов поставщика и приложенные документы.","Review assigned purchasing tasks, supplier order numbers and attachments.","检查分配的采购任务、供应商订单号和附件。"),
      tr("Изменяйте только доступные поля; замечания к процессу отправляйте через «Предложения».","Edit only permitted fields and send process feedback through Suggestions.","仅编辑有权限的字段，通过“建议”提交流程问题。")
    ],
    logistic:[
      tr("Просматривайте закреплённые заявки, предложения, маршруты и сроки в доступных разделах.","Review assigned requests, offers, routes and deadlines in accessible sections.","在有权限的页面查看申请、报价、路线和期限。"),
      tr("Выбор победителя и изменение полей Владельца доступны только Владельцу.","Winner selection and changes to Owner fields are reserved for the Owner.","只有所有者能选定中标方及修改所有者专属字段。")
    ],
    ved:[
      tr("ВЭД исключён из обязательного маршрута нового запроса и согласования перевозчиком транспортной заявки. Исторические документы не удаляются.","Foreign-trade staff are excluded from the mandatory new-request flow and carrier transport-application approval. Historical records remain.","外贸人员不参与当前新申请及承运商运输申请审批的必经流程；历史记录保留。")
    ],
    general:[]
  };
  const questions=[
    [tr("Как сохранить данные из Excel?","How do I import Excel data?","如何从 Excel 导入？"),tr("Скачайте шаблон в форме, заполните отдельные колонки в Microsoft Excel/WPS, загрузите его, проверьте значения. Импорт заполняет поля, но не отправляет заявку: нажмите штатную кнопку отправки.","Download the template in the form, fill separate columns in Excel/WPS, upload and review the values. Import fills fields but does not submit; click Submit afterwards.","下载表格模板，在 Excel/WPS 中逐列填写，上传后检查。导入仅填充字段，仍需点击提交。")],
    [tr("Чем отличаются TR, номер заказа и Битрикс?","What is the difference between TR, order and Bitrix numbers?","TR、订单号、Bitrix 编号有何不同？"),tr("TR — постоянный регистрационный номер запроса. Номер заказа компании, номер заказа поставщика и задача Битрикс записываются отдельно; не подменяйте одно поле другим.","TR is the fixed request registration number. Company order, supplier order and Bitrix task references are separate fields.","TR 为固定登记号；公司订单号、供应商订单号和 Bitrix 任务号分别填写。")],
    [tr("Можно ли отправить ставку после дедлайна?","Can I submit an offer after the deadline?","截止后还可提交报价吗？"),tr("До выбора победителя — да, с отметкой о просрочке. Владелец решает, учитывать ли ставку. Возможные последствия для Service Level сохраняются по действующим правилам.","Yes, until a winner is selected. It is marked late; the Owner decides whether to consider it, and the Service Level rules still apply.","在选定中标方前可以，报价会标记逾期；是否采纳由所有者决定，服务等级规则仍适用。")],
    [tr("Где транспортная заявка и ВЭД?","Where are the transport application and foreign-trade stages?","运输申请和外贸节点在哪里？"),tr("Сейчас они не обязательны и частично скрыты по принятому решению. После выбора победителя работа идёт через «Мои заявки» → «Мои перевозки». Возврат транспортной заявки — отдельная будущая разработка.","They are currently deferred or hidden. After award, use My Requests → My Shipments. Restoring the transport application is a separate future development.","这些功能目前已暂缓或隐藏。中标后使用“我的申请”→“我的运输”。恢复运输申请属于后续开发。")],
    [tr("Кто видит мои сведения?","Who can see my information?","谁可以查看我的资料？"),tr("Разделы и действия зависят от роли. Перевозчик работает со своими заявками, а защищённые реквизиты меняет только Владелец. FAQ не открывает доступ к чужим данным.","Sections and permissions depend on role. Carriers work with their own requests; protected fields are editable by the Owner only. Help content does not grant access to other data.","页面和权限依角色而定。承运商仅处理自己的任务，锁定字段仅所有者可编辑。帮助不会授予额外数据权限。")],
    [tr("Как отправить замечание по сайту?","How do I report a portal issue?","如何反馈网站问题？"),tr("Откройте «Предложения», выберите тип «Доработка», «Исправление» или «Разработка», опишите действие и ожидаемый результат. Владелец видит обращение в «Центре доработок» и изменяет статус.","Open Suggestions, choose Improvement, Fix or Development, and describe the action and expected result. The Owner processes the request in Improvement Center.","打开“建议”，选择改进、修复或开发，描述操作和期望结果。所有者在改进中心处理并更新状态。")]
  ];
  const roleQuestions={
    owner:[[tr("Нужно ли писать причину выбора победителя?","Is a reason required when selecting a winner?","选择中标方必须填写理由吗？"),tr("Нет. Обоснование необязательно; итоговый выбор делает Владелец.","No. The reason is optional; only the Owner makes the final selection.","不必。理由可选填，最终由所有者决定。")]],
    carrier:[[tr("Почему Excel загрузился, но ставка не отправилась?","Why was Excel imported but the offer not submitted?","为何 Excel 已导入但报价未提交？"),tr("Импорт переносит значения в форму. Проверьте обязательные поля, валюту, варианты и подтверждение, затем нажмите «Отправить» или «Отправить все варианты».","Import only fills the form. Check required fields, currency, variants and confirmation, then click Submit or Submit all variants.","导入只填写表单；请检查必填项、币种、方案及确认，再点击提交。")]],
    supplier:[],
    content:[],
    purchase:[],
    logistic:[],
    ved:[],
    general:[]
  };
  const fieldRules=[
    [/битрикс|bitrix/,tr("Номер задачи Битрикс, например 5316; несколько номеров укажите отдельно.","Bitrix task number, e.g. 5316; enter each additional reference separately.","Bitrix 任务号，例如 5316；多个编号分别填写。")],
    [/поставщик.*заказ|supplier.?order|заказ.*поставщик/,tr("Номер заказа в документах поставщика, например WS26165.","Supplier's own order reference, e.g. WS26165.","供应商订单号，例如 WS26165。")],
    [/номер заказа|order.?code|подстановк/,tr("Внутренний номер заказа компании, например C26EM090662; не TR.","Company order reference, e.g. C26EM090662; not TR.","公司内部订单号，例如 C26EM090662，不是 TR。")],
    [/готовност|ready.?date|readiness/,tr("Укажите дату готовности груза; фактическую — только после подтверждения поставщиком.","Enter cargo readiness date; record actual readiness only after supplier confirmation.","填写货物备妥日期；实际日期应在供应商确认后填写。")],
    [/дедлайн|ставки принимаются|valid.?until/,tr("Дата и время окончания приёма ставок; поздние предложения отмечаются отдельно.","Date/time of bid deadline; late bids are handled separately.","填写报价截止日期和时间；逾期报价另行标记。")],
    [/инкотермс|incoterm/,tr("Выберите условие Incoterms 2020 и укажите согласованное место/порт.","Select the Incoterms 2020 rule and named location or port.","选择 Incoterms 2020 条款及约定地点或港口。")],
    [/контакт отправител|shipper.?contact|loading.?contact/,tr("ФИО, телефон или email сотрудника склада/фабрики для связи при погрузке.","Loading contact name and telephone/email at the factory or warehouse.","填写装货联系人姓名及电话或邮箱。")],
    [/опасн|dangerous|msds/,tr("Укажите наличие опасного груза; при «Да» сообщите класс и приложите подтверждающие документы.","Specify whether cargo is hazardous; if yes, enter its class and attach documents.","注明是否为危险货物；若是，请填类别并上传证明材料。")],
    [/груз|cargo|наименование товара|товар/,tr("Краткое наименование груза, состав партии и тип упаковки без общих слов «товар».","Describe the cargo, shipment contents and packaging precisely.","清楚填写货物名称、批次内容及包装方式。")],
    [/объ.?м|volume/,tr("Общий объём в м³, например 8,45; проверьте единицы.","Total volume in m³, e.g. 8.45; verify units.","总体积（立方米），如 8.45；请核对单位。")],
    [/вес|weight/,tr("Вес всей партии с упаковкой в кг; при наличии укажите брутто.","Total packed shipment weight in kg; use gross weight if available.","含包装总重量（千克）；如有请填毛重。")],
    [/порт|станци|departure.?station|destination.?station/,tr("Название порта или станции, город и страна; не ограничивайтесь названием региона.","Station or port name, city and country.","填写站点或港口名称、城市及国家。")],
    [/маршрут|route|промежуточн|waypoint/,tr("Перечислите ключевые пункты маршрута по порядку: отправление → транзит → прибытие.","List route stops in travel order: origin → transit → destination.","按顺序填写路线：始发地→中转→目的地。")],
    [/конечн|пункт прибыт|destination|delivery.?address/,tr("Конечный адрес или терминал назначения, например Минск, Колядичи.","Final warehouse address or terminal, e.g. Kolyadichi, Minsk.","最终仓库地址或终点站，例如明斯克 Kolядичи。")],
    [/отправлен|погруз|origin|loading.?address/,tr("Место отправления: город, фактический адрес фабрики/склада или станция.","Origin: city and exact warehouse/factory address or station.","起运地：城市及工厂、仓库或车站地址。")],
    [/перевозчик|carrier/,tr("Укажите название перевозчика либо выберите доступную организацию.","Enter or select the carrier company name.","填写或选择承运公司名称。")],
    [/тип транспорта|вид транспорта|transport.?mode|^mode$|^transport$/,tr("Выберите фактический тип транспорта: авто, ЖД, море или авиа.","Select the actual mode: road, rail, sea or air.","选择运输方式：公路、铁路、海运或空运。")],
    [/валют|currency/,tr("Валюта указанной суммы: USD, EUR, CNY или доступный вариант.","Currency of the entered amount: USD, EUR, CNY or listed option.","选择金额币种：美元、欧元、人民币或列表选项。")],
    [/ставк|price|amount|стоимост|сумм/,tr("Введите числовую сумму предложения, без символов валюты; валюту выберите отдельно.","Enter the numeric price only; select currency in the separate field.","仅输入数字金额；币种在单独字段选择。")],
    [/eta|планов.*прибыт|срок доставки|transit/,tr("Ожидаемая дата прибытия или срок в соответствии с форматом поля; это прогноз.","Expected arrival date or transit duration as required by the field; it is an estimate.","按字段格式填写预计到达时间或运输时长。")],
    [/фактическ.*выход|actual.?departure/,tr("Заполняйте только после реального отправления груза, по подтверждённой дате.","Fill only after actual cargo departure, using the confirmed date.","仅在货物实际发出后填写确认的日期。")],
    [/контейнер|container/,tr("Номер контейнера, например ABCD1234567; если пока неизвестен, оставьте необязательное поле пустым.","Container number, e.g. ABCD1234567. Leave optional fields empty if unknown.","集装箱号，如 ABCD1234567；未知时非必填字段可留空。")],
    [/местополож|tracking|location/,tr("Текущий подтверждённый пункт и дату/время обновления; не указывайте предполагаемое как факт.","Verified current location and timestamp; do not present estimates as facts.","填写已确认的当前位置与更新时间，不将预测当作事实。")],
    [/фото|photo|изображени/,tr("Приложите чёткие фотографии груза/погрузки, чтобы были видны упаковка и маркировка.","Attach clear cargo/loading photos showing packing and marks.","上传清晰装货及包装标记照片。")],
    [/документ|вложени|attachment|upload|file/,tr("Выберите запрошенные файлы и убедитесь, что загрузка завершилась.","Select the requested files and verify successful upload.","选择所需文件并确认上传成功。")],
    [/тип обращения|request.?type|category/,tr("Выберите «Доработка», «Исправление» или «Разработка» по сути предложения.","Choose Improvement, Fix or Development based on the request.","按需求选择“改进”“修复”或“开发”。")],
    [/описани|description|предложени|пожелани/,tr("Опишите экран, действие, ошибку и ожидаемый результат; без паролей и личных данных.","Describe the screen, action, issue and expected result; do not include passwords.","描述页面、操作、问题及期望结果；勿填写密码。")],
    [/статус|status/,tr("Выберите фактически достигнутый этап; не отмечайте «Завершено» до проверки.","Select the actual stage; do not mark Completed before verification.","选择实际进度；验证前不要标记“已完成”。")],
    [/дат.*выпуск|release.?date/,tr("Планируемая дата публикации обновления; указывайте только после назначения выпуска.","Planned release date; set only when a release has been scheduled.","计划发布日期；仅在安排发布后填写。")],
    [/причин|reason/,tr("Кратко укажите конкретную причину действия или изменения.","State the concrete reason for the action or change.","简要说明操作或变更的具体原因。")],
    [/примечани|комментар|message|notes|comment/,tr("Укажите относящиеся к этой заявке детали и вопросы без конфиденциальных паролей.","Enter relevant details or questions; never include passwords.","填写相关说明或问题，不要提供密码。")],
    [/email|электронн.*почт/,tr("Рабочий email, например logistics@example.com.","Work email address, e.g. logistics@example.com.","工作邮箱，例如 logistics@example.com。")],
    [/телефон|phone|wechat/,tr("Контактный номер с кодом страны или доступный WeChat ID.","Telephone with country code or your WeChat ID.","含国家区号的电话或微信号。")]
  ];
  function activeRole(){
    const p=window.freightAccess&&window.freightAccess.role;
    const q=document.querySelector('.carrier-portal[data-cabinet-role], [data-cabinet-role]');
    const r=String(p||q?.dataset.cabinetRole||"general").toLowerCase();
    if(/owner|admin|владел/.test(r))return "owner";
    if(/carrier|перевоз/.test(r))return "carrier";
    if(/supplier|постав/.test(r))return "supplier";
    if(/content|designer|контент/.test(r))return "content";
    if(/purchase|procure|закуп/.test(r))return "purchase";
    if(/ved|customs|foreign/.test(r))return "ved";
    if(/logistic|логист/.test(r))return "logistic";
    return "general";
  }
  function renderHelp(){
    const host=document.querySelector('.cabinet-panel[data-section="help"]');
    if(!host)return;
    const l=lang(),r=activeRole(),key=VERSION+"-"+l+"-"+r;
    let section=host.querySelector("#portal-faq-current");
    if(section&&section.dataset.key===key)return;
    if(!section){section=document.createElement("section");section.id="portal-faq-current";host.append(section);}
    section.dataset.key=key;
    const intro=tr("Актуальная справка · 08.11.2026","Current help · 8 Nov 2026","最新帮助 · 2026年11月8日");
    const generalTitle=tr("Общий порядок работы","How the portal works","平台工作流程");
    const roleTitle=tr("Инструкция для кабинета","Workspace instructions","工作区操作指南");
    const faqTitle=tr("Вопросы и ответы","Frequently asked questions","常见问题");
    const tip=tr("Пояснение формата и пример заполнения размещены непосредственно под полями формы.","Field format and examples appear directly below the form controls.","各字段下方显示填写格式和示例。");
    const steps=a=>'<ol>'+a.map(x=>'<li>'+esc(x[l])+'</li>').join("")+'</ol>';
    section.innerHTML='<header><span class="ph-kicker">'+esc(intro[l])+'</span><h2>'+esc(generalTitle[l])+'</h2><p>'+esc(tip[l])+'</p></header>'+steps(generalSteps)+
      '<h3>'+esc(roleTitle[l])+' · '+esc(roles[r][l])+'</h3>'+(roleSteps[r].length?steps(roleSteps[r]):'<p>'+esc(tip[l])+'</p>')+
      '<h3>'+esc(faqTitle[l])+'</h3>'+[...questions,...roleQuestions[r]].map(pair=>'<details><summary>'+esc(pair[0][l])+'</summary><p>'+esc(pair[1][l])+'</p></details>').join("");
  }
  const norm=s=>String(s||"").replace(/[ⓘ?*：:]/g," ").replace(/\s+/g," ").trim();
  function findHint(el){
    const label=el.labels?.[0]||el.closest("label");
    const caption=norm((label?.querySelector("span")?.textContent||label?.textContent||el.getAttribute("aria-label")||el.placeholder||"").slice(0,160));
    const identity=String(el.name||el.id||"").replace(/[._-]/g," ");
    const combined=(caption+" "+identity).toLowerCase();
    const found=fieldRules.find(x=>x[0].test(combined));
    if(found)return found[1][lang()];
    if(el.type==="date"||el.type==="datetime-local")return tr("Выберите подтверждённую дату в формате поля.","Select the confirmed date using the field format.","按字段格式选择已确认日期。")[lang()];
    if(el.type==="number")return tr("Введите число и проверьте единицы измерения и ограничения поля.","Enter a number; verify units and limits.","输入数字并核对单位与限制。")[lang()];
    if(el.type==="file")return tr("Выберите подходящий файл и проверьте его загрузку.","Choose the appropriate file and confirm upload.","选择文件并确认上传。")[lang()];
    if(el.type==="checkbox")return tr("Отметьте только после выполнения указанного условия.","Check only when the stated condition is met.","仅满足条件时勾选。")[lang()];
    if(el.tagName==="SELECT")return tr("Выберите вариант, соответствующий фактическим данным.","Choose the option matching the actual situation.","选择符合实际情况的选项。")[lang()];
    return tr("Заполните данные по названию поля; обязательное поле нельзя оставлять пустым.","Enter the value described by the label; required fields cannot be empty.","根据字段名称填写，必填项不可留空。")[lang()];
  }
  function updateFields(){
    const nodes=document.querySelectorAll('.cabinet-panel input,.cabinet-panel textarea,.cabinet-panel select,.carrier-portal input,.carrier-portal textarea,.carrier-portal select');
    for(const el of nodes){
      if(el.closest('#portal-faq-current,#task2-faq,.auth-card,.hp,.ph-ignore')||["hidden","password","submit","button","reset"].includes(el.type)||el.hidden||el.getAttribute("aria-hidden")==="true")continue;
      const label=el.labels?.[0]||el.closest("label");
      if(!label&&!el.getAttribute("aria-label")&&!el.placeholder)continue;
      const key=VERSION+"-"+lang()+"-"+(el.name||el.id||"")+"-"+norm(label?.textContent||"").slice(0,50);
      if(el.dataset.portalHelpKey===key)continue;
      const hint=findHint(el);
      el.title=hint;
      const oldIcon=label?.querySelector(".t2-legacy-hint,.t2-help");
      if(oldIcon)oldIcon.title=hint;
      let small=el._portalHelpHint;
      if(!small||!small.isConnected){
        small=document.createElement("small");
        small.className="portal-field-hint";
        small.id="ph-"+Math.random().toString(36).slice(2,10);
        if(el.closest("label"))el.closest("label").append(small);
        else el.insertAdjacentElement("afterend",small);
        el._portalHelpHint=small;
      }
      small.textContent="ⓘ "+hint;
      const ids=(el.getAttribute("aria-describedby")||"").split(/\s+/).filter(Boolean);
      if(!ids.includes(small.id))el.setAttribute("aria-describedby",ids.concat(small.id).join(" "));
      el.dataset.portalHelpKey=key;
    }
  }
  function css(){
    if(document.getElementById("portal-help-css"))return;
    const style=document.createElement("style");
    style.id="portal-help-css";
    style.textContent='#task2-faq{display:none!important}#portal-faq-current{background:#fff;color:#213a30;border:1px solid #dce7e0;border-radius:14px;padding:20px;margin:16px 0;font-size:14px;line-height:1.55}#portal-faq-current .ph-kicker{font-size:12px;color:#50705e;font-weight:700}#portal-faq-current h2{font-size:21px;margin:4px 0 8px}#portal-faq-current h3{font-size:17px;margin:18px 0 8px}#portal-faq-current ol{padding-left:24px;margin:10px 0}#portal-faq-current li{margin:7px 0}#portal-faq-current details{border-top:1px solid #e2e9e5;padding:11px 0}#portal-faq-current summary{cursor:pointer;font-weight:650}#portal-faq-current details p{margin:8px 0 0}.portal-field-hint{display:block!important;font-size:11px!important;line-height:1.4!important;letter-spacing:0!important;font-weight:400!important;color:#47675b!important;margin:4px 0 8px!important;white-space:normal!important;max-width:100%;overflow-wrap:anywhere}label>.portal-field-hint{width:100%}@media(max-width:600px){#portal-faq-current{padding:13px}.portal-field-hint{font-size:11px!important}}';
    document.head.append(style);
  }
  let pending=false;
  function refresh(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;css();renderHelp();updateFields();});}
  new MutationObserver(refresh).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["lang"]});
  window.addEventListener("freight-access-updated",refresh);
  document.addEventListener("DOMContentLoaded",refresh);
  refresh();
})();