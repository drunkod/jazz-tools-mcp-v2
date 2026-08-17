# Task 04 — Realtime and agent workflows

Priority: P1 acceptance / P2 observability
Dependency: Task 00

## Goal

Prove that another Jazz client/agent can write while Inspector is open and the grid reacts without polling or refresh.

## Subtasks

### T04.1 Two-writer acceptance
- [x] Inspector acts as writer A/subscriber.
- [x] Independent backend-scoped writer B.
- [x] B inserts; A observes without refresh.
- [x] B updates; A observes changed cell.
- [x] B deletes; A observes removal.
- [ ] Keep test required in CI.

### T04.2 Visual feedback
- [x] Row-added animation.
- [x] Row-removed animation.
- [x] Changed-cell animation.
- [ ] Do not replay animation after filter/sort/page scope reset.
- [ ] Respect reduced-motion preference.

### T04.3 Provenance
- [x] `$createdAt`/`$updatedAt` available by default.
- [x] `$createdBy`/`$updatedBy` available through customization.
- [ ] Add compact writer-details affordance when useful.
- [ ] Never call a writer an agent without metadata proving it.

### T04.4 MCP demo
- [ ] Exact server startup.
- [ ] Exact Inspector startup.
- [ ] Insert/update/delete mutation sequence.
- [ ] Use returned IDs rather than hard-coded IDs.
- [ ] Confirm forward and reverse flow without refresh.

## Acceptance

```text
agent/client -> Jazz -> Inspector
Inspector -> Jazz -> agent/client
```
