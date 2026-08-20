# Task 00 — PR #4 merge hardening

Priority: P0
Status: complete

## Goal

Make PR #4 mergeable with a passing end-to-end Inspector gate and track the remaining correctness/maintenance cleanup discovered in review.

## Subtasks

### T00.1 Fix embedded Vite/WASM E2E
- [x] Identify failing browser job and exact Vite WASM error.
- [x] Preserve Jazz `buildJazzViteConfig()`.
- [x] Add `vite-plugin-wasm` to the dev graph.
- [x] Add fresh WASM plugin instances via `worker.plugins`.
- [x] Use `build.target = "esnext"` instead of the incompatible top-level-await SWC rewrite.
- [x] Avoid worker-module misclassification by using an extensionless explicit test WASM URL.
- [x] Assert the actual overlay host contract.
- [x] Enable fixture dev telemetry before the first host query subscribes.
- [x] Confirm final CI standalone/embedded builds pass.
- [x] Confirm final CI embedded overlay passes.

### T00.2 Encode every runtime table route — complete
- [x] Sidebar data/schema routes encoded.
- [x] Relation-navigation route encoded.
- [x] Stale-table redirect encoded.
- [x] Add shared `tableViewPath()` helper.
- [x] Live Query `buildExplorerUrl()` uses the shared encoded path helper.
- [x] Add special-character helper regression coverage.
- [x] Grid toolbar Schema link uses the shared encoded helper.
- [x] Add grid component regression for the Schema link.
- [x] Add browser coverage for a route-significant runtime table name.

### T00.3 Isolate `useAll()` compatibility — complete
- [x] Add `normalizeUseAllResult()` utility.
- [x] Cover legacy array, legacy undefined, current structured, and impossible shapes.
- [x] Use helper in main grid query.
- [x] Use helper in relation query.
- [x] Preserve structured query errors and stable empty data.
- [x] Document removal condition when the pinned Jazz alpha no longer needs compatibility.

### T00.4 Final merge gate
- [x] root `npm run check && npm test && npm run build`.
- [x] Inspector `pnpm test`.
- [x] Inspector `pnpm build` — standalone + embedded.
- [x] `pnpm build:vercel` and output verification.
- [x] `pnpm test:browser` — 13/13.

P0 runtime hardening was first proven fully green in CI run #73 on commit `96ba2c4aa291997a64a5b9dd512e3bd99681d967`.

The route-helper implementation and special-character unit coverage were then validated by **final-head CI run #78** on commit `705e38ebb229dd1b06f9d4d521932490e0bfe341`: both root and Inspector jobs completed successfully, including the full browser E2E suite.

Continuation branch validation on 2026-08-17:

- root check/build and integration tests: 9/9 passed;
- Inspector unit suite: 121/121 passed;
- TypeScript: passed;
- direct, embedded, and fail-closed production builds: passed;
- production artifact exclusion test: 1/1 passed;
- direct/embedded browser E2E: 14/14 passed;
- fail-closed production browser security test: 1/1 passed.

## Acceptance

The original P0 merge blocker is resolved. The continuation branch completes the tracked P1 route and `useAll()` compatibility cleanup with component/browser regressions while preserving the historical PR #4 CI evidence above.
