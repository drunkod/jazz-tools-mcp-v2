# PR #4 review — merge hardening

PR: `#4 feat: add Jazz Admin Inspector plan and WhoDB-inspired shell`

## Verdict

The core architecture is correct: retain runtime schema discovery, generic Jazz queries, reactive reads, and Jazz mutations. WhoDB should influence navigation density, CRUD discoverability, destructive-action UX, schema access, and test organization—not the backend data layer.

The P0 embedded runtime/CI blocker was resolved in PR #4. The continuation branch completes all tracked P1 runtime-route and alpha/current `useAll()` compatibility work, adds admin-safety/navigation/realtime regressions, and introduces a fail-closed deployable artifact so direct browser credentials remain limited to explicit local/operator builds.

The implementation head `705e38ebb229dd1b06f9d4d521932490e0bfe341` passed final-head CI run #78.

## CI evidence reviewed

### Baseline
- root MCP passed;
- Inspector unit tests: 84 passed;
- TypeScript/build passed;
- Vercel build passed;
- Playwright: 12 passed, 1 failed because Vite did not transform WebAssembly ESM in the embedded worker graph.

### Run #68 — top-level-await plugin incompatibility
- Inspector unit tests: 84 passed;
- `pnpm build` failed inside `vite-plugin-top-level-await` SWC printing with `missing field type`.

Resolution: keep `vite-plugin-wasm`, remove the active TLA rewrite, and target `esnext` so the generated top-level await remains native.

### Run #69 — worker URL falsely classified as WASM
- root MCP passed;
- Inspector unit tests: 84 passed;
- standalone and embedded builds passed;
- Vercel build passed;
- Playwright again reached 12/13;
- the original unsupported-WASM error was gone;
- `vite-plugin-wasm@3.6.0` misclassified the worker module URL because its `jazz-wasm-url` query value ended in `.wasm`.

Resolution: serve the real test binary from extensionless `/__jazz/test-runtime` with `Content-Type: application/wasm`.

### Run #70 — runtime fixed, stale broker assertion
- all pre-browser gates passed;
- the host reached `Host ready`;
- the prior WASM/worker errors were gone;
- only a stale expectation for `/__jazz/test-broker-worker.js` failed while the fixture correctly used `/tests/browser/jazz-test-broker-worker.ts`.

Resolution: assert the configured Vite module worker URL.

### Run #71 — non-contract `wasmUrl` assertion
- embedded connection progressed further;
- the test expected `getConnectionConfig().runtimeSources.wasmUrl` to be present.

Upstream Jazz's `buildOverlayDbConfig()` intentionally republishes the resolved persistent-store/broker coordinates and not the host's WASM URL. The test was asserting an implementation detail outside the public host contract.

Resolution: assert `brokerWorkerUrl`, then prove connection/schema behavior through the embedded UI.

### Run #72 — subscription trace timing
- root job passed completely;
- Inspector unit/build/Vercel gates passed;
- embedded Inspector connected and discovered `todos`;
- Subscriptions page remained empty.

Jazz records an active-query trace when the subscription starts only if `DbConfig.devMode` is already true. The test's `useAll(app.todos)` mounted before `installInspectorHost()` could set dev mode in an effect.

Resolution: initialize the browser test host with `devMode: true` before `JazzProvider` creates the query subscription.

### Run #73 — completed P0 runtime gate
Commit: `96ba2c4aa291997a64a5b9dd512e3bd99681d967`

- root `npm run check`: passed;
- root `npm test`: passed;
- root `npm run build`: passed;
- Inspector `pnpm test`: 84/84 passed;
- standalone + embedded build: passed;
- Vercel build + `dist/index.html` verification: passed;
- Chromium installation: passed;
- Playwright browser E2E: 13/13 passed.

### Run #78 — final-head route-helper gate
Commit: `705e38ebb229dd1b06f9d4d521932490e0bfe341`

- root check/test/build: passed;
- Inspector unit tests including the new route-path regression: passed;
- standalone + embedded build: passed;
- Vercel verification: passed;
- Chromium installation: passed;
- browser E2E: passed;
- both required CI jobs concluded successfully.

## Bugs fixed in the P0 hardening chain

1. Missing WebAssembly ESM transform for the extracted published-package worker graph.
2. Incompatible top-level-await rewrite plugin in the Jazz worker build path.
3. `.wasm` query-value false positive in `vite-plugin-wasm` module matching.
4. Stale broker-worker URL assertion.
5. Test asserting a non-contract overlay `wasmUrl` field.
6. Browser fixture enabling DevTools telemetry after its first query subscription had already registered.

## P1 route finding — completed on the continuation branch

The review found two raw runtime table path producers after the earlier sidebar/relation fixes.

### Fixed: Live Query

Previously:

```ts
const base = `/data-explorer/${table}/data`;
```

Now:

```ts
const base = tableViewPath(table, "data");
```

with:

```ts
export function tableViewPath(tableName: string, view: "data" | "schema"): string {
  return `/data-explorer/${encodeURIComponent(tableName)}/${view}`;
}
```

Unit coverage includes slash, hash, query, percent, whitespace, and ordinary table names.

### Fixed: `TableDataGrid` toolbar Schema link

The toolbar, sidebar, relation, schema-back, stale-table, and Live Query producers now call `tableViewPath()`. Component regressions cover the combined name `todos/archived #1`, and browser E2E opens `reports/ready ?#%` through the encoded route. See ST-002.

## Completed P1 — centralized `useAll()` compatibility

The extracted fork supports the published alpha's legacy array/undefined result shape while tolerating current Jazz's structured `{ data,isLoading,error }` state through one tested `normalizeUseAllResult()` utility. Main-grid and relation-cell queries now consume the same normalized shape; structured errors remain visible without clearing cached rows, empty legacy data uses a stable reference, and impossible shapes produce actionable diagnostics. See ST-003 and `snippets/use-all-normalizer.md`.

## Upstream Jazz double-check

Current upstream Inspector uses structured `useAll()` state. Jazz's `buildJazzViteConfig()` handles worker format, `jazz-wasm` optimizer exclusion, SSR externalization, and alias resolution; the extracted published-package setup still needs its consumer-side WASM transform.

The upstream overlay host contract documents a ready-to-use config built from host identity plus resolved persistent-store/broker coordinates. The overlay receives and uses that config verbatim; it is not required to receive the host's explicit WASM URL.

## WhoDB double-check

WhoDB remains a UX/testing reference: database-object navigation, searchable/dense exploration, obvious CRUD actions, typed filters, schema access, and E2E organization. None of those require adopting WhoDB's GraphQL/SQL source architecture.

## Merge gate

Final-head run #78 is green. Browser E2E remains mandatory on future heads because unit tests cannot validate the published worker/WASM/embedded runtime path or two-writer realtime behavior.
