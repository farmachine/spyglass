import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

export interface SubdomainRequest extends Request {
  subdomain?: string;
  tenantOrg?: {
    id: string;
    name: string;
    subdomain: string;
    type: string;
  };
}

const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'localhost'];

export function extractSubdomain(host: string, baseDomain?: string): string | null {
  if (!host) return null;
  
  const hostWithoutPort = host.split(':')[0];
  
  if (hostWithoutPort === 'localhost' || hostWithoutPort.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return null;
  }
  
  if (baseDomain) {
    if (hostWithoutPort === baseDomain) return null;
    if (hostWithoutPort.endsWith('.' + baseDomain)) {
      const subdomain = hostWithoutPort.slice(0, -(baseDomain.length + 1));
      if (subdomain && !subdomain.includes('.')) {
        return subdomain;
      }
    }
    return null;
  }
  
  const parts = hostWithoutPort.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (!RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
      return subdomain;
    }
  }
  
  return null;
}

export function isValidSubdomain(subdomain: string): boolean {
  if (!subdomain || subdomain.length < 2 || subdomain.length > 63) {
    return false;
  }
  
  if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
    return false;
  }
  
  const validPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;
  return validPattern.test(subdomain);
}

export function subdomainMiddleware(baseDomain?: string) {
  return async (req: SubdomainRequest, res: Response, next: NextFunction) => {
    const host = req.headers.host || req.hostname;
    const subdomain = extractSubdomain(host, baseDomain);
    
    if (subdomain) {
      req.subdomain = subdomain;
      
      try {
        const org = await storage.getOrganizationBySubdomain(subdomain);
        if (org) {
          req.tenantOrg = {
            id: org.id,
            name: org.name,
            subdomain: org.subdomain!,
            type: org.type || 'regular'
          };
        }
      } catch (error) {
        console.error('Error looking up organization by subdomain:', error);
      }
    }
    
    next();
  };
}

export function requireTenant(req: SubdomainRequest, res: Response, next: NextFunction) {
  if (!req.tenantOrg) {
    return res.status(404).json({ 
      message: 'Organization not found',
      error: 'TENANT_NOT_FOUND'
    });
  }
  next();
}

export function validateTenantAccess(req: SubdomainRequest, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!user) {
    return next();
  }
  
  if (req.tenantOrg && user.organizationId !== req.tenantOrg.id) {
    return res.status(403).json({ 
      message: 'Access denied: You do not belong to this organization',
      error: 'TENANT_MISMATCH'
    });
  }
  
  next();
}
