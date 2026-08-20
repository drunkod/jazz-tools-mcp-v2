# MCP ↔ Jazz ↔ Inspector realtime demo

This is the canonical development runbook for the root data-connector MCP and `packages/inspector`. It proves both mutation directions with real Jazz operations. It is **not** a production deployment pattern: the standalone Inspector still receives a browser admin secret for this isolated development demo. See [`../security-boundary.md`](../security-boundary.md).

Run all terminals from the repository root unless a command changes directory. Use a disposable dev app/data directory.

## Shared development values

Use the same values in all three terminals:

```sh
export JAZZ_APP_ID="replace-with-dev-app-id"
export JAZZ_ADMIN_SECRET="replace-with-dev-admin-secret"
export JAZZ_BACKEND_SECRET="replace-with-dev-backend-secret"
export JAZZ_SERVER_URL="http://127.0.0.1:1625"
export JAZZ_ENV="dev"
export JAZZ_BRANCH="main"
```

The app must have a published schema containing the demo table. The examples below use:

```text
todos(title: Text, done: Boolean)
```

## Terminal A — official Jazz server

```sh
npx --yes jazz-tools@alpha server "$JAZZ_APP_ID" \
  --port 1625 \
  --data-dir ./data/mcp-realtime-demo \
  --admin-secret "$JAZZ_ADMIN_SECRET" \
  --backend-secret "$JAZZ_BACKEND_SECRET"
```

Wait for the server to listen on port `1625`. If this app has no published schema, run its normal development/deploy flow first; this connector does not infer a schema from source files.

## Terminal B — standalone Inspector

```sh
pnpm --dir packages/inspector install --frozen-lockfile
pnpm --dir packages/inspector dev
```

Open `http://localhost:5173` and connect with:

| Field | Value |
| --- | --- |
| Server URL | `http://127.0.0.1:1625` |
| App ID | the exact `JAZZ_APP_ID` from Terminal A |
| Admin secret | the exact `JAZZ_ADMIN_SECRET` from Terminal A |
| Environment | `dev` |
| Branch | `main` |

Select the active published schema and open `todos`. Do not reload the page during either proof.

## Terminal C — MCP connector through MCP Inspector

```sh
npm install --no-audit --no-fund
npm run build
export JAZZ_SERVER_URL="http://127.0.0.1:1625"
export JAZZ_MCP_ALLOW_WRITES="true"
export JAZZ_MCP_DURABILITY="global"
export JAZZ_MCP_PRINCIPAL="mcp:realtime-demo"
npx --yes @modelcontextprotocol/inspector node ./dist/index.js
```

`JAZZ_MCP_PRINCIPAL` requires `JAZZ_BACKEND_SECRET`; it stamps Jazz attribution while retaining backend-level permissions. It does not turn the connector into an end-user permission-scoped client and does not prove the semantic identity of an “agent.”

In the MCP Inspector UI, connect to the stdio server and use the exact tools below.

## Exact connector tools used

| Tool | Purpose |
| --- | --- |
| `jazz_status` | Verify server/schema, `allowWrites`, durability, auth mode, and attribution. |
| `jazz_list_tables` | Confirm the published runtime table name. |
| `jazz_insert` | Insert and return the created row, including Jazz-generated `row.id`. |
| `jazz_update` | Update by the returned row ID and return the current row. |
| `jazz_delete` | Delete by the returned row ID and return `{ id, deleted: true }`. |
| `jazz_query` | Reverse-flow lookup by unique values; returns `{ rows: [...] }`. |
| `jazz_get_row` | Reverse-flow verification by exact returned ID; returns `{ row }` or `{ row: null }`. |

Do not substitute generic names such as `insert`, `update`, or `delete`; those are not this connector's registered tool names.

## Forward proof: MCP writes, Inspector reacts

### 1. Verify connector state

Tool: `jazz_status`

```json
{}
```

Require at least:

```json
{
  "allowWrites": true,
  "durability": "global",
  "authMode": "backend-secret",
  "accessScope": "privileged-backend",
  "attribution": "mcp:realtime-demo"
}
```

Then call `jazz_list_tables` with `{}` and confirm a returned entry has `"name": "todos"`.

### 2. Insert and capture the returned ID

Tool: `jazz_insert`

```json
{
  "table": "todos",
  "values": {
    "title": "MCP realtime demo 2026-08-17T18:00:00Z",
    "done": false
  }
}
```

The structured result shape is:

```json
{
  "row": {
    "id": "<JAZZ_GENERATED_ID>",
    "title": "MCP realtime demo 2026-08-17T18:00:00Z",
    "done": false
  }
}
```

Copy `row.id` from this response and call it `MCP_ROW_ID`. Do not invent, predict, or hard-code it.

Without reloading Inspector, verify the row appears with `done=false`. If provenance columns are enabled/supplied, verify the displayed values match Jazz data; do not relabel the principal as an agent unless application metadata establishes that mapping.

### 3. Update the same returned ID

Tool: `jazz_update`

```json
{
  "table": "todos",
  "id": "<MCP_ROW_ID_FROM_JAZZ_INSERT>",
  "values": {
    "done": true
  }
}
```

Require `row.id` in the response to equal `MCP_ROW_ID` and `row.done` to be `true`. Without reloading Inspector, verify the open row changes to `done=true` and `$updatedAt` changes when that provenance column is supplied by Jazz.

### 4. Delete the same returned ID

Tool: `jazz_delete`

```json
{
  "table": "todos",
  "id": "<MCP_ROW_ID_FROM_JAZZ_INSERT>"
}
```

Require:

```json
{
  "id": "<MCP_ROW_ID_FROM_JAZZ_INSERT>",
  "deleted": true
}
```

Without reloading Inspector, verify the row disappears.

## Reverse proof: Inspector writes, MCP observes

Use a second unique title, for example `Inspector reverse demo 2026-08-17T18:05:00Z`.

1. In the still-open Inspector table, stage an insert with that exact title and `done=false`, then select **Save changes**.
2. Without reloading Inspector or restarting the MCP connector, call `jazz_query`:

   ```json
   {
     "table": "todos",
     "where": {
       "title": "Inspector reverse demo 2026-08-17T18:05:00Z"
     },
     "select": ["id", "title", "done", "$createdAt", "$updatedAt"],
     "limit": 2,
     "offset": 0
   }
   ```

3. Require exactly one matching row. Capture `rows[0].id` from the response as `INSPECTOR_ROW_ID`; this is the returned Jazz ID for all remaining reverse-flow calls.
4. In Inspector, change that row to `done=true` and select **Save changes**.
5. Call `jazz_get_row` without restarting/reloading anything:

   ```json
   {
     "table": "todos",
     "id": "<INSPECTOR_ROW_ID_FROM_JAZZ_QUERY>"
   }
   ```

   Require `row.id` to equal `INSPECTOR_ROW_ID` and `row.done` to be `true`.
6. In Inspector, stage deletion of that row and select **Save changes**.
7. Call `jazz_get_row` again with the same returned ID and require:

   ```json
   {
     "row": null
   }
   ```

## What “without refresh” means

- Do not reload or navigate away from the open Inspector table between external mutations and UI observations.
- Do not restart the Jazz server, Inspector dev server, or MCP connector.
- Do not call `jazz_reload_schema`; the schema is unchanged during this demo.
- New MCP `jazz_query`/`jazz_get_row` calls are observations, not browser refreshes.
- The forward UI must react through Jazz subscriptions; mocked network responses or polling the page do not pass.

## Acceptance record

Record:

- Jazz server command and resolved `jazz-tools` version;
- connector build/start command and `jazz_status` output with secrets redacted;
- schema hash and table;
- returned `MCP_ROW_ID` and `INSPECTOR_ROW_ID` (redact if row IDs are classified);
- forward insert/update/delete observations without browser refresh;
- reverse insert/update/delete observations without browser refresh;
- cleanup result and any provenance actually supplied by Jazz.

Cleanup passes when both demo rows are absent and no durable test data remains.
