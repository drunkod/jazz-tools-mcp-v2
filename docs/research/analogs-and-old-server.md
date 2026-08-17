# Research: analogs and the old Jazz MCP repository

Research date: 2026-08-16

## Official Jazz docs MCP: same protocol, different purpose

The current `jazz-tools` package already ships an MCP server via `jazz-tools mcp`.

Official documentation: `docs/content/docs/reference/mcp.mdx`.

Its tools are:

- `list_pages`
- `search_docs`
- `get_doc`

The docs MCP intentionally serves documentation matched to the installed Jazz package version. It does not connect to an application's tables or expose database reads/writes.

This is important naming/product context: `jazz-tools-mcp-v2` is a **Jazz data connector**, not a replacement for the official docs MCP. An MCP host can use both at once (for example `jazz-docs` and `jazz-data`).

## Old reference: `bensleveritt/jazz-mcp-server`

Repository:

https://github.com/bensleveritt/jazz-mcp-server

This repository is useful only as historical/reference material.

### Why it cannot be the implementation base

Its package manifest uses the older stack:

```text
jazz-nodejs ^0.9.0
cojson ^0.9.0
cojson-storage-sqlite ^0.9.0
cojson-transport-ws ^0.9.0
@mcp/server ^0.3.0
@mcp/protocol ^0.3.0
```

Its Jazz client code creates a `SqliteStorage`, starts a `WebSocketSyncServer`, and calls the old `createJazz(...)` API. That is a different architecture from the current `jazz-tools@alpha server` + NAPI runtime.

Its data tool also searches an application's filesystem for guessed schema paths and calls old `jazz.get(...)` / `jazz.list(...)` methods.

The README advertises update/create/delete/auth tools, but the checked-in source tree only contains `list-apps.ts` and `get-app-data.ts` under `src/tools` plus supporting config/auth/Jazz files. So even on its own version line it is more prototype than complete connector.

### Ideas worth retaining

Only generic organization ideas survive:

- keep configuration isolated
- keep Jazz adapter logic separate from MCP tool definitions
- expose explicit tool contracts
- keep auth configuration explicit

No Jazz API calls from that repository are copied into this MVP.

## Official Jazz Inspector: strongest direct data analog

Source:

https://github.com/garden-co/jazz/tree/main/packages/inspector

The Inspector is the most relevant data-access implementation reference because it uses the same current `jazz-tools` types while operating on schemas/tables selected dynamically at runtime.

Relevant code:

- `src/utility/generic-query-builder.ts`
- `src/components/data-explorer/TableDataGrid.tsx`
- `src/components/data-explorer/row-mutation-form.ts`

The MVP follows its dynamic query-builder pattern and relies on the same public runtime contracts for mutations.

## LiveStore MCP

Source:

https://github.com/livestorejs/livestore/blob/main/docs/src/content/docs/building-with-livestore/tools/mcp.mdx

LiveStore exposes runtime-oriented MCP tools such as instance connect, read-only query, event commit, status, disconnect, and sync export/import.

Useful design lesson: agents should mutate through the database's semantic/runtime API, not bypass the runtime with arbitrary writable storage access.

For Jazz, the equivalent is Jazz `Db` mutations, not raw SQLite.

## RxDB WebMCP

Source:

https://github.com/pubkey/rxdb/blob/master/src/plugins/webmcp/webmcp-tools.ts

RxDB dynamically creates query/count/change/insert/upsert/delete tools from collection metadata and can disable write operations.

Useful design lessons adopted here:

- generic schema-aware database tools
- explicit read/write boundary
- default-safe mutation configuration
- structured tool arguments rather than UI/DOM automation

Jazz differs because its native query JSON, sync protocol, schema catalogue, row histories, permissions, and durability semantics should remain authoritative.

## MCP TypeScript SDK v2

Source:

https://github.com/modelcontextprotocol/typescript-sdk

At research time `@modelcontextprotocol/server` is `2.0.0`. The current stdio guidance uses:

```ts
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
```

The guidance explicitly reserves stdout for JSON-RPC and recommends stderr for operational logging. The MVP follows this pattern.

## Resulting design hierarchy

Priority order used for this repository:

1. current official Jazz v2 docs and `garden-co/jazz` alpha server/runtime code
2. current official Jazz Inspector dynamic data-access patterns
3. current MCP TypeScript SDK conventions
4. LiveStore/RxDB for high-level data-MCP ergonomics
5. old `bensleveritt/jazz-mcp-server` only as historical context

The official Jazz docs MCP is not an implementation analog for database access, but it is authoritative for MCP naming/runtime expectations and can coexist with this connector.
