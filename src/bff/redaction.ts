import type { AuditEvent, AuditSink } from "./ports.js";

const SENSITIVE_ASSIGNMENT =
  /(adminSecret|backendSecret|password|authorization|cookie|csrf(?:Token)?|idp(?:Token)?|token)\s*[:=]\s*[^,\s]+/gi;

export interface RedactionOptions {
  includeRowIds?: boolean;
}

/** Keep the audit boundary allowlisted even if a future caller adds unsafe fields. */
export function redactAuditEvent(event: AuditEvent, options: RedactionOptions = {}): AuditEvent {
  const target: AuditEvent["target"] = {
    connectionId: event.target.connectionId,
    environment: event.target.environment,
    appId: event.target.appId,
    schemaHash: event.target.schemaHash,
    table: event.target.table,
  };
  if (options.includeRowIds && event.target.rowIds) {
    target.rowIds = event.target.rowIds.map((rowId) => redactString(rowId).slice(0, 256));
  }

  return {
    eventVersion: 1,
    eventId: redactString(event.eventId).slice(0, 256),
    occurredAt: event.occurredAt,
    requestId: redactString(event.requestId).slice(0, 256),
    operatorId: redactString(event.operatorId).slice(0, 256),
    sessionIdHash: event.sessionIdHash ? redactString(event.sessionIdHash).slice(0, 256) : undefined,
    source: {
      ip: event.source.ip ? redactString(event.source.ip).slice(0, 128) : undefined,
      userAgent: event.source.userAgent
        ? redactString(event.source.userAgent).slice(0, 256)
        : undefined,
    },
    target,
    action: event.action,
    operationCounts: event.operationCounts
      ? {
          insert: event.operationCounts.insert,
          update: event.operationCounts.update,
          delete: event.operationCounts.delete,
        }
      : undefined,
    reason: event.reason ? redactString(event.reason).slice(0, 1_000) : undefined,
    elevationId: event.elevationId
      ? redactString(event.elevationId).slice(0, 256)
      : undefined,
    decision: event.decision,
    outcome: event.outcome,
    durationMs: Number.isFinite(event.durationMs) ? Math.max(0, Math.round(event.durationMs)) : 0,
  };
}

export class RedactingAuditSink implements AuditSink {
  constructor(
    private readonly sink: AuditSink,
    private readonly options: RedactionOptions = {},
  ) {}

  async emit(event: AuditEvent): Promise<void> {
    await this.sink.emit(redactAuditEvent(event, this.options));
  }
}

function redactString(value: string): string {
  return value.replace(SENSITIVE_ASSIGNMENT, (match) => {
    const separator = match.includes("=") ? "=" : ":";
    const key = match.slice(0, match.search(/\s*[:=]/));
    return `${key}${separator}[REDACTED]`;
  });
}
