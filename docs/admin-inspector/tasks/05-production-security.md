# Task 05 — Production security boundary

Priority: P0 before internet-exposed production use

## Goal

Replace browser possession of privileged Jazz admin credentials with a trusted server/session boundary.

## Subtasks

### T05.1 Threat model
- [ ] List admin secret, app ID, schema/data, mutation capability as assets.
- [ ] Define developer/operator/end-user/compromised-session actors.
- [ ] Document that admin access bypasses normal permission policies.
- [ ] Define dev/staging/prod isolation.

### T05.2 BFF/session boundary
- [ ] Browser authenticates with operator session.
- [ ] Trusted backend authorizes admin action.
- [ ] Admin credential remains server-side.
- [ ] Backend constructs privileged Jazz client.
- [ ] Browser never receives raw admin secret.

### T05.3 Auditability
- [ ] Log operator identity and target environment/table/row identifiers.
- [ ] Do not log full secrets or sensitive row payloads by default.
- [ ] Define retention/access policy server-side.

### T05.4 Least privilege
- [ ] Separate read-only inspection from mutation capability where architecture permits.
- [ ] Require elevated confirmation for production mutation sessions.

## Acceptance

No production-facing browser bundle stores, receives, or reconstructs the raw Jazz `adminSecret`.
