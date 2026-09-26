# Supporting Notes and Evidence

`notes/` is deliberately separate from reviewer-facing system documentation. It preserves measurements, internal review history, and historical planning without making those artifacts look like the current product contract.

## Evidence

| Path | Purpose |
| --- | --- |
| [`experiments.md`](experiments.md) | measured query-plan experiment, decisions, and explicit limitations |
| [`evidence/`](evidence/) | raw 50k seed/`EXPLAIN` output plus checksums |

## Review and reconciliation

| File | Purpose |
| --- | --- |
| [`ai-findings.md`](ai-findings.md) | provenance/reconciliation ledger behind the concise `AI_WORKFLOW.md` cases |
| [`improvements-log.md`](improvements-log.md) | applied, verified, proposed, and rejected engineering improvements |

## Historical planning

[`history/`](history/) contains the original phased implementation plan and A01–A102 traceability matrix. Those files intentionally preserve pre-implementation wording and are not current status.

For the current narrative, start with the root [`README.md`](../README.md) and [`docs/README.md`](../docs/README.md).
