# Production security boundary

Status: fail-closed deployable artifact and contract complete; trusted BFF not implemented
Owner: platform/security + Admin Inspector
Production exposure: prohibited until the runtime acceptance gate below passes

## Decision

The standalone Inspector's direct connection flow is for trusted local development and controlled operator use only. It places the Jazz `adminSecret` in browser configuration/local storage and therefore **does not** satisfy the production boundary. It is available only through explicit `dev`/`build:direct` workflows.

The deployable/Vercel build is a separate fail-closed artifact. It statically excludes `App.tsx`, `jazz-tools`, and `jazz-wasm`; removes the legacy connection-storage key and URL fragment before rendering; exposes no credential input; and makes no privileged Jazz request. This prevents accidental public deployment of the direct-secret app, but deliberately provides no functional production Inspector until the BFF below exists.

An internet-exposed Admin Inspector must use a same-origin trusted backend-for-frontend (BFF). The browser authenticates as an operator, sends bounded admin requests to the BFF, and never receives or reconstructs a Jazz admin/backend credential. The BFF resolves a server-side connection identifier, authorizes the operation, constructs or leases the privileged Jazz client, performs the operation, and writes an audit event.

```text
operator browser
  | HTTPS + HttpOnly operator session + CSRF protection
  v
same-origin Admin BFF
  | authentication, authorization, environment policy, audit
  | server-side connection registry + secret manager
  v
backend-scoped Jazz client
  |
  v
allowlisted Jazz environment/app
```

## Assets

| Asset | Required protection |
| --- | --- |
| Jazz `adminSecret` and `backendSecret` | Server-side secret storage only; never in HTML, JavaScript, URLs, browser storage, API responses, telemetry, or logs. |
| App ID, schema hash, environment and branch | Treat as deployment metadata. Do not let a request redirect a connection to an arbitrary app/server. |
| Schemas and row data | Authorize reads as privileged data access; minimize responses and logs. |
| Mutation capability | Deny by default, authorize per environment/table/action, and require production elevation. |
| Operator identity/session | Protect against theft, fixation, CSRF, replay, and privilege escalation. |
| Audit records | Make tamper-resistant, access-controlled, queryable, and subject to retention policy. |

Admin/backend access is infrastructure access. It can bypass normal Jazz end-user permission policies, so ordinary application authorization is not a compensating control for a compromised Admin Inspector session.

## Actors and abuse cases

- **Developer:** may use direct browser credentials only against isolated local/dev data under an explicit development policy.
- **Operator:** authenticates through the organization identity provider and receives only mapped environment/action grants.
- **Production approver/elevated operator:** may create a short-lived production mutation elevation after re-authentication or equivalent strong confirmation.
- **End user:** has no Admin Inspector access; an application session must not be accepted as an operator session by default.
- **Compromised operator session:** can attempt privileged reads, mutation, environment switching, CSRF/replay, or bulk extraction. Short expiry, server-side revocation, scope checks, elevation, rate limits, and audit reduce impact.
- **Compromised browser/static bundle:** can issue requests only within the current operator session; it must not reveal durable Jazz secrets or an unrestricted connection target.
- **Compromised BFF/platform administrator:** is inside the privileged trust boundary. Secret-manager controls, deployment access controls, service identity, network policy, and independent audit monitoring are required.

## Environment isolation requirements

1. Dev, staging, and production use separate Jazz app IDs and separate admin/backend secrets.
2. Production secrets live in a production-scoped secret manager and are readable only by the production BFF service identity.
3. The browser selects an opaque `connectionId`; it cannot submit `serverUrl`, `adminSecret`, or `backendSecret` to an admin API.
4. The BFF resolves `connectionId` through a deploy-time allowlist containing environment, server origin, app ID, branch policy, secret references, and capabilities.
5. Production and non-production sessions/elevations are not interchangeable. A production action is authorized against the target connection on every request.
6. Prefer separate BFF deployments, service identities, network paths, and audit sinks for production. If a shared control plane is approved, equivalent hard isolation must be demonstrated.
7. CORS is same-origin only unless an explicit reviewed origin allowlist is required. Never use credentialed wildcard CORS.
8. Test/local-first authentication and test secrets must not be enabled in production deployments.

## Operator session contract

Recommended browser session:

- opaque server-side session ID in a `Secure`, `HttpOnly`, `SameSite=Lax` (or stricter) cookie;
- short idle and absolute expiry with server-side revocation;
- session rotation after login and elevation;
- CSRF token plus `Origin`/`Sec-Fetch-Site` validation for state-changing requests;
- no bearer token in local storage;
- organization MFA/re-authentication for production mutation elevation;
- authorization checked per request, not copied permanently into browser state.

The BFF may return displayable identity and capability metadata, but never identity-provider tokens or Jazz credentials.

## BFF API contract

All endpoints are under `/api/admin/v1`, use HTTPS, return JSON, reject unknown fields, enforce bounded request sizes, and attach a server-generated `requestId`. Table names and row IDs are data, not URL path segments, in mutation/query request bodies.

### Session and connection discovery

`GET /session`

```json
{
  "operator": { "id": "op_123", "displayName": "Ada Operator" },
  "expiresAt": "2026-08-17T18:30:00.000Z",
  "roles": ["inspector-reader"],
  "elevations": [],
  "csrfToken": "opaque-per-session-token"
}
```

`GET /connections`

```json
{
  "connections": [
    {
      "id": "prod-primary",
      "label": "Production",
      "environment": "prod",
      "appId": "display-safe-app-id",
      "capabilities": ["schema:read", "data:read"]
    }
  ]
}
```

`serverUrl` may be omitted or reduced to a display-safe origin. Secret material is never returned.

### Schema and data reads

`POST /query`

```json
{
  "connectionId": "prod-primary",
  "schemaHash": "published-schema-hash",
  "table": "todos",
  "where": { "done": false },
  "select": ["id", "title", "done", "$updatedAt", "$updatedBy"],
  "orderBy": [{ "column": "$updatedAt", "direction": "desc" }],
  "limit": 50,
  "offset": 0
}
```

```json
{
  "requestId": "req_01",
  "schemaHash": "published-schema-hash",
  "rows": [{ "id": "row_01", "title": "Ship", "done": false }],
  "nextOffset": null
}
```

Equivalent bounded endpoints may expose schema catalogue/table descriptions, but every request must resolve the allowlisted connection and authorize `schema:read` or `data:read`. The BFF must validate Jazz query operators/columns and cap result count, response bytes, and execution time.

### Mutations

`POST /mutations`

```json
{
  "connectionId": "prod-primary",
  "schemaHash": "published-schema-hash",
  "table": "todos",
  "reason": "INC-1234: correct completion state",
  "elevationId": "elev_01",
  "operations": [
    { "clientMutationId": "m1", "kind": "insert", "values": { "title": "Verify", "done": false } },
    { "clientMutationId": "m2", "kind": "update", "rowId": "row_02", "values": { "done": true } },
    { "clientMutationId": "m3", "kind": "delete", "rowId": "row_03" }
  ]
}
```

```json
{
  "requestId": "req_02",
  "results": [
    { "clientMutationId": "m1", "status": "applied", "rowId": "row_04" },
    { "clientMutationId": "m2", "status": "applied", "rowId": "row_02" },
    { "clientMutationId": "m3", "status": "applied", "rowId": "row_03" }
  ],
  "durability": "global"
}
```

Rules:

- Require `data:mutate` for the resolved environment/table and a valid production elevation when `environment=prod`.
- Validate `schemaHash` against the selected connection to prevent stale-schema writes.
- Reject `id` and Jazz magic/provenance columns in mutation values.
- Set tight batch and payload limits; define whether the approved implementation is atomic or returns per-operation results. Do not imply atomicity unless Jazz/runtime behavior guarantees it.
- Use `clientMutationId`/`requestId` for retry correlation. The implementation must define idempotency before automatic mutation retries are enabled.
- Return generated insert row IDs. Never accept a hard-coded ID for a subsequent demo/update when the insert response supplied one.

### Production elevation

`POST /elevations`

```json
{
  "connectionId": "prod-primary",
  "capability": "data:mutate",
  "reason": "INC-1234",
  "reauthenticationProof": "provider-specific-one-time-proof"
}
```

```json
{
  "elevationId": "elev_01",
  "connectionId": "prod-primary",
  "capability": "data:mutate",
  "expiresAt": "2026-08-17T18:10:00.000Z"
}
```

The proof format is provider-specific; the BFF must validate it server-side and bind the short-lived elevation to operator, session, connection, capability, and expiry.

### Errors

Use a stable envelope and do not expose secrets, upstream headers, stack traces, or sensitive payloads.

```json
{
  "requestId": "req_03",
  "error": {
    "code": "ELEVATION_REQUIRED",
    "message": "Production mutations require an active elevation."
  }
}
```

At minimum distinguish `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `CSRF_REJECTED` (403), `INVALID_REQUEST` (400), `STALE_SCHEMA` (409), `RATE_LIMITED` (429), and sanitized `UPSTREAM_FAILURE` (502/503).

## Privileged Jazz client handling

For each request, the BFF resolves the allowlisted connection and secret references server-side. It constructs or leases a backend-scoped Jazz context using a service/backend identity where supported. Context pools must be keyed by the complete trusted connection identity and schema hash; never by untrusted URL input. Rotation must invalidate affected pools without a frontend deployment.

The operator identity remains an audit/authorization identity. Jazz attribution may record an approved stable principal, but attribution does not convert backend access into end-user permission evaluation and must not be presented as such.

## Audit contract

Write one append-only audit event for authentication/elevation changes, connection selection failures, privileged queries, mutation attempts, authorization denials, and mutation outcomes. Emit the event server-side even when the upstream Jazz operation fails.

```json
{
  "eventVersion": 1,
  "eventId": "aud_01",
  "occurredAt": "2026-08-17T18:00:00.000Z",
  "requestId": "req_02",
  "operatorId": "op_123",
  "sessionIdHash": "sha256:...",
  "source": { "ip": "redacted-or-policy-approved", "userAgent": "normalized" },
  "target": {
    "connectionId": "prod-primary",
    "environment": "prod",
    "appId": "display-safe-app-id",
    "schemaHash": "published-schema-hash",
    "table": "todos",
    "rowIds": ["row_02", "row_03"]
  },
  "action": "data.mutate",
  "operationCounts": { "insert": 1, "update": 1, "delete": 1 },
  "reason": "INC-1234: correct completion state",
  "elevationId": "elev_01",
  "decision": "allowed",
  "outcome": "succeeded",
  "durationMs": 84
}
```

Do not log raw credentials, cookies, CSRF tokens, identity-provider tokens, mutation payloads, full query results, or sensitive row values by default. Row IDs may also be sensitive and must follow the approved data classification. Audit access itself is privileged and audited. Storage must enforce integrity controls, restricted access, retention, legal hold/deletion requirements, and monitoring for unusual volume or denied production attempts.

## Policy-dependent inputs (the only blocked decisions)

The technical boundary and API contract above are decided. Implementation needs product/security owners to supply these deployment-specific policies:

1. identity provider, MFA/re-authentication mechanism, and operator lifecycle;
2. role-to-environment/table/action mapping and production approver rules;
3. session/elevation idle and absolute lifetimes;
4. audit retention, audit-reader roles, IP/row-ID classification, and legal requirements;
5. approved production topology (dedicated BFF preferred versus demonstrated equivalent isolation);
6. mutation batch atomicity/idempotency policy and maximum query/mutation limits.

The BFF implementation itself is **pending**, not described as policy-blocked. Work that does not depend on the choices above—same-origin routing, server-only secret resolution, request validation, deny-by-default authorization hooks, redaction, audit event emission, and tests—can proceed now.

Immediate mitigation is implemented in `ProductionApp.tsx`, the production-mode Vite graph guard, production artifact test, and production Playwright test. CI builds/tests direct, embedded, and fail-closed production artifacts separately.

## Runtime acceptance gate

Production-facing acceptance remains unmet until tests and deployment evidence prove all of the following:

- browser bundle, HTML, network responses, URLs, storage, telemetry, and logs contain no raw Jazz admin/backend secret;
- direct browser-to-Jazz privileged connection is disabled in the production build/deployment;
- unauthenticated, unauthorized, cross-environment, stale-schema, and CSRF requests fail closed;
- production mutations require valid scoped elevation and emit success/failure audit events;
- read-only operators cannot mutate;
- secret rotation does not expose secrets or require shipping them to the browser;
- dev/staging credentials cannot access production and production credentials are not present outside the production boundary.
