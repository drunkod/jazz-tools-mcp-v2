# Task 02 — Admin mutation safety

Priority: P1
Dependency: Task 00
Status: complete

## Goal

Make destructive operations deliberate while preserving staged Save/Discard semantics.

## Subtasks

### T02.1 Bulk delete confirmation
- [x] Separate request-delete from queue-delete.
- [x] One persisted row may queue directly.
- [x] Two or more persisted rows require explicit confirmation.
- [x] Confirmation shows persisted row count.
- [x] Cancel changes no staged state.
- [x] Confirm queues only; Save performs persistence.
- [x] Discard restores queued deletions.
- [x] Removing unsaved staged inserts does not show persisted-row warning.

### T02.2 Required-field validation
- [x] Validate all staged inserts before mutation promises start.
- [x] Report exact row/column/type errors.
- [x] Keep invalid rows editable.
- [x] Prevent partial batch persistence after local validation failure.

### T02.3 Mutation failure behavior
- [x] Preserve queued edits after failed persistence.
- [x] Identify failed operation where possible.
- [x] Add retry path.
- [x] Test update, insert, and delete failures.

### T02.4 Copy actions
- [x] Copy row ID.
- [x] Copy cell value.
- [x] Copy row as JSON.
- [x] Keyboard-accessible actions.
- [x] Never copy hidden credentials implicitly.

## Acceptance

Operators understand what will persist before Save, and bulk destructive actions require intent. Save validates the full batch before the first mutation, processes operations deterministically, retires each successful operation from staged state, stops safely on failure, and blocks further mutation controls while pending so Retry cannot replay a completed operation.
