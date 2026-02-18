/**
 * Authentication and Authorization Module
 *
 * Handles user authentication, JWT token management, and authorization middleware.
 * Uses bcrypt for password hashing and JWT for stateless authentication.
 *
 * ISO 27001 A.8/A.9 compliance:
 * - Short-lived access tokens (15 min) with refresh token rotation
 * - JWT secret required from environment (no fallbacks)
 * - Passwords hashed with bcrypt (12 salt rounds)
 * - Role-based authorization (admin, user)
 * - Multi-tenant access validation
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import type { AuthUser, UserRole } from '@shared/schema';
import type { SubdomainRequest } from './subdomain';

// Require JWT_SECRET from environment - no fallback
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  );
}

// Access token lifetime: 15 minutes (ISO 27001 A.9 - session management)
const ACCESS_TOKEN_EXPIRY = '15m';
// Refresh token lifetime: 7 days
const REFRESH_TOKEN_EXPIRY = '7d';

export interface AuthRequest extends Request {
  user?: AuthUser;
  subdomain?: string;
  tenantOrg?: {
    id: string;
    name: string;
    subdomain: string;
  };
}

/**
 * Generate a short-lived access token (JWT).
 */
export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      role: user.role,
    },
    JWT_SECRET!,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate an opaque refresh token.
 * Returns both the raw token (sent to client) and its SHA-256 hash (stored in DB).
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Hash a refresh token for storage comparison.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as AuthUser;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12); // Increased from 10 to 12 rounds
}

export function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Middleware to authenticate requests
// Also validates tenant access when subdomain middleware has run
// Checks junction table for multi-org membership
export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  req.user = user;

  // Validate tenant access: if accessing via a subdomain, check junction table for membership
  if (req.tenantOrg) {
    // First check if primary org matches (fast path)
    if (user.organizationId !== req.tenantOrg.id) {
      // Check junction table for multi-org membership
      const { storage } = await import('./storage');
      const userOrgs = await storage.getUserOrganizations(user.id);
      const belongsToTenant = userOrgs.some(uo => uo.organizationId === req.tenantOrg!.id);

      if (!belongsToTenant) {
        return res.status(403).json({
          message: 'Access denied: You do not belong to this organization',
          error: 'TENANT_MISMATCH'
        });
      }
    }
  }

  next();
}

// Middleware to check if user has admin role
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
}

// Middleware to check if user belongs to the same organization
export function requireSameOrganization(organizationId: number) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.organizationId !== organizationId) {
      return res.status(403).json({ message: 'Access denied: different organization' });
    }

    next();
  };
}
