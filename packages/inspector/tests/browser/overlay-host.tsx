// Browser-test fixture for the NEW overlay model: a real host app connects to
// the test sync server, publishes the `window.__jazzInspectorHost` handle (the
// same shape the loader's installInspectorHost builds), pushes its active
// subscription list to the embedded inspector iframe, and the overlay opens its
// OWN worker connection from the published config. No devtools bridge.
//
// Exercised by overlay.spec.ts.
import { StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { JazzProvider, useAll, useJazzClient, useLocalFirstAuth } from "jazz-tools/react";
import { installInspectorHost, type DbConfig } from "jazz-tools";
import { app } from "./schema.js";

// Mirrors tests/browser/test-constants.ts (inlined: that module reads process.env).
const APP_ID = "00000000-0000-0000-0000-000000000099";
const TEST_ENV = "dev";
const TEST_BRANCH = "main";
const TEST_PORT = 19879;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_WORKER_URL = "/tests/browser/jazz-test-worker.ts";
const TEST_BROKER_WORKER_URL = "/tests/browser/jazz-test-broker-worker.ts";
// Intentionally extensionless. Jazz transports this URL in the worker module's
// query string; ending the value in `.wasm` makes vite-plugin-wasm misclassify
// the worker module ID as a WASM file.
const TEST_WASM_URL = "/__jazz/test-runtime";

function HostInner() {
  const { db } = useJazzClient();
  // A real query: creates the host client (so getRuntimeSchema resolves) and
  // registers a public subscription the overlay's Subscriptions tab should display.
  useAll(app.todos);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    // The real host-side installer: publishes the handle + pushes subscriptions.
    return installInspectorHost(db, iframeWindow, window.location.origin);
  }, [db]);

  return (
    <>
      <p id="host-status">Host ready</p>
      <iframe
        ref={iframeRef}
        title="jazz-inspector"
        // overlay.spec.ts serves dist-embedded/ at this path via a Playwright route.
        src="/__jazz/embedded/embedded.html"
        style={{ width: 900, height: 640, border: "1px solid #ccc" }}
      />
    </>
  );
}

function HostApp() {
  const { secret, isLoading } = useLocalFirstAuth();

  if (isLoading || !secret) {
    return <p id="host-status">Authenticating...</p>;
  }

  const origin = window.location.origin;
  const config: DbConfig = {
    appId: APP_ID,
    env: TEST_ENV,
    userBranch: TEST_BRANCH,
    serverUrl: SERVER_URL,
    secret,
    // Subscription traces are registered when subscribeAll() starts. The host
    // query mounts before installInspectorHost() can run its effect, so enable
    // dev mode at Db construction time to make this fixture deterministic and
    // test the same telemetry the overlay is designed to display.
    devMode: true,
    // Keep the Worker and SharedWorker on explicit same-origin Vite module URLs.
    // These tiny entry modules import the pinned jazz-tools worker files through
    // aliases in vite.config.ts, allowing Vite to transform their complete ESM
    // dependency graphs instead of serving one raw dist file.
    runtimeSources: {
      workerUrl: new URL(TEST_WORKER_URL, origin).href,
      brokerWorkerUrl: new URL(TEST_BROKER_WORKER_URL, origin).href,
      wasmUrl: new URL(TEST_WASM_URL, origin).href,
    },
  };

  return (
    <JazzProvider
      config={config}
      autoAttachDevTools={false}
      fallback={<p id="host-status">Connecting...</p>}
    >
      <HostInner />
    </JazzProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HostApp />
  </StrictMode>,
);
