# IM-2026-000007 · Блок 2: управление назначениями перевозок

Owner → Главная → Управление процессами → Проверить назначения. Открытые задания всех ролей, текущий этап и причина блокировки. Для адресных запросов ВЭД логисту допускается переназначение в рамках действующей роли и области доступа: выбрать другого активного логиста, указать причину (10–1000 символов), подтвердить. Сервер проверяет фактического Owner, текущего победителя, активную перевозку, редакцию и доступ нового исполнителя. Статус, документы и финансовые данные не меняются. При конфликте обновить список; не повторять старую запись. Событие owner_reassign_logistic сохраняется в истории перевозки.

EN: Owner home → Process control → Check assignments. Only server-authorized addressed logistic tasks can be reassigned; confirmation, reason and current revision required. Other business operations use their normal workflow. No financial or document approval is implied.

ZH: 所有者主页 → 流程管理 → 检查任务。仅可重新分配服务端授权的指定物流任务；必须确认、填写原因并使用最新版本。其他业务操作仍使用原流程，不代替财务或文件确认。

Backend PR140. Frontend PR194 continuation. Other roles' native transitions, manual risk acceptance, full process integration and protected release remain separate unfinished blocks. No production publication or test PASS claimed here.
