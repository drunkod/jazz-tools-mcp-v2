# Research: official `jazz-tools@alpha server`

Research date: 2026-08-16

Primary source: `garden-co/jazz`, with the user-provided reference commit:

`fa7d33b3ecfc9fcb673cd7c7bb9c35d700255e1d`

Cross-check source: the supplied Jazz v2 documentation snapshot, including server setup, TypeScript server setup, auth/permissions, testing, queries, durability, and the built-in MCP reference.

At research time the official `packages/jazz-tools/package.json` on `main` and at that commit reports:

```text
jazz-tools 2.0.0-alpha.53
```

## 1. The documented self-host command is real and current

Official example:

`examples/docs/todo-server-rs/docs/self-host-cli.sh`

```bash
export JAZZ_APP_ID="replace-with-your-app-id"
export JAZZ_ADMIN_SECRET="replace-with-admin-secret"

npx jazz-tools@alpha server "$JAZZ_APP_ID" \
  --port 1625 \
  --data-dir ./data \
  --admin-secret "$JAZZ_ADMIN_SECRET"
```

The docs page `docs/content/docs/getting-started/server-setup.mdx` documents the same command and the full current option set.

## 2. `npx jazz-tools@alpha server` runs the Rust server binary

`packages/jazz-tools/bin/jazz-tools.js` is the npm wrapper.

It handles TypeScript-side commands (`validate`, `deploy`, `migrations`, `permissions`, `schema`) in the TS CLI, and handles `mcp` in the existing documentation MCP server. Other commands, including `server`, are forwarded to the platform-specific bundled Rust `jazz-tools` binary.

This matters because a new MCP connector must model the behavior of the Rust server, not assume the npm wrapper itself contains a JavaScript database server.

## 3. Current server CLI contract

`crates/jazz-tools/src/main.rs` defines `jazz-tools server` with:

- positional app ID
- `--port`
- `--data-dir`
- `--in-memory`
- `--jwks-url`
- `--jwt-public-key`
- `--auth-cookie-name`
- `--allow-local-first-auth`
- `--backend-secret`
- `--admin-secret`
- `--upstream-url`
- `--shutdown-timeout-secs`

The current command builds a `ServerBuilder`, selects persistent or in-memory storage, binds an Axum listener, and supports controlled shutdown.

The prose docs distinguish secret roles:

- admin secret: catalogue/deploy/migrations access and edge upstream auth
- backend secret: backend/session impersonation and explicit server-owned backend access

## 4. Server routes

`crates/jazz-tools/src/server/routes/mod.rs` constructs the HTTP router.

Public health:

```text
GET /health
```

App-scoped routes:

```text
/apps/<app-id>/ws
/apps/<app-id>/schema/:hash
/apps/<app-id>/schemas
/apps/<app-id>/admin/schemas
/apps/<app-id>/admin/schema-connectivity
/apps/<app-id>/admin/permissions/head
/apps/<app-id>/admin/permissions
/apps/<app-id>/admin/migrations
/apps/<app-id>/admin/introspection/subscriptions
```

There is no generic REST `/rows` or SQL endpoint. Data reads/writes flow through Jazz's sync/runtime protocol.

## 5. WebSocket auth is the key compatibility fact

`crates/jazz-tools/src/server/routes/websocket.rs` documents and implements this handshake priority:

1. valid `admin_secret` -> backend connection
2. `backend_secret` with no user JWT/session -> backend connection
3. otherwise resolve a user session

Therefore the exact self-host example containing only `--admin-secret` is sufficient for an admin-authenticated Jazz WebSocket transport at the reviewed implementation revision.

This is why the MVP can match the command exactly.

### Documentation nuance

The high-level backend docs recommend `context.asBackend()` for server-connected server-owned work and associate that path with `backendSecret`. `context.db()` is described as the natural unscoped handle for embedded/local-only setups.

The connector therefore prefers backend-secret mode when configured, but retains admin-only compatibility for the exact self-host command. This is a privileged implementation-supported path, not a user-scoped permissions path.

## 6. Official TypeScript backend runtime

`packages/jazz-tools/src/backend/create-jazz-context.ts` creates a Node NAPI runtime and calls `JazzClient.connectWithRuntime(...)`.

When `serverUrl` is set it connects the Rust-owned transport with:

```ts
{
  backend_secret: config.backendSecret,
  admin_secret: config.adminSecret,
  jwt_token: config.jwtToken
}
```

The context exposes:

- `db(source?)`
- `asBackend(source?)`
- `withAttribution(principalId, source?)`
- `forRequest(...)`
- `forSession(...)`

`asBackend` and attribution/session helpers require the explicit backend-secret path for server-connected scoped access. For exact admin-only self-host compatibility, the MVP uses `context.db(rawSchema)`, whose underlying transport carries the admin secret.

If a backend secret is configured, the MVP uses `asBackend` or `withAttribution` instead.

## 7. `jazz-napi` must be explicit on Node

The supplied `docs/content/docs/install/typescript-server.mdx` says:

- `jazz-napi` is the native runtime for Jazz on Node.js
- `jazz-tools` detects it automatically at runtime
- it must still be installed/listed as an explicit dependency

The connector package therefore depends on both `jazz-tools@alpha` and `jazz-napi@alpha`.

## 8. Raw server schema can initialize Jazz

`packages/jazz-tools/src/schema-source.ts` defines:

```ts
SchemaSourceInput = WasmSchema | WasmSchemaSource | QuerySchemaSource
```

So a raw `WasmSchema` fetched from the server can be passed to `context.db(schema)` / `context.asBackend(schema)`.

This removes the need to execute arbitrary application source code inside the MCP process.

## 9. Official schema-fetch API

`packages/jazz-tools/src/runtime/schema-fetch.ts` exposes:

- `fetchSchemaHashes(serverUrl, { appId, adminSecret })`
- `fetchStoredWasmSchema(serverUrl, { appId, adminSecret, schemaHash })`
- permissions and publish helpers

These functions use the official app-scoped routes and `X-Jazz-Admin-Secret`.

The MCP uses only the read helpers in MVP.

## 10. Generic querying already exists in the official Inspector

The official Inspector's `packages/inspector/src/utility/generic-query-builder.ts` implements the public `QueryBuilder` interface dynamically from a table name and `WasmSchema`. It builds Jazz query JSON with conditions, select, order, limit, and offset.

The MCP adapts this pattern instead of generating SQL.

The supplied query docs further confirm:

- predicates are AND-combined
- query-level OR is not supported
- supported operators depend on column type
- order should be deterministic before pagination

The connector now validates requested operators with Jazz's public where-operator metadata.

## 11. Magic columns are queryable but not writable

The supplied query/permission docs define system-provided magic columns:

```text
$canRead
$canEdit
$canDelete
$createdBy
$createdAt
$updatedBy
$updatedAt
```

They are not stored in the structural schema. The connector therefore treats them as query-time fields only while rejecting them from mutation values. Row `id` is also not accepted as a mutation field.

## 12. Dynamic mutation is supported by the public runtime contracts

`packages/jazz-tools/src/runtime/db.ts` defines `TableProxy<T, Init>` as a small structural interface containing `_table`, `_schema`, and phantom row/init types.

Normal mutation methods accept this proxy:

```text
Db.insert(table, data)
Db.update(table, id, data)
Db.delete(table, id)
```

The MVP builds a dynamic table proxy only after validating the table and writable columns against the fetched server schema.

## 13. Existing official `jazz-tools mcp` is a different product

The npm wrapper routes `jazz-tools mcp` to the built-in documentation MCP.

The supplied MCP reference documents these tools:

- `search_docs`
- `get_doc`
- `list_pages`

The docs are matched to the installed `jazz-tools` version. This is useful for API lookup but does not connect agents to application data. This repository fills that separate data-connector use case.

## 14. Official testing utilities are the right integration harness

The supplied testing docs recommend `startLocalJazzServer` and `deploy` from `jazz-tools/testing` for server-connected tests.

The PR now contains an integration smoke test that uses those utilities and deliberately omits `backendSecret` from the connector configuration. It verifies admin-authenticated schema discovery plus Jazz-native insert/query/update/delete against the real installed alpha runtime.

## 15. Security conclusion

Because the connector uses admin/backend credentials, it is a privileged operator connector. It should not be described as enforcing end-user RLS.

A future user-scoped mode should use JWT/session-scoped handles (`forRequest` / `forSession` or equivalent) and preserve Jazz's per-query authorization semantics.

## MVP conclusion

The narrowest connector that matches the current alpha server is:

```text
schema catalogue GETs with admin secret
        +
createJazzContext with raw WasmSchema
        +
Jazz-native dynamic queries/mutations over /ws
        +
MCP stdio surface
```

Not:

```text
raw SQLite
REST CRUD invented by the MCP
old CoJSON 0.9 APIs
second WebSocket sync server
arbitrary SQL
```
