# Task 01 — Runtime/API compatibility

Priority: P1
Dependency: Task 00

## Goal

Keep the extracted Inspector compatible with the pinned published Jazz alpha while making future upstream upgrades local and explicit.

## Subtasks

### T01.1 Query result adapter
- [ ] Normalize legacy `T[]`, legacy `undefined`, and current `{data,isLoading,error}`.
- [ ] Do not treat empty data as loading.
- [ ] Preserve query error state.
- [ ] Unit-test impossible primitive shapes.

### T01.2 Centralize version-specific assumptions
- [ ] Search for casts against Jazz hook return values.
- [ ] Move compatibility logic into utilities.
- [ ] Add comments naming the package/version reason.
- [ ] Define the condition for deleting each shim.

### T01.3 Query error UI
- [ ] Expose structured query error without clearing useful cached rows unnecessarily.
- [ ] Add accessible error region near the grid.
- [ ] Cover initial failure and post-data failure.

### T01.4 Propagation/durability
- [ ] Standalone reads remain `full`.
- [ ] Embedded reads remain `local-only`.
- [ ] Standalone writes retain required edge/server durability.
- [ ] Embedded writes remain valid for local development.

## Acceptance

A Jazz upgrade changes a small compatibility surface rather than multiple UI components.
