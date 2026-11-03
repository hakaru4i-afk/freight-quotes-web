# Task2 staging candidate — not published, not ready for full acceptance

Candidate: `stg47-consolidated-e7a963ff8d8d`.
Private backend source: `7ac40d92077145ec588830216721861b4afad380`.
Both repositories use continuation branch `fix/issue47-complete-staging`.

This branch preserves the existing staging bundle and changes only Task2 navigation,
CSV metadata/retry handling, help translations and candidate manifests. Existing root
production files are unchanged. No Task1 source branch was merged.

Implemented: obsolete completion menu removed; direct old hash redirects to canonical
execution; readonly/action controls excluded from CSV; successful canonical Task2 imports
carry server-audit metadata; document request retries carry a stable request ID; event
handler failures are shown instead of causing unhandled promises. English and Chinese
translations now cover 28 existing help categories, all 14 FAQ entries and 14 execution
field tips. Customer values are excluded from static translation.

Local verification: 27 CSV/navigation/i18n/late-preparation tests pass. A private
PostgreSQL-backed integration harness passes 38 checks, including nine role/locale
combinations on six tabs at 390×844, actual CSV preview and database save. It uses the
real Task2 scripts, synthetic actor contexts and a synthetic file store. It does not
test hosted login, the entire legacy app or actual Supabase Storage.

Do not merge or publish this intermediate candidate. The matching backend module has
not been deployed. Real hosted role/Storage checks, direct legacy API completion gates,
full legacy CSV audit, SL integration, verified non-road routes and approved act/PDF
templates remain incomplete or unverified. The private release tracker is
`docs/releases/issue47/CONSOLIDATED_STATUS.md`; `task2Complete` must remain false.
