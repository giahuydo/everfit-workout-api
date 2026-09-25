# AI Workflow and Evidence Status

This document is deliberately evidence-bounded. It uses repository Git history, current source, the public design documents, and `notes/ai-findings.md`. The latter is an internal template with no populated findings. It must not be treated as proof that an AI interaction, correction, or rejection occurred.

## What is traceable

The Git history records a documentation/design commit followed by bootstrap, schema/unit, workout-history, and PR/range-comparison commits on 2026-09-25. The source and documents make the resulting implementation/design decisions reviewable. They do **not** identify an AI tool, prompt, model, generated output, human correction, test diagnosis, or rejected suggestion.

| Assignment area | Traceable tool/purpose evidence | Status |
| --- | --- | --- |
| Architecture | Git commit `8a542b3` added architecture, API, schema, ADR, and planning documents. | Documents are traceable; AI assistance is not. |
| Coding | Commits `71aec40`, `bf6b979`, `9abb739`, and `f40e4c3` show scoped implementation changes. | Code is traceable; AI assistance is not. |
| Testing | `package.json` defines Vitest commands; `notes/experiments.md` contains only empty/planned experiment templates. | No completed test or AI-testing evidence recorded. |
| Debugging | Current code and history show no issue/failure → diagnosis → verified fix record. | No AI-debugging evidence recorded. |
| Documentation | The root README and this file are documented from current source/design records. | Current documentation work is reviewable in Git; prior AI assistance is not. |

## Prompting and review strategy

The traceable project process is phase-oriented: design documents first, then bootstrap, schema/units, workout/history, and PR comparison commits. For future AI-assisted work, a defensible prompt should name the target files, exact API/data invariants, and acceptance checks; reviewers should then compare output against source contracts, run relevant tests, and record the prompt, output, correction, and verification in `notes/ai-findings.md`.

This is a recommended process, not a claim about unpublished prompts or system instructions. No prompt transcript is available, so no model, hidden instruction, or chronology is reconstructed here.

## Required AI case studies: pending evidence

The assignment asks for at least two genuine wrong/suboptimal AI outputs with human corrections and one genuine rejected AI suggestion. The repository has **zero populated findings** in `notes/ai-findings.md` and no equivalent traceable record in Git or the documents. Consequently, none of those three stories can truthfully be supplied.

| Required evidence | Current result | What would close it |
| --- | --- | --- |
| Wrong/suboptimal AI output #1 + correction | Pending — no genuine output is recorded. | Preserve the output, identify the concrete defect, make the human correction, and link a test/review/commit. |
| Wrong/suboptimal AI output #2 + correction | Pending — no genuine output is recorded. | Same evidence chain, distinct from case #1. |
| Rejected AI suggestion + reason | Pending — no genuine rejected suggestion is recorded. | Preserve the suggestion and the evidence-based reason it was rejected. |

No “weak AI stories” were invented to fill these gaps. In particular, the planned cautions in the ADRs (such as avoiding floating-point PR comparisons or avoiding unmeasured `pg_trgm`) are design decisions, not proof that an AI proposed the opposite.

## Evidence links

- [AI findings log — currently an empty template](notes/ai-findings.md)
- [Experiment log — planned work only](notes/experiments.md)
- [Implementation plan](docs/implementation-plan.md)
- [Architecture](docs/architecture.md)
- [API design](docs/api-design.md)
- [Database design](docs/database-design.md)

The README contains a 15–20 minute English walkthrough outline. It is a checklist only; no video recording is claimed to exist.
