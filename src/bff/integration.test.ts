import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { schema as s } from "jazz-tools";
import { deploy, startLocalJazzServer } from "jazz-tools/testing";
import { JazzConnector } from "../connector.js";
import { createConnectionRegistry } from "./connection-registry.js";
import { createBffServer } from "./server.js";
import type { OperatorSession } from "./ports.js";

const appSchema = {
  todos: s.table({
    title: s.string(),
    done: s.boolean(),
  }),
};
const app = s.defineApp(appSchema);
const permissions = s.definePermissions(app, ({ policy }) => {
  policy.todos.allowRead.always();
  policy.todos.allowInsert.always();
  policy.todos.allowUpdate.always();
  policy.todos.allowDelete.always();
});

interface TestServer {
  baseUrl: string;
  close(): Promise<void>;
}

async function startBff(
  dependencies: Parameters<typeof createBffServer>[0],
): Promise<TestServer> {
  const server = createBffServer(dependencies);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.close();
      await once(server, "close");
    },
  };
}

async function request(baseUrl: string, body: unknown, csrf: string) {
  const response = await fetch(`${baseUrl}/api/admin/v1/mutations`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrf },
    body: JSON.stringify(body),
  });
  return { response, body: (await response.json()) as Record<string, any> };
}

test("trusted BFF performs real Jazz CRUD and returns/reuses generated row IDs", async (t) => {
  const jazz = await startLocalJazzServer({ inMemory: true });
  t.after(async () => {
    await jazz.stop();
  });
  await deploy({
    serverUrl: jazz.url,
    appId: jazz.appId,
    adminSecret: jazz.adminSecret,
    schema: app,
    permissions,
  });

  const config = {
    serverUrl: jazz.url,
    appId: jazz.appId,
    adminSecret: jazz.adminSecret,
    allowWrites: true,
    durability: "global" as const,
    env: "dev",
    branch: "main",
  };
  const probe = new JazzConnector(config);
  const status = await probe.status();
  await probe.close();

  const observer = new JazzConnector(config);
  t.after(async () => {
    await observer.close();
  });

  const operator: OperatorSession = {
    operatorId: "op_integration",
    displayName: "Integration Operator",
    roles: ["inspector-writer"],
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    csrfToken: "integration-csrf",
  };
  const audits: unknown[] = [];
  const bff = await startBff({
    registry: createConnectionRegistry([
      {
        id: "dev-primary",
        label: "Development",
        environment: "dev",
        displaySafeAppId: jazz.appId,
        capabilities: ["schema:read", "data:read", "data:mutate"],
        resolveConfig: () => config,
      },
    ]),
    identity: { async resolveSession() { return operator; } },
    authorization: { async isAllowed() { return true; } },
    audit: { async emit(event) { audits.push(event); } },
    connectorFactory: (resolvedConfig) => new JazzConnector(resolvedConfig),
  });
  t.after(async () => {
    await bff.close();
  });

  const insert = await request(bff.baseUrl, {
    connectionId: "dev-primary",
    schemaHash: status.schemaHash,
    table: "todos",
    reason: "integration test insert",
    operations: [
      { clientMutationId: "insert-1", kind: "insert", values: { title: "BFF row", done: false } },
    ],
  }, operator.csrfToken);
  if (insert.response.status !== 200) throw new Error(`insert response: ${JSON.stringify(insert.body)}`);
  const insertedRowId = insert.body.results[0].rowId as string;
  assert.equal(typeof insertedRowId, "string");
  assert.ok(insertedRowId.length > 0);
  await eventually(
    async () => observer.getRow("todos", insertedRowId),
    (row) => row?.title === "BFF row" && row.done === false,
    "observer to see BFF insert",
  );

  const update = await request(bff.baseUrl, {
    connectionId: "dev-primary",
    schemaHash: status.schemaHash,
    table: "todos",
    reason: "integration test update",
    operations: [
      { clientMutationId: "update-1", kind: "update", rowId: insertedRowId, values: { done: true } },
    ],
  }, operator.csrfToken);
  assert.equal(update.response.status, 200, JSON.stringify(update.body));
  assert.equal(update.body.results[0].status, "applied", JSON.stringify(update.body));
  assert.equal(update.body.results[0].rowId, insertedRowId);
  await eventually(
    async () => observer.getRow("todos", insertedRowId),
    (row) => row?.done === true,
    "observer to see BFF update",
  );

  const deleteResult = await request(bff.baseUrl, {
    connectionId: "dev-primary",
    schemaHash: status.schemaHash,
    table: "todos",
    reason: "integration test delete",
    operations: [
      { clientMutationId: "delete-1", kind: "delete", rowId: insertedRowId },
    ],
  }, operator.csrfToken);
  assert.equal(deleteResult.response.status, 200);
  assert.equal(deleteResult.body.results[0].rowId, insertedRowId);

  await eventually(
    async () => observer.getRow("todos", insertedRowId),
    (row) => row === null,
    "observer to see BFF delete",
  );
  assert.equal(audits.length, 3);
});

async function eventually<T>(
  read: () => Promise<T>,
  predicate: (value: T) => boolean,
  description: string,
): Promise<void> {
  const deadline = Date.now() + 20_000;
  let lastValue: T | undefined;
  while (Date.now() < deadline) {
    lastValue = await read();
    if (predicate(lastValue)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}: ${JSON.stringify(lastValue)}`);
}
