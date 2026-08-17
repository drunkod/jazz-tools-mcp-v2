# Task 06 — Upstream sync and fork maintenance

Priority: P2 ongoing
Status: initial immutable baseline and repeatable sync discipline recorded
Baseline/checklist: [`../upstream-sync-baseline.md`](../upstream-sync-baseline.md)

## Goal

Keep the product shell maintainable as the official Jazz Inspector evolves.

## Subtasks

### T06.1 Record baseline
- [x] Record official Jazz source commit: `fa7d33b3ecfc9fcb673cd7c7bb9c35d700255e1d`.
- [x] Record published `jazz-tools@2.0.0-alpha.53` separately from the source commit.
- [x] Record local import/baseline commits and evidence location.
- [x] Preserve and review Jazz attribution/license requirements.

Every future sync must add old/target immutable coordinates and must not use only a moving branch, npm `alpha` dist-tag, or date as its baseline.

### T06.2 Localize product delta
Prefer product changes in layout, Data Explorer shell/styles, tests, security/runbook documentation, and small compatibility utilities with tests/removal conditions. Avoid unnecessary divergence in generic query builder, row parser, schema-fetch internals, and Jazz runtime/worker internals. Classify each sync delta as upstream adoption, intentional product delta, compatibility shim, or deferred conflict.

### T06.3 Upgrade checklist
- [x] Define immutable-input, comparison, reconciliation, validation, and close-out phases.
- [ ] Compare the upstream Inspector tree for the next target commit.
- [ ] Review `TableDataGrid` query/realtime/provenance/CRUD behavior changes for the next target.
- [ ] Review Vite/WASM/worker/embedded-host changes for the next target.
- [ ] Review Inspector/MCP docs and the production security contract for the next target.
- [ ] Run root and Inspector unit/build/browser suites for the next sync.
- [ ] Re-evaluate and remove/retain every compatibility shim for the next sync.

The per-sync boxes remain intentionally unchecked until a future target is selected and validated; the concrete commands and review surfaces are in the baseline document.

### T06.4 WhoDB reference discipline
- [x] Define behavior-level reference, immutable source/license review, and attribution requirements.
- [x] Require reimplementation with Jazz runtime primitives.
- [x] Require Jazz-specific acceptance tests for each borrowed interaction.
- [x] Prohibit SQL/GraphQL/backend assumptions and adapters.

WhoDB is an interaction-design/test-organization reference only. Any future code borrowing requires a separate source commit, license review, and attribution record before implementation.

## Acceptance

Future Jazz upgrades are handled as an immutable upstream delta plus a classified, clearly isolated product delta. Acceptance is procedural and ongoing: update the baseline only after each target is reconciled, attributed, and validated.
