# Jazz Admin Inspector

This package is a product-oriented fork of the official Jazz v2 Inspector. It keeps the Inspector's Jazz-native runtime schema discovery, reactive queries, relations, schema view, and generic CRUD behavior while evolving the standalone UI into a simple database admin application.

Primary UX reference for the MVP: **WhoDB** — especially searchable database-object navigation, compact database-admin chrome, obvious CRUD entry points, and schema access. The Jazz data/query/mutation architecture remains the source of truth.

See the full implementation plan:

```text
../../docs/admin-inspector/README.md
```

## What already works

- connect to a Jazz sync server/app;
- select a published schema version;
- discover tables dynamically from the Jazz runtime schema;
- search the table navigator;
- browse rows reactively;
- see externally-created/changed/deleted rows update without page refresh;
- filter, sort, paginate, and customize columns;
- insert rows;
- edit cells;
- stage/delete rows;
- save or discard queued mutations;
- inspect schema and navigate relations;
- expose Jazz provenance columns such as `$createdAt`, `$createdBy`, `$updatedAt`, and `$updatedBy`.

## Nix / macOS quick start

From the repository root:

```sh
nix develop
cd packages/inspector
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

Then open `http://localhost:5173`.

## Running the Inspector in standalone mode

You can run the Inspector as a regular web app that connects to a Jazz sync server.

```sh
cd packages/inspector
pnpm dev
```

Then open `http://localhost:5173` in your browser (Vite's default dev server port).

First-time configuration:

- **serverUrl**: base URL of your Jazz server, for example `http://127.0.0.1:1625`.
- **appId**: the Jazz app identifier you want to inspect.
- **adminSecret**: admin secret for that app.
- **env**: environment name, for example `dev`, `staging`, `prod`; defaults to `dev`.
- **branch**: logical branch name; defaults to `main`.

The Inspector derives app-scoped endpoints automatically from `serverUrl` and `appId`, so there is no separate path-prefix setting.

> The standalone admin-secret flow is privileged developer/operator access. It does not meet production acceptance for an internet-exposed admin product. The required trusted BFF/session boundary and current unmet gate are documented in [`../../docs/admin-inspector/security-boundary.md`](../../docs/admin-inspector/security-boundary.md).

## Realtime MCP demo

A useful end-to-end demo is to leave a table open in this UI and mutate the same Jazz database with the root MCP connector. The commands below are a quick start; the canonical runbook with exact registered tool names, returned-ID handling, provenance checks, and forward/reverse no-refresh acceptance is [`../../docs/admin-inspector/snippets/mcp-realtime-demo.md`](../../docs/admin-inspector/snippets/mcp-realtime-demo.md).

Terminal 1:

```sh
npx --yes jazz-tools@alpha server "$JAZZ_APP_ID" \
  --port 1625 \
  --data-dir ./data \
  --admin-secret "$JAZZ_ADMIN_SECRET"
```

Terminal 2:

```sh
nix develop
cd packages/inspector
pnpm dev
```

Terminal 3, from the repository root:

```sh
nix develop
npm run build
export JAZZ_SERVER_URL="http://127.0.0.1:1625"
export JAZZ_MCP_ALLOW_WRITES="true"
npx --yes @modelcontextprotocol/inspector node ./dist/index.js
```

Use `jazz_insert`, `jazz_update`, or `jazz_delete` and watch the corresponding table update reactively in the browser.

## Testing

Unit tests:

```sh
cd packages/inspector
pnpm install --frozen-lockfile
pnpm test
```

Build the trusted direct, embedded, and fail-closed production variants:

```sh
pnpm build
```

Browser E2E:

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

## Building the Inspector

The package intentionally separates privileged direct tooling from the deployable production artifact.

Trusted direct standalone app for local/operator use:

```sh
cd packages/inspector
pnpm build:direct
# output: dist-direct/index.html
```

Embedded development Inspector:

```sh
pnpm build:embedded
# output: dist-embedded/embedded.html
```

Fail-closed deployable/Vercel artifact:

```sh
pnpm build:production
pnpm test:production-build
# output: dist/index.html
```

Until the authenticated BFF is implemented, the production artifact only displays an unavailable message. Its build graph rejects `App.tsx`, `jazz-tools`, and `jazz-wasm`, clears legacy direct-connection state, and exposes no admin-secret flow.

Full typecheck and all three builds:

```sh
pnpm build
```

Production browser security gate:

```sh
pnpm test:browser:production
```

The Jazz Vite and SvelteKit development integrations can serve the embedded Inspector as an in-app overlay. Product-oriented shell changes should continue to preserve embedded mode unless a change is explicitly scoped to standalone mode.
