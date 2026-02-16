/**
 * Structured Logger
 *
 * Provides structured logging with two output modes:
 * - Human-readable format for development
 * - JSON format for CloudWatch ingestion in production
 *
 * Encryption functions have been moved to server/encryption.ts.
 * Re-exported here for backwards compatibility with existing imports.
 *
 * ISO 27001 A.12.4: Logging and monitoring
 */

import crypto from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const isProduction = process.env.NODE_ENV === 'production';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, context: string, message: string, meta?: Record<string, any>): string {
  if (isProduction) {
    // Structured JSON for CloudWatch
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      context,
      message,
      ...meta,
    });
  }
  // Human-readable for development
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}${metaStr}`;
}

export function createLogger(context: string) {
  return {
    debug(message: string, meta?: Record<string, any>) {
      if (shouldLog('debug')) console.debug(formatMessage('debug', context, message, meta));
    },
    info(message: string, meta?: Record<string, any>) {
      if (shouldLog('info')) console.log(formatMessage('info', context, message, meta));
    },
    warn(message: string, meta?: Record<string, any>) {
      if (shouldLog('warn')) console.warn(formatMessage('warn', context, message, meta));
    },
    error(message: string, meta?: Record<string, any>) {
      if (shouldLog('error')) console.error(formatMessage('error', context, message, meta));
    },
  };
}

export function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

// Re-export encryption functions from the dedicated module for backwards compatibility
export { encryptCredential, decryptCredential } from './encryption';
