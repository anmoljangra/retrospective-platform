import { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tenantMemberships, tenants } from '../db/schema.js';
import { TenantRole } from '@retrospace/shared';

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
}

export interface MembershipContext {
  id: string;
  role: TenantRole;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      membership?: MembershipContext;
    }
  }
}

export async function requireTenant(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    // Resolve tenant ID from route params or X-Tenant-Id header
    const tenantId =
      (req.params.tenantId as string) ||
      (req.headers['x-tenant-id'] as string) ||
      (req.query.tenantId as string);

    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TENANT_REQUIRED',
          message: 'Tenant context is required (via route param or X-Tenant-Id header)',
        },
      });
      return;
    }

    // Verify tenant exists and user has active membership
    const [membershipRecord] = await db
      .select({
        membershipId: tenantMemberships.id,
        role: tenantMemberships.role,
        tenantId: tenants.id,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.userId, req.user.id)
        )
      )
      .limit(1);

    if (!membershipRecord) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: You are not a member of this organization',
        },
      });
      return;
    }

    req.tenant = {
      id: membershipRecord.tenantId,
      name: membershipRecord.tenantName,
      slug: membershipRecord.tenantSlug,
    };

    req.membership = {
      id: membershipRecord.membershipId,
      role: membershipRecord.role as TenantRole,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireTenantRole(allowedRoles: TenantRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.membership) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Tenant context missing',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.membership.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Action requires one of the following roles: ${allowedRoles.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}

