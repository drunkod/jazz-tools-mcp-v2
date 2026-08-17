// Browser E2E SharedWorker entry. The alias is provided by vite.config.ts and
// points at the broker worker shipped by the pinned jazz-tools package. Running
// it through Vite guarantees a same-origin transformed module URL shared by the
// host and embedded Inspector.
import "@jazz-test-broker-worker-entry";
