# Task 02 — Admin mutation safety

Priority: P1
Dependency: Task 00

## Goal

Make destructive operations deliberate while preserving staged Save/Discard semantics.

## Subtasks

### T02.1 Bulk delete confirmation
- [ ] Separate request-delete from queue-delete.
- [ ] One persisted row may queue directly.
- [ ] Two or more persisted rows require explicit confirmation.
- [ ] Confirmation shows persisted row count.
- [ ] Cancel changes no staged state.
- [ ] Confirm queues only; Save performs persistence.
- [ ] Discard restores queued deletions.
- [ ] Removing unsaved staged inserts does not show persisted-row warning.

### T02.2 Required-field validation
- [ ] Validate all staged inserts before mutation promises start.
- [ ] Report exact row/column/type errors.
- [ ] Keep invalid rows editable.
- [ ] Prevent partial batch persistence after local validation failure.

### T02.3 Mutation failure behavior
- [ ] Preserve queued edits after failed persistence.
- [ ] Identify failed operation where possible.
- [ ] Add retry path.
- [ ] Test update, insert, and delete failures.

### T02.4 Copy actions
- [ ] Copy row ID.
- [ ] Copy cell value.
- [ ] Copy row as JSON.
- [ ] Keyboard-accessible actions.
- [ ] Never copy hidden credentials implicitly.

## Acceptance

Operators understand what will persist before Save, and bulk destructive actions require intent.
