import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { JazzConnector, type QueryInput } from "../connector.js";
import type { ConnectorConfig } from "../config.js";
import type { ConnectionEntry, ConnectionRegistry } from "./connection-registry.js";
import {
  elevationRequestSchema,
  mutationsRequestSchema,
  queryRequestSchema,
  type MutationOperation,
} from "./schemas.js";
import {
  type AuditAction,
  type AuditEvent,
  type AuditSink,
  type AuthorizationPort,
  denyAllAuthorization,
  denyAllElevation,
  denyAllIdentity,
  type ElevationPort,
  type IdentityPort,
  type OperatorSession,
} from "./ports.js";

const API_PREFIX = "/api/admin/v1";
const MAX_BODY_BYTES = 256 * 1024;

interface ConnectorLike {
  status(): Promise<Record<string, unknown>>;
  listTables(): Promise<Array<{ name: string; columnCount: number }>>;
  query(input: QueryInput): Promise<unknown[]>;
  getRow(table: string, id: string): Promise<Record<string, unknown> | null>;
  insert(table: string, values: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(
    table: string,
    id: string,
    values: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null>;
  delete(table: string, id: string): Promise<{ id: string; deleted: true }>;
  close(): Promise<void>;
}

export interface BffDependencies {
  identity?: IdentityPort;
  authorization?: AuthorizationPort;
  elevations?: ElevationPort;
  audit?: AuditSink;
  registry: ConnectionRegistry;
  connectorFactory?: (config: ConnectorConfig) => ConnectorLike;
  allowedOrigin?: string;
  now?: () => Date;
  requestId?: () => string;
}

interface ResolvedDependencies {
  identity: IdentityPort;
  authorization: AuthorizationPort;
  elevations: ElevationPort;
  audit: AuditSink;
  registry: ConnectionRegistry;
  connectorFactory: (config: ConnectorConfig) => ConnectorLike;
  now: () => Date;
  requestId: () => string;
  allowedOrigin?: string;
}

export async function handleBffRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: BffDependencies,
): Promise<void> {
  const deps = resolveDependencies(dependencies);
  const requestId = `req_${deps.requestId()}`;
  const startedAt = deps.now().getTime();
  const path = pathname(request.url);
  const action = actionForPath(path);

  if (!path.startsWith(`${API_PREFIX}/`)) {
    respond(response, 404, { requestId, error: { code: "NOT_FOUND", message: "Not found." } });
    return;
  }

  let session: OperatorSession | null = null;
  try {
    session = await deps.identity.resolveSession(request);
  } catch {
    session = null;
  }

  if (!session || isExpired(session, deps.now())) {
    await emitAudit(deps.audit, makeAudit({
      requestId,
      startedAt,
      session: null,
      action,
      decision: "denied",
      outcome: "failed",
    }));
    respondError(response, 401, requestId, "UNAUTHENTICATED", "Authentication is required.");
    return;
  }

  if (request.method === "GET" && path === `${API_PREFIX}/session`) {
    await emitAudit(deps.audit, makeAudit({
      requestId,
      startedAt,
      session,
      action: "session.read",
      decision: "allowed",
      outcome: "succeeded",
    }));
    respond(response, 200, {
      requestId,
      operator: { id: session.operatorId, displayName: session.displayName },
      expiresAt: session.expiresAt,
      roles: session.roles,
      elevations: [],
      csrfToken: session.csrfToken,
    });
    return;
  }

  if (request.method === "GET" && path === `${API_PREFIX}/connections`) {
    await handleConnections(requestId, startedAt, session, deps, response);
    return;
  }

  if (request.method === "GET" && path === `${API_PREFIX}/schema`) {
    await handleSchema(requestId, startedAt, session, deps, response);
    return;
  }

  if (request.method === "POST" && path === `${API_PREFIX}/query`) {
    await handleQuery(request, requestId, startedAt, session, deps, response);
    return;
  }

  if (request.method === "POST" && path === `${API_PREFIX}/mutations`) {
    await handleMutations(request, requestId, startedAt, session, deps, response);
    return;
  }

  if (request.method === "POST" && path === `${API_PREFIX}/elevations`) {
    await handleElevation(request, requestId, startedAt, session, deps, response);
    return;
  }

  respond(response, 404, { requestId, error: { code: "NOT_FOUND", message: "Not found." } });
}

async function handleConnections(
  requestId: string,
  startedAt: number,
  session: OperatorSession,
  deps: ResolvedDependencies,
  response: ServerResponse,
): Promise<void> {
  const connections: Array<{
    id: string;
    label: string;
    environment: string;
    appId: string;
    capabilities: readonly string[];
  }> = [];
  try {
    for (const entry of deps.registry.values()) {
      const visible = await hasAnyCapability(deps.authorization, session, entry);
      if (visible) {
        connections.push({
          id: entry.id,
          label: entry.label,
          environment: entry.environment,
          appId: entry.displaySafeAppId,
          capabilities: entry.capabilities,
        });
      }
    }
    await emitAudit(deps.audit, makeAudit({
      requestId,
      startedAt,
      session,
      action: "connection.list",
      decision: "allowed",
      outcome: "succeeded",
    }));
    respond(response, 200, { requestId, connections });
  } catch {
    await emitAudit(deps.audit, makeAudit({
      requestId,
      startedAt,
      session,
      action: "connection.list",
      decision: "allowed",
      outcome: "failed",
    }));
    respondError(response, 502, requestId, "UPSTREAM_FAILURE", "The admin service could not list connections.");
  }
}

async function handleSchema(
  requestId: string,
  startedAt: number,
  session: OperatorSession,
  deps: ResolvedDependencies,
  response: ServerResponse,
): Promise<void> {
  let connector: ConnectorLike | undefined;
  try {
    const entry = await firstAuthorizedEntry(deps.registry, session, deps.authorization, "schema:read");
    if (!entry) {
      await emitAudit(deps.audit, makeAudit({
        requestId,
        startedAt,
        session,
        action: "schema.read",
        decision: "denied",
        outcome: "failed",
      }));
      respondError(response, 403, requestId, "FORBIDDEN", "The requested operation is not permitted.");
      return;
    }
    const config = entry.resolveConfig();
    connector = deps.connectorFactory(config);
    const status = await connector.status();
    const tables = await connector.listTables();
    await emitAudit(deps.audit, makeAudit({
      requestId,
      startedAt,
      session,
      action: "schema.read",
      decision: "allowed",
      outcome: "succeeded",
      entry,
      schemaHash: asOptionalString(status.schemaHash),
    }));
    respond(response, 200, {
      requestId,
      schemaHash: asOptionalString(status.schemaHash),
      tables,
    });
  } catch {
    await emitAudit(deps.audit, makeAudit({
      requestId,
      startedAt,
      session,
      action: "schema.read",
      decision: "allowed",
      outcome: "failed",
    }));
    respondError(response, 502, requestId, "UPSTREAM_FAILURE", "The admin service could not read the schema.");
  } finally {
    await closeConnector(connector);
  }
}

async function handleQuery(
  request: IncomingMessage,
  requestId: string,
  startedAt: number,
  session: OperatorSession,
  deps: ResolvedDependencies,
  response: ServerResponse,
): Promise<void> {
  let entry: ConnectionEntry | undefined;
  let connector: ConnectorLike | undefined;
  let decision: AuditEvent["decision"] = "denied";
  let body: ReturnType<typeof queryRequestSchema.parse> | undefined;
  try {
    body = queryRequestSchema.parse(await readJson(request));
    entry = deps.registry.get(body.connectionId);
    if (!entry) {
      respondError(response, 403, requestId, "FORBIDDEN", "The requested operation is not permitted.");
      return;
    }
    const allowed = await isAllowed(deps.authorization, session, entry, "data:read", body.table);
    if (!allowed) {
      respondError(response, 403, requestId, "FORBIDDEN", "The requested operation is not permitted.");
      return;
    }
    decision = "allowed";
    connector = deps.connectorFactory(entry.resolveConfig());
    const status = await connector.status();
    if (status.schemaHash !== body.schemaHash) {
      respondError(response, 409, requestId, "STALE_SCHEMA", "The requested schema is no longer current.");
      return;
    }
    const rows = await connector.query(body as QueryInput);
    respond(response, 200, {
      requestId,
      schemaHash: body.schemaHash,
      rows,
      nextOffset: rows.length === body.limit ? body.offset + body.limit : null,
    });
    return;
  } catch (error) {
    if (isValidationError(error)) {
      respondError(response, 400, requestId, "INVALID_REQUEST", "The request is invalid.");
    } else {
      respondError(response, 502, requestId, "UPSTREAM_FAILURE", "The Jazz operation failed.");
    }
  } finally {
    await closeConnector(connector);
    await emitAudit(deps.audit, makeAudit({
      requestId,
      startedAt,
      session,
      action: "data.query",
      decision,
      outcome: response.statusCode >= 200 && response.statusCode < 300 ? "succeeded" : "failed",
      entry,
      schemaHash: body?.schemaHash,
      table: body?.table,
    }));
  }
}

async function handleMutations(
  request: IncomingMessage,
  requestId: string,
  startedAt: number,
  session: OperatorSession,
  deps: ResolvedDependencies,
  response: ServerResponse,
): Promise<void> {
  let entry: ConnectionEntry | undefined;
  let connector: ConnectorLike | undefined;
  let decision: AuditEvent["decision"] = "denied";
  let body: ReturnType<typeof mutationsRequestSchema.parse> | undefined;
  let config: ConnectorConfig | undefined;
  const rowIds: string[] = [];
  const operationCounts = { insert: 0, update: 0, delete: 0 };
  try {
    if (!validStateChangingRequest(request, session, deps.allowedOrigin)) {
      respondError(response, 403, requestId, "CSRF_REJECTED", "The state-changing request was rejected.");
      return;
    }
    body = mutationsRequestSchema.parse(await readJson(request));
    entry = deps.registry.get(body.connectionId);
    if (!entry) {
      respondError(response, 403, requestId, "FORBIDDEN", "The requested operation is not permitted.");
      return;
    }
    if (entry.environment === "prod") {
      if (!body.elevationId) {
        respondError(response, 403, requestId, "ELEVATION_REQUIRED", "Production mutations require an active elevation.");
        return;
      }
      const elevated = await deps.elevations.resolve({
        session,
        connectionId: entry.id,
        capability: "data:mutate",
        elevationId: body.elevationId,
      });
      if (!elevated) {
        respondError(response, 403, requestId, "FORBIDDEN", "The requested operation is not permitted.");
        return;
      }
    }
    const allowed = await isAllowed(
      deps.authorization,
      session,
      entry,
      "data:mutate",
      body.table,
      body.elevationId,
    );
    if (!allowed) {
      respondError(response, 403, requestId, "FORBIDDEN", "The requested operation is not permitted.");
      return;
    }
    decision = "allowed";
    config = entry.resolveConfig();
    connector = deps.connectorFactory(config);
    const status = await connector.status();
    if (status.schemaHash !== body.schemaHash) {
      respondError(response, 409, requestId, "STALE_SCHEMA", "The requested schema is no longer current.");
      return;
    }

    const results = [];
    for (const operation of body.operations) {
      const result = await applyOperation(connector, body.table, operation);
      operationCounts[operation.kind] += 1;
      const appliedRowId = asOptionalString(result.rowId);
      if (appliedRowId) rowIds.push(appliedRowId);
      results.push({ clientMutationId: operation.clientMutationId, ...result });
    }
    respond(response, 200, {
      requestId,
      results,
      durability: status.durability ?? config?.durability ?? "edge",
    });
  } catch (error) {
    if (isValidationError(error)) {
      respondError(response, 400, requestId, "INVALID_REQUEST", "The request is invalid.");
    } else {
      respondError(response, 502, requestId, "UPSTREAM_FAILURE", "The Jazz operation failed.");
    }
  } finally {
    await closeConnector(connector);
    await emitAudit(deps.audit, makeAudit({
      requestId,
      startedAt,
      session,
      action: "data.mutate",
      decision,
      outcome: response.statusCode >= 200 && response.statusCode < 300 ? "succeeded" : "failed",
      entry,
      schemaHash: body?.schemaHash,
      table: body?.table,
      reason: body?.reason,
      elevationId: body?.elevationId,
      operationCounts,
      rowIds,
    }));
  }
}

async function handleElevation(
  request: IncomingMessage,
  requestId: string,
  startedAt: number,
  session: OperatorSession,
  deps: ResolvedDependencies,
  response: ServerResponse,
): Promise<void> {
  let entry: ConnectionEntry | undefined;
  try {
    if (!validStateChangingRequest(request, session, deps.allowedOrigin)) {
      respondError(response, 403, requestId, "CSRF_REJECTED", "The state-changing request was rejected.");
      return;
    }
    const body = elevationRequestSchema.parse(await readJson(request));
    entry = deps.registry.get(body.connectionId);
    if (!entry) {
      respondError(response, 403, requestId, "FORBIDDEN", "The requested operation is not permitted.");
      return;
    }
    if (!(await isAllowed(deps.authorization, session, entry, body.capability))) {
      respondError(response, 403, requestId, "FORBIDDEN", "The requested operation is not permitted.");
      return;
    }
    const elevation = await deps.elevations.create({
      session,
      connectionId: entry.id,
      environment: entry.environment,
      capability: body.capability,
      reason: body.reason,
      reauthenticationProof: body.reauthenticationProof,
    });
    if (!elevation) {
      respondError(response, 403, requestId, "FORBIDDEN", "The requested operation is not permitted.");
      return;
    }
    respond(response, 200, { requestId, ...elevation });
  } catch (error) {
    if (isValidationError(error)) {
      respondError(response, 400, requestId, "INVALID_REQUEST", "The request is invalid.");
    } else {
      respondError(response, 502, requestId, "UPSTREAM_FAILURE", "The elevation service failed.");
    }
  } finally {
    await emitAudit(deps.audit, makeAudit({
      requestId,
      startedAt,
      session,
      action: "elevation.create",
      decision: response.statusCode >= 200 && response.statusCode < 300 ? "allowed" : "denied",
      outcome: response.statusCode >= 200 && response.statusCode < 300 ? "succeeded" : "failed",
      entry,
    }));
  }
}

function resolveDependencies(dependencies: BffDependencies): ResolvedDependencies {
  return {
    identity: dependencies.identity ?? denyAllIdentity,
    authorization: dependencies.authorization ?? denyAllAuthorization,
    elevations: dependencies.elevations ?? denyAllElevation,
    audit: dependencies.audit ?? { emit: async () => undefined },
    registry: dependencies.registry,
    connectorFactory: dependencies.connectorFactory ?? ((config) => new JazzConnector(config)),
    allowedOrigin: dependencies.allowedOrigin,
    now: dependencies.now ?? (() => new Date()),
    requestId: dependencies.requestId ?? (() => randomUUID()),
  };
}

async function applyOperation(
  connector: ConnectorLike,
  table: string,
  operation: MutationOperation,
): Promise<Record<string, unknown>> {
  if (operation.kind === "insert") {
    const row = await connector.insert(table, operation.values);
    const rowId = asOptionalString(row.id);
    if (!rowId) throw new Error("Jazz insert did not return a row id");
    return { status: "applied", rowId };
  }
  if (operation.kind === "update") {
    const existing = await waitForRow(connector, table, operation.rowId);
    if (!existing) return { status: "not_found", rowId: operation.rowId };
    const row = await connector.update(table, operation.rowId, operation.values);
    return { status: row ? "applied" : "not_found", rowId: operation.rowId };
  }
  const existing = await waitForRow(connector, table, operation.rowId);
  if (!existing) return { status: "not_found", rowId: operation.rowId };
  await connector.delete(table, operation.rowId);
  return { status: "applied", rowId: operation.rowId };
}

async function firstAuthorizedEntry(
  registry: ConnectionRegistry,
  session: OperatorSession,
  authorization: AuthorizationPort,
  capability: "schema:read" | "data:read" | "data:mutate",
): Promise<ConnectionEntry | undefined> {
  for (const entry of registry.values()) {
    if (entry.capabilities.includes(capability) && await isAllowed(authorization, session, entry, capability)) {
      return entry;
    }
  }
  return undefined;
}

async function hasAnyCapability(
  authorization: AuthorizationPort,
  session: OperatorSession,
  entry: ConnectionEntry,
): Promise<boolean> {
  for (const capability of entry.capabilities) {
    if (await isAllowed(authorization, session, entry, capability)) return true;
  }
  return false;
}

async function isAllowed(
  authorization: AuthorizationPort,
  session: OperatorSession,
  entry: ConnectionEntry,
  capability: "schema:read" | "data:read" | "data:mutate",
  table?: string,
  elevationId?: string,
): Promise<boolean> {
  if (!entry.capabilities.includes(capability)) return false;
  try {
    return await authorization.isAllowed({
      session,
      connectionId: entry.id,
      environment: entry.environment,
      table,
      capability,
      elevationId,
    });
  } catch {
    return false;
  }
}

function validStateChangingRequest(
  request: IncomingMessage,
  session: OperatorSession,
  allowedOrigin: string | undefined,
): boolean {
  const csrf = header(request, "x-csrf-token");
  if (!csrf || !session.csrfToken || csrf !== session.csrfToken) return false;
  const fetchSite = header(request, "sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  const origin = header(request, "origin");
  if (!origin) return true;
  if (allowedOrigin && origin !== allowedOrigin) return false;
  try {
    const originUrl = new URL(origin);
    const host = header(request, "host");
    return originUrl.host === host;
  } catch {
    return false;
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_BODY_BYTES) throw new RequestValidationError();
    chunks.push(buffer);
  }
  if (chunks.length === 0) throw new RequestValidationError();
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new RequestValidationError();
  }
}

class RequestValidationError extends Error {}

function isValidationError(error: unknown): boolean {
  return error instanceof RequestValidationError || (error !== null && typeof error === "object" && "issues" in error);
}

function pathname(url: string | undefined): string {
  try {
    return new URL(url ?? "/", "http://bff.invalid").pathname;
  } catch {
    return "/";
  }
}

function actionForPath(path: string): AuditAction {
  if (path.endsWith("/connections")) return "connection.list";
  if (path.endsWith("/schema")) return "schema.read";
  if (path.endsWith("/query")) return "data.query";
  if (path.endsWith("/mutations")) return "data.mutate";
  if (path.endsWith("/elevations")) return "elevation.create";
  return "session.read";
}

function isExpired(session: OperatorSession, now: Date): boolean {
  const expiresAt = Date.parse(session.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime();
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function respondError(
  response: ServerResponse,
  status: number,
  requestId: string,
  code: string,
  message: string,
): void {
  respond(response, status, { requestId, error: { code, message } });
}

function respond(response: ServerResponse, status: number, value: unknown): void {
  if (response.writableEnded) return;
  const body = JSON.stringify(value, (_key, currentValue: unknown) =>
    typeof currentValue === "bigint" ? String(currentValue) : currentValue,
  );
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(body);
}

async function closeConnector(connector: ConnectorLike | undefined): Promise<void> {
  if (!connector) return;
  await connector.close().catch(() => undefined);
}

async function emitAudit(sink: AuditSink, event: AuditEvent): Promise<void> {
  await sink.emit(event).catch(() => undefined);
}

function makeAudit(input: {
  requestId: string;
  startedAt: number;
  session: OperatorSession | null;
  action: AuditAction;
  decision: AuditEvent["decision"];
  outcome: AuditEvent["outcome"];
  entry?: ConnectionEntry;
  schemaHash?: string;
  table?: string;
  reason?: string;
  elevationId?: string;
  operationCounts?: AuditEvent["operationCounts"];
  rowIds?: string[];
}): AuditEvent {
  return {
    eventVersion: 1,
    eventId: `aud_${randomUUID()}`,
    occurredAt: new Date().toISOString(),
    requestId: input.requestId,
    operatorId: input.session?.operatorId ?? "anonymous",
    sessionIdHash: input.session?.sessionIdHash,
    source: { ip: "redacted" },
    target: {
      connectionId: input.entry?.id,
      environment: input.entry?.environment,
      appId: input.entry?.displaySafeAppId,
      schemaHash: input.schemaHash,
      table: input.table,
      rowIds: input.rowIds,
    },
    action: input.action,
    operationCounts: input.operationCounts,
    reason: input.reason,
    elevationId: input.elevationId,
    decision: input.decision,
    outcome: input.outcome,
    durationMs: Math.max(0, Date.now() - input.startedAt),
  };
}

async function waitForRow(
  connector: ConnectorLike,
  table: string,
  rowId: string,
): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + 2_000;
  while (true) {
    const row = await connector.getRow(table, rowId);
    if (row) return row;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
