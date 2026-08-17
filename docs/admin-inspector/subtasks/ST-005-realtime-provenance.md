# ST-005 — Realtime provenance details

Parent: Task 04
Priority: P2
Status: complete

## Goal

Make cross-client changes explainable without inventing agent identity.

## Checklist

- [x] preserve `$createdAt`/`$updatedAt` default columns and optional `$createdBy`/`$updatedBy` access;
- [x] add compact writer details affordance where IDs are meaningful;
- [x] render exact Jazz provenance values rather than inferred labels;
- [x] label a writer as an agent only when application metadata proves that mapping;
- [x] keep raw writer IDs copyable in a dedicated writer-details affordance;
- [x] test a realtime writer-B update changes both the visible boolean value and rendered `$updatedAt` supplied by Jazz.

Evidence: `packages/inspector/tests/browser/standalone-inspector.spec.ts` captures the open row's rendered `$updatedAt`, performs writer B's globally durable update, and requires both `done=true` and a different ISO timestamp without browser refresh. `TableDataGrid` renders visible `$createdBy`/`$updatedBy` values as compact buttons that show and copy the exact Jazz writer ID. Tests prove the copy path, and the UI intentionally does not infer a human, service, or agent label.

## Acceptance

Accepted: the UI and required browser test show when an external update occurred, and visible writer provenance can be inspected/copied compactly as an exact raw ID. A Jazz writer/principal value remains a raw recorded identity unless application-owned metadata proves a human/service/agent mapping.
