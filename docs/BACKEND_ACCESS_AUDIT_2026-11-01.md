# Backend: access controls and transport workflow — read-only audit (01.11.2026)

**Sources:** Supabase Edge Function `freight-api`, version 32, in production and staging; read-only SQL on PostgreSQL metadata (schema `freight`); aggregate Supabase function logs. **No records, credentials, or production settings modified.**

## Verified architecture

- Both environments expose a Supabase Edge Function named `freight-api` and each has 60 tables under non-public schema `freight`.
- Server implementation uses a custom session/cookie abstraction around a bearer token and SQL queries. The Edge Function has `verify_jwt: false`; access to business routes is implemented in its own `freightAccess.authorize(req)` layer. This is **not inherently an authentication bypass**, but custom auth requires systematic negative tests.
- `freightPermissionFor(path,method,action,q)` maps routes/actions to capabilities such as `applications.read/fill/approve`, `shipments.read/fill`, `execution.customs`, `offers.decide`, etc. Access handler checks user role, permission list and (when appropriate) scoped ownership.
- Owner has an explicit early bypass in the access layer. Need verify the owner identification and session lifecycle, including reset/deactivation and two-session limit.

## Transport application and execution gates found

- Form field descriptors include bilingual RU/EN labels and required-field markers.
- `transportRequired(details)` checks required attributes, numeric ranges and date formats.
- `submit` requires required attributes and a positive final amount; approval/review checks for completeness.
- `departure_approve` requires an approved transport application and required documents. File exceptions require a reason of at least 20 characters and staff approval; core documents cannot be waived by the same path.
- Carrier `progress` to `en_route` / pre-customs stages checks: required form data, document set, booking approved, approval revision current, actual loading date, actual departure date and route length. Departure check is not a superficial UI-only gate.
- Customs, warehouse, claims and completion use separate stage/role rules. Uploaded or changed required documents may invalidate previously recorded stage approval.
- The transition table currently allows `awaiting_loading -> en_route` as well as `awaiting_loading -> loading -> en_route`. Because data prerequisites are separately checked, this **does not prove the carrier can bypass required documents**; it may nevertheless contradict a requirement that the visual loading stage itself must always be recorded. Needs a specific business decision and regression test.

## Observed aggregate API statuses (Supabase logs; last 24h at query time)

- Production `function_edge_logs`: 200 = 6,235; 204 = 6,043; 403 = 527; 401 = 1; 502 = 1.
- Staging `function_edge_logs`: 200 = 18; 403 = 437. Almost all staging 403s (414) relate to `GET /api/access`.
- **Interpretation limits:** 403 can represent expected authorization denials, unauthenticated probes or a real broken test login. Repeated 403 is a lead for diagnosis, **not proof of an outage**. High 200 volume on production means the API has served successful requests, but doesn't verify all critical workflows.

## Recommended automated tests before code changes

1. Create isolated test users (never use actual carrier or supplier credentials) for Owner, Logistic, Carrier A, Carrier B, Supplier and Designer.
2. Verify `/api/auth`, `/api/session`, `/api/access`: correct login, expired/revoked sessions, role changes, owner-only write endpoints; ensure unauthorized user sees no sensitive data.
3. Carrier A vs Carrier B negative access tests for `/api/data`, `/api/carrier`, `/api/transport-applications`, `/api/transport-files`, `/api/chats`, `/api/shipments` and `/api/tenders`. Confirm denial server-side, not only UI hiding.
4. Build a transport application with missing required fields: submit must fail. Then add required fields and confirm submission; owner/Logistic approval must be required.
5. Move to `en_route` with one missing document, without recorded loading date, with stale approval revision and without route length: each must fail. Re-upload/change a required document and verify approval invalidation.
6. Check intended rule for `awaiting_loading -> en_route` vs mandatory `loading` stage, then lock with tests.
7. Test customs, warehouse receipt and completion with staff and carrier roles and required attachments.
8. Test CSV/Office export for injection or malformed content and PDF rendering with long multilingual strings.
9. Re-check staging 403s with known test credentials and only then diagnose whether access failures are expected.

**Safety:** No script should insert/update/delete production rows. Avoid accessing commercial cargo records or sharing credentials in reports.
