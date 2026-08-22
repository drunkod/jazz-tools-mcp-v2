# Task 05 — Production security boundary

Priority: P0 before internet-exposed production use
Status: policy-independent BFF core implemented with fail-closed defaults; approved policy adapters and functional production acceptance remain unmet
Contract: [`../security-boundary.md`](../security-boundary.md)

## Goal

Replace browser possession of privileged Jazz admin credentials with a trusted server/session boundary.

## Subtasks

### T05.1 Threat model
- [x] List admin/backend secrets, app ID/schema metadata, schema/data, mutation capability, sessions, and audit records as assets.
- [x] Define developer/operator/production approver/end-user/compromised-session/browser/BFF actors.
- [x] Document that admin/backend access may bypass normal end-user permission policies.
- [x] Define dev/staging/prod app, secret, service identity, connection registry, and session/elevation isolation.

### T05.2 BFF/session boundary
- [x] Specify a concrete same-origin session, CSRF, connection-registry, query, mutation, elevation, and error API contract.
- [ ] Browser authenticates with operator session in an implemented BFF.
- [ ] Trusted backend authorizes every environment/table/action in runtime code.
- [ ] Admin/backend credential remains in server-side secret storage.
- [ ] Backend constructs or leases the privileged Jazz client from an allowlisted connection.
- [x] Deployable production browser artifact is proven to exclude direct Jazz modules, remove legacy secret state, and make no privileged network requests.

The deployable/Vercel artifact fails closed and contains no functional Inspector until the trusted BFF is connected to approved policy adapters. The policy-independent core now exists under `src/bff/`, but its default identity, authorization, elevation, and audit wiring remain fail-closed. The separate `dev`/`build:direct` admin-secret flow is development/operator tooling and is not accepted for internet-exposed production use.

### T05.3 Auditability
- [x] Define a versioned server-side audit event with operator, request, environment/app/schema/table/row identifiers, action, decision, outcome, reason, elevation, counts, and duration.
- [x] Prohibit logging credentials, session/CSRF/IdP tokens, mutation payloads, query results, and sensitive values by default.
- [x] Implement server-side audit emission hooks, default redaction, sanitized errors, and failure-path coverage.
- [ ] Configure the approved durable append-only audit sink, retention, access, classification, legal hold, and monitoring policy.

### T05.4 Least privilege
- [x] Contract separates `schema:read`, `data:read`, and `data:mutate` capabilities.
- [x] Contract requires a short-lived operator/session/connection-bound elevation for production mutation.
- [x] Implement deny-by-default capability checks and prove read-only operators cannot mutate in the adapter/router tests.
- [ ] Integrate the approved identity-provider re-authentication/elevation mechanism.

## Acceptance

No production-facing browser bundle stores, receives, or reconstructs a raw Jazz `adminSecret` or `backendSecret`.

**Current functional result: not accepted.** The policy-independent BFF core exists and is covered by fail-closed/router and in-memory Jazz tests, while the production artifact remains safely unavailable and excludes the direct Jazz graph. Only explicit local/operator direct mode accepts/stores `adminSecret`. Production Admin Inspector functionality remains disabled until the approved policy adapters and runtime acceptance gate in [`../security-boundary.md`](../security-boundary.md) are implemented and evidenced.

Only identity provider/role mapping, session/elevation lifetimes, audit retention/classification, deployment topology, and mutation atomicity/idempotency/limit choices are policy-dependent. The policy-independent BFF core is implemented; the approved production adapters and runtime evidence remain pending rather than broadly “blocked”.
