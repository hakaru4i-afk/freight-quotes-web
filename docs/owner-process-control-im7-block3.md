# IM-2026-000007 · Блок 3 · Управление заданиями документов

RU: Владелец → Главная → Управление процессами → Проверить назначения. Для запросов ВЭД к логисту и перевозчику сервер показывает допустимые действия: начать работу, вернуть в открытые, закрыть при наличии ответных файлов или повторно открыть до проверки ПТО и последующих этапов. Выбрать действие, указать причину 10–1000 символов, подтвердить. При изменении редакции обновить список. Документы и их происхождение сохраняются; изменение статуса и событие аудита записываются вместе. Фактические этапы, претензии и финансы — через штатные процессы.

EN: Owner home → Process control → Check assignments. Only server-authorized document-request transitions are offered: start, return to open, complete with attached files, reopen before dependent PTO/warehouse milestones. Confirmation, reason and current revision are mandatory; refresh after a conflict. Documents remain intact; all transitions are audited. No physical-stage or financial override.

ZH: 所有者主页 → 流程管理 → 检查任务。仅允许服务端授权的文件请求状态转换：开始、退回待办、上传文件后关闭、在相关海关和仓库阶段之前重新打开。必须确认、填写原因并使用最新版本；发生冲突时刷新。保留文件及审计记录，不覆盖实际运输或财务流程。

Backend PR142. Block 3 only; all other roles, native stage reversal, risk controls, full QA and production release remain separate.