# SH-01.30.59 v · изолированный API v17 и совместимость frontend

Дата проверки: 2026-11-20. Текущее состояние: **SOURCE_CONTRACT_PASS / V17_METADATA_PIN_PASS / MAC_SOURCE_16_OF_16_PASS / AUTH_E2E_NOT_VERIFIED / RELEASE_BLOCKED**. Ранее обнаруженное несоответствие v13 исправлено в том же PR; разделы ниже сохраняют историю проверки.

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
| FE `test/build-info.json` и `test/staging-manifest.json` закрепляют v17 | **PASS после исправления:** в обоих v17, 26 файлов, source `f8bb38ca...`; Mac run 44699102424 проверил исходники и health, без авторизованных E2E |
| Полный authenticated frontend ↔ isolated API v17 E2E, MAP50 и 37/37 | **NOT_VERIFIED** |

Это **source contract / provenance check**, не подтверждение работы всей фронтенд-сборки через настоящий вход.

## Исправление frontend source-guard в этом же PR

- `tests/carrier124-isolated-target.mjs`, коммит `cd77cff`: строгий ожидаемый readback 26 файлов для v17+, 25 для исторических v13 и ниже.
- `scripts/check-staging-alignment.mjs`, коммит `d64ed13`: то же правило для источника манифеста.
- Blob readback обоих файлов после коммита — PASS; **release gate оставлен закрытым**.

## Оставшийся барьер перед подтверждением пары

**V17 manifest pin исправлен и source-check подтверждён.** Следующий барьер — защищённый authenticated Owner/Carrier/MAP50/37 E2E на зафиксированной паре и независимый restore, затем served-byte readback после разрешённой публикации. OIDC сейчас main-only/github-hosted: бесплатный Mac source-run не доказывает авторизацию. **Runtime exact-pair acceptance = NOT_VERIFIED; RELEASE_BLOCKED.** Не менять production, shared staging, реальные заявки, SQL, RLS/OIDC-политику; не использовать платные API или Codex.

Каноническая запись: [единый релиз в backend PR #102](https://github.com/hakaru4i-afk/freight-quotes/blob/fix/carrier-dashboard-124/docs/releases/STAB-20261117/UNIFIED_RELEASE_20261119.md).

## 20.11.2026 · Дальнейшее исправление после первоначального отчёта

- Оба JSON (`test/build-info.json`, `test/staging-manifest.json`) **фактически закрепляют isolated v17**, SHA-256 `a61aafa1d30a6b0d8a1526a80c1aea8cd67b662d505f35d98359650cfd532c0a`, `sourceFilesVerified:26`, backendSourceCommit `f8bb38ca1d55b7aceb529a89526abbb0c3253ecd`. `staging-manifest.json` в корне совпадает по isolated pin с test. Ранее зафиксированная v13 больше не является текущей привязкой PR.
- [Mac source-candidate run 44699102424](https://github.com/hakaru4i-afk/freight-quotes/actions/runs/44699102424): job `source-candidate` **SUCCESS**; лог содержит `CANDIDATE_SOURCE_ALIGNMENT_PASS; RELEASE_BLOCKED`, `SH59_V17_FRONTEND_SOURCE_AND_MANIFEST_PASS` и `SH59_V17_LIVE_QA_HEALTH_PASS`. Согласно отдельному gate ledger: 16/16 source checks, 399 indexed assets. Это **не** авторизованные E2E.
- [Mac served-readback run 44691436607](https://github.com/hakaru4i-afk/freight-quotes/actions/runs/44691436607) (повторный job readback 20.11 07:56 UTC) вернул `CARRIER_CANDIDATE_NOT_PUBLISHED_ON_TEST` и `PRODUCTION_VERSION_DRIFT`: shared Pages /test/ ещё обслуживает другой frontend commit `c918c133...`, production frontend SH59, production API SH52. Это **не исправляется заменой label**.
- Полные 37/37 authenticated E2E и проверка MAP50 на окончательной паре **не выполнялись / NOT_VERIFIED**. OIDC protected workflow требует main и GitHub-hosted runner; нельзя заменять его неавторизованным Mac smoke или ослаблять политику ради PASS.

