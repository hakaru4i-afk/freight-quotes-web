# Центр доработок — подтверждённый порядок и ошибка GitHub
Дата проверки: 2026-11-22 · Задача: IM-2026-000007

## RU
После «Взять в работу» в инженерном реестре появляется одна задача в Центре доработок. Владелец указывает дедлайн и передаёт работу в GitHub. Прогресс «10%» означает **зарегистрирована ветка/Issue**, а не что Codex начал писать код.
Стандартный блок «Новый статус» убран из основного интерфейса в сворачиваемые «Дополнительные действия Владельца» — на случай восстановления зависших переходов. Он не заменяет принятие результата или выпуск.
Если сервер вернул GITHUB_TOKEN_NOT_CONFIGURED, задача сохраняется, но автоматический вызов GitHub недоступен. Токен должен устанавливаться только в секретах Supabase как GITHUB_OWNER_REGISTER_TOKEN. Не запрашивать и не вводить его в карточки/чат.
У IM-2026-000007 вручную создан GitHub Issue #163 и рабочая ветка. Это не запуск Codex. История и статус сохранены.

## EN
Once the Owner accepts a register entry, one task moves to the Improvement Center. Set the deadline and hand it to GitHub there. 10% confirms a GitHub issue/branch only, not that Codex has started.
The generic status editor is under collapsed **Advanced Owner actions**, for exceptional stalled-workflow recovery. It does not replace acceptance or publication.
GITHUB_TOKEN_NOT_CONFIGURED indicates a missing server-only Supabase secret GITHUB_OWNER_REGISTER_TOKEN. Never ask for or paste the token into the website or chat. Task IM-2026-000007 was manually registered as GitHub Issue #163; Codex is not running.

## ZH
所有者从工程登记册接受任务后，仅生成一项改进中心任务。请在改进中心设定截止日期并提交给 GitHub。10% 仅代表 GitHub Issue/分支已建立，不代表 Codex 已开始开发。
常规的“更改状态”表单折叠到“所有者高级操作”，仅用于恢复卡住的流程；不等于验收或发布。
GITHUB_TOKEN_NOT_CONFIGURED 表示 Supabase 服务器端缺少 GITHUB_OWNER_REGISTER_TOKEN 密钥。不得在网页表单或聊天中粘贴令牌。IM-2026-000007 已通过 GitHub Issue #163 人工登记，但 Codex 尚未运行。

## Business process structure / Структура бизнес-процессов
Checked: no new process stage was added. Intake → Center → deadline → GitHub task registration → development → review → separate production release is unchanged. Only the placement of optional manual status controls changed.
Preserve current approved diagram; **do not substitute a SHA update for substantive process review**.
Required pre-release checks: exact frontend/test parity, owner-only actions, three languages, existing workflow state not modified, FAQ and registry evidence, release approval.
