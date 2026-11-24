# Evidence for the locked release pair

The two commits in `release-lock.json` are the candidate. The workflows run from trusted `main` and record their own workflow commit and attempt separately. Changing the lock requires fresh evidence for the resulting pair.

| Dispatch on `main` as Owner | Required output |
| --- | --- |
| `release-stabilization.yml` | Locked frontend regression and the complete frontend test job |
| `locked-backend-regression.yml` | Locked backend regression, synthetic backup safety and schema transition rehearsal |
| `isolated-qa-oidc-browser.yml` | `locked-release-evidence-attempt-N` with the pair and all 37 authenticated scenarios |

The E2E workflow needs the tested frontend's `test/` assets at the staging URL and the isolated API at `ibclzdkxiozbzmniiygv/freight-api-qa-rc20261110`. Prepare the isolated API package from the backend SHA with `node scripts/release/locked-qa-runtime.mjs build <backend-checkout> <new-output-directory>` in the protected workflow. The package contains `index.ts` and `deno.json`. Use the existing isolated deployment channel for that project and function. The workflow checks provider metadata, downloads and compares the deployed function files, checks the live health deployment ID and compares staging assets before and after the browser run. A source mismatch blocks the run before it obtains QA sessions. The QA workflow uses a GitHub-hosted runner because the credential broker requires that OIDC claim.

Use the three successful run IDs from the same lock within 24 hours of their start. Results from reruns must come from the current attempt. The production workflow requires `publish=true`, the Owner's approval string containing both SHAs, all three verified runs and a fresh encrypted backup with ciphertext readback and isolated recovery. The PR and the three evidence workflows have no production deployment step.
