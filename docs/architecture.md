# MVP architecture

## Goal

Expose a small, auditable MCP surface over the official `jazz-tools@alpha server` without bypassing Jazz's query, mutation, schema, or sync machinery.

The current MVP is deliberately a **privileged operator/backend connector**. It does not claim to preserve an end-user's row-level permission scope because it authenticates with server admin/backend credentials.

## Data path

```text
MCP host
  |
  | stdio / MCP
  v
jazz-tools-mcp-v2
  |
  |-- GET /health
  |
  |-- GET /apps/<app-id>/schemas
  |-- GET /apps/<app-id>/schema/<hash>
  |       X-Jazz-Admin-Secret
  |
  `-- createJazzContext(...)
          |
          | NAPI runtime (in-memory local replica)
          |
          `-- Jazz WebSocket transport
                /apps/<app-id>/ws
                admin_secret or backend_secret
                        |
                        v
                 jazz-tools@alpha server
```

## Why this is not a REST connector

The official server router exposes health, schema catalogue/admin routes, and the app WebSocket endpoint. General data CRUD is carried by the Jazz sync protocol. The MCP therefore embeds the official TypeScript backend runtime and lets Jazz construct/translate queries and mutations.

## Schema discovery

The connector fetches published server schema metadata with `fetchSchemaHashes()` and `fetchStoredWasmSchema()` from `jazz-tools`. The latter returns a raw `WasmSchema`, which current `createJazzContext` accepts as a schema source when obtaining a DB handle.

This avoids brittle filesystem scanning and avoids requiring the MCP process to compile/import a user's TypeScript schema module.

## Dynamic reads

The official Inspector already needs to query tables whose TypeScript types are unknown at Inspector compile time. Its `GenericQueryBuilder` implements the public `QueryBuilder` contract using:

- `_table`
- `_schema`
- `_build()` returning Jazz query JSON

The MVP adapts that approach for `jazz_query`.

Before executing a query, the connector validates:

- table existence
- queryable column names
- Jazz magic-column names
- where operators against Jazz's public per-column operator metadata
- maximum MCP query limit

Where predicates remain Jazz-native AND-combined conditions. The connector does not invent OR or SQL semantics.

### Magic columns

The fetched `WasmSchema` only contains structural user columns. Jazz also provides query-time system columns:

- `$canRead`, `$canEdit`, `$canDelete`
- `$createdBy`, `$createdAt`, `$updatedBy`, `$updatedAt`

The connector accepts these for querying/selecting but keeps them outside the writable-column set.

## Dynamic writes

The public `TableProxy<T, Init>` contract only requires:

- `_table`
- `_schema`
- `_rowType` phantom type
- `_initType` phantom type

The MCP constructs a dynamic proxy for a known table in the fetched schema, then calls normal `Db.insert`, `Db.update`, and `Db.delete`. Jazz itself performs value conversion, local-first mutation handling, sync, and durability waiting.

Mutation fields are restricted to structural schema columns. `id` and `$...` magic columns are rejected from the `values` object.

## Auth choice

The official Rust WebSocket authentication order at the reviewed alpha revision is:

1. valid `admin_secret` -> backend
2. valid `backend_secret` with no user session -> backend
3. otherwise resolve a user session

For strict compatibility with the official self-host snippet, admin-secret-only mode uses the context's admin-authenticated transport.

If `JAZZ_BACKEND_SECRET` is supplied, the MCP uses `context.asBackend(schema)`, or `context.withAttribution(principal, schema)` when `JAZZ_MCP_PRINCIPAL` is set.

The Jazz v2 prose docs prefer the explicit backend-secret / `asBackend()` pattern for server-connected server-owned work. Admin-only mode is retained as an implementation-supported compatibility path for the exact self-host command.

## Permission / RLS boundary

Admin/backend authentication is privileged. It must not be confused with a session-scoped client:

- reads are not a proof of what a specific user may read
- writes are not evaluated as a specific user
- `withAttribution` changes authorship metadata but preserves backend-level permission authority

A future user-scoped connector mode should construct JWT/session-scoped handles and let Jazz apply the application's row-level policies per query/mutation.

## Safety boundary

The MVP is intentionally conservative:

- stdio only
- privileged scope reported by `jazz_status`
- writes disabled unless explicitly enabled
- query limit capped at 200
- table/query/writable columns validated separately
- where operators validated by Jazz column type
- no SQL
- no arbitrary URLs
- no local source-tree scanning
- no schema writes
- no permissions writes
- no migration writes

Schema and policy deployment remain the responsibility of the official Jazz CLI.

## Schema lifecycle

A `JazzContext` cannot be re-used with a different schema after initialization. `jazz_reload_schema` therefore shuts down the current context and builds a new one from the configured/newest published schema.

Jazz can keep multiple schema hashes connected by migrations; by default this connector picks the newest published schema as its local runtime view. `JAZZ_SCHEMA_HASH` can pin a specific published view when deterministic version selection is required.

## Verification path

CI uses Jazz's official `startLocalJazzServer` and `deploy` testing utilities, then connects this adapter through the same schema catalogue + NAPI + WebSocket path used in production. This makes the critical admin-only compatibility assertion executable instead of relying only on source inspection.
