# SH-01.30.59 v · изолированный API v17 и совместимость frontend

Дата проверки: 2026-11-20. Состояние: **SOURCE_CONTRACT_PASS / METADATA_PIN_MISMATCH / AUTH_E2E_NOT_VERIFIED / RELEASE_BLOCKED**.

## Фактический текущий тестовый API

- Supabase project `ibclzdkxiozbzmniiygv`, Edge Function `freight-api-qa-carrier124nov18`, **v17 ACTIVE**, release `SH-01.30.59 v`, схема `freight_qa_carrier124nov18`.
- Provider bundle SHA-256: `a61aafa1d30a6b0d8a1526a80c1aea8cd67b662d505f35d98359650cfd532c0a`; API bundle содержит **26 файлов**.
- Предыдущие v9/v13/v16 — исторические проверенные версии, не текущий runtime. Shared staging `freight-api` v117 и production `freight-api` v46 — другие функции.
- Self-hosted Mac [run 44563115585](https://github.com/hakaru4i-afk/freight-quotes/actions/runs/44563115585), job `136149869039`: `/health` PASS, GET `/api/carrier` и `/api/portal-feedback?view=notices` анонимно 403 PASS. В этом запуске не было авторизованного браузера и записи в production.

## Адресная сверка API и frontend-контракта

Через Supabase **get Edge Function** получены реальные файлы v17 (не исторический Git bundle). Через GitHub PR #102 получены текущие `src/transport-application/carrier-dashboard.mjs` и `database-target.mjs`. Проверка точного текста:

| Контроль | Итог |
| --- | --- |
| Live v17 содержит ровно 26 source files и провайдерный bundle выше | PASS |
| `carrier-dashboard.mjs` live v17 побайтно равен текущему backend PR #102 | PASS |
| `database-target.mjs` live v17 побайтно равен текущему backend PR #102 | PASS |
| Live `index.ts` импортирует и вызывает `assertDatabaseTarget(databaseConnectionUrl, EXPECTED_PROJECT)` | PASS |
| В live `index.ts` присутствуют `/api/carrier`, `/api/route-distance`, `/api/portal-feedback`, `/health` | PASS: наличие маршрутов в исходнике; не выполнение запросов со всеми ролями |
| Live `projectCarrierDashboard` содержит `version:1`, `scope:'assigned_requests'`, `items`, `counts`, `order_code`, `round_id`, `stage`, `filters` | PASS: форма контракта исходника |
| Frontend source test `tests/carrier124-refresh-parity.test.mjs` проверяет серверный валидатор | PASS: тест присутствует; текущий запуск на паре v17 не произведён |
| FE `test/build-info.json` и `test/staging-manifest.json` закрепляют v17 | **FAIL**: оба `sh59IsolatedQa` всё ещё закрепляют старую v13, 25 файлов, source `12eee66c...` |
| Полный authenticated frontend ↔ isolated API v17 E2E, MAP50 и 37/37 | **NOT_VERIFIED** |

Это **source contract / provenance check**, не подтверждение работы всей фронтенд-сборки через настоящий вход.

## Исправление frontend source-guard в этом же PR

- `tests/carrier124-isolated-target.mjs`, коммит `cd77cff`: строгий ожидаемый readback 26 файлов для v17+, 25 для исторических v13 и ниже.
- `scripts/check-staging-alignment.mjs`, коммит `d64ed13`: то же правило для источника манифеста.
- Blob readback обоих файлов после коммита — PASS; **release gate оставлен закрытым**.

## Оставшийся барьер перед подтверждением пары

Пересобрать и перепроверить единый frontend manifest + `test/build-info.json` с честными v17 SHA/source и текущим FE commit (не подменяя version stamp), затем выполнить на той же зафиксированной паре защищённый authenticated Owner/Carrier/MAP50/E2E и readback. Пока в FE остаётся v13, **exact pair = FAIL/NOT_VERIFIED**. Не менять production, shared staging, реальные заявки, SQL, RLS/OIDC-политику; не использовать платные API или Codex.

Каноническая запись: [единый релиз в backend PR #102](https://github.com/hakaru4i-afk/freight-quotes/blob/fix/carrier-dashboard-124/docs/releases/STAB-20261117/UNIFIED_RELEASE_20261119.md).
