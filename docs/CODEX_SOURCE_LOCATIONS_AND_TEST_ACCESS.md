# Codex handoff: where sources live and how to test safely

Verified 2026-11-01. This document is a source-location map, **not proof of full system test coverage**.

## Frontend repository
- Public interface repository: `https://github.com/hakaru4i-afk/freight-quotes-web`.
- Development branch: `codex-development`; production branch: `main`.
- Production built assets: `/index.html`, `/app.js`, `/style.css`, `/build-info.json`, `/site-status.json`.
- Staging built assets: `/test/index.html`, `/test/app.js`, `/test/style.css`, `/test/build-info.json`, `/test/site-status.json`.
- This repository contains **built frontend artifacts**, not an identified editable source project. An original frontend source repository, bundler configuration and build instructions have **not been established**. Do not invent a source path or re-create the project as a workaround without agreement.
- See `AGENTS.md`, `docs/INITIAL_AUDIT_2026-11-01.md`, `docs/RELEASE_INCIDENT_2026-11-01.md`, and `docs/BACKEND_ACCESS_AUDIT_2026-11-01.md`.

## Backend
- Hosted in Supabase **Edge Functions** named `freight-api` (deployed version 32 at verification time), with an `index.ts` entrypoint.
- Production Supabase project: `ooclsrndeygojtofuyte`, project name `freight-quotes`.
- Staging Supabase project: `ibclzdkxiozbzmniiygv`, project name `freight-quotes-staging`.
- Both projects have a PostgreSQL schema named `freight` with 60 tables.
- These source files were inspected via an authorized connected Supabase integration. The location of the **original source-controlled backend repository** has not been confirmed. No backend source has been copied to this public frontend repository.
- Production and staging are separate systems. Never copy staging configuration, users, or database rows into production.

## Tests and accounts
- **No verified test credentials for all roles are available in this repository or in this handoff.** Never ask for passwords, secret tokens, or service-role keys in a chat.
- First run static checks and anonymous, read-only `/health` checks (if network policy allows). Expected 403 on unauthenticated `/api/access` is not itself evidence of an outage.
- Role-based E2E tests require *dedicated nonproduction fixture accounts*, provisioned by an authorized staging admin using a secure mechanism. Do not borrow real user accounts, reset actual credentials, create backdoors, disable auth, or touch production user data.
- If authorized staging test identities are not accessible, report those tests as BLOCKED/NOT TESTED rather than PASSED; continue with checks that do not require credentials.

## Release blocking conditions
- Production UI assets currently advertise `1.19.0`; staging assets `1.19.1`; deployed Edge Functions label `1.19.1`.
- In the checked GitHub snapshot, production `site-status.json` has `maintenance: true`; staging has `maintenance: false`. The UI's banner logic actually reads this field. This explains the persistent update banner, but a release still needs validation.
- **Do not claim full 1.19.1 verification or promote from staging without real test evidence and a known reproducible frontend build process.** Never just copy staging JS/CSS to production: environment-specific settings differ.
- Existing read-only helper: `node scripts/check_release_config.mjs` on `codex-development`. This checks release metadata consistency, not functionality.
- Owner requested 1.19.1 publication after fixing errors, **subject to passing critical checks**. If blockers remain, describe them precisely, retain working production, and propose a controlled release plan.

## Primary next action for Codex
Find the actual editable frontend sources and the backend source of truth using explicitly available, authorized project resources. If not accessible, finish safe audits and release diagnostics with exact evidence; do not guess file paths or silently rewrite compiled bundles. Produce a concise blocker report identifying the minimum access needed.
