# ST-006 — Trusted BFF/session boundary

Parent: Task 05
Priority: P0 before production exposure
Status: policy-independent BFF core implemented with fail-closed defaults; approved policy adapters and runtime acceptance pending
Contract: [`../security-boundary.md`](../security-boundary.md)

## Target topology

```text
browser
  | authenticated operator session
  v
trusted admin BFF
  | authorization + environment policy + audit
  v
backend-scoped Jazz client
  |
  v
Jazz sync server
```

## Defined contract

- [x] same-origin `/api/admin/v1` BFF with opaque HttpOnly session and CSRF/origin checks;
- [x] opaque server-resolved `connectionId`; browser cannot choose arbitrary server URLs or submit privileged credentials;
- [x] concrete session, connection, query, mutation, elevation, audit, and error envelopes;
- [x] separate `schema:read`, `data:read`, and `data:mutate` capabilities;
- [x] production mutation elevation bound to operator, session, connection, capability, reason, and expiry;
- [x] server-side privileged Jazz context construction/pooling constraints;
- [x] audit event schema and default payload/secret redaction rules;
- [x] explicit dev/staging/prod app, secret, service-identity, and session/elevation isolation.

## Immediate fail-closed mitigation

- [x] deployable production graph excludes `App.tsx`, `jazz-tools`, and `jazz-wasm`;
- [x] production startup removes legacy direct-connection storage and secret-bearing fragments;
- [x] production browser test proves no credential UI or privileged network traffic;
- [x] CI builds/tests direct, embedded, and production artifacts separately.

## Policy-independent core implemented

- [x] `src/bff/router.ts` mounts the `/api/admin/v1` session, connection, schema, query, mutation, and elevation handlers.
- [x] `src/bff/connection-registry.ts` resolves opaque connection IDs to server-only secret-bearing connector configs.
- [x] `src/bff/schemas.ts` enforces strict bounded envelopes and rejects `id`/`$` mutation fields.
- [x] `src/bff/ports.ts` supplies pluggable identity, authorization, elevation, and audit seams with deny-by-default implementations.
- [x] `src/bff/redaction.ts` allowlists audit fields and removes tokens, payloads, and row IDs by default.
- [x] Router tests cover unauthenticated/CSRF/authorization/stale-schema/least-privilege/secret non-leakage paths.
- [x] In-memory Jazz integration covers BFF insert/update/delete and generated row-ID reuse.
- [x] The root CI workflow runs a separate `bff` job; the production Inspector fail-closed guard remains unchanged.

## Runtime requirements still pending

- [ ] production admin/backend secret exists only in the approved production secret manager and is wired to the deployed service;
- [ ] browser authenticates using the approved operator identity/session implementation;
- [ ] approved backend authorizes environment/table/action on every production request;
- [ ] read-only and mutation roles are enforced by the approved role mapping;
- [ ] mutation attempts/outcomes reach the approved durable append-only audit sink;
- [ ] browser bundle/storage/responses/telemetry/logs are proven free of raw privileged secrets;
- [ ] approved audit storage redacts credentials, tokens, query results, and sensitive row payloads by default;
- [ ] production deployment topology, session/elevation lifetimes, and mutation limits/idempotency are approved and enforced;
- [ ] production mutation sessions require a valid short-lived elevation.

## Non-solutions

- localStorage obfuscation;
- hiding the input field;
- base64/encoding the secret;
- moving the same raw secret into another browser storage API.

## Policy inputs

Only the identity provider and role mapping, session/elevation lifetimes, audit retention/access/data classification, approved deployment topology, and mutation atomicity/idempotency/limits require product/security policy decisions. The rest of the BFF is pending implementation, not generically blocked.

## Acceptance

Compromising the static frontend bundle alone does not reveal a privileged Jazz admin/backend credential, and a browser cannot perform privileged Jazz operations except through an authenticated, authorized, audited BFF request.

**Current result: not accepted.** The policy-independent BFF core is implemented, but the standalone Inspector still supports direct browser `adminSecret` configuration in explicit development/direct builds, and the approved production identity, authorization, elevation, audit, and deployment adapters are not configured. Do not describe browser-secret handling or production Admin Inspector functionality as complete.
