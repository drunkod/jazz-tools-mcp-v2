import type { IncomingMessage } from "node:http";

export type BffRequest = IncomingMessage;

export type Capability = "schema:read" | "data:read" | "data:mutate";

export interface OperatorSession {
  operatorId: string;
  displayName: string;
  roles: string[];
  expiresAt: string;
  csrfToken: string;
  /** A server-side/session-store identifier or a pre-hashed equivalent. */
  sessionIdHash?: string;
}

export interface IdentityPort {
  resolveSession(request: BffRequest): Promise<OperatorSession | null>;
}

export interface AuthorizationInput {
  session: OperatorSession;
  connectionId: string;
  environment: string;
  table?: string;
  capability: Capability;
  elevationId?: string;
}

export interface AuthorizationPort {
  isAllowed(input: AuthorizationInput): Promise<boolean>;
}

export interface ElevationRequest {
  session: OperatorSession;
  connectionId: string;
  environment: string;
  capability: Capability;
  reason: string;
  reauthenticationProof: string;
}

export interface Elevation {
  elevationId: string;
  connectionId: string;
  capability: Capability;
  expiresAt: string;
}

export interface ElevationPort {
  create(input: ElevationRequest): Promise<Elevation | null>;
  resolve(input: {
    session: OperatorSession;
    connectionId: string;
    capability: Capability;
    elevationId: string;
  }): Promise<boolean>;
}

export type AuditAction =
  | "session.read"
  | "connection.list"
  | "schema.read"
  | "data.query"
  | "data.mutate"
  | "elevation.create";
export type AuditDecision = "allowed" | "denied";
export type AuditOutcome = "succeeded" | "failed";

export interface AuditEvent {
  eventVersion: 1;
  eventId: string;
  occurredAt: string;
  requestId: string;
  operatorId: string;
  sessionIdHash?: string;
  source: {
    ip?: string;
    userAgent?: string;
  };
  target: {
    connectionId?: string;
    environment?: string;
    appId?: string;
    schemaHash?: string;
    table?: string;
    rowIds?: string[];
  };
  action: AuditAction;
  operationCounts?: {
    insert?: number;
    update?: number;
    delete?: number;
  };
  reason?: string;
  elevationId?: string;
  decision: AuditDecision;
  outcome: AuditOutcome;
  durationMs: number;
}

export interface AuditSink {
  emit(event: AuditEvent): Promise<void>;
}

export const denyAllAuthorization: AuthorizationPort = {
  async isAllowed(): Promise<boolean> {
    return false;
  },
};

export const denyAllIdentity: IdentityPort = {
  async resolveSession(): Promise<OperatorSession | null> {
    return null;
  },
};

export const denyAllElevation: ElevationPort = {
  async create(): Promise<null> {
    return null;
  },
  async resolve(): Promise<boolean> {
    return false;
  },
};

export const noopAuditSink: AuditSink = {
  async emit(): Promise<void> {
    // Auditing is best-effort at this seam; production must supply a durable sink.
  },
};
