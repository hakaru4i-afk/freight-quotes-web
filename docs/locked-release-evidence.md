# Evidence for the locked release pair

The two commits in `release-lock.json` are the candidate. The workflows run from trusted `main` and record their own workflow commit and attempt separately. Changing the lock requires fresh evidence for the resulting pair.

| Dispatch on `main` as Owner | Required output |
| --- | --- |
| `release-stabilization.yml` | Locked frontend regression and the complete frontend test job |
| `locked-backend-regression.yml` | Locked backend regression, synthetic backup safety and schema transition rehearsal |
| `isolated-qa-oidc-browser.yml` | `locked-release-evidence-attempt-N` with the pair and all 37 authenticated scenarios |

The E2E workflow needs the tested frontend's `test/` assets at the staging URL and the isolated API at `ibclzdkxiozbzmniiygv/freight-api-qa-rc20261110`. Prepare the isolated API package from the backend SHA with `node scripts/release/locked-qa-runtime.mjs build <backend-checkout> <new-output-directory>` in the protected workflow. The package contains `index.ts` and `deno.json`. Use the existing isolated deployment channel for that project and function. The workflow checks provider metadata, downloads and compares the deployed function files, checks the live health deployment ID and compares staging assets before and after the browser run. A source mismatch blocks the run before it obtains QA sessions. The QA workflow uses a GitHub-hosted runner because the credential broker requires that OIDC claim.

Use the three successful run IDs from the same lock within 24 hours of their start. Results from reruns must come from the current attempt. The production workflow requires `publish=true`, the Owner's approval string containing both SHAs, all three verified runs and a fresh encrypted backup with ciphertext readback and isolated recovery. The PR and the three evidence workflows have no production deployment step.

## Private backend credentials

In the existing main-only `isolated-qa` environment of `freight-quotes-web`, configure `BACKEND_QA_READ_TOKEN` with a fine-grained GitHub token restricted to the private `freight-quotes` repository and Contents: Read-only (Metadata: Read-only is implicit). No Actions write, Administration, or production deployment rights. All locked backend and E2E jobs use this environment and validate the exact backend commit before checkout. E2E also checks presence of its existing provider readback credential `SUPABASE_ACCESS_TOKEN`; never paste values into issues or logs. The separate `BACKEND_RELEASE_TOKEN` remains required exclusively for the production release workflow's protected backup dispatch and checkout. Do not copy it to the QA environment. This change does not authorize a release or replace runtime alignment or test evidence.


## Permanent version-linkage procedure (verified 2026-11-25)

**The source of truth is the actual GitHub lock and independently observed deployed bytes, not a historical SH label, an assumed API version, a prior PASS or a number written in build-info.** Never update version labels to conceal an unverified deployment.

1. Before changing a release, read current frontend/backend HEADs, `release-lock.json`, the live production manifest and Supabase deployment metadata. Classify under the current Owner-approved release regulation; do not treat backend, data, permissions or mixed changes as low-risk UI changes.
2. Stamp frontend metadata/cache keys from actual candidate bytes. Pin immutable full frontend and backend SHAs in the lock; preserve their ancestry when merging. The workflow commit is separate from the candidate SHA. Changes to either candidate SHA invalidate the previous pair's evidence.
3. For a class-B candidate, use the existing **Locked QA staging only** workflow, `.github/workflows/locked-qa-staging.yml`, on trusted main with Owner input STAGING ONLY. Do not reuse the old SH59-only workflow. It builds the exact backend, binds the test transport only to the isolated rc20261110 function, captures the live production root by its manifest hashes, deploys only the isolated function and staging assets, and independently checks root preservation and staging identity.
4. Reuse existing protected `isolated-qa` main-only environment: `BACKEND_QA_READ_TOKEN` (private backend contents read), `SUPABASE_ACCESS_TOKEN` (scoped to freight-quotes-staging, Edge Functions read/write). Never copy a production token to QA or log secret values. The Supabase scoped token was installed and successfully used on 2026-11-25. Renew only if expiring or revoked. No additional Mac runners or paid service is required for this path.
5. Before dispatch, run PR source/negative tests and complete read-only live root inventory. Bounded retries use a stable cache key; report all missing or mismatched files, never silently skip them. In provider readback, normalize only the exact deployment-qualified source prefix, compare both index.ts and deno.json byte-for-byte, reject duplicate/unexpected paths and mismatched content. Verify provider slug, version, bundle hash, runtime deployment ID, backend SHA, isolated project/schema and denied anonymous private access.
6. After staging attestation, run all three current protected evidence workflows named above for the same lock. Require real 37/37 authenticated E2E and fresh encrypted backup/readback/isolated restore under the current class-B gate. Release only through the approved production workflow, with exact Owner approval and separate production credentials. Verify deployed frontend assets, actual API identity, compatible pair and live smoke after publication. Never infer release from a successful PR.
7. Reuse valid evidence only for the exact same pair and within its permitted validity window. A tool/network error is not a functional PASS. Do not restart already-proved stages unnecessarily. Report to Owner only a verified publication or a specific genuinely unavoidable action; resolve normal source/config/dependency drift within the engineering workflow. No new runners, accounts, tokens or paid services for ordinary reconciliation.

### Verified reference run (historical proof, not a future release lock)

- Staging run [45588682368](https://github.com/hakaru4i-afk/freight-quotes-web/actions/runs/45588682368), all three applicable jobs SUCCESS.
- Candidate frontend `df89a9ad2e487caba839d6cd939d639bb292e42a`; backend `376637f806c889aab4526a4252da1c85a5c428f4`.
- Existing isolated QA function `freight-api-qa-rc20261110`, version 45, provider bundle `ed47af75738c8c2825b9063b299fec59199e7ef06cf3a62ece56e874ef21e8a2`.
- 196 live production root files preserved; staging pair independently attested. PRs #201, #202 and #203 merged. This is staging proof only, not full 37/37 or production approval. Use live identities and current lock on subsequent runs.
