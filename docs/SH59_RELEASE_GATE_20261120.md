# SH59 — контролируемая публикация (20.11.2026)

Статус: **CONFIGURATION_PENDING / RELEASE_BLOCKED**. Отдельное инфраструктурное изменение, не выпуск SH59.

## Реализуемая защита

- workflows sync-release-metadata и reconcile-staging-provenance переведены в режим чтения, без записи в main;
- task12-observer хранит отчёты в GitHub Actions artifacts вместо двух push в main;
- controlled-sh59-publish — только ручной запуск владельцем с точными SHA frontend/backend;
- gate проверяет подлинные GitHub run ID, соответствие commit SHA, 37/37 авторизованных API+browser сценариев, RBAC/RLS, миграции, фактические served байты, зашифрованную резервную копию и независимое восстановление PostgreSQL + Storage, подтверждённый откат, согласие владельца после E2E.
- согласие: APPROVE SH59 FRONTEND=<40-символьный SHA> BACKEND=<40-символьный SHA> в комментарии GitHub владельца;
- любой недостающий или несовместимый артефакт означает RELEASE_BLOCKED; запрещено подставлять синтетические PASS.

## Обязательная настройка GitHub Pages

**Изменение workflow не отключает автоматическую публикацию Pages с main**, если в настройках выбран Deploy from a branch.

Владелец/администратор должен выполнить в публичном репозитории freight-quotes-web: **Settings → Pages → Build and deployment → Source → GitHub Actions**.

Эту настройку невозможно изменить текущими доступными действиями GitHub-коннектора. До фактического подтверждения Source=GitHub Actions нельзя считать, что GitHub Actions стал единственной точкой публикации. Дополнительная защита среды github-pages с required reviewer желательна; для публичных репозиториев доступна на бесплатном GitHub. Без защиты ветки администратор всё ещё может вручную обойти workflow — абсолютную блокировку не заявлять.

## Доступ только для чтения к приватному backend

Нужен бесплатный GitHub secret BACKEND_RELEASE_READ_TOKEN в web-репозитории, со строго ограниченным доступом Actions: Read и Contents: Read к приватному freight-quotes. Пока его нет, release gate обязан останавливаться. Секреты не записывать в исходники или артефакты.

## Требуемые действительные артефакты

- web complete-frontend-regression: release-gate-regression.json;
- web carrier124-oidc-sh59-redacted-evidence: release-gate-pair.json и private-authenticated-e2e.json (37 фактических подтверждений);
- backend release-migration-and-support-evidence: release-gate-backend.json;
- backend sh59-production-recovery-receipt: private-production-backup-evidence.json и private-restore-evidence.json.

Producer workflows должны отдавать эти **редактированные доказательства только после успешных реальных проверок**. В текущем состоянии полный набор недоступен: никакой выпуск не разрешён. Синтетические тесты не заменяют реальный backup/restore.

## Критерии закрытия

- [ ] В PR успешны отрицательные тесты, включая несовместимый SHA, 36/37, отсутствие restore и owner approval;
- [ ] В том же CI фактически сравнивались served production байты до/после теста;
- [ ] Проверено отсутствие автоматических записей в main из трёх перечисленных workflows;
- [ ] Переключён GitHub Pages Source → GitHub Actions;
- [ ] Пришли доказательства 37/37, точного API и зашифрованного backup+restore;
- [ ] Тест реального рабочего release gate подтверждает отклонение несовместимой сборки без изменения production;
- [ ] Владелец одобрил конкретную пару SHA; только затем ручной release.

Не менять production и реальные данные для испытания блокировки. Никаких платных ресурсов.
