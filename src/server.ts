import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { JazzConnector } from "./connector.js";
import { toolResult } from "./json.js";

const whereSchema = z.record(z.string(), z.unknown());
const valuesSchema = z.record(z.string(), z.unknown());
const orderBySchema = z.array(
  z.object({
    column: z.string().min(1),
    direction: z.enum(["asc", "desc"]).optional(),
  }),
);

export function createMcpServer(connector: JazzConnector): McpServer {
  const server = new McpServer({ name: "jazz-tools-mcp-v2", version: "0.1.0" });

  server.registerTool(
    "jazz_status",
    {
      description:
        "Check the configured jazz-tools@alpha server, loaded schema, privileged auth mode, and write safety settings.",
      annotations: { readOnlyHint: true },
    },
    async () => toolResult(await connector.status()),
  );

  server.registerTool(
    "jazz_reload_schema",
    {
      description:
        "Drop the local Jazz runtime and reload the newest published schema from the server catalogue.",
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      await connector.reload();
      return toolResult(await connector.status());
    },
  );

  server.registerTool(
    "jazz_list_tables",
    {
      description: "List tables in the published Jazz schema currently used by the connector.",
      annotations: { readOnlyHint: true },
    },
    async () => toolResult({ tables: await connector.listTables() }),
  );

  server.registerTool(
    "jazz_describe_table",
    {
      description:
        "Return the official Jazz WASM schema descriptor for one table plus supported query-time magic columns.",
      inputSchema: z.object({ table: z.string().min(1) }),
      annotations: { readOnlyHint: true },
    },
    async ({ table }) => toolResult(await connector.describeTable(table)),
  );

  server.registerTool(
    "jazz_query",
    {
      description:
        "Query a Jazz table through Jazz's native query builder. `where` values may be scalars (eq) or type-supported operator objects such as {gt: 5}, {contains: \"foo\"}, or {in: [...]}. Conditions are AND-combined; query-level OR is not supported. Magic columns such as $createdBy/$updatedAt may be selected or filtered. This is not SQL.",
      inputSchema: z.object({
        table: z.string().min(1),
        where: whereSchema.optional(),
        select: z.array(z.string().min(1)).optional(),
        orderBy: orderBySchema.optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ table, where, select, orderBy, limit, offset }) =>
      toolResult({
        rows: await connector.query({ table, where, select, orderBy, limit, offset }),
      }),
  );

  server.registerTool(
    "jazz_get_row",
    {
      description: "Fetch one Jazz row by table name and row id.",
      inputSchema: z.object({ table: z.string().min(1), id: z.string().min(1) }),
      annotations: { readOnlyHint: true },
    },
    async ({ table, id }) => toolResult({ row: await connector.getRow(table, id) }),
  );

  server.registerTool(
    "jazz_insert",
    {
      description:
        "Insert a row using Jazz's native local-first mutation API with privileged backend access. Disabled unless JAZZ_MCP_ALLOW_WRITES=true.",
      inputSchema: z.object({
        table: z.string().min(1),
        values: valuesSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ table, values }) => toolResult({ row: await connector.insert(table, values) }),
  );

  server.registerTool(
    "jazz_update",
    {
      description:
        "Update fields on one Jazz row with privileged backend access and wait for configured durability. Disabled unless JAZZ_MCP_ALLOW_WRITES=true.",
      inputSchema: z.object({
        table: z.string().min(1),
        id: z.string().min(1),
        values: valuesSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ table, id, values }) =>
      toolResult({ row: await connector.update(table, id, values) }),
  );

  server.registerTool(
    "jazz_delete",
    {
      description:
        "Delete one Jazz row with privileged backend access through Jazz's native delete operation. Disabled unless JAZZ_MCP_ALLOW_WRITES=true.",
      inputSchema: z.object({ table: z.string().min(1), id: z.string().min(1) }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ table, id }) => toolResult(await connector.delete(table, id)),
  );

  return server;
}
