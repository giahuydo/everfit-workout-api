# Architecture

## Scope

A single NestJS service exposes workout logging, workout history, and personal-record APIs. PostgreSQL is the source of truth. The take-home intentionally avoids microservices, Redis, queues, search engines, and other infrastructure that is not required by the assignment.

## Module boundaries

- `workouts`: validated bulk logging and workout history.
- `exercises`: shared global exercise identity and configurable muscle-group metadata loaded from seed/config; no admin API in this scope.
- `units`: extensible weight conversion and response-unit formatting.
- `personal-records`: PR aggregation and range comparison.
- `common`: configuration, validation, logging, errors, request IDs, pagination helpers.

Controllers should remain thin. Application services orchestrate use cases. Persistence/query concerns stay behind repositories or dedicated query services. Unit conversion is injected behind a small abstraction rather than scattered `if/else` logic.

## Write flow

`POST workout → validate DTO → normalize exercise names → transactionally resolve/create exercises by unique normalized name, convert each weight to canonical kg, and persist all entries + sets → return created result`. Decimal-safe arithmetic uses exact conversion factors and fixed storage precision; repeated same-day exercise occurrences remain separate entries.

One request is one transaction. If any exercise or set is invalid or persistence fails, no part of that bulk request remains committed.

## Read flow

History queries filter **entries** in PostgreSQL, including literal substring search on application-normalized exercise names, before keyset pagination, then load the selected entries' ordered sets; they never page joined set rows. PR queries resolve an exact normalized exercise name and rank sets in PostgreSQL using canonical kg expressions with deterministic ties. Output-unit conversion happens after selection of the winning row. Valid no-data queries return 200 with empty history or null PRs.

## Time model

`workout_date` is a calendar date supplied by the client, with inclusive date filters. System timestamps such as `created_at` are UTC `TIMESTAMPTZ(6)` values; history cursors preserve all six fractional digits of ingestion time. The service does not invent a workout timestamp or client timezone. Within the same workout date, `created_at` improves deterministic display ordering but is not the actual workout time.

## Scaling stance

The implementation target is a correct indexed PostgreSQL design for 50k+ entries/user, verified with representative query plans rather than an unmeasured throughput claim. The video may discuss stateless horizontal API scaling, connection-pool limits, read replicas, caching, projections, or partitioning as future options for 10k concurrent coaches, but these are not claimed as implemented capacity. `userId` is a route parameter, not an authorization mechanism; a real deployment requires an explicit access-control policy.


## Frozen operational bounds

The take-home bounds requests deliberately: 256 KiB body, 50 exercises/request, 50 sets/exercise, 120-char exercise names, 128-char user IDs, and history pages default/max 20/100. These limits keep transaction and response sizes predictable without adding queues or asynchronous ingestion. Pool, query and transaction timeouts are configuration-managed.

Exercise catalog creation is conflict-safe under concurrent logging via unique normalized identity plus insert-on-conflict followed by a separate select in the same transaction. Cursor payloads bind pagination state to the effective query but unsigned hashes are not tamper protection or authorization tokens; catalog metadata edits can alter filtered membership between pages.
