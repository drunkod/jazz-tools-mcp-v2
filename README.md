# jazz-tools-mcp-v2

MVP Model Context Protocol **data connector** for the official **`jazz-tools@alpha server`**.

This project deliberately targets the current Jazz 2 alpha architecture. It does **not** use the old `jazz-nodejs` / CoJSON `0.9.x` APIs and it does not start a second Jazz sync server.

> Jazz itself also ships `jazz-tools mcp`. That is the official **documentation MCP** (`list_pages`, `search_docs`, `get_doc`). This repository is a separate, privileged connector for application data.

## Security boundary

This MCP connects with Jazz admin/backend credentials and therefore operates with **privileged backend access**, not an end-user permission-scoped session.

- read tools may see rows an ordinary user would not be permitted to read
- mutation tools, when enabled, may bypass ordinary row-level user policies
- `JAZZ_MCP_PRINCIPAL` changes write attribution only; it does not impersonate a user for permission evaluation

Treat this process and its secrets like database administrator credentials. Run it only in trusted operator/agent environments. Writes remain disabled by default.

## What it connects to

The official self-hosted server is started like this:

```bash
export JAZZ_APP_ID="replace-with-your-app-id"
export JAZZ_ADMIN_SECRET="replace-with-admin-secret"

npx jazz-tools@alpha server "$JAZZ_APP_ID" \
  --port 1625 \
  --data-dir ./data \
  --admin-secret "$JAZZ_ADMIN_SECRET"
```

The MCP connector talks to that process in two ways:

1. HTTP catalogue endpoints discover the published Jazz schema.
2. Jazz's own NAPI backend runtime connects to the app-scoped WebSocket sync endpoint for queries and mutations.

There is no SQL bridge and no invented REST CRUD API.

## MVP tools

Read tools:

- `jazz_status`
- `jazz_reload_schema`
- `jazz_list_tables`
- `jazz_describe_table`
- `jazz_query`
- `jazz_get_row`

Mutation tools, disabled by default:

- `jazz_insert`
- `jazz_update`
- `jazz_delete`

`jazz_query` uses the same generic Jazz query JSON shape used by the official Jazz Inspector. Example:

```json
{
  "table": "todos",
  "where": {
    "done": false,
    "title": { "contains": "ship" }
  },
  "select": ["title", "done", "$createdBy", "$updatedAt"],
  "orderBy": [{ "column": "title", "direction": "asc" }],
  "limit": 25
}
```

Where predicates are AND-combined. Query-level OR is not part of the current Jazz query API. The connector validates operators against the Jazz column type (`contains` for text, range operators for numeric/timestamp fields, etc.).

Query-time Jazz magic columns supported by the connector are:

- `$canRead`, `$canEdit`, `$canDelete`
- `$createdBy`, `$createdAt`, `$updatedBy`, `$updatedAt`

They are query-only system columns and cannot be passed as mutation fields. Row `id` is likewise not accepted in mutation `values`; Jazz manages row identity separately.

## Requirements

- Node.js 22.12+
- a running `jazz-tools@alpha server`
- an app ID
- the server admin secret
- at least one published schema for the app

For Node backends Jazz requires `jazz-napi` as an explicit dependency. This repository therefore depends on both:

```text
jazz-tools@alpha
jazz-napi@alpha
```

The connector follows the npm `alpha` tag for both packages. The research snapshot for this MVP was checked against official Jazz `2.0.0-alpha.53` and repository commit `fa7d33b3ecfc9fcb673cd7c7bb9c35d700255e1d` on 2026-08-16.

## Setup

```bash
npm install
cp .env.example .env
```

Set at least:

```bash
JAZZ_SERVER_URL=http://127.0.0.1:1625
JAZZ_APP_ID=replace-with-your-app-id
JAZZ_ADMIN_SECRET=replace-with-admin-secret
```

Then:

```bash
npm run build
npm start
```

The server uses MCP stdio. Do not write logs to stdout; stdout is reserved for MCP JSON-RPC.

### Example MCP client config

```json
{
  "mcpServers": {
    "jazz-data": {
      "command": "node",
      "args": ["/absolute/path/to/jazz-tools-mcp-v2/dist/index.js"],
      "env": {
        "JAZZ_SERVER_URL": "http://127.0.0.1:1625",
        "JAZZ_APP_ID": "your-app-id",
        "JAZZ_ADMIN_SECRET": "your-admin-secret"
      }
    }
  }
}
```

Using a name such as `jazz-data` avoids confusion with Jazz's built-in docs MCP.

## Schema discovery

The MCP does not crawl your source tree for `schema.ts`.

At first use it calls the official Jazz schema catalogue APIs:

```text
GET /apps/<app-id>/schemas
GET /apps/<app-id>/schema/<schema-hash>
X-Jazz-Admin-Secret: ...
```

By default it selects the newest published schema using `publishedAt`, falling back to the last returned hash. Pin a specific schema with:

```bash
JAZZ_SCHEMA_HASH=<hash>
```

If the server has no schema yet, run your Jazz application in its normal development flow so structural schema auto-sync occurs, or use the project's normal `jazz-tools@alpha deploy` workflow.

After a new deployment, call `jazz_reload_schema` or restart the MCP process. Jazz contexts are schema-bound after initialization, so reload tears down the old local runtime before loading the new schema.

## Authentication modes

### Preferred production backend mode

The Jazz v2 backend documentation recommends explicit backend identity for server-connected server-owned work. Start Jazz with both secrets:

```bash
npx jazz-tools@alpha server "$JAZZ_APP_ID" \
  --port 1625 \
  --data-dir ./data \
  --admin-secret "$JAZZ_ADMIN_SECRET" \
  --backend-secret "$JAZZ_BACKEND_SECRET"
```

Then configure:

```bash
JAZZ_BACKEND_SECRET=...
```

The MCP uses `context.asBackend(schema)`.

To stamp mutation provenance while retaining backend-level permissions:

```bash
JAZZ_MCP_PRINCIPAL=mcp:agent
```

This uses `context.withAttribution(...)` and requires `JAZZ_BACKEND_SECRET`.

### Compatibility mode: admin secret only

The exact self-host example above contains only `--admin-secret`. The current alpha Rust server accepts `admin_secret` in its WebSocket handshake as backend access, so the connector retains an admin-only compatibility path and uses the context's admin-authenticated transport.

This path is tested in CI against Jazz's official `startLocalJazzServer` + `deploy` test utilities. For production server-owned work, prefer the explicit backend-secret mode above.

## Write safety

Writes are off by default:

```bash
JAZZ_MCP_ALLOW_WRITES=false
```

Enable explicitly:

```bash
JAZZ_MCP_ALLOW_WRITES=true
```

Mutation confirmation defaults to Jazz's `edge` durability tier:

```bash
JAZZ_MCP_DURABILITY=edge
```

Allowed values are `local`, `edge`, and `global`.

The MVP intentionally does **not** expose schema mutation, permission mutation, migrations, arbitrary HTTP requests, raw SQLite access, or arbitrary SQL. Those operations have stronger Jazz-specific invariants and should continue through the official `validate`, `deploy`, permissions, and migrations flows.

The current query surface also intentionally omits relation `include(...)`, recursive `gather(...)`, reactive subscriptions, and arbitrary query JSON.

## Verification

CI runs on Node 22.12 and performs:

```text
npm install
npm run check
npm test
npm run build
```

Tests include an integration smoke test using the official Jazz testing utilities to:

1. start an in-memory Jazz server
2. deploy a real schema and permissions bundle
3. connect this MCP adapter without passing the backend secret
4. discover the published schema through the admin catalogue
5. insert/query/update/delete through Jazz's native runtime and WebSocket protocol

For a manual server test, see [`docs/testing.md`](docs/testing.md).

## Test with MCP Inspector

After installing dependencies and building:

```bash
npx @modelcontextprotocol/inspector node ./dist/index.js
```

Provide the Jazz environment variables in the shell that launches the Inspector.

## Research

- [`docs/research/official-alpha-server.md`](docs/research/official-alpha-server.md)
- [`docs/research/analogs-and-old-server.md`](docs/research/analogs-and-old-server.md)
- [`docs/research/attached-jazz-v2-docs-review.md`](docs/research/attached-jazz-v2-docs-review.md)
- [`docs/architecture.md`](docs/architecture.md)

## License

MIT
