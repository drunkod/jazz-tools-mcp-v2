import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createConnectionRegistry } from "./connection-registry.js";
import { redactAuditEvent, RedactingAuditSink } from "./redaction.js";
import { createBffServer } from "./server.js";
import { denyAllAuthorization, type AuditEvent, type AuditSink, type OperatorSession } from "./ports.js";

const session: OperatorSession = {
  operatorId: "op_test",
  displayName: "Test Operator",
  roles: ["inspector-reader"],
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  csrfToken: "csrf-test-token",
  sessionIdHash: "sha256:test-session",
};

function registry(environment = "dev") {
  return createConnectionRegistry([
    {
      id: environment === "prod" ? "prod-primary" : "dev-primary",
      label: environment === "prod" ? "Production" : "Development",
      environment,
      displaySafeAppId: "display-safe-app-id",
      capabilities: ["schema:read", "data:read", "data:mutate"],
      resolveConfig: () => ({
        serverUrl: "http://127.0.0.1:1",
        appId: "real-app-id-never-returned",
        adminSecret: "admin-secret-never-returned",
        backendSecret: "backend-secret-never-returned",
        schemaHash: "current-hash",
        allowWrites: true,
        durability: "edge",
        env: environment,
        branch: "main",
      }),
    },
  ]);
}

function fakeConnector(schemaHash = "current-hash") {
  let nextId = 1;
  const rows = new Map<string, Record<string, unknown>>();
  return {
    async status() {
      return { schemaHash, durability: "edge" };
    },
    async listTables() {
      return [{ name: "todos", columnCount: 2 }];
    },
    async query() {
      return [...rows.values()];
    },
    async getRow(_table: string, id: string) {
      return rows.get(id) ?? null;
    },
    async insert(_table: string, values: Record<string, unknown>) {
      const row = { id: `row_${nextId++}`, ...values };
      rows.set(String(row.id), row);
      return row;
    },
    async update(_table: string, id: string, values: Record<string, unknown>) {
      const current = rows.get(id);
      if (!current) return null;
      const row = { ...current, ...values };
      rows.set(id, row);
      return row;
    },
    async delete(_table: string, id: string) {
      rows.delete(id);
      return { id, deleted: true as const };
    },
    async close() {
      // no-op
    },
  };
}

function allowAll() {
  return {
    async isAllowed() {
      return true;
    },
  };
}

async function withServer(
  dependencies: Parameters<typeof createBffServer>[0],
  callback: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createBffServer(dependencies);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function jsonRequest(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: Record<string, any> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  return { response, body: (await response.json()) as Record<string, any> };
}

function body(value: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(value) };
}

function mutationBody(connectionId = "dev-primary") {
  return {
    connectionId,
    schemaHash: "current-hash",
    table: "todos",
    reason: "test mutation",
    operations: [{ clientMutationId: "m1", kind: "insert", values: { title: "Ship" } }],
  };
}

function auditCollector(): { events: AuditEvent[]; sink: AuditSink } {
  const events: AuditEvent[] = [];
  return {
    events,
    sink: {
      emit: async (event) => {
        events.push(event);
      },
    },
  };
}

test("unauthenticated requests fail closed", async () => {
  const audit = auditCollector();
  await withServer(
    { registry: registry(), audit: audit.sink, connectorFactory: () => fakeConnector() },
    async (baseUrl) => {
      const result = await jsonRequest(baseUrl, "/api/admin/v1/query", body({}));
      assert.equal(result.response.status, 401);
      assert.equal(result.body.error.code, "UNAUTHENTICATED");
      assert.equal(audit.events.at(-1)?.decision, "denied");
    },
  );
});

test("state-changing requests require CSRF and same-origin checks", async () => {
  await withServer(
    {
      registry: registry(),
      identity: { async resolveSession() { return session; } },
      authorization: allowAll(),
      connectorFactory: () => fakeConnector(),
    },
    async (baseUrl) => {
      const missing = await jsonRequest(baseUrl, "/api/admin/v1/mutations", body(mutationBody()));
      assert.equal(missing.response.status, 403);
      assert.equal(missing.body.error.code, "CSRF_REJECTED");

      const crossSite = await jsonRequest(baseUrl, "/api/admin/v1/mutations", {
        ...body(mutationBody()),
        headers: { "x-csrf-token": session.csrfToken, origin: "https://evil.example" },
      });
      assert.equal(crossSite.response.status, 403);
      assert.equal(crossSite.body.error.code, "CSRF_REJECTED");
    },
  );
});

test("deny-by-default authorization denies reads and mutations and audits both", async () => {
  const audit = auditCollector();
  await withServer(
    {
      registry: registry(),
      identity: { async resolveSession() { return session; } },
      authorization: denyAllAuthorization,
      audit: audit.sink,
      connectorFactory: () => fakeConnector(),
    },
    async (baseUrl) => {
      const read = await jsonRequest(
        baseUrl,
        "/api/admin/v1/query",
        body({ connectionId: "dev-primary", schemaHash: "current-hash", table: "todos" }),
      );
      assert.equal(read.response.status, 403);
      const mutation = await jsonRequest(baseUrl, "/api/admin/v1/mutations", {
        ...body(mutationBody()),
        headers: { "x-csrf-token": session.csrfToken },
      });
      assert.equal(mutation.response.status, 403);
      assert.equal(mutation.body.error.code, "FORBIDDEN");
      assert.equal(audit.events.filter((event) => event.decision === "denied").length, 2);
    },
  );
});

test("read-only authorization cannot mutate", async () => {
  const audit = auditCollector();
  await withServer(
    {
      registry: registry(),
      identity: { async resolveSession() { return session; } },
      authorization: {
        async isAllowed(input) {
          return input.capability === "data:read";
        },
      },
      audit: audit.sink,
      connectorFactory: () => fakeConnector(),
    },
    async (baseUrl) => {
      const result = await jsonRequest(baseUrl, "/api/admin/v1/mutations", {
        ...body(mutationBody()),
        headers: { "x-csrf-token": session.csrfToken },
      });
      assert.equal(result.response.status, 403);
      assert.equal(audit.events.at(-1)?.action, "data.mutate");
      assert.equal(audit.events.at(-1)?.decision, "denied");
    },
  );
});

test("stale schemas are rejected before delegation", async () => {
  let delegated = false;
  await withServer(
    {
      registry: registry(),
      identity: { async resolveSession() { return session; } },
      authorization: allowAll(),
      connectorFactory: () => {
        delegated = true;
        return fakeConnector("current-hash");
      },
    },
    async (baseUrl) => {
      const result = await jsonRequest(
        baseUrl,
        "/api/admin/v1/query",
        body({ connectionId: "dev-primary", schemaHash: "stale-hash", table: "todos" }),
      );
      assert.equal(result.response.status, 409);
      assert.equal(result.body.error.code, "STALE_SCHEMA");
      assert.equal(delegated, true);
    },
  );
});

test("production cannot be authorized by a non-production grant or elevation", async () => {
  await withServer(
    {
      registry: registry("prod"),
      identity: { async resolveSession() { return session; } },
      authorization: {
        async isAllowed(input) {
          return input.environment === "dev";
        },
      },
      elevations: {
        async create() { return null; },
        async resolve() { return true; },
      },
      connectorFactory: () => fakeConnector(),
    },
    async (baseUrl) => {
      const result = await jsonRequest(baseUrl, "/api/admin/v1/mutations", {
        ...body(mutationBody("prod-primary")),
        headers: { "x-csrf-token": session.csrfToken },
      });
      assert.equal(result.response.status, 403);
      assert.equal(result.body.error.code, "ELEVATION_REQUIRED");

      const withNonProdElevation = await jsonRequest(baseUrl, "/api/admin/v1/mutations", {
        ...body({ ...mutationBody("prod-primary"), elevationId: "non-prod-elevation" }),
        headers: { "x-csrf-token": session.csrfToken },
      });
      assert.equal(withNonProdElevation.response.status, 403);
      assert.equal(withNonProdElevation.body.error.code, "FORBIDDEN");
    },
  );
});

test("responses expose safe connection/session metadata only", async () => {
  await withServer(
    {
      registry: registry(),
      identity: { async resolveSession() { return session; } },
      authorization: allowAll(),
      connectorFactory: () => fakeConnector(),
    },
    async (baseUrl) => {
      const connections = await jsonRequest(baseUrl, "/api/admin/v1/connections");
      const sessionResult = await jsonRequest(baseUrl, "/api/admin/v1/session");
      const serialized = JSON.stringify({ connections: connections.body, session: sessionResult.body });
      assert.doesNotMatch(serialized, /admin-secret-never-returned|backend-secret-never-returned|real-app-id-never-returned/);
      assert.equal(connections.body.connections[0].appId, "display-safe-app-id");
      assert.equal(sessionResult.body.csrfToken, session.csrfToken);
    },
  );
});

test("mutation values reject Jazz identity and provenance fields", async () => {
  await withServer(
    {
      registry: registry(),
      identity: { async resolveSession() { return session; } },
      authorization: allowAll(),
      connectorFactory: () => fakeConnector(),
    },
    async (baseUrl) => {
      const result = await jsonRequest(baseUrl, "/api/admin/v1/mutations", {
        ...body({
          ...mutationBody(),
          operations: [{ clientMutationId: "m1", kind: "insert", values: { id: "fixed", $createdBy: "bad" } }],
        }),
        headers: { "x-csrf-token": session.csrfToken },
      });
      assert.equal(result.response.status, 400);
      assert.equal(result.body.error.code, "INVALID_REQUEST");
    },
  );
});

test("redaction removes token-like reason data and row IDs by default", async () => {
  const received: AuditEvent[] = [];
  const sink = new RedactingAuditSink({
    emit: async (event) => {
      received.push(event);
    },
  });
  const unsafe = {
    eventVersion: 1 as const,
    eventId: "aud_1",
    occurredAt: new Date().toISOString(),
    requestId: "req_1",
    operatorId: "operator",
    source: { userAgent: "test" },
    target: { connectionId: "dev", rowIds: ["secret-row-id"] },
    action: "data.mutate" as const,
    reason: "INC-1 adminSecret=super-secret csrfToken=csrf-secret payload={\"title\":\"secret\"}",
    decision: "allowed" as const,
    outcome: "succeeded" as const,
    durationMs: 1,
  } satisfies AuditEvent;
  await sink.emit(unsafe);
  assert.equal(received.length, 1);
  const serialized = JSON.stringify(received[0]);
  assert.doesNotMatch(serialized, /super-secret|csrf-secret|secret-row-id/);
  assert.deepEqual(redactAuditEvent(unsafe).target.rowIds, undefined);
});
