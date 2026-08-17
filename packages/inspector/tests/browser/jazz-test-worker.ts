// Browser E2E worker entry. The alias is provided by vite.config.ts and points
// at the dedicated worker shipped by the pinned jazz-tools package. Keeping the
// entry inside the Vite module graph lets Vite transform the worker's relative
// imports and dynamic jazz-wasm import instead of serving one raw dist file.
import "@jazz-test-worker-entry";
