# Full snippet — Vite WASM runtime/E2E configuration

The extracted Inspector needs three details simultaneously:

1. Jazz's `buildJazzViteConfig()` for Jazz-specific aliases/optimizer behavior;
2. `vite-plugin-wasm` for the published package's WebAssembly ESM graph;
3. an extensionless **test runtime URL**, because Jazz transports that URL in the worker module query string and `vite-plugin-wasm@3.6.0` matches IDs using `endsWith(".wasm")`.

```ts
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import react from "@vitejs/plugin-react-swc";
import { buildJazzViteConfig } from "jazz-tools/dev/vite";
import { defineConfig, type Plugin, type UserConfig } from "vite";
import wasm from "vite-plugin-wasm";

const jazzRuntimeConfig = buildJazzViteConfig({});
const require = createRequire(import.meta.url);
const jazzToolsPackageRoot = dirname(require.resolve("jazz-tools/package.json"));
const jazzToolsRequire = createRequire(resolve(jazzToolsPackageRoot, "package.json"));
const jazzWasmEntry = jazzToolsRequire.resolve("jazz-wasm");
const jazzViteAliases = jazzRuntimeConfig.resolve?.alias ?? [];

const testWorkerAliases = [
  {
    find: /^@jazz-test-worker-entry$/,
    replacement: resolve(jazzToolsPackageRoot, "dist", "worker", "jazz-worker.js"),
  },
  {
    find: /^@jazz-test-broker-worker-entry$/,
    replacement: resolve(jazzToolsPackageRoot, "dist", "worker", "jazz-broker-worker.js"),
  },
];

// Deliberately no `.wasm` suffix: this URL is serialized into the worker
// module's query string. The response still has the correct WASM content type.
const testRuntimeFiles = new Map<string, { path: string; contentType: string }>([
  [
    "/__jazz/test-runtime",
    {
      path: resolve(dirname(jazzWasmEntry), "jazz_wasm_bg.wasm"),
      contentType: "application/wasm",
    },
  ],
]);

function inspectorBrowserTestRuntimePlugin(): Plugin {
  return {
    name: "inspector-browser-test-runtime",
    apply: "serve",
    configureServer(server) {
      for (const [urlPath, file] of testRuntimeFiles) {
        server.middlewares.use(urlPath, (_request, response, next) => {
          try {
            response.statusCode = 200;
            response.setHeader("Content-Type", file.contentType);
            response.setHeader("Cache-Control", "no-store");
            response.end(readFileSync(file.path));
          } catch (error) {
            next(error as Error);
          }
        });
      }
    },
  };
}

function createWasmPlugins() {
  return [wasm()];
}

const sharedConfig = {
  ...jazzRuntimeConfig,
  resolve: {
    ...(jazzRuntimeConfig.resolve ?? {}),
    alias: [...jazzViteAliases, ...testWorkerAliases],
  },
  worker: {
    ...(jazzRuntimeConfig.worker ?? {}),
    plugins: () => createWasmPlugins(),
  },
};

export default defineConfig(({ mode }): UserConfig => {
  const plugins = [inspectorBrowserTestRuntimePlugin(), ...createWasmPlugins(), react()];

  if (mode === "embedded") {
    return {
      ...sharedConfig,
      plugins,
      base: "./",
      build: {
        target: "esnext",
        outDir: "dist-embedded",
        emptyOutDir: true,
        rollupOptions: { input: { index: resolve(__dirname, "embedded.html") } },
      },
    };
  }

  return {
    ...sharedConfig,
    plugins,
    base: "/",
    publicDir: "public",
    build: {
      target: "esnext",
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
```

And the browser fixture must publish the same extensionless URL:

```ts
const TEST_WASM_URL = "/__jazz/test-runtime";

runtimeSources: {
  workerUrl: new URL(TEST_WORKER_URL, origin).href,
  brokerWorkerUrl: new URL(TEST_BROKER_WORKER_URL, origin).href,
  wasmUrl: new URL(TEST_WASM_URL, origin).href,
},
```
