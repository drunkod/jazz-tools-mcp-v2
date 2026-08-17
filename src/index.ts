#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { JazzConnector } from "./connector.js";
import { loadConfig } from "./config.js";
import { createMcpServer } from "./server.js";

const connector = new JazzConnector(loadConfig());
const handle = serveStdio(() => createMcpServer(connector));

console.error("jazz-tools-mcp-v2 listening on stdio");

async function shutdown(): Promise<void> {
  await connector.close().catch(() => undefined);
  await handle.close().catch(() => undefined);
}

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
