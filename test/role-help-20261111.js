/* SH-01.30.46 v: staff role FAQ for supplier, design, content, purchasing, certification.
 * Only helps users navigate existing assigned tasks; never grants permissions. */
(()=>{"use strict";
const labels={ru:"FAQ и инструкции по кабинетам",en:"FAQ & role instructions",zh:"常见问题与岗位说明"};
const data={
 supplier:{ru:["Откройте только назначенные вам заказы поставщика.","Проверьте проформу, документы и фактическую дату готовности, если поле открыто.","При запросе приложите фото погрузки и убедитесь, что файл сохранён.","Отсутствующие функции сообщайте через «Предложения»; не заполняйте чужие заказы."],en:["Open only supplier orders assigned to you.","Check the pro forma, documents and actual readiness date when available.","Attach loading photos when requested and verify that files were saved.","Use Suggestions to report missing functions; never edit someone else's orders."],zh:["仅打开分配给您的供应商订单。","检查形式发票、文件及可用的实际备货日期。","按要求上传装货照片并确认文件已保存。","通过建议反馈缺失功能，不得修改他人的订单。"]},
 designer:{ru:["Откройте назначенную задачу дизайна, если функция доступна.","Сверьте материалы и требования; приложите результат в разрешённой форме.","Отмечайте выполнение только после подтверждённого сохранения."],en:["Open your assigned design task where enabled.","Review source material, attach output in the permitted form.","Mark complete only after confirmed saving."],zh:["打开已分配且可用的设计任务。","核对素材与要求，在允许的表单提交结果。","确认保存后再标记完成。"]},
 content:{ru:["Откройте доступные задачи контента и назначенные карточки.","Проверьте фото, описание и документы; не добавляйте неподтверждённые данные.","Запросите недостающие материалы через доступные функции."],en:["Open assigned content tasks and permitted product records.","Check photos, descriptions and evidence; do not invent missing data.","Request missing assets using available controls."],zh:["打开分配的内容任务及可访问商品记录。","检查照片、说明和证明，不得编造数据。","通过允许的功能申请补充资料。"]},
 purchasing:{ru:["Работайте только с доступными заказами закупки.","Сверяйте фактическую готовность и документы поставщика.","Если действие ещё не реализовано, сообщите в «Предложения»."],en:["Work only with permitted purchasing orders.","Review supplier readiness and documents.","Report missing workflow support using Suggestions."],zh:["仅处理授权采购订单。","核对供应商备货状态和文件。","通过建议反馈尚未实现的功能。"]},
 certification:{ru:["Проверяйте только назначенные документы сертификации.","Загружайте результаты в разрешённые формы; не подменяйте проверку ВЭД.","Если для роли пока нет активной задачи, не создавайте её самостоятельно."],en:["Review only certification documents assigned to you.","Upload results where permitted; do not replace foreign-trade document review.","Do not invent tasks where the role has no active assignment."],zh:["仅审核分配给您的认证文件。","在允许的表单上传结果，不得替代外贸文件检查。","无有效任务时不得自行创建工作流。"]}
};
const locale=()=>{const l=(document.documentElement.lang||"ru").toLowerCase();return l.startsWith("zh")?"zh":l.startsWith("en")?"en":"ru";};
let queued=false;
function render(){
 for(const cab of document.querySelectorAll(".sw-cabinet[data-cabinet-role]")){
  const nav=cab.querySelector(".sw-sidebar nav"),page=cab.querySelector(".sw-page");
  const buttons=[...(nav?.querySelectorAll("button")||[])],help=buttons.at(-1);
  if(!help||!page)continue;
  const l=locale(),name=labels[l];
  if(help.textContent!==name)help.textContent=name;
  const role=cab.getAttribute("data-cabinet-role")||"";
  const current=help.getAttribute("aria-current")==="page";
  if(!current||!data[role])continue;
  let section=page.querySelector("#sh-role-instructions");
  if(!section){section=document.createElement("section");section.id="sh-role-instructions";page.prepend(section);}
  const key=role+"|"+l;if(section.dataset.version===key)continue;
  section.dataset.version=key;section.replaceChildren();
  const h=document.createElement("h2");h.textContent=name;
  const version=document.createElement("small");version.textContent="SH-01.30.46 v";
  const ol=document.createElement("ol");
  for(const line of data[role][l]){const li=document.createElement("li");li.textContent=line;ol.append(li);}
  section.append(h,version,ol);
 }
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()});}
new MutationObserver(schedule).observe(document.getElementById("root")||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["aria-current"]});
new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
window.addEventListener("freight-access-updated",schedule);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule);else schedule();
window.shRoleHelpVersion="SH-01.30.46 v";
})();