/**
 * Server configuration constants and settings
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

// Load config.json
let configData: any = {};
const configPath = path.join(process.cwd(), 'config.json');
if (existsSync(configPath)) {
  try {
    configData = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (error) {
    console.warn('Failed to load config.json:', error);
  }
}

/**
 * AI Model Configuration
 */
export const AI_CONFIG = {
  models: {
    default: configData?.ai?.models?.default || process.env.AI_MODEL || 'gemini-2.5-pro',
    extraction: configData?.ai?.models?.extraction || 'gemini-2.5-pro',
    flash: configData?.ai?.models?.flash || 'gemini-2.5-flash',
    imageGeneration: configData?.ai?.models?.imageGeneration || 'gemini-2.0-flash-preview-image-generation'
  },
  temperature: configData?.ai?.temperature || 0.7,
  maxRetries: configData?.ai?.maxRetries || 3,
  timeout: configData?.ai?.timeout || 30000, // 30 seconds
};

/**
 * Extraction Configuration
 */
export const EXTRACTION_CONFIG = {
  maxContentLength: configData?.extraction?.maxContentLength || 2000,
  batchSize: configData?.extraction?.batchSize || 10,
  tokenLimit: configData?.extraction?.tokenLimit || 8192,
  maxBatchSizeForColumnName: configData?.extraction?.maxBatchSizeForColumnName || 10,
  minConfidenceScore: configData?.extraction?.minConfidenceScore || 70,
  defaultConfidenceScore: 85,
  highConfidenceScore: 95
};

/**
 * Session Configuration
 */
export const SESSION_CONFIG = {
  secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-in-production',
  cookie: {
    maxAge: configData?.server?.sessionTimeout || 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const
  },
  resave: false,
  saveUninitialized: false,
  name: 'extrapl.sid'
};

/**
 * Database Configuration
 */
export const DATABASE_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  connectionTimeout: configData?.database?.connectionTimeout || 5000,
  maxConnections: configData?.database?.maxConnections || 20,
  idleTimeout: configData?.database?.idleTimeout || 10000
};

/**
 * File Processing Configuration
 */
export const FILE_CONFIG = {
  maxFileSize: configData?.document?.maxFileSize || 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: configData?.document?.allowedMimeTypes || [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg'
  ],
  extractionTimeout: configData?.document?.extractionTimeout || 120000 // 2 minutes
};

/**
 * Server Configuration
 */
export const SERVER_CONFIG = {
  port: process.env.PORT || configData?.server?.port || 5000,
  corsOrigins: configData?.server?.corsOrigins || ['http://localhost:5000', 'http://localhost:3000'],
  requestSizeLimit: configData?.server?.requestSizeLimit || '50mb',
  environment: process.env.NODE_ENV || 'development'
};

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Authentication Configuration
 */
export const AUTH_CONFIG = {
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  jwtExpiry: process.env.JWT_EXPIRY || '7d',
  bcryptRounds: 10,
  passwordMinLength: 8,
  passwordMaxLength: 128
};

/**
 * Validation Patterns
 */
export const VALIDATION_PATTERNS = {
  email: configData?.validation?.emailRegex || /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: configData?.validation?.phoneRegex || /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
};

/**
 * Limits Configuration
 */
export const LIMITS = {
  maxProjectsPerUser: configData?.limits?.maxProjectsPerUser || 100,
  maxSessionsPerProject: configData?.limits?.maxSessionsPerProject || 500,
  maxDocumentsPerSession: configData?.limits?.maxDocumentsPerSession || 50,
  maxCollectionsPerProject: configData?.limits?.maxCollectionsPerProject || 20,
  maxPropertiesPerCollection: configData?.limits?.maxPropertiesPerCollection || 50
};

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  BAD_REQUEST: 'Invalid request data',
  INTERNAL_ERROR: 'An internal error occurred',
  DATABASE_ERROR: 'Database operation failed',
  VALIDATION_ERROR: 'Validation failed',
  EXTRACTION_ERROR: 'Extraction process failed',
  FILE_TOO_LARGE: 'File size exceeds maximum limit',
  UNSUPPORTED_FILE: 'File type not supported',
  SESSION_EXPIRED: 'Session has expired, please login again'
};

/**
 * Success Messages
 */
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  PROJECT_CREATED: 'Project created successfully',
  PROJECT_UPDATED: 'Project updated successfully',
  PROJECT_DELETED: 'Project deleted successfully',
  EXTRACTION_COMPLETE: 'Extraction completed successfully',
  VALIDATION_COMPLETE: 'Validation completed successfully'
};

/**
 * Default Values
 */
export const DEFAULTS = {
  organizationId: '550e8400-e29b-41d4-a716-446655440000',
  defaultRole: 'user',
  defaultProjectStatus: 'active',
  defaultValidationStatus: 'pending'
};

/**
 * Feature Flags
 */
export const FEATURES = {
  enableDebugLogging: process.env.ENABLE_DEBUG_LOGGING === 'true',
  enableAIFeatures: process.env.ENABLE_AI_FEATURES !== 'false', // Default true
  enableDocumentProcessing: process.env.ENABLE_DOCUMENT_PROCESSING !== 'false' // Default true
};