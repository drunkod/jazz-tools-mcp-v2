# Nix development and local test runbook

This project includes a root `flake.nix` so you can get the required Node.js development environment with `nix develop`.

The flake supports:

- Apple Silicon macOS: `aarch64-darwin`
- Intel macOS: `x86_64-darwin`
- ARM64 Linux: `aarch64-linux`
- x86_64 Linux: `x86_64-linux`

It provides:

- Node.js 22
- npm
- pnpm
- Git
- curl
- CA certificates

The root MCP project requires Node.js 22.12 or newer. The vendored Jazz Admin Inspector also requires Node.js 22.12 or newer and uses `pnpm`.

## 1. Clone the repository

```bash
git clone https://github.com/kodyka/jazz-tools-mcp-v2.git
cd jazz-tools-mcp-v2
```

Until PR #1 is merged, check out the feature branch:

```bash
git fetch origin
git checkout feat/mvp-alpha-server-connector
git pull origin feat/mvp-alpha-server-connector
```

After PR #1 is merged, use `main`:

```bash
git checkout main
git pull origin main
```

## 2. Verify Nix

```bash
nix --version
```

On Apple Silicon you can also confirm the current Nix system:

```bash
nix eval --impure --raw --expr builtins.currentSystem
echo
```

Expected output on an Apple Silicon Mac:

```text
aarch64-darwin
```

Expected output on an Intel Mac:

```text
x86_64-darwin
```

## 3. Enter the development shell

From the repository root:

```bash
nix develop
```

The shell prints Node, npm, and pnpm versions plus the recommended verification commands.

Verify manually if desired:

```bash
node --version
npm --version
pnpm --version
```

## 4. Test the root MCP connector

Still inside the `nix develop` shell:

```bash
npm install --no-audit --no-fund
npm run check
npm test
npm run build
```

The integration test automatically:

1. starts an in-memory Jazz server through the official Jazz NAPI runtime;
2. deploys a test schema and permissions;
3. connects the MCP connector using the admin-secret path;
4. performs insert/query/update/delete;
5. shuts the temporary server down.

You do not need to configure an app ID or secret for this test.

Expected final test summary includes:

```text
fail 0
```

Verify the generated MCP entry point:

```bash
ls -la dist/index.js
```

## 5. Test the Jazz Admin Inspector

From the repository root, while still inside `nix develop`:

```bash
cd packages/inspector
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

The Inspector is a separate frontend package with its own `pnpm-lock.yaml`.

Expected results:

- Vitest unit tests pass;
- TypeScript build passes;
- standalone Vite build is produced;
- embedded Inspector build is produced.

## 6. Run the Jazz Admin Inspector locally

```bash
cd packages/inspector
pnpm dev
```

Open:

```text
http://localhost:5173
```

The standalone UI asks for:

```text
serverUrl
appId
adminSecret
env
branch
```

For a local self-hosted server, `serverUrl` is normally:

```text
http://127.0.0.1:1625
```

The current admin UI work is documented in:

```text
docs/admin-inspector-mvp-plan.md
```

## 7. Full MCP + realtime Inspector demo

Use three terminals.

### Terminal A — server

```bash
export JAZZ_APP_ID="replace-with-your-dev-app-id"
export JAZZ_ADMIN_SECRET="replace-with-your-dev-admin-secret"

npx --yes jazz-tools@alpha server "$JAZZ_APP_ID" \
  --port 1625 \
  --data-dir ./data \
  --admin-secret "$JAZZ_ADMIN_SECRET"
```

### Terminal B — Inspector

```bash
cd /path/to/jazz-tools-mcp-v2
nix develop
cd packages/inspector
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:5173` and connect to the app.

### Terminal C — MCP connector

```bash
cd /path/to/jazz-tools-mcp-v2
nix develop
npm install --no-audit --no-fund
npm run build

export JAZZ_SERVER_URL="http://127.0.0.1:1625"
export JAZZ_APP_ID="replace-with-your-dev-app-id"
export JAZZ_ADMIN_SECRET="replace-with-your-dev-admin-secret"
export JAZZ_MCP_ALLOW_WRITES="true"

npx --yes @modelcontextprotocol/inspector node ./dist/index.js
```

Call `jazz_insert`, `jazz_update`, and `jazz_delete` while the same table is visible in the browser. Jazz's reactive query should update the Inspector without a page refresh.

## 8. Leave the Nix shell

```bash
exit
```

## Fast path — MCP only

```bash
nix develop
npm install --no-audit --no-fund
npm run check
npm test
npm run build
exit
```

## Fast path — Inspector only

```bash
nix develop
cd packages/inspector
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

## One-command MCP verification

From the repository root:

```bash
nix develop -c bash -lc 'npm install --no-audit --no-fund && npm run check && npm test && npm run build'
```

If `node_modules` already exists and you only want to run the tests:

```bash
nix develop -c npm test
```

## One-command Inspector verification

From the repository root:

```bash
nix develop -c bash -lc 'cd packages/inspector && pnpm install --frozen-lockfile && pnpm test && pnpm build'
```

## If flakes are not enabled in your Nix installation

Most current Nix installations enable flakes, but if `nix develop` reports that `nix-command` or `flakes` are experimental features, run:

```bash
nix --extra-experimental-features 'nix-command flakes' develop
```

The equivalent one-command MCP test is:

```bash
nix --extra-experimental-features 'nix-command flakes' develop -c bash -lc 'npm install --no-audit --no-fund && npm run check && npm test && npm run build'
```

## Updating the Nix input

The flake currently follows `NixOS/nixpkgs` `nixos-unstable`.

If a `flake.lock` exists and you want to update it:

```bash
nix flake update
```

Then re-enter the environment:

```bash
nix develop
```

## Manual MCP Inspector test

For the complete root MCP connector workflow, also see:

```text
docs/local-testing-runbook.md
```

That guide covers starting `jazz-tools@alpha server`, deploying your own Jazz schema, launching MCP Inspector, and manually exercising the read/write MCP tools.
