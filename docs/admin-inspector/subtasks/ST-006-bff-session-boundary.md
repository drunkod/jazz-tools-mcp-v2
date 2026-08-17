# ST-006 — Trusted BFF/session boundary

Parent: Task 05
Priority: P0 before production exposure
Status: design/implementation follow-up

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

## Requirements

- [ ] production admin secret exists only in server-side secret storage;
- [ ] browser authenticates using normal operator identity/session;
- [ ] backend authorizes environment/table/action;
- [ ] read-only and mutation privileges are separable where possible;
- [ ] mutations are auditable by operator identity;
- [ ] browser responses do not contain raw secret;
- [ ] logs redact credentials and sensitive row payloads by default;
- [ ] CSRF/session protections match deployment architecture;
- [ ] production mutation sessions require explicit elevation/confirmation.

## Non-solutions

- localStorage obfuscation;
- hiding the input field;
- base64/encoding the secret;
- moving the same raw secret into another browser storage API.

## Acceptance

Compromising the static frontend bundle alone does not reveal the privileged Jazz admin credential.
