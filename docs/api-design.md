# API Design

- **Base path:** `/v1`
- **Identity:** `:userId` is a required opaque client identifier, not authentication.
- **Dates:** real `YYYY-MM-DD` calendar dates with inclusive bounds. Valid no-data requests return `200`, not an error.

## Endpoints at a glance

| Method | Endpoint | Business purpose |
| --- | --- | --- |
| `POST` | `/v1/users/:userId/workouts` | Record what the client actually completed |
| `GET` | `/v1/users/:userId/workouts` | Review workout history over time |
| `GET` | `/v1/users/:userId/personal-records` | Derive the client's best performance for one exercise |
| `GET` | `/v1/users/:userId/personal-records/compare` | Compare PRs between two explicit periods |

## Shared conventions

- Weight input is a JSON number. Initial units are `kg` and `lb`.
- Original weight/unit are preserved; canonical kg is stored for consistent calculations.
- Response weights are rounded half-up to at most three decimals.
- Exercise identity is outer-trim + lowercase only. Internal whitespace, punctuation, and diacritics remain significant.
- History uses partial-name matching; PR endpoints use exact normalized exercise identity.
- `from`/`to` ranges are inclusive. The service never infers month boundaries or coach locale.

---

## 1. Log workout

`POST /v1/users/:userId/workouts`

**Purpose:** record one workout date with one or more exercise occurrences and their ordered sets.

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

### Validation

- non-empty `userId`, `exerciseName`, `exercises`, and `sets`;
- real calendar `date`;
- reps: integer `1..10000`;
- weight: finite number `0..100000`, at most three meaningful decimal places;
- supported unit from the shared unit registry;
- request ≤ 256 KiB, ≤ 50 exercises, ≤ 50 sets/exercise.

### Transaction behavior

The entire request is atomic. Exercises are resolved/created inside the same transaction, canonical kg is calculated with decimal-safe arithmetic, then entries and sets are persisted. If any part fails, nothing from the request is committed.

Repeated same-day exercise names are valid and are not deduplicated.

### `201` response

```json
{
  "entries": [
    {
      "id": "entry-uuid",
      "exerciseName": "Bench Press",
      "date": "2026-09-25",
      "sets": [
        { "id": "set-uuid", "reps": 5, "weight": 100, "unit": "kg" }
      ]
    }
  ]
}
```

This endpoint echoes the submitted display value/unit; canonical kg stays an internal persistence detail.

---

## 2. Workout history

`GET /v1/users/:userId/workouts?exerciseName=&from=&to=&muscleGroup=&unit=&limit=&cursor=`

**Purpose:** let a coach review client activity over time without loading all history at once.

| Query | Behavior |
| --- | --- |
| `exerciseName` | Optional literal partial match on normalized exercise name |
| `from`, `to` | Optional inclusive date bounds; one-sided ranges allowed |
| `muscleGroup` | Optional case-normalized match against current catalog metadata |
| `unit` | Output unit; `kg` default, `lb` supported |
| `limit` | Default 20, maximum 100 |
| `cursor` | Opaque filter-bound keyset cursor |

The SQL filter runs before pagination. Entry order is `(workout_date DESC, created_at DESC, id DESC)`; sets remain `set_order ASC`.

### Cursor contract

The cursor carries the last `(workout_date, created_at, id)` plus a canonical hash of the effective query (`userId`, filters, output unit, and page size). `created_at` is preserved with PostgreSQL's six-digit microsecond precision. Invalid or mismatched cursors return `400`.

The scope hash prevents accidental cursor reuse with a different query; it is **not** authentication, authorization, or cryptographic tamper protection. Pagination is deterministic for an unchanged dataset, not snapshot-consistent across concurrent writes.

### `200` response

```json
{
  "items": [
    {
      "id": "entry-uuid",
      "exerciseName": "Bench Press",
      "muscleGroup": "chest",
      "date": "2026-09-25",
      "createdAt": "2026-09-25T12:30:00.123456Z",
      "sets": [
        { "id": "set-uuid", "reps": 5, "weight": 220.462, "unit": "lb" }
      ]
    }
  ],
  "page": { "limit": 20, "hasMore": false, "nextCursor": null }
}
```

A valid empty page keeps the same shape and adds `"message": "No workouts found for the requested filters"`.

---

## 3. Personal records

`GET /v1/users/:userId/personal-records?exerciseName=Bench%20Press&from=&to=&unit=kg`

**Purpose:** turn raw set history into the client's best performance for one exact exercise.

The three records are selected **independently**:

| Record | Ranking expression |
| --- | --- |
| `heaviestSet` | `weight_kg` |
| `highestVolume` | `reps × weight_kg` |
| `estimatedOneRepMax` | Epley `weight_kg × (1 + reps/30)` |

Ranking uses persisted canonical kg before display conversion. Ties use metric DESC, then `workout_date ASC`, `created_at ASC`, entry ID, set order, and set ID.

Each populated record returns entry/set IDs, reps, displayed weight/unit, metric `value`, `valueUnit`, and `achievedDate` from `workout_date`.

A valid query with no candidates returns:

```json
{
  "heaviestSet": null,
  "highestVolume": null,
  "estimatedOneRepMax": null,
  "message": "No personal records found for the requested range"
}
```

---

## 4. Compare personal records

`GET /v1/users/:userId/personal-records/compare?exerciseName=&rangeAFrom=&rangeATo=&rangeBFrom=&rangeBTo=&unit=`

**Purpose:** compare the same PR rules across two caller-supplied periods.

All four range bounds are required and inclusive. Each range is calculated independently; ranges may overlap. The API does not infer "this month" or "last month" because no coach timezone/locale is supplied.

```json
{
  "rangeA": {
    "from": "2026-09-01",
    "to": "2026-09-30",
    "records": { "heaviestSet": {}, "highestVolume": {}, "estimatedOneRepMax": {} }
  },
  "rangeB": {
    "from": "2026-08-01",
    "to": "2026-08-31",
    "records": { "heaviestSet": null, "highestVolume": null, "estimatedOneRepMax": null },
    "message": "No personal records found for this range"
  }
}
```

A no-data range remains `200`; only that range receives the short message.

---

## Error contract

All errors use one envelope:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": ["..."],
  "requestId": "..."
}
```

| Status | Code | Typical cause |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | malformed body/query/date/range/unit/cursor |
| `413` | `PAYLOAD_TOO_LARGE` | request body over 256 KiB |
| `500` | `INTERNAL_SERVER_ERROR` | unexpected server/database failure |

Unexpected failures return `details: null` and never expose stack traces in the response. A database failure never becomes a partial-success bulk response.

## Related docs

- [Architecture](architecture.md)
- [Database design](database-design.md)
- [Cursor ADR](decisions/004-cursor-pagination.md)
- [Weight normalization ADR](decisions/002-canonical-weight-normalization.md)
