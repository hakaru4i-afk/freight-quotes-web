# Freight Quotes — project tools and rules for Codex / Work

Project: frontend `hakaru4i-afk/freight-quotes-web`, backend `hakaru4i-afk/freight-quotes`. Production is used by real carriers; do not edit user data or deploy an unapproved candidate.

## Fast, low-credit development workflow

- Read **current PR / issue notes and exact failing Actions logs** before investigating; avoid duplicate research or tickets. Fix root causes, not symptoms. Never report a successful CI smoke as a full real authenticated E2E.
- Use existing toolchain: Node.js `node --test`, TypeScript `tsc`, Python, Playwright/Chromium where available, GitHub Actions artifacts, and read-only Supabase diagnostics. Install packages **only when absent and needed**, pinned to the repository's current versions/lockfiles. Do not install a second testing stack.
- Before work: `node tools/qa-fast.mjs --doctor`; plan via `node tools/qa-fast.mjs --changed main` (if local main exists) or `node tools/qa-fast.mjs --suite carrier,release`.
- After changes: `node tools/qa-fast.mjs --suite carrier --run`, changing suite to the affected module. This runner **does not deploy or run a full 37-scenario E2E**. Prefer one targeted rerun per root cause; run full 37 only for the final approved candidate with protected synthetic Owner/Carrier A/B/other-role credentials.
- Do not repeatedly invoke heavy workflows while a prerequisite (OIDC/test identities, proven frontend/API parity or published release manifest) is blocked. Preserve redacted private screenshots and CI logs; distinguish PASS/PARTIAL/FAIL/BLOCKED.

## Release and security invariants

- All implementation goes into isolated branches and draft PRs. **Do not merge to `main` or deploy** to GitHub Pages/Supabase before the actual release gate and explicit Owner approval.
- Do not perform destructive SQL or use real production orders, accounts, sessions, rates, files or passwords as test fixtures. Do not share secrets. Never bypass TLS checks, authentication, RLS, source hashes, or protected workflow requirements to get a green check.
- Production and test are separate databases. Maintain intended functional parity without cross-copying customer data. Validate real served assets, business version, Git SHA and API version together.
- Owner journals: Remarks / Developments / Updates / Owner acceptance. Keep history and ID links, update affected role FAQ in RU/EN/ZH, check 1440×900 and 390×844. `Выполнено` requires the Owner's actual acceptance; a commit is not publication.
- End each work unit with a brief table: defect/root cause, changed files and SHA, targeted test evidence, rollout location (PR/test/production), unresolved gate, explicit user approvals required.

## Current context (recheck against latest head)

Frontend draft PR #129 and backend draft PR #102 form a coupled Carrier-dashboard candidate. Version SHA/provenance, production SH52/visible SH59 manifest, test map parity and backend canonical document gate remain relevant. Do not assume this note overrides newer evidence.