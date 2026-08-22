import type { ConnectorConfig, DurabilityTier } from "../config.js";
import type { Capability } from "./ports.js";

export interface ConnectionEntry {
  readonly id: string;
  readonly label: string;
  readonly environment: string;
  readonly displaySafeAppId: string;
  readonly capabilities: readonly Capability[];
  /** Resolves secrets only on the server. Never serialize the returned config. */
  readonly resolveConfig: () => ConnectorConfig;
}

export interface ConnectionRegistry {
  get(connectionId: string): ConnectionEntry | undefined;
  values(): Iterable<ConnectionEntry>;
}

export interface ConnectionDefinition {
  id: string;
  label: string;
  environment: string;
  displaySafeAppId: string;
  capabilities: Capability[];
  resolveConfig: () => ConnectorConfig;
}

const CAPABILITIES: readonly Capability[] = ["schema:read", "data:read", "data:mutate"];
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function createConnectionRegistry(entries: readonly ConnectionDefinition[]): ConnectionRegistry {
  const map = new Map<string, ConnectionEntry>();
  for (const entry of entries) {
    assertConnectionId(entry.id);
    if (map.has(entry.id)) throw new Error(`Duplicate BFF connection id: ${entry.id}`);
    if (!entry.label.trim() || !entry.environment.trim() || !entry.displaySafeAppId.trim()) {
      throw new Error(`BFF connection ${entry.id} is missing display metadata`);
    }
    for (const capability of entry.capabilities) {
      if (!CAPABILITIES.includes(capability)) {
        throw new Error(`Unsupported capability on BFF connection ${entry.id}`);
      }
    }
    map.set(entry.id, {
      id: entry.id,
      label: entry.label,
      environment: entry.environment,
      displaySafeAppId: entry.displaySafeAppId,
      capabilities: [...new Set(entry.capabilities)],
      resolveConfig: entry.resolveConfig,
    });
  }

  return {
    get: (connectionId) => map.get(connectionId),
    values: () => map.values(),
  };
}

interface EnvironmentConnectionDefinition {
  id: string;
  label: string;
  environment: string;
  displaySafeAppId: string;
  capabilities: Capability[];
  serverUrlEnv: string;
  appIdEnv: string;
  adminSecretEnv: string;
  backendSecretEnv?: string;
  schemaHashEnv?: string;
  allowWrites?: boolean;
  durability?: DurabilityTier;
  principalEnv?: string;
  branchEnv?: string;
}

/**
 * Load a deploy-time allowlist. The JSON contains environment-variable names,
 * not secret values; the values are read only when the server resolves a
 * connection after authorization.
 */
export function loadConnectionRegistry(
  environment: NodeJS.ProcessEnv = process.env,
): ConnectionRegistry {
  const raw = environment.JAZZ_BFF_CONNECTIONS?.trim();
  if (!raw) return createConnectionRegistry([]);

  let definitions: unknown;
  try {
    definitions = JSON.parse(raw);
  } catch (error) {
    throw new Error("JAZZ_BFF_CONNECTIONS must be valid JSON", { cause: error });
  }
  if (!Array.isArray(definitions)) {
    throw new Error("JAZZ_BFF_CONNECTIONS must be a JSON array");
  }

  return createConnectionRegistry(
    definitions.map((value, index) => {
      const definition = asEnvironmentDefinition(value, index);
      return {
        id: definition.id,
        label: definition.label,
        environment: definition.environment,
        displaySafeAppId: definition.displaySafeAppId,
        capabilities: definition.capabilities,
        resolveConfig: () => ({
          serverUrl: normalizeServerUrl(requiredEnv(environment, definition.serverUrlEnv)),
          appId: requiredEnv(environment, definition.appIdEnv),
          adminSecret: requiredEnv(environment, definition.adminSecretEnv),
          backendSecret: optionalEnv(environment, definition.backendSecretEnv),
          schemaHash: optionalEnv(environment, definition.schemaHashEnv),
          allowWrites: definition.allowWrites ?? definition.capabilities.includes("data:mutate"),
          durability: definition.durability ?? "edge",
          principal: optionalEnv(environment, definition.principalEnv),
          env: definition.environment,
          branch: optionalEnv(environment, definition.branchEnv) ?? "main",
        }),
      };
    }),
  );
}

function asEnvironmentDefinition(value: unknown, index: number): EnvironmentConnectionDefinition {
  if (!isRecord(value)) throw new Error(`BFF connection ${index} must be an object`);
  const capabilities = value.capabilities;
  if (
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    typeof value.environment !== "string" ||
    typeof value.displaySafeAppId !== "string" ||
    !Array.isArray(capabilities) ||
    !capabilities.every((item): item is Capability => CAPABILITIES.includes(item as Capability)) ||
    typeof value.serverUrlEnv !== "string" ||
    typeof value.appIdEnv !== "string" ||
    typeof value.adminSecretEnv !== "string"
  ) {
    throw new Error(`BFF connection ${index} has invalid metadata or secret references`);
  }
  return value as unknown as EnvironmentConnectionDefinition;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertConnectionId(id: string): void {
  if (!OPAQUE_ID.test(id)) throw new Error(`Invalid opaque BFF connection id: ${id}`);
}

function requiredEnv(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for a BFF connection`);
  return value;
}

function optionalEnv(environment: NodeJS.ProcessEnv, name: string | undefined): string | undefined {
  if (!name) return undefined;
  const value = environment[name]?.trim();
  return value || undefined;
}

function normalizeServerUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("BFF server URL must be an absolute http(s) URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BFF server URL must use http or https");
  }
  return url.toString().replace(/\/$/, "");
}
