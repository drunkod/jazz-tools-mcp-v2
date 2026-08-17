# ST-006 — Trusted BFF/session boundary

Parent: Task 05
Priority: P0 before production exposure
Status: fail-closed production artifact and API/session/audit design complete; trusted BFF implementation pending
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

## Runtime requirements still pending

- [ ] production admin/backend secret exists only in server-side secret storage;
- [ ] browser authenticates using the approved operator identity/session implementation;
- [ ] backend authorizes environment/table/action on every request;
- [ ] read-only and mutation roles are enforced and tested;
- [ ] mutation attempts/outcomes are emitted to the approved audit sink;
- [ ] browser bundle/storage/responses/telemetry/logs are proven free of raw privileged secrets;
- [ ] logs redact credentials, tokens, query results, and sensitive row payloads by default;
- [ ] CSRF/session/elevation protections are implemented and fail-closed;
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

**Current result: not accepted.** The standalone Inspector still supports direct browser `adminSecret` configuration and no trusted BFF is implemented in this repository. Do not describe browser-secret handling as production-complete.
