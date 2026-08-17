import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const distDirectory = resolve(packageRoot, "dist");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nestedFiles.flat();
}

test("production artifact excludes the direct Jazz Inspector graph", async () => {
  const files = await listFiles(distDirectory);
  const textFiles = files.filter((file) => [".css", ".html", ".js"].includes(extname(file)));
  const artifactText = (
    await Promise.all(textFiles.map((file) => readFile(file, "utf8")))
  ).join("\n");

  assert.match(artifactText, /Inspector unavailable in production/);
  assert.match(artifactText, /backend-for-frontend/);
  assert.equal(files.some((file) => extname(file) === ".wasm"), false);

  for (const forbiddenMarker of [
    "Connect to Jazz server",
    "Admin secret",
    "adminSecret",
    "https://v2.sync.jazz.tools/",
    "createJazzClient",
    "JazzClientProvider",
    "fetchSchemaHashes",
    "fetchStoredWasmSchema",
    "jazz-tools",
    "jazz-wasm",
  ]) {
    assert.doesNotMatch(artifactText, new RegExp(forbiddenMarker), forbiddenMarker);
  }
});
