# ST-001 — Fix Vite WASM browser E2E

Parent: Task 00
Priority: P0
Status: complete

## Failure sequence and fixes

### Baseline

The Inspector unit/build/Vercel gates passed, but `pnpm test:browser` stopped at 12/13 because the embedded overlay host could not load Jazz's published worker/WASM graph. Vite rejected WebAssembly ESM integration before the host became ready.

### Iteration 1 — missing WASM transform

We first installed both `vite-plugin-wasm` and `vite-plugin-top-level-await` in the Vite main/worker graphs. That removed the original design gap but CI run #68 failed earlier during `pnpm build`: the top-level-await plugin crashed in its SWC print step with `missing field type`.

### Iteration 2 — native top-level await

The revised configuration keeps `vite-plugin-wasm`, removes the active top-level-await rewrite, and sets standalone/embedded build targets to `esnext`. This preserved native top-level await and cleared unit/build/Vercel gates.

CI run #69 then exposed a second runtime edge: Jazz transports `runtimeSources.wasmUrl` in the worker module query string, while `vite-plugin-wasm@3.6.0` checks module IDs with `id.endsWith(".wasm")`. A worker URL such as:

```text
/tests/browser/jazz-test-worker.ts?jazz-wasm-url=.../__jazz/test-runtime.wasm
```

was therefore misclassified as a local WASM module and failed with ENOENT.

### Iteration 3 — extensionless explicit runtime URL

The test fixture now serves the same real `jazz_wasm_bg.wasm` bytes from:

```text
/__jazz/test-runtime
```

with `Content-Type: application/wasm`. Jazz still receives an explicit WASM URL, but the worker module ID no longer ends in `.wasm`.

CI run #70 proved the original runtime issue was gone: the host reached `Host ready`. The remaining failure was only a stale broker-worker URL assertion.

### Iteration 4 — assert the actual host contract

The fixture publishes `/tests/browser/jazz-test-broker-worker.ts`. The stale `/__jazz/test-broker-worker.js` expectation was corrected.

CI run #71 then showed `getConnectionConfig().runtimeSources.wasmUrl` is intentionally absent. Upstream Jazz confirms the host bridge republishes the resolved persistent-store/broker coordinates, not the host's WASM URL. The test now asserts the public `brokerWorkerUrl` contract and then proves behavior through embedded connection/schema/subscriptions.

### Iteration 5 — enable tracing before the host subscription starts

CI run #72 connected successfully and discovered the `todos` table, but the Subscriptions page remained empty. Jazz registers an active-query trace only when `DbConfig.devMode` is already true at subscription registration time. In the fixture, `useAll(app.todos)` mounted before `installInspectorHost()` could call `db.setDevMode(true)` in an effect.

The browser fixture now constructs the host `Db` with:

```ts
const config: DbConfig = {
  // ...
  devMode: true,
};
```

This changes only test-fixture initialization; production tracing semantics are unchanged.

## Final verification — CI run #73

Commit: `96ba2c4aa291997a64a5b9dd512e3bd99681d967`

- [x] root `npm run check`;
- [x] root `npm test`;
- [x] root `npm run build`;
- [x] Inspector `pnpm test` — 84/84;
- [x] standalone + embedded `pnpm build`;
- [x] `pnpm build:vercel` and `dist/index.html` verification;
- [x] Chromium install;
- [x] `pnpm test:browser` — 13/13.

## Implementation checklist

- [x] preserve Jazz `buildJazzViteConfig()` aliases/optimizer behavior;
- [x] apply `vite-plugin-wasm` to the normal Vite graph;
- [x] apply fresh `vite-plugin-wasm` instances via `worker.plugins`;
- [x] set standalone and embedded build target to `esnext`;
- [x] remove `vite-plugin-top-level-await` from the active plugin graph;
- [x] serve the test runtime WASM from an extensionless URL with the correct content type;
- [x] assert the public overlay host `brokerWorkerUrl` contract rather than a non-contract `wasmUrl` field;
- [x] enable dev telemetry before the fixture's first host subscription;
- [x] keep the real embedded/worker path enabled;
- [x] pass the full browser suite.

## Acceptance

Complete. The standalone/embedded builds and all 13 browser tests pass without disabling the embedded test, bypassing Jazz workers, or adding a second runtime/data architecture.
