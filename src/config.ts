export type DurabilityTier = "local" | "edge" | "global";

export interface ConnectorConfig {
  serverUrl: string;
  appId: string;
  adminSecret: string;
  backendSecret?: string;
  schemaHash?: string;
  allowWrites: boolean;
  durability: DurabilityTier;
  principal?: string;
  env: string;
  branch: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function envBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === undefined || value === "") return defaultValue;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  throw new Error(`${name} must be true/false, yes/no, on/off, or 1/0`);
}

function durabilityTier(value: string | undefined): DurabilityTier {
  const normalized = value?.trim().toLowerCase() || "edge";
  if (normalized === "local" || normalized === "edge" || normalized === "global") {
    return normalized;
  }
  throw new Error("JAZZ_MCP_DURABILITY must be local, edge, or global");
}

function normalizeServerUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("JAZZ_SERVER_URL must be an absolute http(s) URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("JAZZ_SERVER_URL must use http or https");
  }
  return url.toString().replace(/\/$/, "");
}

export function loadConfig(): ConnectorConfig {
  const backendSecret = optionalEnv("JAZZ_BACKEND_SECRET");
  const principal = optionalEnv("JAZZ_MCP_PRINCIPAL");

  if (principal && !backendSecret) {
    throw new Error("JAZZ_MCP_PRINCIPAL requires JAZZ_BACKEND_SECRET");
  }

  return {
    serverUrl: normalizeServerUrl(requiredEnv("JAZZ_SERVER_URL")),
    appId: requiredEnv("JAZZ_APP_ID"),
    adminSecret: requiredEnv("JAZZ_ADMIN_SECRET"),
    backendSecret,
    schemaHash: optionalEnv("JAZZ_SCHEMA_HASH"),
    allowWrites: envBoolean("JAZZ_MCP_ALLOW_WRITES", false),
    durability: durabilityTier(process.env.JAZZ_MCP_DURABILITY),
    principal,
    env: optionalEnv("JAZZ_ENV") ?? "dev",
    branch: optionalEnv("JAZZ_BRANCH") ?? "main",
  };
}
