import test from "node:test";
import assert from "node:assert/strict";
import { schema as s } from "jazz-tools";
import { deploy, startLocalJazzServer } from "jazz-tools/testing";
import { JazzConnector } from "./connector.js";

const integrationSchema = {
  todos: s.table({
    title: s.string(),
    done: s.boolean(),
  }),
};

const integrationApp = s.defineApp(integrationSchema);
const integrationPermissions = s.definePermissions(integrationApp, ({ policy }) => {
  policy.todos.allowRead.always();
  policy.todos.allowInsert.always();
  policy.todos.allowUpdate.always();
  policy.todos.allowDelete.always();
});

test("connector discovers schema and performs CRUD through an admin-authenticated Jazz server", async (t) => {
  const server = await startLocalJazzServer({ inMemory: true });
  t.after(async () => {
    await server.stop();
  });

  await deploy({
    serverUrl: server.url,
    appId: server.appId,
    adminSecret: server.adminSecret,
    schema: integrationApp,
    permissions: integrationPermissions,
  });

  // Deliberately omit server.backendSecret. This exercises the connector's
  // compatibility path for the documented admin-secret-only self-host setup.
  const connector = new JazzConnector({
    serverUrl: server.url,
    appId: server.appId,
    adminSecret: server.adminSecret,
    allowWrites: true,
    durability: "edge",
    env: "dev",
    branch: "main",
  });
  t.after(async () => {
    await connector.close();
  });

  const status = await connector.status();
  assert.equal(status.healthStatus, 200);
  assert.equal(status.authMode, "admin-secret");
  assert.equal(status.accessScope, "privileged-backend");

  const tables = await connector.listTables();
  assert.ok(tables.some((table) => table.name === "todos"));

  const created = await connector.insert("todos", {
    title: "verify MCP connector",
    done: false,
  });
  assert.equal(created.title, "verify MCP connector");
  assert.equal(created.done, false);

  const queried = await connector.query({
    table: "todos",
    where: { id: created.id },
    select: ["title", "done", "$createdBy"],
    limit: 1,
  });
  assert.equal(queried.length, 1);
  assert.equal(queried[0]?.title, "verify MCP connector");
  assert.equal(queried[0]?.done, false);

  const updated = await connector.update("todos", created.id, { done: true });
  assert.equal(updated?.done, true);

  await connector.delete("todos", created.id);
  const deleted = await connector.getRow("todos", created.id);
  assert.equal(deleted, null);
});
