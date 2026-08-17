import {
  fetchSchemaHashes,
  fetchStoredWasmSchema,
  type Db,
  type DynamicTableRow,
  type WasmSchema,
} from "jazz-tools";
import { createJazzContext, type JazzContext } from "jazz-tools/backend";
import type { ConnectorConfig } from "./config.js";
import {
  GenericQueryBuilder,
  assertOrderByColumns,
  assertQueryableColumns,
  assertTable,
  assertWhereInput,
  assertWritableColumns,
  dynamicTableProxy,
  type GenericWhereInput,
  type OrderByInput,
} from "./query.js";

export interface QueryInput {
  table: string;
  where?: GenericWhereInput;
  select?: string[];
  orderBy?: OrderByInput[];
  limit?: number;
  offset?: number;
}

interface LoadedState {
  schema: WasmSchema;
  schemaHash: string;
  schemaPublishedAt: number | null;
  context: JazzContext;
  db: Db;
}

export class JazzConnector {
  private state?: LoadedState;
  private loading?: Promise<LoadedState>;

  constructor(readonly config: ConnectorConfig) {}

  async close(): Promise<void> {
    const state = this.state;
    this.state = undefined;
    this.loading = undefined;
    if (state) await state.context.shutdown();
  }

  async reload(): Promise<void> {
    await this.close();
    await this.ensureLoaded();
  }

  async status(): Promise<Record<string, unknown>> {
    const healthUrl = `${this.config.serverUrl}/health`;
    let health: unknown = null;
    let healthStatus: number | null = null;
    try {
      const response = await fetch(healthUrl);
      healthStatus = response.status;
      const text = await response.text();
      try {
        health = JSON.parse(text) as unknown;
      } catch {
        health = text;
      }
    } catch (error) {
      health = { error: error instanceof Error ? error.message : String(error) };
    }

    const loaded = await this.ensureLoaded();
    return {
      serverUrl: this.config.serverUrl,
      appId: this.config.appId,
      healthStatus,
      health,
      schemaHash: loaded.schemaHash,
      schemaPublishedAt: loaded.schemaPublishedAt,
      tables: Object.keys(loaded.schema),
      allowWrites: this.config.allowWrites,
      durability: this.config.durability,
      authMode: this.config.backendSecret ? "backend-secret" : "admin-secret",
      accessScope: "privileged-backend",
      attribution: this.config.backendSecret
        ? (this.config.principal ?? "jazz:system")
        : "runtime/default",
    };
  }

  async listTables(): Promise<Array<{ name: string; columnCount: number }>> {
    const { schema } = await this.ensureLoaded();
    return Object.entries(schema).map(([name, table]) => ({
      name,
      columnCount: table.columns.length,
    }));
  }

  async describeTable(tableName: string): Promise<Record<string, unknown>> {
    const { schema } = await this.ensureLoaded();
    assertTable(schema, tableName);
    return {
      name: tableName,
      ...schema[tableName],
      queryMagicColumns: [
        "$canRead",
        "$canEdit",
        "$canDelete",
        "$createdBy",
        "$createdAt",
        "$updatedBy",
        "$updatedAt",
      ],
    } as Record<string, unknown>;
  }

  async query(input: QueryInput): Promise<DynamicTableRow[]> {
    const { schema, db } = await this.ensureLoaded();
    assertTable(schema, input.table);
    assertWhereInput(schema, input.table, input.where);
    if (input.select) assertQueryableColumns(schema, input.table, input.select);
    if (input.orderBy) {
      assertOrderByColumns(
        schema,
        input.table,
        input.orderBy.map((item) => item.column),
      );
    }

    let query = new GenericQueryBuilder(input.table, schema);
    if (input.where) query = query.where(input.where);
    if (input.select?.length) query = query.select(input.select);
    if (input.orderBy?.length) query = query.orderBy(input.orderBy);
    if (input.limit !== undefined) query = query.limit(input.limit);
    if (input.offset !== undefined) query = query.offset(input.offset);
    return await db.all(query);
  }

  async getRow(table: string, id: string): Promise<DynamicTableRow | null> {
    const rows = await this.query({ table, where: { id }, limit: 1 });
    return rows[0] ?? null;
  }

  async insert(table: string, values: Record<string, unknown>): Promise<DynamicTableRow> {
    this.assertWritesEnabled();
    const { schema, db } = await this.ensureLoaded();
    assertTable(schema, table);
    assertWritableColumns(schema, table, Object.keys(values));
    const proxy = dynamicTableProxy(table, schema);
    return await db.insert(proxy, values).wait({ tier: this.config.durability });
  }

  async update(
    table: string,
    id: string,
    values: Record<string, unknown>,
  ): Promise<DynamicTableRow | null> {
    this.assertWritesEnabled();
    const { schema, db } = await this.ensureLoaded();
    assertTable(schema, table);
    assertWritableColumns(schema, table, Object.keys(values));
    const proxy = dynamicTableProxy(table, schema);
    await db.update(proxy, id, values).wait({ tier: this.config.durability });
    return await this.getRow(table, id);
  }

  async delete(table: string, id: string): Promise<{ id: string; deleted: true }> {
    this.assertWritesEnabled();
    const { schema, db } = await this.ensureLoaded();
    assertTable(schema, table);
    const proxy = dynamicTableProxy(table, schema);
    await db.delete(proxy, id).wait({ tier: this.config.durability });
    return { id, deleted: true };
  }

  private assertWritesEnabled(): void {
    if (!this.config.allowWrites) {
      throw new Error(
        "Jazz mutations are disabled. Set JAZZ_MCP_ALLOW_WRITES=true to enable insert/update/delete tools.",
      );
    }
  }

  private async ensureLoaded(): Promise<LoadedState> {
    if (this.state) return this.state;
    if (this.loading) return await this.loading;
    this.loading = this.load();
    try {
      this.state = await this.loading;
      return this.state;
    } finally {
      this.loading = undefined;
    }
  }

  private async load(): Promise<LoadedState> {
    const catalogue = await fetchSchemaHashes(this.config.serverUrl, {
      appId: this.config.appId,
      adminSecret: this.config.adminSecret,
    });
    const schemaHash = this.config.schemaHash ?? pickLatestSchemaHash(catalogue);
    if (!schemaHash) {
      throw new Error(
        "The Jazz server has no published schema. Run your app in dev long enough to auto-sync its schema, or publish it with `npx jazz-tools@alpha deploy` before starting this MCP connector.",
      );
    }
    if (!catalogue.hashes.includes(schemaHash)) {
      throw new Error(`Configured JAZZ_SCHEMA_HASH is not published on this server: ${schemaHash}`);
    }

    const stored = await fetchStoredWasmSchema(this.config.serverUrl, {
      appId: this.config.appId,
      adminSecret: this.config.adminSecret,
      schemaHash,
    });

    const context = createJazzContext({
      appId: this.config.appId,
      driver: { type: "memory" },
      serverUrl: this.config.serverUrl,
      backendSecret: this.config.backendSecret,
      adminSecret: this.config.adminSecret,
      env: this.config.env,
      userBranch: this.config.branch,
      defaultDurabilityTier: this.config.durability,
    });

    // Exact self-host example compatibility: the server accepts admin_secret
    // in the WebSocket handshake as backend access. When backendSecret is
    // configured, use the explicitly backend-scoped handles from Jazz.
    const db = this.config.backendSecret
      ? this.config.principal
        ? context.withAttribution(this.config.principal, stored.schema)
        : context.asBackend(stored.schema)
      : context.db(stored.schema);

    return {
      schema: stored.schema,
      schemaHash,
      schemaPublishedAt: stored.publishedAt,
      context,
      db,
    };
  }
}

export function pickLatestSchemaHash(catalogue: {
  hashes: string[];
  schemas: Array<{ hash: string; publishedAt: number | null }>;
}): string | undefined {
  const withDates = catalogue.schemas.filter(
    (entry): entry is { hash: string; publishedAt: number } => entry.publishedAt !== null,
  );
  if (withDates.length > 0) {
    return [...withDates].sort((a, b) => a.publishedAt - b.publishedAt).at(-1)?.hash;
  }
  return catalogue.hashes.at(-1);
}
