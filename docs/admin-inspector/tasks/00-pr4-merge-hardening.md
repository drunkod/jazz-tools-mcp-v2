# Task 00 — PR #4 merge hardening

Priority: P0
Status: P0 complete; P1 cleanup partially implemented

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

### T00.2 Encode every runtime table route — P1 partially implemented
- [x] Sidebar data/schema routes encoded.
- [x] Relation-navigation route encoded.
- [x] Stale-table redirect encoded.
- [x] Add shared `tableViewPath()` helper.
- [x] Live Query `buildExplorerUrl()` uses the shared encoded path helper.
- [x] Add special-character helper regression coverage.
- [ ] Grid toolbar Schema link uses the shared encoded helper.
- [ ] Add grid component regression for the Schema link.

### T00.3 Isolate `useAll()` compatibility — P1 follow-up
- [ ] Add `normalizeUseAllResult()` utility.
- [ ] Cover legacy array, legacy undefined, and current structured shapes.
- [ ] Use helper in main grid query.
- [ ] Use helper in relation query.
- [ ] Document removal condition when the pinned Jazz alpha no longer needs compatibility.

### T00.4 Final merge gate
- [x] root `npm run check && npm test && npm run build`.
- [x] Inspector `pnpm test`.
- [x] Inspector `pnpm build` — standalone + embedded.
- [x] `pnpm build:vercel` and output verification.
- [x] `pnpm test:browser` — 13/13.

P0 runtime hardening was first proven fully green in CI run #73 on commit `96ba2c4aa291997a64a5b9dd512e3bd99681d967`.

The route-helper implementation and special-character unit coverage were then validated by **final-head CI run #78** on commit `705e38ebb229dd1b06f9d4d521932490e0bfe341`: both root and Inspector jobs completed successfully, including the full browser E2E suite.

## Acceptance

The P0 merge blocker is resolved and the current implementation head has a green required CI gate. The Live Query route gap is fixed. The remaining grid-route and `useAll()` normalization work stays explicitly tracked as P1 cleanup rather than being silently folded into the completed P0 claim.
