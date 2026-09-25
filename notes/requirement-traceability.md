# Requirement Traceability — Everfit assignment (internal reference)

This detailed matrix is split from [the concise implementation plan](../docs/implementation-plan.md). All A01–A102 rows, source classifications, proposed decisions, planned verification, and future deliverable evidence are retained. Keep this internal reference in sync with the plan and the assignment; do not treat planned tests or artifacts as completed.

## Assignment-to-deliverable traceability (planning only)

**Source/claim discipline:** Compared against the full assignment checklist supplied in this session (items 1–12). Rows tagged **A** map its mandates, evaluation criteria, deliverables, or recommendations; A30 (UTC recommended) and A63 (AI tools encouraged) are **recommendations**, not standalone mandates; A80 (diagram) is an **optional bonus**. A36 records the required technology choice/justification, not a mandate to choose NestJS. The **Design** column records *our proposed choices*, not Everfit mandates. P0–P9 refer to phases in [the implementation plan](../docs/implementation-plan.md). **All checks and evidence below are planned, not executed or delivered.** `README` means the future root `README.md`; `Video` means the future English walkthrough. P7 test reports / `notes/experiments.md` are future evidence, not current results. Rows for an evaluation criterion may revisit a feature requirement from a different verification perspective; they are cross-references, not additional mandated features.

### Logging, storage, history and PR behavior

| ID / assignment item (A) | Design decision (not assignment mandate) | Phase | Planned verification / test | Final deliverable evidence (planned) |
|---|---|---|---|---|
| A01 `userId` on workout entry | Required opaque route parameter, stored as `workout_entries.user_id`; [API](../docs/api-design.md#log-workouts), [schema](../docs/database-design.md#workout_entries) | P2–P3 | Integration: entry linked to supplied user; reject blank ID | README POST example + schema; P7 test result |
| A02 workout `date` | ISO calendar date → `workout_date DATE`; [ADR 003](../docs/decisions/003-workout-date-and-timezone.md) | P2–P3 | Valid real date round-trip; invalid date rejected | README POST/date semantics; P7 result |
| A03 `exerciseName` | Shared exercise identity, outer trim + lowercase; [API](../docs/api-design.md#log-workouts) | P2–P3 | Name resolution, normalization/collision integration tests | README POST example + schema; P7 result |
| A04 `sets[{reps,weight,unit}]` | Ordered child sets, original values + canonical weight; [schema](../docs/database-design.md#workout_sets) | P2–P3 | Create/read multiple sets with all three fields and positions | README request/response examples; P7 result |
| A05 kg accepted | Unit registry with decimal kg factor; [ADR 002](../docs/decisions/002-canonical-weight-normalization.md) | P2–P3 | Unit and integration kg round-trip | README units; P7 result |
| A06 lb accepted | Registry with decimal lb→kg factor | P2–P3 | Unit and integration lb conversion with precision fixtures | README units; P7 result |
| A07 normalized kg stored **alongside original** | `weight_kg`, `original_weight`, `original_unit` per set; [schema](../docs/database-design.md#workout_sets) | P2–P3 | DB integration reads all three and verifies conversion, independent of display | README schema/trade-off; P7 result |
| A08 multiple exercises in one request | One entry per exercise occurrence, single transaction; [API](../docs/api-design.md#log-workouts) | P3 | Mixed-validity rollback and valid multi-exercise POST integration | README bulk request/response; Video demo; P7 result |
| A09 history **by user** | `GET /v1/users/:userId/workouts`, SQL user filter | P4 | Integration: second user's entries excluded | README GET example; Video demo; P7 result |
| A10 partial exercise-name history filter | App-normalized literal substring on `normalized_name` via escaped SQL `LIKE`, not PR identity; [API](../docs/api-design.md#workout-history) | P4 | Mixed-case substring/negative match integration + query plan | README filter example; Video; P7 result |
| A11 history date-range filter | Inclusive `workout_date` bounds, one-sided allowed | P4 | Both/one-sided bounds; boundary days and invalid range | README filter example; Video; P7 result |
| A12 history muscle-group filter **when metadata available** | Shared nullable `exercises.muscle_group` from seed/config; outer-trim + lowercase exact matching against current catalog, null excluded | P2, P4 | Seed metadata; match, nonmatch, null, combined-filter integration | README metadata setup + filter example; Video; P7 result |
| A13 requested output unit conversion | Convert from kg at read time, default kg; retain original; [ADR 002](../docs/decisions/002-canonical-weight-normalization.md) | P2, P4–P5 | Same history/PR fixture in kg vs lb; winner invariant | README unit query/response; Video; P7 result |
| A14 pagination (cursor **or** offset) | **Chosen:** versioned keyset `(workout_date, created_at, id)`, not assignment-required offset; [ADR 004](../docs/decisions/004-cursor-pagination.md) | P4 | Page boundary, equal-key, invalid/mismatched cursor, insertion-between-pages integration | README cursor contract; Video; P7 result |
| A15 PR heaviest single set | Independently rank canonical `weight_kg` by exact normalized exercise name | P5 | Fixture where heaviest winner differs from other metrics; tie test | README PR example; Video; P7 result |
| A16 PR highest-volume set (`reps*weight`) | Rank `reps * weight_kg`, decimal arithmetic | P5 | Independent volume fixture incl mixed units/ties | README PR example; Video; P7 result |
| A17 PR Epley 1RM (`weight*(1+reps/30)`) | Rank `weight_kg * (1 + reps / 30)` with decimal division | P5 | Known numeric fixture; detect integer division; mixed-unit/tie cases | README PR example/formula; Video; P7 result |
| A18 date each PR achieved | Winner's `workout_date` as `achievedDate`; ties deterministic, not actual first time | P5 | Separate winner dates + same-day ties | README response examples; Video; P7 result |
| A19 PR comparison across time ranges (e.g. this vs last month) | Two explicit inclusive date windows; caller supplies month boundaries | P5 | Two-range fixtures, empty/overlapping ranges, boundary dates | README compare example; Video demo; P7 result |

### Invalid inputs, dates, concurrency, scale and extensibility

| ID / assignment item (A) | Design decision (not assignment mandate) | Phase | Planned verification / test | Final deliverable evidence (planned) |
|---|---|---|---|---|
| A20 invalid/unsupported units | Central registry validation; structured 400, atomic rollback | P2–P3, P6 | Invalid unit in one set of bulk request; no rows committed | README error-code example; Video error demo; P7 result |
| A21 malformed fields | DTO/global validation plus DB constraints; structured 400 | P3, P6 | Missing/wrong-type names, arrays, weight/unit, invalid date string | README validation/errors; Video; P7 result |
| A22 missing fields | Required route/body fields validated | P3, P6 | Missing date/exerciseName/sets/reps/weight/unit cases | README 400 cases; Video; P7 result |
| A23 **null date** | Reject null, never reinterpret as current date | P3 | Explicit null-date POST → 400, no writes | README error example; Video; P7 result |
| A24 **negative weight** | Non-negative numeric weight; zero accepted as chosen policy | P2–P3 | Negative weight → 400/rollback; zero succeeds | README validation rules; Video; P7 result |
| A25 **negative reps** | Positive integer reps (zero also rejected by our policy) | P2–P3 | Negative/fractional/zero reps → 400/rollback | README validation rules; Video; P7 result |
| A26 **empty sets** | Require non-empty sets for each exercise | P3 | Empty sets in bulk request → 400/rollback | README 400 case; Video; P7 result |
| A27 no-data date ranges: empty result | 200 empty `items` or null three PR metrics per range, not error | P4–P5 | History/PR/compare empty-range integration, absent exercise | README 200 examples; Video; P7 result |
| A28 no-data date ranges: appropriate message | Short human-readable no-data message **with** empty/null data; [API](../docs/api-design.md) | P4–P5 | Assert message in history, PR and comparison's empty range | README 200 examples; Video; P7 result |
| A29 timezone strategy and trade-offs | Client calendar `DATE`; UTC `TIMESTAMPTZ` for system timestamps, not invented workout time; [ADR 003](../docs/decisions/003-workout-date-and-timezone.md) | P0, P2–P5 | Day-boundary/date parsing fixtures; verify no timezone date shift | README rationale/limitations; Video architecture; P7 result |
| A30 UTC recommendation acknowledged | Adopt UTC for ingestion/audit timestamps; do not convert date-only workout day to midnight UTC | P0–P2 | UTC timestamp serialization and non-UTC client-date fixture | README UTC policy/trade-off; Video; P7 result |
| A31 concurrent writes same user/exercise/same time | No uniqueness on user/exercise/day; atomic writes + unique normalized exercise upsert/re-read | P2–P3 | Concurrent POSTs same exercise/day: both workouts, one exercise, intact sets | README concurrency trade-off; P7 result |
| A32 50,000+ entries per user | SQL predicates, supporting indexes, keyset; optimize on evidence only | P4, P7 | Representative 50k+ user seed, deep pages, filtered history/PR `EXPLAIN (ANALYZE, BUFFERS)` | README measured results/limits; `notes/experiments.md`; Video scaling |
| A33 new unit (e.g. stone) with minimal changes | Registry/converter, unit codes not hard-coded in business logic; [ADR 002](../docs/decisions/002-canonical-weight-normalization.md) | P2, P7 | Add stone via registry fixture/test; validate writes/reads/PR without service conditionals | README extension guide; P7 test result |
| A34 configurable exercise→muscle-group mapping | Shared catalog seeded/configured outside business logic; metadata changes affect subsequent filtering of historical entries; no admin API | P2, P4 | Change mapping/config fixture and re-run filter; null behavior | README metadata configuration; P7 result |

### Technology and evaluation criteria (each independently checkable)

| ID / assignment item (A) | Design decision (not assignment mandate) | Phase | Planned verification / test | Final deliverable evidence (planned) |
|---|---|---|---|---|
| A35 NodeJS | Build on Node.js runtime (assignment requirement) | P1 | Clean install/build/run under documented Node version | README prerequisites + clean-checkout P9 record |
| A36 NestJS choice | **Chosen** NestJS (recommended, not mandated); modular controllers/services/DI | P0–P1 | Build/boot + module-level tests | README architecture + Video rationale |
| A37 PostgreSQL vs MongoDB justification | **Chosen** PostgreSQL for relational/transaction/query fit; MongoDB allowed; [ADR 001](../docs/decisions/001-postgresql.md) | P0–P2 | Schema/migration review + relational query tests | README trade-off + schema; Video rationale |
| A38 schema design | Three tables/FKs/checks/`NUMERIC`/`DATE`/UTC timestamps; [schema](../docs/database-design.md) | P2 | Migration up/down, FK/constraints integration | README schema diagram/description; P7 result |
| A39 indexes | Planned user/date/cursor and exercise lookup indexes, adjust only from plans | P2, P7 | Inspect migration/index list + representative `EXPLAIN` | README indexes/measurement; `notes/experiments.md` |
| A40 query efficiency (evaluation) | SQL-filtered entry history; SQL-ranked PR, avoid per-entry/N+1 reads and offset deep scans | P4–P5, P7 | Query counts + 50k+ plans for filters/PR/keyset | README measured query notes; P7 result |
| A41 normalization (evaluation) | Store original weight/unit plus kg, conservative unique exercise name; avoid float winner selection | P2, P7 | Conversion and identity collision fixtures | README design/precision notes; P7 result |
| A42 REST API design (evaluation) | Versioned POST/GET routes and explicit status/response contracts; [API](../docs/api-design.md) | P0, P3–P6 | OpenAPI/spec review + HTTP e2e for each route/status | README endpoint examples; Video demo |
| A43 REST error handling (evaluation) | Stable status/code/message/details/requestId envelope | P3, P6 | 400 invalid, 200 empty, unexpected error sanitized | README error codes; Video error demo; P7 result |
| A44 REST pagination (evaluation) | Cursor chosen; filter/unit/limit binding; no snapshot promise | P4 | Multi-page/invalid cursor/concurrent insert e2e | README pagination contract; Video; P7 result |
| A45 REST filtering (evaluation) | SQL user, name, dates, optional metadata predicates | P4 | Each filter independently and combined e2e | README query examples; Video; P7 result |
| A46 REST validation (evaluation) | Validated DTOs + constraints + bounded input | P3, P6 | Table-driven malformed/boundary tests | README validation/error examples; P7 result |
| A47 separation of concerns (evaluation) | Thin controllers; use cases; repository/query services; [architecture](../docs/architecture.md) | P1–P6 | Design/code review of module boundaries | README architecture + Video walkthrough |
| A48 extensibility (evaluation) | Registry-based unit conversion and configurable exercise metadata | P2, P4 | Stone/mapping change tests without cross-module conditionals | README extension guide; Video trade-offs |
| A49 dependency injection (evaluation) | Nest providers for unit converter, services and persistence | P1–P6 | Unit tests with injected fakes; provider wiring integration | README architecture; P7 results |
| A50 PR correctness (evaluation) | Three independent SQL winners + deterministic ties | P5 | Independent fixture calculator incl ties, mixed units | README PR examples; Video; P7 result |
| A51 1RM correctness (evaluation) | Epley decimal factor and canonical unit before output rounding | P5 | Numerical fixture with fractional `reps/30`, comparison | README formula; Video; P7 result |
| A52 timezone correctness (evaluation) | Date-only exercise day; UTC system timestamps | P0, P2–P5 | Boundary, serialization and UTC-offset fixtures | README strategy/trade-off; Video; P7 result |
| A53 bulk correctness (evaluation) | Single request transaction for all exercises/sets | P3 | Mixed-validity rollback and parallel logging integration | README atomicity; Video; P7 result |
| A54 graceful **structured** errors (evaluation) | Global handler + sanitized predictable envelope and request ID | P6 | Exception and validation e2e; no stack trace | README error-code examples; Video; P7 result |
| A55 unit testing (evaluation) | Isolated converter, normalization, cursor, PR arithmetic | P2–P7 | Run unit suite, record cases and results | README test instructions + P7 result |
| A56 integration testing (evaluation) | Real PostgreSQL migration/transaction/filter/PR tests | P2–P7 | Run DB-backed suite on clean DB | README test instructions + P7 result |
| A57 edge-case testing (evaluation) | Boundary matrix incl invalid inputs, zero policy, empty ranges, ties, concurrency | P3–P7 | Run adversarial e2e fixtures + inspect assertion outcomes | README tests/limitations + P7 result |
| A58 test **design over coverage %** (evaluation) | Requirement→nominal/boundary/failure/concurrency case map; coverage % is secondary | P0, P7 | Review test matrix for gaps, layer rationale and deterministic fixtures, not just coverage threshold | README testing approach + P7 test inventory |
| A59 Docker readiness (evaluation) | Compose DB/service setup and multi-stage image | P1, P6, P9 | Docker build, `docker compose up` or documented sequence from clean checkout | README reproducible setup; P9 result |
| A60 logging readiness (evaluation) | Structured Pino logs with request ID, no sensitive stack traces in responses | P6 | Inspect structured log from successful/error request | README operations; P7 result |
| A61 configuration readiness (evaluation) | Environment validation, explicit DB pool defaults, fail fast | P1, P6 | Missing/invalid env startup tests | README config/env; P7 result |
| A62 performance readiness (evaluation) | Benchmark actual query shapes before adding extensions/indexes | P7 | 50k+ seed, representative plans/latencies; record limits | README measured evidence or honest gap; `notes/experiments.md` |

### AI adoption, submission artifacts and video

| ID / assignment item (A) | Design decision (not assignment mandate) | Phase | Planned verification / test | Final deliverable evidence (planned) |
|---|---|---|---|---|
| A63 AI tools **encouraged** / actual use | Recommended reviewed assistance, not a mandate to use a particular tool or fabricate usage | P0–P8 | Cross-check real prompts/outputs/edits vs findings log | `AI_WORKFLOW.md` + genuine `notes/ai-findings.md` evidence |
| A64 no auth; `userId` as parameter | Route-scoped opaque ID; no fabricated users/auth layer; explicitly flag production access-control gap | P0, P3–P6 | e2e path ID propagation; review no auth claim as limitation | README security trade-off + API path; Video |
| A65 `AI_WORKFLOW.md`: tools + purposes in architecture | Describe actual architecture-assistance tool usage; if absent flag unmet, never invent | P8 | Verify tool names, prompts/tasks against records | `AI_WORKFLOW.md` architecture section |
| A66 `AI_WORKFLOW.md`: tools + purposes in coding | Describe actual coding assistance; if absent flag unmet, never invent | P3–P8 | Match real code review/edits to tool record | `AI_WORKFLOW.md` coding section |
| A67 `AI_WORKFLOW.md`: tools + purposes in testing | Describe actual test assistance; if absent flag unmet, never invent | P7–P8 | Match generated tests and human checks to evidence | `AI_WORKFLOW.md` testing section |
| A68 `AI_WORKFLOW.md`: tools + purposes in debugging | Describe actual debugging assistance; if absent flag unmet, never invent | P7–P8 | Match diagnosis/fix to tests or issue record | `AI_WORKFLOW.md` debugging section |
| A69 `AI_WORKFLOW.md`: tools + purposes in docs | Describe actual docs assistance, including this planning pass where supported | P0, P8 | Review session edits and findings log; do not infer model/tool not recorded | `AI_WORKFLOW.md` docs section |
| A70 `AI_WORKFLOW.md`: >=2 real wrong/suboptimal outputs | Document two **distinct, evidenced** cases if they occur; never invent | P7–P8 | Review original output and concrete defect/suboptimality for each | `AI_WORKFLOW.md` two case studies + supporting findings |
| A71 `AI_WORKFLOW.md`: corrections to both | Human correction plus independent check for each real case | P7–P8 | Diff/review/test evidence of each correction | `AI_WORKFLOW.md` case studies + test/commit refs |
| A72 `AI_WORKFLOW.md`: >=1 real rejected suggestion | Record a genuine distinct rejection only if it occurred | P7–P8 | Trace original suggestion and explicit rejection decision | `AI_WORKFLOW.md` rejection case + findings |
| A73 `AI_WORKFLOW.md`: why rejected | Explain verified risk/trade-off instead of a fabricated anecdote | P7–P8 | Review rejection rationale vs design/measurements | `AI_WORKFLOW.md` rationale + refs |
| A74 prompting strategy: context | Describe what real files/requirements were provided to AI | P8 | Compare narrative to recorded prompts/session artifacts | `AI_WORKFLOW.md` prompting section |
| A75 prompting strategy: decomposition | Explain actual task/phase breakdown and iterative review | P8 | Compare narrative to work history | `AI_WORKFLOW.md` prompting section |
| A76 prompting strategy: rules/system prompts | Describe rules or system prompts **only where actually used and shareable**; never invent or disclose secrets/hidden prompts | P8 | Review against permissible actual instructions/context | `AI_WORKFLOW.md` prompting section |
| A77 iterative meaningful git history | Future genuine phase-scoped commits with meaningful messages and reviewable changes; none made here | P1–P9 | Inspect `git log --stat` for milestones and messages | Repository commit history; README implementation timeline if useful |
| A78 reviewed/refined AI code; no blind copy-paste | Human review and revision of AI output before acceptance | P3–P9 | Inspect code diffs/tests + findings evidence | Git history + `AI_WORKFLOW.md` reviewed example |
| A79 README architecture overview | Explain modules, flows, time/unit choices | P8 | Compare README with implemented code | Root `README.md` architecture section |
| A80 README architecture diagram **bonus** | Add a simple diagram if accurate and useful; bonus, not mandatory | P8 | Check diagram against real modules/schema | Root `README.md` diagram if provided |
| A81 README working setup (`docker compose up` **or clear steps**) | Compose-oriented setup, document any migration/seed commands explicitly | P1, P8–P9 | Reproduce from fresh checkout following README alone | Root `README.md` setup + P9 result |
| A82 README API request documentation | Provide logging/history/PR/compare requests and filters | P8 | Exercise each documented example | Root `README.md` API request examples |
| A83 README API response documentation | Show successful, paginated and no-data bodies for all endpoints | P8 | Compare examples to e2e responses | Root `README.md` response examples |
| A84 README API error codes | Document 400 validation, 200 empty, and unexpected error contract/statuses | P6, P8 | Exercise bad-input examples | Root `README.md` error section |
| A85 README DB schema/design decisions | Describe tables, keys, indexes, conversion, timestamps, normalization | P8 | Compare migrations with docs/schema ADRs | Root `README.md` schema/decision section |
| A86 README trade-offs | Explain date-only, cursor, normalization, no auth, metadata and measurement limits | P8 | Compare trade-offs to actual implementation | Root `README.md` trade-offs section |
| A87 README scaling changes | Distinguish implemented indexed queries from hypothetical 10k-coach options | P8 | Check claims vs experiment evidence, note unmeasured capacity | Root `README.md` scaling section |
| A88 video length and language | Produce a **15–20 min English** walkthrough recording | P8 | Timed rehearsal, language check, then verify finished recording/link is accessible | Accessible English video recording/link (future) |
| A89 video architecture decisions **and why** | Cover NestJS/Postgres/schema/date/units/cursor trade-offs | P8 | Review narration against ADRs and README | Video architecture segment |
| A90 video demo **all APIs** | Show POST, history, PR, comparison with real responses | P8 | Run demo checklist for all four paths | Video API demo |
| A91 video errors and edge cases | Show malformed/unsupported input, bulk rollback and no-data 200 | P8 | Rehearse representative edge/error calls | Video edge/error demo |
| A92 video walk `AI_WORKFLOW.md` | Explain actual tools, corrections, rejection and prompting | P8 | Cross-check spoken claims with file and evidence | Video AI workflow segment |
| A93 video explain one **AI-generated code** piece line-by-line | Choose genuine AI-generated code with traceable provenance, show review/fix and each line's role | P8 | Verify code provenance against actual output/diff; confirm finished accessible video contains line-by-line walkthrough | Video line-by-line code segment + `AI_WORKFLOW.md` refs |
| A94 video 10k concurrent coaches scaling answer | Discuss stateless replicas, DB pool/load, read replicas/caches/projections only as evidence-driven future options | P8 | Review no unmeasured throughput claim | Video scaling segment + README trade-offs |

### AI evaluation intent and repository delivery (source items 10–11)

| ID / assignment item (A) | Design decision (not assignment mandate) | Phase | Planned verification / test | Final deliverable evidence (planned) |
|---|---|---|---|---|
| A95 direct AI effectively (evaluation intent) | Provide bounded architecture/coding/testing/docs tasks with explicit constraints; use only genuine prompts | P0–P8 | Compare prompts, supplied context and resulting changes against goals | `AI_WORKFLOW.md` real task/prompt examples; git history |
| A96 identify wrong AI output (evaluation intent) | Review AI suggestions against assignment, contracts and tests; preserve genuine wrong-output evidence | P3–P8 | Trace original output → identified flaw → independently checked correction | `AI_WORKFLOW.md` genuine wrong/suboptimal case studies; `notes/ai-findings.md` |
| A97 debug AI-generated code (evaluation intent) | Diagnose with a reproducible test/failure, not unverified assertions; no invented debugging episode | P3–P8 | Reproduce failure, inspect cause, verify fix when actual AI code exists | `AI_WORKFLOW.md` real debugging evidence + test results |
| A98 understand AI-written code (evaluation intent) | Human review of control/data flow and invariants before acceptance | P3–P8 | Explain selected AI code against behavior, queries and tests in review | `AI_WORKFLOW.md` code review notes; Video code walkthrough |
| A99 explain AI-written code (evaluation intent) | Choose genuine AI-generated section and explain each line and trade-off | P8 | Check explanation against source and actual output | Video line-by-line segment; `AI_WORKFLOW.md` provenance |
| A100 extend AI-written code (evaluation intent) | Plan a justified incremental change to actual AI-assisted code; if none occurs, report the evaluation gap rather than invent extension history | P3–P8 | Review extension diff and run relevant regression/edge tests | Genuine git diff/history + `AI_WORKFLOW.md` explanation |
| A101 GitHub repository deliverable | Submit repository after genuine development; no publish/commit in this docs-only audit | P8–P9 | Verify accessible repo, required files, commit history and clean checkout | GitHub repository URL/history + P9 clean-clone result |
| A102 `AI_WORKFLOW.md` deliverable as a file | Produce final root document only once evidence exists; do not create it outside authorized scope now | P8–P9 | Confirm file exists in delivered repo and aligns with real evidence | Root `AI_WORKFLOW.md` in submitted repo |

**Source comparison gate:** Compared every supplied assignment source item **1–12** with the matrix: **102 mapped rows**, of which **99 are required audit/evaluation/deliverable trace rows**, **2 are recommendations** (A30 UTC, A63 AI use), and **1 is an optional bonus** (A80 diagram). No supplied source item remains unmapped. Repeated evaluation rows intentionally assess the same features under different rubric criteria; they are not new feature mandates. Correction from the prior audit: it omitted explicit source-item-10 AI evaluation intent and GitHub repository delivery, and its “93 required” label incorrectly included recommendations. This gate closes *source-to-plan mapping only*, not P0's open contract decisions, completed implementation, testing, published repository, AI case-study evidence, or video. The AI wrong-output and rejection quotas cannot be claimed satisfied until real cases exist; do not synthesize them. Root `README.md` and `AI_WORKFLOW.md` are future P8 deliverables, not files to write under this docs-only authorization.

