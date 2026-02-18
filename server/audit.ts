/**
 * Audit Logging Module
 *
 * Provides security event audit logging for ISO 27001 compliance (A.12.4).
 * Audit events are logged as structured JSON and sent to a dedicated
 * CloudWatch log group with 365-day retention in production.
 *
 * Captures: authentication events, data access, admin actions, config changes.
 */

import { Request } from 'express';
import type { AuthRequest } from './auth';

export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.token_refresh'
  | 'auth.mfa_setup'
  | 'auth.mfa_verify'
  | 'auth.password_change'
  | 'auth.password_reset'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.role_change'
  | 'org.create'
  | 'org.update'
  | 'org.delete'
  | 'org.member_add'
  | 'org.member_remove'
  | 'project.create'
  | 'project.update'
  | 'project.delete'
  | 'session.create'
  | 'session.delete'
  | 'document.upload'
  | 'document.download'
  | 'document.delete'
  | 'extraction.run'
  | 'export.generate'
  | 'config.update'
  | 'inbox.configure'
  | 'inbox.delete';

export type AuditOutcome = 'success' | 'failure' | 'denied';

export interface AuditEvent {
  timestamp: string;
  eventType: 'audit';
  action: AuditAction;
  outcome: AuditOutcome;
  userId?: string;
  userEmail?: string;
  organizationId?: string;
  resource?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  details?: Record<string, any>;
}

/**
 * Extract client IP from request, handling proxied requests.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Log an audit event. In production, outputs structured JSON to stdout
 * which is captured by CloudWatch Logs. In development, outputs
 * human-readable format.
 */
export function auditLog(
  action: AuditAction,
  outcome: AuditOutcome,
  req?: AuthRequest,
  details?: {
    resource?: string;
    resourceId?: string;
    extra?: Record<string, any>;
  }
): void {
  const event: AuditEvent = {
    timestamp: new Date().toISOString(),
    eventType: 'audit',
    action,
    outcome,
    userId: req?.user?.id,
    userEmail: req?.user?.email,
    organizationId: req?.user?.organizationId,
    resource: details?.resource,
    resourceId: details?.resourceId,
    ip: req ? getClientIp(req) : undefined,
    userAgent: req?.headers['user-agent'],
    requestId: (req as any)?.requestId,
    details: details?.extra,
  };

  if (process.env.NODE_ENV === 'production') {
    // Structured JSON line for CloudWatch ingestion
    console.log(JSON.stringify(event));
  } else {
    const userStr = event.userEmail || event.userId || 'anonymous';
    const resourceStr = event.resource ? ` on ${event.resource}${event.resourceId ? `:${event.resourceId}` : ''}` : '';
    console.log(
      `[AUDIT] ${event.timestamp} ${event.action} ${event.outcome} by ${userStr}${resourceStr}`
    );
  }
}
