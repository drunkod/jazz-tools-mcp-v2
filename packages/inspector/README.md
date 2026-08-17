# Jazz Admin Inspector

This package is a product-oriented fork of the official Jazz v2 Inspector. It keeps the Inspector's Jazz-native runtime schema discovery, reactive queries, relations, schema view, and generic CRUD behavior while evolving the standalone UI into a simple database admin application.

Primary UX reference for the MVP: **WhoDB** — especially searchable database-object navigation, compact database-admin chrome, obvious CRUD entry points, and schema access. The Jazz data/query/mutation architecture remains the source of truth.

See the full implementation plan:

```text
../../docs/admin-inspector-mvp-plan.md
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

> The standalone admin-secret flow is privileged developer/operator access. Do not treat browser-stored admin credentials as the final architecture for an internet-exposed production admin product. The production hardening plan is documented in `docs/admin-inspector-mvp-plan.md`.

## Realtime MCP demo

A useful end-to-end demo is to leave a table open in this UI and mutate the same Jazz database with the root MCP connector.

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

Build both standalone and embedded variants:

```sh
pnpm build
```

Browser E2E:

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

## Building the Inspector

The package provides standalone web and embedded builds.

Standalone web app:

```sh
cd packages/inspector
pnpm build:web
```

Embedded inspector:

```sh
cd packages/inspector
pnpm build:embedded
```

Full build:

```sh
pnpm build
```

The Jazz Vite and SvelteKit development integrations can serve the embedded Inspector as an in-app overlay. Product-oriented shell changes should continue to preserve embedded mode unless a change is explicitly scoped to standalone mode.
