# Codex project instructions — freight-quotes-web

## Scope and safety
- Repository: `hakaru4i-afk/freight-quotes-web`.
- Use `codex-development` for development. Do not commit or merge into `main` without explicit approval.
- Never deploy or alter the production or test sites, Supabase project/data, or Railway services without explicit authorization.
- Do not modify existing operational records, user accounts, credentials, policies or live databases.
- Never commit credentials, tokens, API keys, or private customer/shipment documents.
- Create small, reviewable commits and report what was changed and tested.
- If the task requires the backend, locate the backend repository and verify ownership/access rather than inventing endpoints or schemas.

## Current repository facts (verified 2026-11-01)
- Root is a static web frontend with `index.html`, `app.js`, `style.css`, `build-info.json`, and supporting assets.
- `test/` contains a separate frontend variant.
- `README.md` states the server and data are stored separately.
- Avoid modifying generated/minified assets until identifying their source of truth and build process.

## Product scope to preserve or evaluate
Logistics portal for international freight quotes, with distinct role-based spaces for owner/admin, foreign trade/logistics staff, carriers, suppliers, and design/content staff. Planned workflows include requests for rates, responses and deadlines, carrier applications, approval, shipping documents, tenders, shipment tracking, activity logs, export/PDF/Excel/Word, notifications, service-level scoring and reports. Multilingual support: Russian, English, Chinese where relevant. These are requirements to verify against code, **not claims that features already exist**.

## First task
Perform read-only audit of frontend structure, runtime configuration, role/access handling, forms, validation, translation coverage, API contracts, and test-vs-production differences. Locate the separate backend and ascertain safe test strategy. Produce a concise gap analysis with verified findings and specific file references. Do not change functionality before approval.
