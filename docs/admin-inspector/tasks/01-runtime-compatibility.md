# Task 01 — Runtime/API compatibility

Priority: P1
Dependency: Task 00
Status: complete

## Goal

Keep the extracted Inspector compatible with the pinned published Jazz alpha while making future upstream upgrades local and explicit.

## Subtasks

### T01.1 Query result adapter
- [x] Normalize legacy `T[]`, legacy `undefined`, and current `{data,isLoading,error}`.
- [x] Do not treat empty data as loading.
- [x] Preserve query error state.
- [x] Unit-test impossible primitive shapes.

### T01.2 Centralize version-specific assumptions
- [x] Search for casts against Jazz hook return values.
- [x] Move compatibility logic into utilities.
- [x] Add comments naming the package/version reason.
- [x] Define the condition for deleting each shim.

### T01.3 Query error UI
- [x] Expose structured query error without clearing useful cached rows unnecessarily.
- [x] Add accessible error region near the grid.
- [x] Cover initial failure and post-data failure.

### T01.4 Propagation/durability
- [x] Standalone reads remain `full`.
- [x] Embedded reads remain `local-only`.
- [x] Standalone writes retain required edge/server durability.
- [x] Embedded writes remain valid for local development.

## Acceptance

A Jazz upgrade changes a small compatibility surface rather than multiple UI components.
