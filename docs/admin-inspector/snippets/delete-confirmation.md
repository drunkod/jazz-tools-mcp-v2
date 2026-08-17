# Full snippet — staged bulk-delete confirmation

Keep confirmation separate from persistence.

```tsx
interface PendingDeleteConfirmation {
  rowIds: string[];
}

const [pendingDeleteConfirmation, setPendingDeleteConfirmation] =
  useState<PendingDeleteConfirmation | null>(null);

function queuePersistedDeletes(rowIds: string[]) {
  setQueuedDeletes((current) => {
    const next = new Set(current);
    for (const rowId of rowIds) next.add(rowId);
    return next;
  });
}

function requestSelectedDeletes() {
  if (selectedVisibleRowIds.size === 0) return;

  setQueuedSaveError(null);

  const selectedStagedIds = stagedInserts
    .filter((insert) => selectedVisibleRowIds.has(insert.id))
    .map((insert) => insert.id);

  if (selectedStagedIds.length > 0) {
    const stagedIdSet = new Set(selectedStagedIds);
    setStagedInserts((current) => current.filter((insert) => !stagedIdSet.has(insert.id)));
  }

  const persistedIds = visibleRows
    .map(getGridRowId)
    .filter((rowId) => selectedVisibleRowIds.has(rowId));

  setSelectedRowIds(new Set());

  if (persistedIds.length === 0) return;
  if (persistedIds.length === 1) {
    queuePersistedDeletes(persistedIds);
    return;
  }

  setPendingDeleteConfirmation({ rowIds: persistedIds });
}
```

Dialog:

```tsx
{pendingDeleteConfirmation ? (
  <div role="dialog" aria-modal="true" aria-labelledby="bulk-delete-title">
    <h2 id="bulk-delete-title">Queue {pendingDeleteConfirmation.rowIds.length} rows for deletion?</h2>
    <p>The rows are not deleted until you press Save changes.</p>
    <button type="button" onClick={() => setPendingDeleteConfirmation(null)} autoFocus>
      Cancel
    </button>
    <button
      type="button"
      onClick={() => {
        queuePersistedDeletes(pendingDeleteConfirmation.rowIds);
        setPendingDeleteConfirmation(null);
      }}
    >
      Queue {pendingDeleteConfirmation.rowIds.length} deletions
    </button>
  </div>
) : null}
```

Persistence remains in the existing Save handler:

```ts
for (const rowId of queuedDeletes) {
  await db.delete(tableProxy, rowId).wait({ durability: mutationDurabilityTier });
}
```
