import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { schema as s } from "jazz-tools";
import { deploy, startLocalJazzServer } from "jazz-tools/testing";
import { JazzConnector } from "./connector.js";

const REQUEST_TIMEOUT_MS = 20_000;
const SERVER_ENTRY_PATH = fileURLToPath(new URL("./index.js", import.meta.url));

const transportSchema = {
  todos: s.table({
    title: s.string(),
    done: s.boolean(),
  }),
};

const transportApp = s.defineApp(transportSchema);
const transportPermissions = s.definePermissions(transportApp, ({ policy }) => {
  policy.todos.allowRead.always();
  policy.todos.allowInsert.always();
  policy.todos.allowUpdate.always();
  policy.todos.allowDelete.always();
});

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: number;
  result: unknown;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

class StdioMcpClient {
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  #nextRequestId = 1;
  #stdoutBuffer = "";
  #stderr = "";

  constructor(environment: NodeJS.ProcessEnv) {
    this.#child = spawn(process.execPath, [SERVER_ENTRY_PATH], {
      env: environment,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.#child.stdout.setEncoding("utf8");
    this.#child.stdout.on("data", (chunk: string) => {
      this.#stdoutBuffer += chunk;
      this.#drainStdout();
    });
    this.#child.stderr.setEncoding("utf8");
    this.#child.stderr.on("data", (chunk: string) => {
      this.#stderr += chunk;
    });
    this.#child.once("error", (error) => {
      this.#rejectAll(new Error(`MCP child process failed: ${error.message}`));
    });
    this.#child.once("exit", (code, signal) => {
      this.#rejectAll(
        new Error(
          `MCP child exited before completing requests (code=${String(code)}, signal=${String(signal)}).` +
            this.#stderrContext(),
        ),
      );
    });
  }

  async initialize(): Promise<void> {
    const result = asRecord(
      await this.request("initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "jazz-tools-mcp-v2-transport-test", version: "1.0.0" },
      }),
      "initialize result",
    );
    assert.equal(typeof result.protocolVersion, "string");
    this.notify("notifications/initialized", {});
  }

  request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.#nextRequestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(
          new Error(
            `Timed out waiting for MCP response to ${method} (id=${id}).${this.#stderrContext()}`,
          ),
        );
      }, REQUEST_TIMEOUT_MS);
      this.#pending.set(id, { resolve, reject, timer });
      this.#write({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method: string, params: Record<string, unknown>): void {
    this.#write({ jsonrpc: "2.0", method, params });
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const result = asRecord(
      await this.request("tools/call", { name, arguments: args }),
      `${name} tool result`,
    );
    assert.notEqual(result.isError, true, `${name} returned an MCP tool error`);
    return asRecord(result.structuredContent, `${name} structuredContent`);
  }

  async close(): Promise<void> {
    if (this.#child.exitCode !== null || this.#child.signalCode !== null) return;

    const exit = once(this.#child, "exit");
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error("Timed out stopping MCP child process.")),
        5_000,
      );
    });
    this.#child.kill("SIGTERM");
    try {
      await Promise.race([exit, timeout]);
    } catch (error) {
      this.#child.kill("SIGKILL");
      await exit;
      throw error;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  #write(message: Record<string, unknown>): void {
    this.#child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #drainStdout(): void {
    while (true) {
      const newlineIndex = this.#stdoutBuffer.indexOf("\n");
      if (newlineIndex === -1) return;

      const line = this.#stdoutBuffer.slice(0, newlineIndex).replace(/\r$/, "");
      this.#stdoutBuffer = this.#stdoutBuffer.slice(newlineIndex + 1);
      if (!line) continue;

      let message: JsonRpcResponse;
      try {
        message = JSON.parse(line) as JsonRpcResponse;
      } catch (error) {
        this.#rejectAll(
          new Error(`MCP stdout contained non-JSON data: ${line}`, { cause: error }),
        );
        continue;
      }

      if (typeof message.id !== "number") continue;
      const pending = this.#pending.get(message.id);
      if (!pending) continue;

      clearTimeout(pending.timer);
      this.#pending.delete(message.id);
      if ("error" in message) {
        pending.reject(
          new Error(
            `MCP request failed (${message.error.code}): ${message.error.message}` +
              (message.error.data === undefined
                ? ""
                : `\n${JSON.stringify(message.error.data, null, 2)}`),
          ),
        );
      } else {
        pending.resolve(message.result);
      }
    }
  }

  #rejectAll(error: Error): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
  }

  #stderrContext(): string {
    const stderr = this.#stderr.trim();
    return stderr ? `\nMCP stderr:\n${stderr}` : "";
  }
}

function asRecord(value: unknown, description: string): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${description} must be an object`);
  return value as Record<string, unknown>;
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  assert.ok(Array.isArray(value), "rows must be an array");
  return value.map((row, index) => asRecord(row, `row ${index}`));
}

function asString(value: unknown, description: string): string {
  assert.equal(typeof value, "string", `${description} must be a string`);
  return value as string;
}

async function eventually<T>(
  load: () => Promise<T>,
  matches: (value: T) => boolean,
  description: string,
  timeoutMs = 15_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastValue: T | undefined;
  while (Date.now() < deadline) {
    lastValue = await load();
    if (matches(lastValue)) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Timed out waiting for ${description}. Last value: ${JSON.stringify(lastValue, null, 2)}`,
  );
}

test(
  "stdio MCP transport exposes tools and observes forward and reverse Jazz mutations",
  { timeout: 90_000 },
  async (t) => {
    const server = await startLocalJazzServer({ inMemory: true });
    t.after(async () => {
      await server.stop();
    });

    await deploy({
      serverUrl: server.url,
      appId: server.appId,
      adminSecret: server.adminSecret,
      schema: transportApp,
      permissions: transportPermissions,
    });

    const externalConnector = new JazzConnector({
      serverUrl: server.url,
      appId: server.appId,
      adminSecret: server.adminSecret,
      allowWrites: true,
      durability: "edge",
      env: "dev",
      branch: "main",
    });
    t.after(async () => {
      await externalConnector.close();
    });

    const client = new StdioMcpClient({
      ...process.env,
      JAZZ_SERVER_URL: server.url,
      JAZZ_APP_ID: server.appId,
      JAZZ_ADMIN_SECRET: server.adminSecret,
      JAZZ_MCP_ALLOW_WRITES: "true",
      JAZZ_MCP_DURABILITY: "edge",
      JAZZ_ENV: "dev",
      JAZZ_BRANCH: "main",
    });
    t.after(async () => {
      await client.close();
    });

    await client.initialize();

    const listToolsResult = asRecord(await client.request("tools/list", {}), "tools/list result");
    const tools = listToolsResult.tools;
    assert.ok(Array.isArray(tools));
    const toolNames = tools.map((tool, index) => {
      const name = asRecord(tool, `tool ${index}`).name;
      assert.equal(typeof name, "string", `tool ${index} name must be a string`);
      return name;
    });
    assert.deepEqual(toolNames.toSorted(), [
      "jazz_delete",
      "jazz_describe_table",
      "jazz_get_row",
      "jazz_insert",
      "jazz_list_tables",
      "jazz_query",
      "jazz_reload_schema",
      "jazz_status",
      "jazz_update",
    ]);

    const status = await client.callTool("jazz_status");
    assert.equal(status.healthStatus, 200);
    assert.equal(status.allowWrites, true);

    const tableResult = await client.callTool("jazz_list_tables");
    const tables = tableResult.tables;
    assert.ok(Array.isArray(tables));
    assert.ok(tables.some((table) => asRecord(table, "table descriptor").name === "todos"));

    const inserted = await client.callTool("jazz_insert", {
      table: "todos",
      values: { title: "MCP transport forward", done: false },
    });
    const insertedRow = asRecord(inserted.row, "inserted row");
    const insertedId = asString(insertedRow.id, "inserted row ID");
    assert.equal(insertedRow.title, "MCP transport forward");
    await eventually(
      async () => externalConnector.getRow("todos", insertedId),
      (row) => row?.title === "MCP transport forward" && row.done === false,
      "an independent Jazz connector to observe the MCP insert",
    );

    const updated = await client.callTool("jazz_update", {
      table: "todos",
      id: insertedId,
      values: { done: true },
    });
    assert.equal(asRecord(updated.row, "updated row").done, true);
    await eventually(
      async () => externalConnector.getRow("todos", insertedId),
      (row) => row?.done === true,
      "an independent Jazz connector to observe the MCP update",
    );

    const fetched = await client.callTool("jazz_get_row", {
      table: "todos",
      id: insertedId,
    });
    assert.equal(asRecord(fetched.row, "fetched row").done, true);

    const deleted = await client.callTool("jazz_delete", {
      table: "todos",
      id: insertedId,
    });
    assert.equal(deleted.deleted, true);
    const deletedRow = await client.callTool("jazz_get_row", {
      table: "todos",
      id: insertedId,
    });
    assert.equal(deletedRow.row, null);
    await eventually(
      async () => externalConnector.getRow("todos", insertedId),
      (row) => row === null,
      "an independent Jazz connector to observe the MCP delete",
    );

    const reverseTitle = `External reverse ${Date.now()}`;
    const externalRow = await externalConnector.insert("todos", {
      title: reverseTitle,
      done: false,
    });

    const reverseRows = await eventually(
      async () => {
        const reverseQuery = await client.callTool("jazz_query", {
          table: "todos",
          where: { title: reverseTitle },
          select: ["id", "title", "done"],
          limit: 1,
        });
        return asRows(reverseQuery.rows);
      },
      (rows) => rows.some((row) => row.id === externalRow.id),
      "the running MCP process to observe an external insert",
    );
    const reverseId = reverseRows.find((row) => row.id === externalRow.id)?.id;
    assert.equal(reverseId, externalRow.id);

    await externalConnector.update("todos", externalRow.id, { done: true });
    await eventually(
      async () => client.callTool("jazz_get_row", { table: "todos", id: reverseId }),
      (result) => {
        const row = result.row;
        return row !== null && asRecord(row, "externally updated row").done === true;
      },
      "the running MCP process to observe an external update",
    );

    await externalConnector.delete("todos", externalRow.id);
    await eventually(
      async () => client.callTool("jazz_get_row", { table: "todos", id: reverseId }),
      (result) => result.row === null,
      "the running MCP process to observe an external delete",
    );
  },
);
