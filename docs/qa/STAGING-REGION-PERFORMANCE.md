# Staging API region · 11.11.2026

The database is in `eu-central-1`. Provider logs showed isolated QA v8 executing in `us-east-2`; API requests during published cabinet loading reached 34.562s server execution time. Request-local identity reuse reduces repeated reads but does not resolve the distance between the function and database.

A real comparison on the same isolated backend and accounts measured a burst of 12 authorized cabinet requests at **8645ms with automatic region selection** and **549ms in eu-central-1**. Warm session calls for Owner/Carrier/VED were 734/2615/1290ms versus 168/209/167ms. These measurements are evidence for this candidate, not a general latency guarantee.

`test/staging-api-region.mjs` adds the documented `forceFunctionRegion=eu-central-1` parameter only to the fixed staging API URL. Existing query values, authorization headers, document identity, methods and bodies are retained. No operation is retried, including writes. The local candidate role browser passed Owner/Carrier/VED at desktop/mobile; longest recorded API request was 1003ms. Final published verification remains required after deployment.

Supabase [regional invocation documentation](https://supabase.com/docs/guides/functions/regional-invocation) recommends database-local invocation for multiple database round trips and supports this query parameter for CORS clients. Explicit region selection disables automatic region failover. A region outage requires an operator to roll back this staging routing change and republish; ambiguous writes must not be automatically replayed. The database itself is already in this region.

Production files, business rules, SL scores, roles, tasks and migration state are unchanged. Process maps retain their business stages and record the new technical source under version `20261111-logic-5`; version 4 remains archived. Release remains `RELEASE_BLOCKED`.
