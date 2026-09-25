# API Design (planned contract)

Base path: `/v1`. `:userId` is a required, non-blank opaque identifier; it is not authentication. Dates are ISO calendar dates (`YYYY-MM-DD`, real dates, not timestamps) and refer to `workout_date` without timezone conversion. Date ranges use **inclusive** `from` and `to`; when both are present, `from <= to`. No locale-derived month boundaries are inferred. Invalid values return the error envelope below; valid empty results are 200.

## Log workouts

`POST /v1/users/:userId/workouts`

```json
{
  "date": "2026-09-25",
  "exercises": [
    {
      "exerciseName": "Bench Press",
      "sets": [
        { "reps": 5, "weight": 100, "unit": "kg" },
        { "reps": 8, "weight": 80, "unit": "lb" }
      ]
    }
  ]
}
```

One request creates one entry per exercise occurrence (including repeated exercise names); each entry has ordered sets. `exercises` and each `sets` array must be non-empty. Require non-blank exercise names after outer trim, integer reps in `[1, 10000]`, finite JSON-number weights in `[0, 100000]` with at most 3 fractional decimal places, and supported units (`kg`, `lb` initially). Validate the parsed number's normalized decimal value, not the raw JSON token spelling: e.g. `1.0000` is accepted as 1; `0.0001` is rejected. Convert that normalized numeric value to a decimal string before decimal-library conversion/arithmetic; no binary-float unit calculation or raw-token fidelity is promised. Reject missing/null/malformed dates, negative weight/reps, fractional reps, invalid units, and malformed collections with 400. Enforce: request body ≤ 256 KiB, ≤ 50 exercises/request, ≤ 50 sets/exercise, `exerciseName` ≤ 120 chars, and `userId` ≤ 128 chars. Validate the entire payload and resolve/create exercises within **one database transaction**; a failure commits no entries or sets. Do not deduplicate repeated same-day workouts. Successful creation returns 201 with `{ "entries": [{ "id": "entry-uuid", "exerciseName": "Bench Press", "date": "2026-09-25", "sets": [{ "id": "set-uuid", "reps": 5, "weight": 100, "unit": "kg" }] }] }`; one item per submitted exercise occurrence, with sets in submitted order. Returned set weights/units are the submitted original values for this endpoint.

Exercise identity uses outer trim + lowercase only. Internal whitespace, punctuation, and diacritics are significant; original display spelling is retained. A shared global exercise name maps to one exercise row, not a per-user identity.

## Workout history

`GET /v1/users/:userId/workouts?exerciseName=&from=&to=&muscleGroup=&unit=&limit=&cursor=`

- `exerciseName`: optional **literal partial substring** of `exercises.normalized_name`, filtered in SQL. Outer-trim + Unicode-lowercase the search term with the same application normalizer used for identity, then escape SQL `LIKE` wildcards `%`, `_` and the escape character `\` so they match literally; use `LIKE ... ESCAPE '\'` against the `C`-collated normalized key (not locale-dependent `ILIKE` on display spelling). Internal whitespace, punctuation and diacritics remain significant. Unlike PR lookup, this is a partial filter, not exact identity.
- `from` / `to`: optional inclusive workout-date bounds. One-sided bounds are allowed.
- `muscleGroup`: optional metadata filter. Match case-insensitively after outer trim + lowercase against current `exercises.muscle_group`; null/nonmatching metadata are excluded. Metadata comes from the configurable seed/catalog, not business-logic constants.
- `unit`: output weight unit (`kg` default, `lb` supported). Original weight/unit and canonical kg remain stored regardless of the display choice.
- `limit`: positive integer, default 20, maximum 100.
- `cursor`: opaque base64url-encoded versioned JSON containing `(workout_date, created_at, id)` plus a canonical hash of `userId`, effective filters, output unit and limit. Round-trip `created_at` as a UTC ISO timestamp **with six fractional digits**, preserving PostgreSQL microseconds; never pass it through a millisecond-precision JS `Date` before keyset comparison. Invalid/mismatched cursors return 400. An unsigned hash is only for query matching, **not** token integrity, authentication or authorization; signing is deferred.

Filter in SQL before `LIMIT`, join/load the selected entries' ordered sets without paginating the joined set rows, and return one history item per workout entry. Order entries by `(workout_date DESC, created_at DESC, id DESC)`; sets by `set_order ASC`. Next-page predicate for last key `(d, t, i)` is `(workout_date, created_at, id) < (d, t, i)` with the same filters; fetch `limit + 1` entries to determine `hasMore`. `created_at` is ingestion time, not workout time. Convert returned weights to the requested unit using canonical kg; serialize JSON numbers rounded half-up to at most 3 fractional digits. Display rounding never affects stored or PR winner values.

Response shape (illustrative populated page): `{ "items": [{ "id": "entry-uuid", "exerciseName": "Bench Press", "muscleGroup": "chest", "date": "2026-09-25", "createdAt": "2026-09-25T12:30:00.123456Z", "sets": [{ "id": "set-uuid", "reps": 5, "weight": 100, "unit": "kg" }] }], "page": { "limit": 20, "hasMore": false, "nextCursor": null } }`. A populated response omits `message`; `nextCursor` is a non-null opaque string when `hasMore` is true. A page exhausted after a valid cursor still returns the same empty-page shape with the no-data message. Each `weight`/`unit` pair uses the requested display unit; nullable `muscleGroup` reflects current catalog metadata. `createdAt` is a UTC timestamp preserving database microseconds (not workout time). Default limit is 20. A valid no-data query returns 200 with `items: []`, `hasMore: false`, `nextCursor: null`, and an appropriate short `message` such as `No workouts found for the requested filters` (not an error). Pagination is not a snapshot: concurrent inserts may be omitted from or appear in later pages depending on their sort keys; changes to current catalog muscle-group metadata between requests can also alter filtered membership. Immutable ordering keys are assumed (entries are create-only in this scope).

## Personal records

`GET /v1/users/:userId/personal-records?exerciseName=Bench%20Press&from=&to=&unit=kg`

`exerciseName` is required and resolved by **exact normalized identity** (outer trim + lowercase), not partial matching. Optional date bounds are inclusive. `unit` defaults to `kg`. Select three records independently from matching sets using canonical kg before any output conversion/rounding:

- `heaviestSet`: maximum `weight_kg`.
- `highestVolume`: maximum `reps * weight_kg` (kg-based volume).
- `estimatedOneRepMax`: maximum Epley `weight_kg * (1 + reps / 30)` (force decimal division in SQL, e.g. `reps::NUMERIC / 30::NUMERIC`, never integer division).

Each non-null record includes the selected entry/set IDs, reps, displayed weight/unit, a `value` with explicit `valueUnit` (`kg`/`lb` for heaviest and estimated 1RM, `kg·reps`/`lb·reps` for volume), and `achievedDate` from `workout_date`. A populated example for a single 5×100 kg set is `{ "heaviestSet": { "entryId": "entry-uuid", "setId": "set-uuid", "reps": 5, "weight": 100, "unit": "kg", "value": 100, "valueUnit": "kg", "achievedDate": "2026-09-25" }, "highestVolume": { "entryId": "entry-uuid", "setId": "set-uuid", "reps": 5, "weight": 100, "unit": "kg", "value": 500, "valueUnit": "kg·reps", "achievedDate": "2026-09-25" }, "estimatedOneRepMax": { "entryId": "entry-uuid", "setId": "set-uuid", "reps": 5, "weight": 100, "unit": "kg", "value": 116.667, "valueUnit": "kg", "achievedDate": "2026-09-25" } }`. All three metrics are populated when there are candidate sets. Volume/estimated 1RM derive from persisted six-decimal canonical kg **before display rounding**, then convert and round for display. Tie order after metric DESC is `workout_date ASC, created_at ASC, workout_entry.id ASC, set_order ASC, workout_set.id ASC`. This chooses a deterministic row, **not** the actual first workout within a day. Missing exercise and valid ranges with no sets return 200 with all three metrics `null`, not 404, plus an appropriate short `message` such as `No personal records found for the requested range`. The no-data response is `{ "heaviestSet": null, "highestVolume": null, "estimatedOneRepMax": null, "message": "No personal records found for the requested range" }`; populated responses omit `message`. For a candidate set, all three independent metrics are non-null.

## PR comparison

`GET /v1/users/:userId/personal-records/compare?exerciseName=&rangeAFrom=&rangeATo=&rangeBFrom=&rangeBTo=&unit=`

Require a non-blank `exerciseName` and all four valid date bounds (`rangeAFrom <= rangeATo`, `rangeBFrom <= rangeBTo`); ranges may overlap. Return `{ "rangeA": { "from": "...", "to": "...", "records": { ... } }, "rangeB": { "from": "...", "to": "...", "records": { ... } } }`, using the same three independent PR rules per range. A range with no data has three null metrics and a short no-data `message` alongside that range's `records`: `{ "rangeA": { "from": "2026-08-01", "to": "2026-08-31", "records": { "heaviestSet": null, "highestVolume": null, "estimatedOneRepMax": null }, "message": "No personal records found for this range" }, "rangeB": { "from": "2026-09-01", "to": "2026-09-30", "records": { "heaviestSet": null, "highestVolume": null, "estimatedOneRepMax": null }, "message": "No personal records found for this range" } }`. Populated ranges omit their `message`; the response remains 200. The caller supplies explicit calendar boundaries; no coach locale or month inference.

## Errors

One structured error envelope: `{ "statusCode": 400, "code": "VALIDATION_ERROR", "message": "...", "details": [...], "requestId": "..." }`. Syntax, invalid ranges/units, mismatched/invalid cursor, and invalid fields are 400. Database failure is not a partial-success response. Never expose stack traces in production responses. The assignment does not specify authentication/authorization; this take-home intentionally omits it and accepts `userId` as a route parameter. This is not a prohibition on auth: production deployment needs an explicit identity/access-control policy.
