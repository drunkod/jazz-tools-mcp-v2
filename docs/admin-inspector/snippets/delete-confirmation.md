# Full snippet — staged bulk-delete confirmation

Keep request, confirmation, queueing, and persistence as separate phases. Cancel must not remove staged rows or alter queued deletes.

```tsx
interface DeleteRequest {
  stagedInsertIds: string[];
  persistedRowIds: string[];
}

const [pendingDeleteRequest, setPendingDeleteRequest] =
  useState<DeleteRequest | null>(null);

function applyDeleteRequest(request: DeleteRequest) {
  if (request.stagedInsertIds.length > 0) {
    const stagedIds = new Set(request.stagedInsertIds);
    setStagedInserts((current) =>
      current.filter((insert) => !stagedIds.has(insert.id)),
    );
  }

  if (request.persistedRowIds.length > 0) {
    setQueuedDeletes((current) => {
      const next = new Set(current);
      for (const rowId of request.persistedRowIds) next.add(rowId);
      return next;
    });
  }

  setSelectedRowIds(new Set());
}

function requestSelectedDeletes() {
  if (selectedVisibleRowIds.size === 0) return;

  const request: DeleteRequest = {
    stagedInsertIds: stagedInserts
      .filter((insert) => selectedVisibleRowIds.has(insert.id))
      .map((insert) => insert.id),
    persistedRowIds: visibleRows
      .map(getGridRowId)
      .filter((rowId) => selectedVisibleRowIds.has(rowId)),
  };

  if (request.persistedRowIds.length >= 2) {
    setPendingDeleteRequest(request);
    return;
  }

  applyDeleteRequest(request);
}
```

The accessible native dialog focuses the safe action, handles Escape through `onCancel`, and reports only persisted rows in the destructive count:

```tsx
<dialog
  ref={dialogRef}
  aria-labelledby="delete-confirmation-title"
  aria-describedby="delete-confirmation-description"
  onCancel={(event) => {
    event.preventDefault();
    onCancel();
  }}
  onClose={onCancel}
>
  <h2 id="delete-confirmation-title">Queue persisted-row deletion?</h2>
  <p id="delete-confirmation-description">
    {request.persistedRowIds.length} persisted rows will be queued for deletion.
    Save changes is still required to persist this operation.
  </p>
  <button ref={cancelButtonRef} type="button" onClick={onCancel}>
    Cancel
  </button>
  <button type="button" onClick={onConfirm}>
    Queue deletion of {request.persistedRowIds.length} rows
  </button>
</dialog>
```

Confirmation only applies the request and closes the dialog:

```tsx
<DeleteConfirmationDialog
  request={pendingDeleteRequest}
  onCancel={() => setPendingDeleteRequest(null)}
  onConfirm={() => {
    if (pendingDeleteRequest) applyDeleteRequest(pendingDeleteRequest);
    setPendingDeleteRequest(null);
  }}
/>
```

Persistence remains in the existing Save handler and uses the runtime-specific Jazz durability tier:

```ts
await Promise.all(
  [...queuedDeletes].map((rowId) =>
    db.delete(tableProxy, rowId).wait({ tier: mutationDurabilityTier }),
  ),
);
```
