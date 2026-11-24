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
