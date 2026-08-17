# Architecture and invariants

## Runtime discovery

The admin UI must not depend on compile-time app models. It discovers tables and columns from the stored runtime `WasmSchema` and constructs generic queries/mutations from runtime names.

```text
serverUrl + appId + adminSecret + env + branch
  -> schema hashes
  -> stored WasmSchema
  -> Object.keys(schema)
  -> generic table navigator
```

**Invariant A1:** a newly published table can be inspected without shipping table-specific UI code.

## Query path

```ts
const query = new GenericQueryBuilder(table, schema)
  .where(where)
  .orderBy(orderBy)
  .limit(pageSize + 1)
  .offset(pageIndex * pageSize);

const queryResult = useAll(query, queryOptions);
```

Normal table reads stay reactive. Do not add polling, raw SQL, direct SQLite editing, or a replacement REST CRUD layer.

## Mutation path

```text
cell edit / staged insert / queued delete
  -> queued changes
  -> Save changes
  -> Db.update / Db.insert / Db.delete
  -> durability wait
```

A destructive confirmation may decide whether to queue a deletion, but must not bypass staged Save/Discard semantics.

## Standalone vs embedded

Standalone connects to a reachable sync server and can use full propagation/server durability. Embedded overlay may intentionally inspect local unsynced state and must remain independently buildable.

## Credential boundary

`adminSecret` is privileged backend/admin access. For an internet-facing production product use:

```text
browser operator session
  -> trusted BFF / server authorization
  -> backend-scoped Jazz client
```

The browser must not receive the raw production admin secret.

## Routing invariant

Runtime table names are data, not route syntax:

```ts
`/data-explorer/${encodeURIComponent(tableName)}/data`
`/data-explorer/${encodeURIComponent(tableName)}/schema`
```

Relation IDs belong in `URLSearchParams`.

## Status semantics

Only claim observable facts. `Reactive table data` is valid; `LIVE`, `Connected`, or `Last synced` require a real Jazz signal rather than configuration presence.

## Compatibility invariant

Published alpha and current upstream API differences must be isolated in small utilities with tests and an explicit removal condition. Do not scatter casts through components.
