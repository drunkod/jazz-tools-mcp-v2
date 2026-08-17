# End-to-end test runbook

> **Testing this on your own computer?** Start with [`local-testing-runbook.md`](./local-testing-runbook.md). It contains copy/paste commands for cloning the repo, installing Node dependencies, running the self-contained real-Jazz integration test, starting a local Jazz server, deploying a schema, launching MCP Inspector, and manually testing read/write tools on macOS/Linux/Git Bash and Windows PowerShell.

This runbook targets the official alpha server rather than a mock REST API.

## Automated CI smoke test

`src/connector.integration.test.ts` uses the official Jazz testing utilities documented in `jazz-tools/testing`:

- `startLocalJazzServer({ inMemory: true })`
- `deploy(...)`

The test deploys a real schema/permissions bundle, constructs `JazzConnector` with the server admin secret but deliberately omits the backend secret, then exercises:

1. health + schema catalogue discovery
2. table discovery
3. insert at `edge` durability
4. query, including a Jazz magic column in `select`
5. update
6. delete

This validates the actual NAPI server/runtime and WebSocket protocol supplied by the installed `jazz-tools@alpha` / `jazz-napi@alpha`, rather than a hand-written protocol mock.

The normal CI sequence is:

```bash
npm install --no-audit --no-fund
npm run check
npm test
npm run build
```

## 1. Start the official server manually

```bash
export JAZZ_APP_ID="replace-with-your-app-id"
export JAZZ_ADMIN_SECRET="replace-with-admin-secret"

npx jazz-tools@alpha server "$JAZZ_APP_ID" \
  --port 1625 \
  --data-dir ./data \
  --admin-secret "$JAZZ_ADMIN_SECRET"
```

Expected server-side behavior:

- `GET http://127.0.0.1:1625/health` responds.
- app routes are namespaced under `/apps/<canonical-app-id>`.
- WebSocket data sync is at the app-scoped `/ws` route.

## 2. Ensure a schema is published

Use the same app ID from a real Jazz alpha application. In development, the official server supports structural schema auto-sync. Alternatively use the project's existing `jazz-tools@alpha deploy` flow.

Verify with the Jazz Inspector or by calling the MCP's `jazz_status` after startup.

If the catalogue is empty, the MCP returns a specific error instead of guessing a schema.

## 3. Build the MCP

```bash
npm install
npm run check
npm test
npm run build
```

`jazz-napi@alpha` is an explicit dependency because Jazz's Node backend documentation requires the native runtime to be installed directly alongside `jazz-tools@alpha`.

## 4. Configure environment

```bash
export JAZZ_SERVER_URL=http://127.0.0.1:1625
export JAZZ_APP_ID="$JAZZ_APP_ID"
export JAZZ_ADMIN_SECRET="$JAZZ_ADMIN_SECRET"
export JAZZ_MCP_ALLOW_WRITES=false
```

This is privileged operator/backend access. It is not an end-user permission-scoped session.

## 5. Launch MCP Inspector

```bash
npx @modelcontextprotocol/inspector node ./dist/index.js
```

Suggested read-only smoke sequence:

1. `jazz_status`
2. `jazz_list_tables`
3. `jazz_describe_table` for one table
4. `jazz_query` with `{ "table": "<table>", "limit": 5 }`
5. `jazz_get_row` using a returned row ID

Also test a query selecting one or more Jazz magic columns such as `$createdBy` or `$updatedAt`.

## 6. Mutation smoke test

Restart the MCP with:

```bash
export JAZZ_MCP_ALLOW_WRITES=true
```

Use a non-production app and a table whose required fields you understand from `jazz_describe_table`.

1. `jazz_insert`
2. `jazz_get_row`
3. `jazz_update`
4. `jazz_delete`
5. query again to confirm visible state

The connector waits for the configured durability tier (`edge` by default).

Mutation `values` must contain schema-defined writable columns only. `id` and Jazz `$...` magic columns are intentionally rejected.

## 7. Backend-secret variant

For production server-owned work, prefer the explicit backend-secret path documented by Jazz:

```bash
export JAZZ_BACKEND_SECRET="replace-with-backend-secret"

npx jazz-tools@alpha server "$JAZZ_APP_ID" \
  --port 1625 \
  --data-dir ./data \
  --admin-secret "$JAZZ_ADMIN_SECRET" \
  --backend-secret "$JAZZ_BACKEND_SECRET"
```

Then launch the MCP with `JAZZ_BACKEND_SECRET` set. Optionally set:

```bash
export JAZZ_MCP_PRINCIPAL=mcp:test-agent
```

That exercises the explicit backend-scoped / attributed code path.

## 8. Schema reload test

Publish a new schema version through the normal Jazz project flow, then call `jazz_reload_schema`. The reported schema hash and table descriptions should update without restarting the MCP host.

## 9. Permission-scope caveat

The current MVP intentionally runs as a privileged backend/admin connector. It does not verify that a specific end-user session would be allowed to read or mutate a row.

A future permission-scoped test mode should mint a user JWT/session and exercise `forRequest` / `forSession` semantics separately from the privileged operator connector.
