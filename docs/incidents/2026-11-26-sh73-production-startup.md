# P0 SH-01.30.73 — production startup outage, 2026-11-26

Owner confirmed working cabinet restored after rollback run 45827581662. Screen shows 16 requests, 16 shipments in transit and seven pending tasks. No database restore was performed.

## Evidence
- Release 45818064696: exact pair c8e984e749b9283e053360ec5e11a1147f106044 / 8af962470a2aed1c35457b234ceb36666cd2ed64, static readback and health passed, but authenticated cabinet timed out.
- New production endpoint freight-api-release-83fd49986d138ab80c0ae7b96b970b64: health 200; observed logs after reported failure had no new endpoint cabinet requests. Legacy endpoint continued returning 200 for session/data.
- PR 226 corrected exact immutable route matching; attempt 45826334545/2 published it, but Owner still saw timeout. Thus missing routing match is a confirmed defect, NOT proven sole root cause.
- Two Pages artifact lookup failures: 45825751729 and 45826334545/1. REST visibility was insufficient on first attempt; attempt 2 succeeded.
- Rollback 45827581662 restored verified previous root and existing API, then Owner confirmed cabinet loads. SH73 remains unsuitable for publication.

## Permanent acceptance requirements
1. Keep prior production running during candidate checks. Use exact packaged candidate and exact new API, real browser same origin, actual authenticated read-only session and data responses and visible cabinet.
2. Fail closed if proof or approved dedicated smoke session is absent. No production business writes, no personal Owner session export, no secrets in logs/artifacts.
3. Repeat real authenticated browser test on published root. On failure, restore saved previous Pages artifact; verify restored root and API. Do not restore database.
4. Require exact production region routing for candidate slug; reject legacy-only wrapper. Test with real candidate bundle, not staging URL alone.
5. Require exact uploaded Pages artifact readiness, attempt-specific identifiers and evidence. REST readiness is necessary, not proof of internal deploy lookup availability.
6. Do not republish SH73 merely because static/health/isolated E2E pass. Complete exact runtime and real user network verification first; keep rollback evidence.
