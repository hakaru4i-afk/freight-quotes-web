// Test-only progressive enhancement. Keeps Incoterms option values unchanged.
const terms = {
 EXW:["Франко-завод","Продавец предоставляет товар в согласованном месте; основную перевозку, экспортное оформление (если применимо) и риски организует покупатель."],
 FCA:["Франко-перевозчик","Продавец передаёт товар перевозчику в согласованном месте и выполняет экспортное оформление; дальнейшую перевозку организует покупатель."],
 CPT:["Перевозка оплачена до","Продавец оплачивает перевозку до названного пункта, но риск переходит при передаче первому перевозчику."],
 CIP:["Перевозка и страхование оплачены до","Продавец оплачивает перевозку и предусмотренное страхование до названного пункта; риск переходит при передаче перевозчику."],
 DAP:["Поставка в месте назначения","Продавец доставляет товар до согласованного места, готовым к разгрузке; покупатель разгружает и оформляет импорт."],
 DPU:["Поставка в месте назначения с разгрузкой","Продавец доставляет и разгружает товар в согласованном месте; покупатель оформляет импорт."],
 DDP:["Поставка с оплатой пошлин","Продавец доставляет товар до согласованного места, выполняет импортное оформление и оплачивает применимые пошлины; разгрузка обычно за покупателем."],
 FAS:["Свободно вдоль борта судна","Продавец размещает товар вдоль борта судна в порту отгрузки; дальнейшие расходы и риски у покупателя. Только водный транспорт."],
 FOB:["Свободно на борту судна","Продавец загружает товар на судно в порту отгрузки; далее риск у покупателя. Только водный транспорт."],
 CFR:["Стоимость и фрахт","Продавец оплачивает фрахт до порта назначения, но риск переходит после погрузки на судно. Только водный транспорт."],
 CIF:["Стоимость, страхование и фрахт","Продавец оплачивает фрахт и предусмотренное страхование до порта назначения; риск переходит после погрузки на судно. Только водный транспорт."]
};
const codes = Object.keys(terms);
function enhance() {
 for (const select of document.querySelectorAll('select')) {
  const options = Array.from(select.options);
  const found = options.filter(o => codes.includes((o.value || '').trim().toUpperCase()) || codes.includes(o.textContent.trim().toUpperCase()));
  if (found.length < 5 || !found.some(o => (o.value || '').toUpperCase() === 'FCA')) continue;
  for (const opt of found) {
   const code = (opt.value || opt.textContent).trim().toUpperCase();
   if (terms[code]) {
    const text = code + ' — ' + terms[code][0];
    if (opt.textContent !== text) opt.textContent = text;
   }
  }
  let note = select.nextElementSibling;
  if (!note || !note.classList.contains('incoterms-explanation')) {
   note = document.createElement('p');
   note.className = 'incoterms-explanation';
   note.style.cssText='margin:8px 0 12px;font-size:13px;line-height:1.5;color:#476960';
   select.insertAdjacentElement('afterend',note);
  }
  const code = (select.value || '').trim().toUpperCase();
  const explanation = terms[code] ? terms[code][1] : 'Выберите условие, чтобы увидеть распределение расходов и рисков.';
  if (note.textContent !== explanation) note.textContent = explanation;
  if (select.dataset.incotermsExplainer !== '1') {
   select.dataset.incotermsExplainer='1';
   select.addEventListener('change',enhance);
  }
 }
}
let queued=false;
new MutationObserver(() => {
 if (queued) return;
 queued=true;
 requestAnimationFrame(() => {queued=false;enhance();});
}).observe(document.body,{childList:true,subtree:true});
enhance();
