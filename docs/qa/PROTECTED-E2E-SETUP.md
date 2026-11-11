# Protected authorized E2E

Workflow: `.github/workflows/isolated-qa-published-browser.yml` → **Isolated QA published role browser**. Manual dispatch from `main` only. Production is not a target. Results are real HTTP responses and downloaded published assets; API responses are not mocked.

In repository **Settings → Environments**, create **`isolated-qa`** and restrict deployment branches to **`main`**. Add the following **Environment secrets** there. Do not enter credentials in Issues, PRs, workflow inputs, Variables or chat. No personal access token, production credential, service-role key or private age identity is required.

| Role | Login secret | Password secret |
| --- | --- | --- |
| Owner | `QA_OWNER_LOGIN` | `QA_OWNER_PASSWORD` |
| Carrier A | `QA_CARRIER_A_LOGIN` | `QA_CARRIER_A_PASSWORD` |
| Carrier B | `QA_CARRIER_B_LOGIN` | `QA_CARRIER_B_PASSWORD` |
| VED | `QA_VED_LOGIN` | `QA_VED_PASSWORD` |
| Logistic | `QA_LOGISTIC_LOGIN` | `QA_LOGISTIC_PASSWORD` |
| Supplier | `QA_SUPPLIER_LOGIN` | `QA_SUPPLIER_PASSWORD` |
| Designer | `QA_DESIGNER_LOGIN` | `QA_DESIGNER_PASSWORD` |
| Content | `QA_CONTENT_LOGIN` | `QA_CONTENT_PASSWORD` |
| Purchasing | `QA_PURCHASING_LOGIN` | `QA_PURCHASING_PASSWORD` |
| Certification | `QA_CERTIFICATION_LOGIN` | `QA_CERTIFICATION_PASSWORD` |

Use only the existing isolated test accounts. Login scope and server role are checked before browser execution. Credentials must be handed over through an encrypted channel; they are not included in this document. The VED and Logistic accounts are separate identities even though their current technical API role is the same.

**Variables required by this workflow: none.** This differs from the older Task12 observer, which has its own `QA_RUN_ID` and `QA_SCHEMA_PARITY_VERIFIED` variables; setting those is not a substitute for authenticated E2E credentials or evidence.

After values are entered, open **Actions → Isolated QA published role browser → Run workflow → main**. The job first validates every actual login/role against the isolated API, then installs dependencies, reads all role cabinets at desktop/mobile, creates a real isolated Owner request, submits Carrier A CSV and Carrier B XLSX bids, compares both offers and selects one winner, accepts the shipment with the winning carrier, saves dates and containers, verifies the four-reschedule limit under concurrent requests and retries without extra history/audit, then assigns documents and sends a shared VED chat message with a byte-verified attachment. Loser and premature VED access are denied. Credentials are available only to the authentication step. Missing/invalid bindings stop the job. The final `always()` step revokes sessions and deletes the private session directory. Session tokens, screenshots of credentials and private files are not uploaded; only redacted JSON evidence is retained for seven days.

A successful run confirms the scenarios it executes. It does **not** promote all 37 broad acceptance groups to PASS or authorize a production release. Download and review the JSON artifact; resolve any failed cleanup or scenario before acceptance.
