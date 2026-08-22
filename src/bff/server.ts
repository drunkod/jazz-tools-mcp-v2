import { createServer, type Server } from "node:http";
import { loadConnectionRegistry, type ConnectionRegistry } from "./connection-registry.js";
import {
  denyAllAuthorization,
  denyAllElevation,
  denyAllIdentity,
  type AuditSink,
  type AuthorizationPort,
  type ElevationPort,
  type IdentityPort,
  type OperatorSession,
} from "./ports.js";
import { handleBffRequest, type BffDependencies } from "./router.js";
import { RedactingAuditSink } from "./redaction.js";

export function createBffServer(dependencies: BffDependencies): Server {
  return createServer((request, response) => {
    void handleBffRequest(request, response, dependencies).catch(() => {
      if (!response.writableEnded) {
        response.statusCode = 500;
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.end(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Internal server error." } }));
      }
    });
  });
}

export interface StaticRoleOptions {
  session: OperatorSession;
  grants: readonly {
    connectionId: string;
    environment: string;
    capability: "schema:read" | "data:read" | "data:mutate";
    table?: string;
  }[];
}

/** Explicit local/test adapter. Do not use this adapter for production identity. */
export function createStaticRoleAdapters(options: StaticRoleOptions): {
  identity: IdentityPort;
  authorization: AuthorizationPort;
} {
  return {
    identity: {
      async resolveSession(): Promise<OperatorSession> {
        return options.session;
      },
    },
    authorization: {
      async isAllowed(input): Promise<boolean> {
        return options.grants.some(
          (grant) =>
            grant.connectionId === input.connectionId &&
            grant.environment === input.environment &&
            grant.capability === input.capability &&
            (grant.table === undefined || grant.table === input.table),
        );
      },
    },
  };
}

export class ConsoleAuditSink implements AuditSink {
  async emit(event: Parameters<AuditSink["emit"]>[0]): Promise<void> {
    console.error(JSON.stringify(event));
  }
}

/** Safe default for a production process until policy adapters are configured. */
export function createFailClosedBffDependencies(
  registry: ConnectionRegistry = loadConnectionRegistry(),
): BffDependencies {
  return {
    registry,
    identity: denyAllIdentity,
    authorization: denyAllAuthorization,
    elevations: denyAllElevation,
    audit: new RedactingAuditSink(new ConsoleAuditSink()),
  };
}
