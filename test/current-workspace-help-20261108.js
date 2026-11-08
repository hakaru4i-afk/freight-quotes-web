/* LW-GUIDE-01: current role FAQ and inline visible field help, staging only. */
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
["Как сообщить об ошибке?","Сохраните номер заявки, роль, действие, время и скриншот; после исправления в staging повторите тот же шаг."],
["Как новому партнёру связаться с компанией?","На публичной странице есть форма «Сотрудничество». Владелец получает обращение и отдельно решает вопрос о доступе."]
],
roles:{
owner:["Создайте перевозку: заполните номера заказа/Bitrix, сроки, груз, вес/объём, Incoterms и вложения.","Опубликуйте запрос и проверьте журнал адресатов.","Сравните предложения по маршрутам, срокам, суммам и валютам; поздние ставки рассматривайте отдельно.","Выберите ровно одну ставку и проверьте корректный архив проигравших.","Контролируйте документы, ход перевозки, итоговые суммы и закрытие.","Просматривайте обращения потенциальных партнёров в «Помощь / FAQ»."],
carrier:["Откройте «Мои заявки», условия и вложения.","Укажите маршрут, станции, транспорт (авто/ЖД/море/авиа), цену, валюту, сроки; отказ — только с причиной.","Для нескольких ставок добавьте отдельные варианты; после Excel/CSV проверьте каждое поле.","До выбора победителя поздняя ставка доступна с отметкой о просрочке.","После победы «Взять в работу», затем фактический выход, контрольные точки и файлы.","Проигравшие не исполняют перевозку."],
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
["Found a bug?","Provide role, request number, action, timestamp and screenshot; re-test after the staging fix."],
["How do new partners join?","Use the public Partnership form. The Owner receives requests and grants accounts separately."]
],
roles:{
owner:["Create a request with order, Bitrix, dates, cargo, Incoterms and files.","Publish and review carrier notification log.","Compare routes, timings, prices and currencies.","Select one offer and verify losing statuses.","Monitor execution, tracking and closure.","Review partner inquiries in Help / FAQ."],
carrier:["Open assigned requests and attachments.","Enter stations, route, road/rail/sea/air, amount, currency and dates; give a reason to decline.","For variants use separate offers and check Excel/CSV import.","Late offers are possible until winner selection.","If selected, accept execution and update tracking and documents.","Unselected carriers cannot execute."],
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
["发现问题怎么办？","提供角色、申请号、操作、时间和截图，修复后重测。"],
["如何成为合作伙伴？","使用公开合作表单；负责人审核后单独开通账号。"]
],
roles:{
owner:["创建询价并填写订单、Bitrix、货物、时间和附件。","发布并查看承运商通知。","比较路线、时效、报价和币种。","选择唯一中标报价。","跟踪运输和结案。","在帮助栏目查看合作申请。"],
carrier:["打开指定询价及附件。","填写路线、运输方式、报价、币种和时效。","核对 Excel/CSV 导入及多个方案。","中选前可逾期报价。","中选后接单、更新跟踪和文件。","未中选不能执行运输。"],
logistic:["查看权限内的报价和申请。","核对路线、时效和文件。","不可代替负责人选择报价。"],
supplier:["打开分配的订单。","在可用字段填写备货时间和文件。","按要求上传装货照片。","向负责人反馈缺失功能。"],
designer:["查看指定设计任务。","核对产品资料。","提交材料和结果。"],
content:["检查分配的内容任务。","核对图片和资料。","通过已授权的功能申请补齐材料。"],
purchasing:["查看允许的供应商订单。","核对备货和文件。","向负责人反馈缺失功能。"],
certification:["查看分配的商品文件。","按权限上传证明。","当前不自动生成外贸任务。"]
}}
};
const H=[
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
[/контейнер|container|集装箱/,["Фактический номер, если известен; не придумывайте.","Actual container number if available.","实际箱号，如已知。"]],
[/местополож|location|位置/,["Текущее место груза и дата сведений.","Cargo location and observation date.","货物位置及更新时间。"]],
[/причин|reason|原因/,["Конкретная причина отказа или переноса.","Specific decline or reschedule reason.","拒绝或延期的具体原因。"]],
[/претензи|claim|索赔/,["Событие, доказательства и сумма требования.","Incident, evidence and claimed amount.","事件、证据及金额。"]],
[/вложени|файл|документ|upload|file|附件|文件/,["Загрузите документ именно этого заказа; проверьте результат.","Upload this order's document and verify saving.","上传对应订单文件并确认保存。"]],
[/фото|photo|图片/,["Чёткое фото фактической погрузки или товара.","Clear actual loading/product photo.","清晰的实际装货照片。"]],
[/контакт|contact|联系人/,["Имя и рабочий телефон/email ответственного.","Contact name and reachable email/phone.","联系人及可用电话或邮箱。"]],
[/коммент|примечан|note|备注/,["Только фактическое пояснение, без паролей.","Relevant factual note, no passwords.","实际说明，不要填写密码。"]]
];
const lang=()=>{let l=(document.documentElement.lang||"ru").toLowerCase();return l.startsWith("en")?"en":l.startsWith("zh")?"zh":"ru"};
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const role=()=>document.querySelector(".cabinet-app")?.getAttribute("data-cabinet-role")||window.freightAccess?.role||"";
const generic={ru:"Укажите достоверное значение и проверьте его перед сохранением.",en:"Enter accurate information and verify before saving.",zh:"填写真实信息并在保存前核对。"};
let queued=false;
function update(){
const l=lang(),data=DATA[l],r=role(),host=document.querySelector('.cabinet-panel[data-section="help"]');
if(host){let box=host.querySelector("#lw-current-help"),key=l+"-"+r;
if(!box){box=document.createElement("section");box.id="lw-current-help";host.prepend(box)}
if(box.dataset.version!==key){box.dataset.version=key;
box.innerHTML="<h2>"+escapeHtml(data.title)+"</h2><p>"+escapeHtml(data.flow)+"</p>"+
(data.roles[r]?"<h3>"+escapeHtml(r)+"</h3><ol>"+data.roles[r].map(a=>"<li>"+escapeHtml(a)+"</li>").join("")+"</ol>":"")+
"<h3>FAQ</h3>"+data.faq.map(([q,a])=>"<details><summary>"+escapeHtml(q)+"</summary><p>"+escapeHtml(a)+"</p></details>").join("");}}
const root=document.querySelector(".cabinet-app");if(!root)return;
let n=0;for(const field of root.querySelectorAll("input,textarea,select")){
if(n++>800)break;
if(["hidden","password","submit","button","radio","checkbox"].includes(field.type)||field.closest("#lw-current-help,#lw-owner-inquiries,#portal-feedback-root"))continue;
if(!field.getClientRects().length)continue;
const label=field.closest("label")||field.labels?.[0]||field.closest(".field,.form-field,.t2-field");
if(!label)continue;
let helper=field.nextElementSibling;if(!helper?.classList.contains("lw-field-help")){
helper=document.createElement("small");helper.className="lw-field-help";field.insertAdjacentElement("afterend",helper);}
const info=(label.textContent+" "+field.name+" "+field.placeholder).slice(0,260);
const rule=H.find(row=>row[0].test(info)),hint=rule?rule[1][l==="ru"?0:l==="en"?1:2]:generic[l];
if(helper.textContent!==hint)helper.textContent=hint;
}}
function tick(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update()})}
window.lwCurrentHelpEnabled=true;
new MutationObserver(tick).observe(document.getElementById("root")||document.body,{subtree:true,childList:true});
new MutationObserver(tick).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
window.addEventListener("hashchange",tick);
window.addEventListener("freight-access-updated",tick);
tick();
})();