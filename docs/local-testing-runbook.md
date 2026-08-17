# Local testing runbook

This is the copy/paste guide for testing `jazz-tools-mcp-v2` on your own computer.

There are two useful test paths:

1. **Recommended first test — zero configuration.** This runs the repository's real Jazz integration test. It starts an in-memory Jazz server, deploys a schema, connects through the real NAPI/WebSocket runtime, and performs CRUD. You do **not** need an app ID, admin secret, or an existing Jazz project.
2. **Manual MCP test — MCP Inspector.** This runs the MCP process against a Jazz server and lets you call `jazz_status`, `jazz_query`, `jazz_insert`, etc. interactively.

The repository requires **Node.js 22.12 or newer**.

---

## Part A — fastest local test, no Jazz setup required

### A1. Open a terminal

macOS/Linux: Terminal, iTerm, etc.

Windows: PowerShell, Windows Terminal, or Git Bash.

### A2. Clone the repository

```bash
git clone https://github.com/kodyka/jazz-tools-mcp-v2.git
cd jazz-tools-mcp-v2
```

### A3. Check out the PR branch

Until PR #1 is merged, use:

```bash
git fetch origin
git checkout feat/mvp-alpha-server-connector
git pull origin feat/mvp-alpha-server-connector
```

After PR #1 is merged, use `main` instead:

```bash
git checkout main
git pull origin main
```

### A4. Verify Node and npm

```bash
node --version
npm --version
```

`node --version` must print `v22.12.0` or newer.

If Node is too old and you already use `nvm`, run:

```bash
nvm install 22.12.0
nvm use 22.12.0
node --version
```

### A5. Install dependencies

```bash
npm install --no-audit --no-fund
```

This installs both `jazz-tools@alpha` and the required native `jazz-napi@alpha` runtime.

### A6. Type-check the project

```bash
npm run check
```

Expected result: the command exits with code `0` and no TypeScript errors.

### A7. Run all tests

```bash
npm test
```

This is the most important local verification command.

The integration test automatically:

1. starts a real in-memory Jazz server with `startLocalJazzServer()`;
2. deploys a test `todos` schema and permissions;
3. creates the MCP connector with the admin secret;
4. checks `/health` and schema discovery;
5. inserts a row;
6. queries it through Jazz's native query runtime;
7. updates it;
8. deletes it;
9. shuts the local server down.

Expected result: all tests pass and the output ends with `fail 0`.

### A8. Build the MCP

```bash
npm run build
```

### A9. Confirm the compiled entry point exists

macOS/Linux/Git Bash:

```bash
ls -la dist/index.js
```

PowerShell:

```powershell
Get-Item .\dist\index.js
```

At this point the repository, Jazz NAPI runtime, real Jazz server test, TypeScript build, and CRUD connector path have all been tested locally.

---

## Part B — manually test the MCP tools with MCP Inspector

Use this part when you want to click/call the actual MCP tools yourself.

You need:

- this repository;
- a Jazz app ID;
- an admin secret;
- a published Jazz schema for that app.

Do this with a **development/test app**, not production data. The connector uses privileged backend/admin access.

You will use three terminals:

- **Terminal 1:** Jazz server
- **Terminal 2:** your Jazz application project, for schema deployment
- **Terminal 3:** this MCP repository / MCP Inspector

---

## Terminal 1 — start the Jazz server

### B1. Go to a directory where local Jazz data can be stored

For example:

```bash
mkdir -p ~/jazz-mcp-local-test
cd ~/jazz-mcp-local-test
```

On PowerShell:

```powershell
New-Item -ItemType Directory -Force "$HOME\jazz-mcp-local-test" | Out-Null
Set-Location "$HOME\jazz-mcp-local-test"
```

### B2. Set the app ID and admin secret

Replace the values below with your development app values.

macOS/Linux/Git Bash:

```bash
export JAZZ_APP_ID="replace-with-your-app-id"
export JAZZ_ADMIN_SECRET="replace-with-your-admin-secret"
export JAZZ_SERVER_URL="http://127.0.0.1:1625"
```

PowerShell:

```powershell
$env:JAZZ_APP_ID="replace-with-your-app-id"
$env:JAZZ_ADMIN_SECRET="replace-with-your-admin-secret"
$env:JAZZ_SERVER_URL="http://127.0.0.1:1625"
```

### B3. Start the official Jazz alpha server

macOS/Linux/Git Bash:

```bash
npx --yes jazz-tools@alpha server "$JAZZ_APP_ID" \
  --port 1625 \
  --data-dir ./data \
  --admin-secret "$JAZZ_ADMIN_SECRET"
```

PowerShell:

```powershell
npx --yes jazz-tools@alpha server $env:JAZZ_APP_ID `
  --port 1625 `
  --data-dir .\data `
  --admin-secret $env:JAZZ_ADMIN_SECRET
```

Leave Terminal 1 running.

---

## Terminal 2 — verify the server and publish your app schema

### B4. Set the same environment variables again

Each terminal has its own environment.

macOS/Linux/Git Bash:

```bash
export JAZZ_APP_ID="replace-with-your-app-id"
export JAZZ_ADMIN_SECRET="replace-with-your-admin-secret"
export JAZZ_SERVER_URL="http://127.0.0.1:1625"
```

PowerShell:

```powershell
$env:JAZZ_APP_ID="replace-with-your-app-id"
$env:JAZZ_ADMIN_SECRET="replace-with-your-admin-secret"
$env:JAZZ_SERVER_URL="http://127.0.0.1:1625"
```

### B5. Check server health

macOS/Linux/Git Bash:

```bash
curl -fsS "$JAZZ_SERVER_URL/health"
echo
```

PowerShell:

```powershell
Invoke-RestMethod "$env:JAZZ_SERVER_URL/health"
```

You should get a successful health response.

### B6. Go to your Jazz application project

Example:

```bash
cd /absolute/path/to/your-jazz-app
```

PowerShell example:

```powershell
Set-Location "C:\absolute\path\to\your-jazz-app"
```

The app directory should contain the Jazz `schema.ts` used by `jazz-tools` and, if applicable, `permissions.ts`.

### B7. Install your application dependencies if needed

```bash
npm install
```

### B8. Validate the Jazz schema

```bash
npx --yes jazz-tools@alpha validate
```

Fix validation errors before continuing.

### B9. Deploy the schema and permissions to the local Jazz server

macOS/Linux/Git Bash:

```bash
npx --yes jazz-tools@alpha deploy "$JAZZ_APP_ID" \
  --server-url "$JAZZ_SERVER_URL" \
  --admin-secret "$JAZZ_ADMIN_SECRET"
```

PowerShell:

```powershell
npx --yes jazz-tools@alpha deploy $env:JAZZ_APP_ID `
  --server-url $env:JAZZ_SERVER_URL `
  --admin-secret $env:JAZZ_ADMIN_SECRET
```

### B10. Verify that the server now has a published schema

macOS/Linux/Git Bash:

```bash
curl -fsS \
  -H "X-Jazz-Admin-Secret: $JAZZ_ADMIN_SECRET" \
  "$JAZZ_SERVER_URL/apps/$JAZZ_APP_ID/schemas"
echo
```

PowerShell:

```powershell
Invoke-RestMethod `
  -Headers @{"X-Jazz-Admin-Secret"=$env:JAZZ_ADMIN_SECRET} `
  "$env:JAZZ_SERVER_URL/apps/$env:JAZZ_APP_ID/schemas"
```

The response must contain at least one schema hash. If it is empty, do not start the MCP yet; the connector needs a published schema.

---

## Terminal 3 — build and launch the MCP

### B11. Go back to the MCP repository

macOS/Linux/Git Bash:

```bash
cd /absolute/path/to/jazz-tools-mcp-v2
```

PowerShell:

```powershell
Set-Location "C:\absolute\path\to\jazz-tools-mcp-v2"
```

### B12. Check out the PR branch if necessary

```bash
git fetch origin
git checkout feat/mvp-alpha-server-connector
git pull origin feat/mvp-alpha-server-connector
```

### B13. Install and build

```bash
npm install --no-audit --no-fund
npm run check
npm test
npm run build
```

### B14. Set MCP environment variables — read-only first

macOS/Linux/Git Bash:

```bash
export JAZZ_SERVER_URL="http://127.0.0.1:1625"
export JAZZ_APP_ID="replace-with-your-app-id"
export JAZZ_ADMIN_SECRET="replace-with-your-admin-secret"
export JAZZ_MCP_ALLOW_WRITES="false"
export JAZZ_MCP_DURABILITY="edge"
export JAZZ_ENV="dev"
export JAZZ_BRANCH="main"
```

PowerShell:

```powershell
$env:JAZZ_SERVER_URL="http://127.0.0.1:1625"
$env:JAZZ_APP_ID="replace-with-your-app-id"
$env:JAZZ_ADMIN_SECRET="replace-with-your-admin-secret"
$env:JAZZ_MCP_ALLOW_WRITES="false"
$env:JAZZ_MCP_DURABILITY="edge"
$env:JAZZ_ENV="dev"
$env:JAZZ_BRANCH="main"
```

### B15. Launch MCP Inspector

```bash
npx --yes @modelcontextprotocol/inspector node ./dist/index.js
```

Keep this terminal running. MCP Inspector normally prints a local URL and/or opens its browser UI.

---

## Part C — read-only MCP smoke test

In MCP Inspector, connect to the server and call these tools in order.

### C1. `jazz_status`

No arguments.

Expected fields include:

- `healthStatus: 200`
- your `appId`
- a `schemaHash`
- one or more `tables`
- `allowWrites: false`
- `authMode: "admin-secret"` unless you configured a backend secret
- `accessScope: "privileged-backend"`

### C2. `jazz_list_tables`

No arguments.

Choose one table for the next tests.

### C3. `jazz_describe_table`

Example input:

```json
{
  "table": "todos"
}
```

Replace `todos` with a table returned by `jazz_list_tables`.

### C4. `jazz_query`

Example:

```json
{
  "table": "todos",
  "limit": 5,
  "offset": 0
}
```

### C5. Query with selected fields and Jazz magic columns

Example:

```json
{
  "table": "todos",
  "select": ["title", "$createdBy", "$createdAt"],
  "limit": 5
}
```

Use real schema-defined columns from `jazz_describe_table`.

### C6. Query with a `where` condition

Example:

```json
{
  "table": "todos",
  "where": {
    "done": false
  },
  "limit": 5
}
```

Operator-object example:

```json
{
  "table": "todos",
  "where": {
    "title": {
      "contains": "test"
    }
  },
  "limit": 5
}
```

### C7. `jazz_get_row`

Copy a real row `id` returned by `jazz_query`:

```json
{
  "table": "todos",
  "id": "replace-with-real-row-id"
}
```

If all of the above work, the read path is working.

---

## Part D — write smoke test

Only do this against a development/test app.

### D1. Stop MCP Inspector

In Terminal 3 press:

```text
Ctrl+C
```

### D2. Enable writes

macOS/Linux/Git Bash:

```bash
export JAZZ_MCP_ALLOW_WRITES="true"
```

PowerShell:

```powershell
$env:JAZZ_MCP_ALLOW_WRITES="true"
```

### D3. Start MCP Inspector again

```bash
npx --yes @modelcontextprotocol/inspector node ./dist/index.js
```

### D4. Confirm writes are enabled

Call `jazz_status` again and confirm:

```text
allowWrites: true
```

### D5. Insert a row

Use the actual required columns from `jazz_describe_table`.

For a `todos(title, done)` example:

```json
{
  "table": "todos",
  "values": {
    "title": "manual MCP smoke test",
    "done": false
  }
}
```

Call `jazz_insert` and copy the returned row `id`.

Do not include `id`, `$createdBy`, `$createdAt`, `$updatedBy`, `$updatedAt`, or other Jazz `$...` fields in `values`.

### D6. Read the inserted row

Call `jazz_get_row`:

```json
{
  "table": "todos",
  "id": "replace-with-inserted-row-id"
}
```

### D7. Update the row

Example `jazz_update` input:

```json
{
  "table": "todos",
  "id": "replace-with-inserted-row-id",
  "values": {
    "done": true
  }
}
```

### D8. Query the row again

Example `jazz_query` input:

```json
{
  "table": "todos",
  "where": {
    "id": "replace-with-inserted-row-id"
  },
  "limit": 1
}
```

Confirm that the updated value is visible.

### D9. Delete the row

Example `jazz_delete` input:

```json
{
  "table": "todos",
  "id": "replace-with-inserted-row-id"
}
```

### D10. Confirm deletion

Call `jazz_get_row` again with the same ID. It should return no row / `null`.

At this point you have manually verified the complete MCP CRUD path.

---

## Part E — optional backend-secret test

The connector also supports Jazz's explicit backend-secret identity path.

### E1. Stop the Jazz server in Terminal 1

Press:

```text
Ctrl+C
```

### E2. Set a backend secret

macOS/Linux/Git Bash:

```bash
export JAZZ_BACKEND_SECRET="replace-with-a-backend-secret"
```

PowerShell:

```powershell
$env:JAZZ_BACKEND_SECRET="replace-with-a-backend-secret"
```

### E3. Start the Jazz server with both secrets

macOS/Linux/Git Bash:

```bash
npx --yes jazz-tools@alpha server "$JAZZ_APP_ID" \
  --port 1625 \
  --data-dir ./data \
  --admin-secret "$JAZZ_ADMIN_SECRET" \
  --backend-secret "$JAZZ_BACKEND_SECRET"
```

PowerShell:

```powershell
npx --yes jazz-tools@alpha server $env:JAZZ_APP_ID `
  --port 1625 `
  --data-dir .\data `
  --admin-secret $env:JAZZ_ADMIN_SECRET `
  --backend-secret $env:JAZZ_BACKEND_SECRET
```

### E4. In Terminal 3, set the same backend secret

macOS/Linux/Git Bash:

```bash
export JAZZ_BACKEND_SECRET="replace-with-a-backend-secret"
export JAZZ_MCP_PRINCIPAL="mcp:local-test"
```

PowerShell:

```powershell
$env:JAZZ_BACKEND_SECRET="replace-with-a-backend-secret"
$env:JAZZ_MCP_PRINCIPAL="mcp:local-test"
```

### E5. Start Inspector again

```bash
npx --yes @modelcontextprotocol/inspector node ./dist/index.js
```

Call `jazz_status` and confirm:

```text
authMode: backend-secret
```

Then repeat the read/write smoke tests if desired.

`JAZZ_MCP_PRINCIPAL` controls mutation attribution. It does **not** turn this privileged backend connection into an end-user permission-scoped session.

---

## Part F — schema reload test

Keep the Jazz server and MCP Inspector running.

### F1. Change your Jazz application's `schema.ts`

Make a safe development-only schema change.

### F2. Validate and deploy the changed schema from the Jazz app project

```bash
npx --yes jazz-tools@alpha validate
```

macOS/Linux/Git Bash:

```bash
npx --yes jazz-tools@alpha deploy "$JAZZ_APP_ID" \
  --server-url "$JAZZ_SERVER_URL" \
  --admin-secret "$JAZZ_ADMIN_SECRET"
```

PowerShell:

```powershell
npx --yes jazz-tools@alpha deploy $env:JAZZ_APP_ID `
  --server-url $env:JAZZ_SERVER_URL `
  --admin-secret $env:JAZZ_ADMIN_SECRET
```

### F3. In MCP Inspector call `jazz_reload_schema`

No arguments.

### F4. Confirm the schema changed

Call:

1. `jazz_status`
2. `jazz_list_tables`
3. `jazz_describe_table`

The connector should report the newly published schema without restarting the MCP host.

---

## Part G — useful troubleshooting commands

### Show your current git branch

```bash
git branch --show-current
```

### Show the exact commit you are testing

```bash
git rev-parse HEAD
```

### Clean and rebuild compiled JavaScript

macOS/Linux/Git Bash:

```bash
rm -rf dist
npm run build
```

PowerShell:

```powershell
Remove-Item -Recurse -Force .\dist -ErrorAction SilentlyContinue
npm run build
```

### Reinstall dependencies from scratch

macOS/Linux/Git Bash:

```bash
rm -rf node_modules
npm install --no-audit --no-fund
```

PowerShell:

```powershell
Remove-Item -Recurse -Force .\node_modules -ErrorAction SilentlyContinue
npm install --no-audit --no-fund
```

### Re-run only the compiled integration test

First build:

```bash
npm run build
```

Then:

```bash
node --test dist/connector.integration.test.js
```

### Run the MCP directly without Inspector

After setting all required `JAZZ_*` environment variables:

```bash
npm start
```

or:

```bash
node ./dist/index.js
```

The process should print its operational message to stderr and then wait for MCP JSON-RPC on stdin. That is normal; for interactive use, MCP Inspector is easier.

### Verify the installed Jazz package versions

```bash
npm ls jazz-tools jazz-napi @modelcontextprotocol/server
```

### Print all repository test commands in one sequence

```bash
npm install --no-audit --no-fund && \
npm run check && \
npm test && \
npm run build
```

PowerShell equivalent:

```powershell
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

---

## Minimum success checklist

Before considering a local test successful, verify all of these:

- `node --version` is 22.12+
- `npm install` succeeds
- `npm run check` succeeds
- `npm test` ends with zero failures
- `npm run build` succeeds
- `jazz_status` reports HTTP health `200`
- `jazz_list_tables` returns your published tables
- `jazz_query` can read rows
- with writes enabled on a test app, insert/update/delete succeeds
- after deletion, `jazz_get_row` returns no row

If Part A passes but Part B fails, the connector itself is probably installed correctly; troubleshoot your local server URL, app ID, admin secret, schema deployment, or MCP environment variables next.
