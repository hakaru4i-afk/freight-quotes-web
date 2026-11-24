/* Recovery controls for the Improvement center candidate. */
(() => {
  "use strict";
  const words = {
    ru:{title:"Восстановление обработки",operation:"Действие",reason:"Причина (10–2000 символов, видна автору)",next:"Следующая стадия",previous:"Предыдущая стадия",close:"Закрыть обращение",restore:"Повторно открыть",read:"Прочитано",evaluated:"Оценено",in_progress:"В работе",denied:"Отказано в разработке",confirm:"Подтверждаю выбранный переход и публикацию причины в истории обращения",save:"Сохранить переход",saved:"Переход сохранён в истории.",stale:"Обращение изменилось. Обновите список.",error:"Не удалось изменить стадию."},
    en:{title:"Request recovery",operation:"Action",reason:"Reason (10–2000 characters, visible to the author)",next:"Next stage",previous:"Previous stage",close:"Close request",restore:"Reopen request",read:"Read",evaluated:"Evaluated",in_progress:"In progress",denied:"Declined",confirm:"I confirm the selected transition and that the reason will appear in the request history",save:"Save transition",saved:"The stage change was recorded in history.",stale:"The request changed. Refresh the list.",error:"Could not change the stage."},
    zh:{title:"恢复申请处理",operation:"操作",reason:"原因（10–2000 个字符，申请人可见）",next:"下一阶段",previous:"上一阶段",close:"关闭申请",restore:"重新打开申请",read:"已读",evaluated:"已评估",in_progress:"处理中",denied:"已拒绝",confirm:"我确认所选阶段变更，并同意将原因写入申请历史",save:"保存阶段变更",saved:"阶段变更已记入历史。",stale:"申请已更改，请刷新列表。",error:"无法更改阶段。"}
  };
  const api = "/api/portal-feedback";
  let current;
  let confirmation;

  function element(tag, text) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    return node;
  }

  function buildForm(view, capability) {
    const t = words[view.lang];
    const stages = ["read","evaluated","in_progress","denied"];
    const operations = ["next","previous","close","restore"].filter(key => stages.includes(capability.options?.[key]));
    if (!operations.length) return;
    const form = element("form");
    form.id = "pf-recovery";
    form.className = "pf-form";
    const operation = element("select");
    operation.required = true;
    operation.append(new Option("",""));
    for (const key of operations) operation.append(new Option(t[key]+" → "+t[capability.options[key]],key));
    const reason = element("textarea");
    reason.required = true;
    reason.minLength = 10;
    reason.maxLength = 2000;
    reason.rows = 3;
    const operationLabel = element("label",t.operation);
    operationLabel.append(operation);
    const reasonLabel = element("label",t.reason);
    reasonLabel.append(reason);
    const checked = element("input");
    checked.type = "checkbox";
    checked.required = true;
    const confirmLabel = element("label");
    confirmLabel.append(checked, document.createTextNode(t.confirm));
    const fields = element("fieldset");
    const submit = element("button",t.save);
    submit.className = "pf-secondary";
    const error = element("p");
    error.setAttribute("role","alert");
    fields.append(operationLabel,reasonLabel,confirmLabel,submit);
    form.append(element("h4",t.title),fields,error);
    form.addEventListener("input",event => {
      if (event.target !== checked) checked.checked = false;
    });
    form.addEventListener("submit",async event => {
      event.preventDefault();
      if (fields.disabled || current !== view || !checked.checked || !operations.includes(operation.value)) return;
      const trimmedReason = reason.value.trim();
      if (trimmedReason.length < reason.minLength || trimmedReason.length > reason.maxLength) {
        error.textContent = t.reason;
        reason.focus();
        return;
      }
      fields.disabled = true;
      let refreshRequired = false;
      error.textContent = "";
      confirmation = undefined;
      view.root.querySelector(".pf-recovery-confirmation")?.remove();
      try {
        const response = await fetch(api,{
          method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"recover",id:view.id,revision:capability.revision,operation:operation.value,reason:trimmedReason})
        });
        const result = await response.json();
        if (!response.ok || result.ok !== true) {
          refreshRequired = result.error === "RECOVERY_STALE" || result.error === "RECOVERY_INVALID_TRANSITION";
          error.textContent = refreshRequired ? t.stale : t.error;
          return;
        }
        refreshRequired = true;
        if (current === view) {
          confirmation = view.root;
          sync();
          view.root.querySelector('[data-pf="refresh"]')?.click();
        }
      } catch {
        error.textContent = t.error;
      } finally {
        fields.disabled = refreshRequired;
      }
    });
    return form;
  }

  async function load(view) {
    try {
      const response = await fetch(api+"?recoverId="+encodeURIComponent(view.id),{cache:"no-store"});
      const capability = await response.json();
      if (current !== view || !response.ok || capability.ok !== true ||
          typeof capability.revision !== "string" || !capability.revision) return;
      view.form = buildForm(view,capability);
      sync();
    } catch {
      // The existing card remains available when recovery capabilities cannot be loaded.
    }
  }

  function sync() {
    const root = document.getElementById("portal-feedback-root");
    const isOwnerView = root?.querySelector(".pf-metrics");
    if (confirmation !== root || !isOwnerView) confirmation = undefined;
    const requestedLang = document.documentElement.lang.toLowerCase().split("-")[0];
    const lang = Object.hasOwn(words, requestedLang) ? requestedLang : "ru";
    if (confirmation) {
      let notice = root.querySelector(".pf-recovery-confirmation");
      if (!notice) {
        notice = element("p");
        notice.className = "pf-recovery-confirmation";
        notice.setAttribute("role","status");
        root.prepend(notice);
      }
      if (notice.textContent !== words[lang].saved) notice.textContent = words[lang].saved;
    }
    const selected = root?.querySelector(".pf-list .pf-selected");
    const detail = root?.querySelector(".pf-detail");
    const id = selected?.dataset.pfId;
    if (!isOwnerView || !id || !detail) {
      current?.form?.remove();
      current = undefined;
      return;
    }
    const status = selected.querySelector(".pf-status")?.className;
    if (current?.root !== root || current.id !== id || current.status !== status || current.lang !== lang) {
      current?.form?.remove();
      current = {root,id,status,lang};
      void load(current);
    }
    if (current.form && current.form.parentNode !== detail) {
      detail.insertBefore(current.form, detail.querySelector(".pf-history")?.previousElementSibling ?? null);
    }
  }

  document.addEventListener("click", event => {
    if (!event.target.closest?.('#portal-feedback-root [data-pf="refresh"]')) return;
    current?.form?.remove();
    current = undefined;
    sync();
  });
  new MutationObserver(sync).observe(document.documentElement,{
    subtree:true,childList:true,attributes:true,attributeFilter:["lang"]
  });
  sync();
})();
