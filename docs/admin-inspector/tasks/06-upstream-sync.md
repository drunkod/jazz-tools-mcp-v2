# Task 06 — Upstream sync and fork maintenance

Priority: P2 ongoing

## Goal

Keep the product shell maintainable as the official Jazz Inspector evolves.

## Subtasks

### T06.1 Record baseline
- [ ] Record Jazz source commit for each sync.
- [ ] Record published `jazz-tools` version separately.
- [ ] Preserve license/attribution.

### T06.2 Localize product delta
Prefer product changes in layout, Data Explorer shell/styles, tests, and small compatibility utilities. Avoid unnecessary divergence in generic query builder, row parser, schema-fetch internals, and Jazz runtime/worker internals.

### T06.3 Upgrade checklist
- [ ] Compare upstream Inspector tree.
- [ ] Review `TableDataGrid` behavior changes.
- [ ] Review Vite/worker config changes.
- [ ] Review Inspector docs/security contract.
- [ ] Run unit/build/browser suites.
- [ ] Re-evaluate every compatibility shim.

### T06.4 WhoDB reference discipline
- [ ] Identify UX behavior being borrowed.
- [ ] Reimplement with Jazz runtime primitives.
- [ ] Add Jazz-specific acceptance test.
- [ ] Do not copy SQL/GraphQL backend assumptions.

## Acceptance

Future Jazz upgrades are a small upstream delta plus a clearly isolated product delta.
