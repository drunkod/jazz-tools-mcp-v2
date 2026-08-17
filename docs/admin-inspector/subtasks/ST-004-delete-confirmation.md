# ST-004 — Confirm bulk persisted-row deletion

Parent: Task 02
Priority: P1
Status: proposed

## Behavior

The existing delete action queues changes; persistence happens later through Save. Keep that model.

Rules:

1. deleting only unsaved staged inserts removes them immediately from staged UI state;
2. queueing one persisted row can remain a direct action;
3. queueing two or more persisted rows opens a confirmation dialog;
4. Cancel does not mutate queued delete state;
5. Confirm adds IDs to `queuedDeletes` only;
6. Save performs `db.delete()` and durability waits;
7. Discard clears queued deletion state.

## Accessibility

- dialog has an accessible name;
- initial focus lands on Cancel or a safe control;
- Escape cancels;
- destructive button includes row count;
- keyboard flow is fully tested.

## Tests

- [ ] 1 persisted row queues without dialog;
- [ ] 2 persisted rows require confirmation;
- [ ] cancel is no-op;
- [ ] confirm queues exact IDs;
- [ ] mixed staged + persisted selection removes staged rows but counts only persisted rows for warning;
- [ ] Save is still required for persistence.
