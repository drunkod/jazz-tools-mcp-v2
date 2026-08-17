# Task 04 — Realtime and agent workflows

Priority: P1 acceptance / P2 observability
Dependency: Task 00
Status: two-writer and provenance UI complete; MCP runbook ready; manual MCP transport acceptance pending

## Goal

Prove that another Jazz client/agent can write while Inspector is open and the grid reacts without polling or refresh.

## Subtasks

### T04.1 Two-writer acceptance
- [x] Inspector acts as writer A/subscriber.
- [x] Independent backend-scoped writer B.
- [x] B inserts; A observes without refresh.
- [x] B updates; A observes changed cell.
- [x] B deletes; A observes removal.
- [x] Keep test required in CI.

Evidence: `packages/inspector/tests/browser/standalone-inspector.spec.ts` performs insert/update/delete through an independent backend context while the table stays open. `.github/workflows/ci.yml` runs `pnpm test:browser` as a non-optional step in the pull-request-triggered `inspector` job with no skip or `continue-on-error`, so a two-writer failure fails that CI job. Whether the GitHub job is enforced by branch protection remains a repository setting outside this tree. The same browser fixture now opens a deployed runtime table named `reports/ready ?#%` to cover route-significant table names end to end.

### T04.2 Visual feedback
- [x] Row-added animation.
- [x] Row-removed animation.
- [x] Changed-cell animation.
- [x] Do not replay animation after filter/sort/page scope reset.
- [x] Respect reduced-motion preference.

### T04.3 Provenance
- [x] `$createdAt`/`$updatedAt` available by default.
- [x] `$createdBy`/`$updatedBy` available through customization.
- [x] Two-writer browser test proves writer B changes both the visible value and rendered `$updatedAt`.
- [x] Add compact writer-details affordance for exact raw writer IDs.
- [x] Never call a writer an agent without metadata proving it.

Jazz provenance is displayed as recorded. Visible `$createdBy`/`$updatedBy` cells provide a compact copy action for the exact raw writer ID. A raw principal/writer ID is not semantic proof that a human, service, or agent owns that identity; see [`../subtasks/ST-005-realtime-provenance.md`](../subtasks/ST-005-realtime-provenance.md).

Animation scope includes the table, compiled query, and visible-column set, so a filter/sort/page/column scope change establishes a new baseline rather than replaying live-change animation. Component coverage verifies the sort reset, and `prefers-reduced-motion: reduce` disables row, cell, and skeleton animation.

### T04.4 MCP demo
- [x] Exact server startup.
- [x] Exact Inspector startup.
- [x] Exact connector startup and registered tool names.
- [x] Insert/update/delete mutation sequence.
- [x] Use `jazz_insert`'s returned `row.id` and reverse-flow `jazz_query`'s returned `rows[0].id`; never hard-code row IDs.
- [ ] Confirm forward and reverse MCP transport flow without refresh (runbook is complete; executable transport evidence is pending).

Canonical runbook: [`../snippets/mcp-realtime-demo.md`](../snippets/mcp-realtime-demo.md). It documents exact inputs and return shapes for `jazz_status`, `jazz_list_tables`, `jazz_insert`, `jazz_update`, `jazz_delete`, `jazz_query`, and `jazz_get_row`. The two-writer browser gate proves the Jazz client path; a checked-in MCP transport test or recorded manual run is still required before marking the final MCP checkbox.

## Acceptance

```text
agent/client -> Jazz -> Inspector
Inspector -> Jazz -> agent/client
```

Automated acceptance covers an independent Jazz client/backend writer flowing into Inspector with insert/update/delete and provenance change, without refresh. The canonical MCP runbook covers the named root connector in both directions, but its manual/transport execution is intentionally not claimed as completed. Animation scope reset, reduced motion, and exact writer-ID inspection/copy are implemented and covered by component or browser evidence.
