# Jazz Admin Inspector implementation plan

This folder is the executable implementation plan for `packages/inspector`. It replaces the previous single large plan with reviewable tasks, atomic subtasks, and full implementation snippets.

## Product boundary

Keep the Jazz-native runtime path intact:

```text
stored WasmSchema
  -> runtime table discovery
  -> GenericQueryBuilder
  -> reactive useAll()
  -> react-data-grid
  -> Db.insert / Db.update / Db.delete
  -> Jazz sync
```

WhoDB is a UX/test-organization reference only. Do not transplant its SQL/GraphQL backend architecture into the Inspector.

## References reviewed

- `garden-co/jazz/packages/inspector`
- `garden-co/jazz/packages/jazz-tools/src/dev/vite.ts`
- `garden-co/jazz/docs/content/docs/reference/inspector.mdx`
- `garden-co/jazz/docs/content/docs/reference/mcp.mdx`
- `clidey/whodb/frontend`
- `clidey/whodb/frontend/src/pages/storage-unit`

Jazz's Inspector documentation treats `adminSecret` as backend/admin access that bypasses normal permission policies. It is infrastructure/operator access, not an end-user authentication model.

## Folder map

```text
docs/admin-inspector/
├── README.md
├── architecture.md
├── reviews/pr4.md
├── tasks/
│   ├── 00-pr4-merge-hardening.md
│   ├── 01-runtime-compatibility.md
│   ├── 02-admin-safety.md
│   ├── 03-navigation-and-data-explorer.md
│   ├── 04-realtime-and-agent-workflows.md
│   ├── 05-production-security.md
│   └── 06-upstream-sync.md
├── subtasks/
│   ├── ST-001-fix-vite-wasm-e2e.md
│   ├── ST-002-encode-runtime-routes.md
│   ├── ST-003-normalize-use-all.md
│   ├── ST-004-delete-confirmation.md
│   ├── ST-005-realtime-provenance.md
│   └── ST-006-bff-session-boundary.md
└── snippets/
    ├── vite-wasm-runtime.md
    ├── route-safety.md
    ├── use-all-normalizer.md
    ├── delete-confirmation.md
    ├── realtime-two-writer-playwright.md
    └── mcp-realtime-demo.md
```

## Execution order

1. PR #4 merge hardening: CI/WASM, runtime routes, compatibility boundary.
2. Admin mutation safety.
3. Navigation/Data Explorer ergonomics.
4. Realtime + agent workflows.
5. Production security boundary.
6. Ongoing upstream synchronization.

## PR #4 definition of done

- root MCP checks pass;
- Inspector unit tests pass;
- standalone + embedded builds pass;
- `build:vercel` creates `dist/index.html`;
- all Playwright tests pass, including embedded overlay and two-writer realtime;
- every runtime table route producer encodes the table segment;
- `useAll()` alpha/current compatibility is isolated in one tested helper;
- this folder is the canonical implementation plan.
