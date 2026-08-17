# Cross-check: attached Jazz v2 documentation

Review date: 2026-08-16

This review cross-checks the MCP data connector against the Jazz v2 documentation snapshot supplied with the PR review. The source snapshot includes the Jazz 2 overview, server setup, TypeScript server setup, auth/permissions, queries, testing, durability, migrations, and the built-in Jazz documentation MCP reference.

## 1. Jazz already ships an MCP server, but it is docs-only

`docs/content/docs/reference/mcp.mdx` documents the MCP bundled with `jazz-tools`.

Its purpose is to expose Jazz documentation matched to the installed `jazz-tools` version. Its tools are:

- `list_pages`
- `search_docs`
- `get_doc`

That MCP does **not** query or mutate an application's Jazz data. `jazz-tools-mcp-v2` therefore occupies a separate role: an operator/backend MCP bridge to application data on a running Jazz server.

To avoid ambiguity, documentation in this repository calls the built-in command the **Jazz docs MCP** and this project the **Jazz data MCP connector**.

## 2. Node runtime requirement and native dependency

The attached Jazz docs require Node.js 22.12+ for the built-in MCP path.

More importantly, `docs/content/docs/install/typescript-server.mdx` says that `jazz-napi` is the native Node runtime for Jazz and **must be listed as an explicit dependency**, even though `jazz-tools` detects it automatically.

Action taken in this PR:

```json
{
  "dependencies": {
    "jazz-tools": "alpha",
    "jazz-napi": "alpha"
  }
}
```

The package already requires Node `>=22.12`.

## 3. Self-hosted server secrets have different intended roles

The attached `server-setup.mdx` documents:

- `--admin-secret`: catalogue/deploy/migrations access and edge upstream sync
- `--backend-secret`: backend session impersonation / server-owned backend access

The backend identity guidance says that a server-connected TypeScript backend should normally use `context.asBackend()` (or a request/session-scoped handle) and that `context.db()` is the natural choice for embedded/local-only setups.

The connector therefore treats `JAZZ_BACKEND_SECRET` as the preferred production data-access credential when available.

### Why admin-secret-only compatibility remains

The exact self-host command supplied for this task only sets an admin secret. The Rust WebSocket implementation at the reviewed Jazz commit explicitly authenticates `admin_secret` as backend access before checking `backend_secret`. The official Jazz testing/migration documentation also demonstrates server-connected `createDb(...)` instances configured with `adminSecret`.

So admin-only mode is retained for compatibility with the documented self-host example, but it should be understood as an implementation-supported privileged path rather than the preferred backend identity pattern in the prose docs.

## 4. Security boundary: this is a privileged connector

Jazz permissions are row-level policies evaluated against user sessions. The attached permissions/auth docs emphasize that server-connected backend handles can bypass ordinary user-scoped permission checks.

This connector uses admin/backend credentials, so it is **not an end-user RLS proxy**. In practical terms:

- read tools may see rows an ordinary authenticated user would not see
- write tools, when explicitly enabled, run with backend-level authority
- `JAZZ_MCP_PRINCIPAL` changes authorship attribution; it does not turn backend access into user impersonation

Deploy this MCP only in trusted operator/agent environments and protect both the admin and backend secrets like database administrator credentials.

A future user-scoped mode should use JWT/session-scoped Jazz handles and let server permissions filter reads and writes.

## 5. Query semantics cross-check

The attached query docs confirm the generic query shape used by the connector:

- `where(...)` predicates are AND-combined
- query-level OR is not supported
- `orderBy(...)` should precede pagination for stable pages
- `limit` and `offset` are native Jazz query concepts
- operator support depends on column type

The current connector intentionally exposes only a small flat subset:

- `where`
- `select`
- `orderBy`
- `limit`
- `offset`

It does not yet expose relation `include(...)`, recursive `gather(...)`, reactive subscriptions, branches outside the configured environment/user branch, or arbitrary query JSON.

## 6. Magic columns

The attached docs describe query-time magic columns:

Permission introspection:

- `$canRead`
- `$canEdit`
- `$canDelete`

Provenance:

- `$createdBy`
- `$createdAt`
- `$updatedBy`
- `$updatedAt`

These do not exist in the structural schema and are omitted from `select("*")`; callers must opt in explicitly.

The connector's schema validation must therefore distinguish **queryable system columns** from **writable schema columns**. Magic columns may be read/filtered where supported, but must never be accepted as mutation fields.

## 7. Durability

Jazz documents `local`, `edge`, and `global` tiers. Backends/servers default to `edge`; clients/browsers default to `local`.

The connector defaults mutation confirmation to `edge`, matching the backend/server guidance. `global` should only be selected when the caller truly needs the extra cross-region coordination guarantee.

## 8. Testing should use Jazz's official test utilities

`docs/content/docs/recipes/testing.mdx` recommends:

- `startLocalJazzServer` from `jazz-tools/testing`
- `deploy` to publish schema/permissions
- connecting an in-memory Jazz client to that server

This is a better regression test for this repository than mocks alone because it exercises the real NAPI server/runtime and schema catalogue shipped by the installed alpha packages.

The PR therefore keeps lightweight unit tests and adds/targets an integration smoke test around the official testing utilities for the connector's admin-authenticated schema discovery and Jazz-native query/write path.

## 9. Review conclusion

The architecture remains correct after the documentation cross-check:

```text
MCP stdio
  -> schema catalogue read
  -> raw WasmSchema
  -> Jazz NAPI runtime
  -> Jazz WebSocket sync/query protocol
  -> jazz-tools@alpha server
```

The review produced three concrete corrections/clarifications:

1. add explicit `jazz-napi@alpha`
2. distinguish the built-in docs MCP from this data connector
3. document the privileged backend/RLS security boundary and prefer backend-secret mode for production server-owned access

It also identifies magic-column support and an official local-server integration test as important MVP hardening work.
