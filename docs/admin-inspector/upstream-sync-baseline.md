# Upstream sync baseline and discipline

Status: baseline recorded
Baseline date: 2026-08-17

## Recorded baseline

| Item | Baseline |
| --- | --- |
| Official source repository | [`garden-co/jazz`](https://github.com/garden-co/jazz) |
| Official source commit reviewed | `fa7d33b3ecfc9fcb673cd7c7bb9c35d700255e1d` |
| Upstream subtree | `packages/inspector` |
| Related upstream surfaces | `packages/jazz-tools/src/dev/vite.ts`, Inspector docs, MCP docs |
| Published runtime used by this package | `jazz-tools@2.0.0-alpha.53` |
| Published version evidence | `packages/inspector/pnpm-lock.yaml` importer entry |
| Local Inspector import commit | `afa52bf9d673522d9df50e516fec0f949a112fb6` |
| Local repository baseline at record time | `c28502286abc324e8feea97ecbaa7d036274ae59` |
| Local package | `packages/inspector` |

The official source commit and published package version are separate coordinates. Never infer that an npm `alpha` tag still points to the recorded version, and never replace the source commit with only a package version. The repository's root README independently records the same Jazz `2.0.0-alpha.53` / `fa7d33b…` research snapshot.

This record identifies the comparison baseline; it does not claim every local file is a byte-for-byte copy from that commit. The product fork has local UI, compatibility, test, and deployment changes.

## Attribution and license

`packages/inspector` is a product-oriented fork/derivative of the official Jazz Inspector. Upstream project and path:

- Jazz: <https://github.com/garden-co/jazz>
- Inspector source: `packages/inspector`
- Published `jazz-tools@2.0.0-alpha.53` package metadata: MIT

Preserve upstream copyright/license headers when present. When copying a new upstream file, record its source path and commit in the sync record and carry its applicable license notice. Do not overwrite the repository's own MIT license or imply that local contributors authored upstream work. Re-check the upstream repository/file license on every sync rather than assuming it can never change.

WhoDB is currently a UX and test-organization reference only; no WhoDB backend code is part of the Jazz runtime path. Any future code-level borrowing requires a separately recorded source URL, commit, license review, and attribution before the code enters this repository.

## Product delta boundary

Prefer local product work in:

- layout, navigation, Data Explorer shell, and styles;
- accessibility and browser acceptance tests;
- small, named compatibility utilities with removal conditions;
- standalone connection/deployment integration;
- security-boundary and operator runbooks.

Treat these as high-conflict/high-risk upstream surfaces and avoid divergence unless necessary:

- generic query construction and row parsing;
- schema catalogue/fetch internals;
- Jazz runtime, worker, broker, and WASM initialization;
- relation semantics and mutation primitives;
- `TableDataGrid` behavior that upstream has changed.

A local workaround around an alpha API must identify the upstream/published-version difference, have a focused test, and state when it can be removed.

## Sync record template

Create a dated section or companion record for every sync:

```md
## YYYY-MM-DD sync

- previous Jazz source commit: `<sha>`
- target Jazz source commit: `<sha>`
- previous published `jazz-tools`: `<version>`
- target published `jazz-tools`: `<version>`
- upstream comparison URL: `https://github.com/garden-co/jazz/compare/<old>...<new>`
- local base commit: `<sha>`
- upstream files reviewed: ...
- local product-delta files affected: ...
- compatibility shims added/removed: ...
- attribution/license changes: ...
- validation: commands + results
- deferred conflicts: owner + reason
```

Do not call a moving branch, tag, or npm dist-tag the baseline. Resolve it to immutable commit/version coordinates.

## Comparison and upgrade checklist

### 1. Prepare immutable inputs

- [ ] Fetch the official `garden-co/jazz` repository without changing this repository's `upstream` remote (that remote currently points to the original `jazz-tools-mcp-v2` fork, not Jazz).
- [ ] Resolve old and target Jazz refs to full commit SHAs.
- [ ] Record old and target published `jazz-tools` versions separately.
- [ ] Read upstream release notes/migrations and compare package peer/runtime requirements.
- [ ] Confirm license and attribution for every newly copied file.

A disposable clone/worktree is preferred. Do not vendor upstream `.git` state into this repository.

### 2. Compare upstream surfaces

- [ ] Diff `packages/inspector` from the recorded source commit to the target source commit.
- [ ] Review `TableDataGrid` query shape, pagination, filters, sorting, provenance, relations, CRUD, optimistic/realtime behavior, and reduced-motion behavior.
- [ ] Review Inspector routes and runtime-table encoding.
- [ ] Review `packages/jazz-tools/src/dev/vite.ts`, worker URLs/formats, WASM transforms, optimizer exclusions, aliases, and embedded overlay host contract.
- [ ] Review schema catalogue APIs, stored schema types, `useAll()` result shape, backend context/authentication, mutation return types, and durability semantics.
- [ ] Review official Inspector/MCP/security documentation for credential and permission-boundary changes.
- [ ] Identify upstream fixes already represented by local patches; prefer upstream behavior and delete redundant local code.

Useful comparison commands after obtaining a separate Jazz checkout at `<JAZZ_CHECKOUT>`:

```sh
git -C <JAZZ_CHECKOUT> rev-parse HEAD
git -C <JAZZ_CHECKOUT> diff --stat <OLD_JAZZ_SHA>..<NEW_JAZZ_SHA> -- packages/inspector packages/jazz-tools/src/dev/vite.ts
git -C <JAZZ_CHECKOUT> diff <OLD_JAZZ_SHA>..<NEW_JAZZ_SHA> -- packages/inspector packages/jazz-tools/src/dev/vite.ts
git diff --no-index <JAZZ_CHECKOUT>/packages/inspector packages/inspector
```

`git diff --no-index` returns status 1 when differences exist; that is expected during comparison.

### 3. Reconcile deliberately

- [ ] Classify each delta as upstream adoption, intentional product delta, compatibility shim, or deferred conflict.
- [ ] Port the smallest coherent upstream changes; do not wholesale overwrite product-owned files.
- [ ] Keep Jazz-native query/mutation/runtime behavior authoritative.
- [ ] Update dependency specifiers and lockfile together; record the resolved version.
- [ ] Re-evaluate every compatibility shim and remove it when the target runtime makes it unnecessary.
- [ ] Update tests, docs, attribution, and the sync record in the same change.

### 4. Validate from focused to broad

From `packages/inspector`:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm build:vercel
pnpm test:browser
```

From the repository root:

```sh
npm install --no-audit --no-fund
npm run check
npm test
npm run build
```

Also verify:

- [ ] `dist/index.html` exists after `build:vercel`;
- [ ] standalone and embedded Inspector modes both build;
- [ ] browser E2E includes the required two-writer no-refresh test;
- [ ] a runtime table containing route-significant characters opens successfully;
- [ ] no browser production path newly receives an admin/backend secret;
- [ ] CI workflow and required branch check still execute the browser suite.

### 5. Close the sync

- [ ] Record exact commands/results and any known unrelated failures.
- [ ] Record deferred conflicts with an owner; do not silently drop upstream behavior.
- [ ] Update the baseline table to the new source commit, published version, local base, and date only after reconciliation and validation.
- [ ] Review the final diff for accidental generated files, upstream `.git` data, or unrelated product changes.

## WhoDB reference discipline

For each WhoDB-inspired change:

1. Name the exact UX behavior (for example, searchable object navigation), not “make it like WhoDB.”
2. Record the reference URL and immutable source commit in the change/plan.
3. Confirm whether the work is observation/reimplementation or code borrowing. Code borrowing requires license review and attribution.
4. Reimplement data access with Jazz runtime schema discovery, `GenericQueryBuilder`, reactive `useAll()`, and Jazz `Db` mutations.
5. Add Jazz-specific acceptance proving permissions/admin boundary, reactive updates, runtime table names, and/or relations as applicable.
6. Reject SQL/GraphQL assumptions: no database DSN, SQL parser, REST CRUD bridge, SQL pagination/count semantics, or WhoDB backend adapters.
7. Re-check whether official Jazz Inspector now supplies the behavior before maintaining a local version.

The governing rule is: WhoDB may inform interaction design; Jazz defines data, permissions, identity, sync, query, mutation, and runtime architecture.
