/**
 * Authentication and Authorization Module
 * 
 * Handles user authentication, JWT token management, and authorization middleware.
 * Uses bcrypt for password hashing and JWT for stateless authentication.
 * 
 * Key Features:
 * - JWT token generation and verification
 * - Password hashing and comparison
 * - Authentication middleware for protected routes
 * - Role-based authorization (admin, user roles)
 * 
 * Security Notes:
 * - JWT secret should be set via JWT_SECRET environment variable
 * - Tokens expire after 7 days
 * - Passwords are hashed with bcrypt (10 salt rounds)
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import type { AuthUser, UserRole } from '@shared/schema';
import type { SubdomainRequest } from './subdomain';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export interface AuthRequest extends Request {
  user?: AuthUser;
  subdomain?: string;
  tenantOrg?: {
    id: string;
    name: string;
    subdomain: string;
  };
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Middleware to authenticate requests
// Also validates tenant access when subdomain middleware has run
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  req.user = user;
  
  // Validate tenant access: if accessing via a subdomain, user must belong to that org
  if (req.tenantOrg && user.organizationId !== req.tenantOrg.id) {
    return res.status(403).json({ 
      message: 'Access denied: You do not belong to this organization',
      error: 'TENANT_MISMATCH'
    });
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