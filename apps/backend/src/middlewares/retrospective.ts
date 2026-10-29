import { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { retrospectives, teams, teamMemberships } from '../db/schema.js';
import { TeamRole, TenantRole } from '@retrospace/shared';

export interface RetrospectiveContext {
  id: string;
  tenantId: string;
  teamId: string;
  title: string;
  status: string;
  isAnonymous: boolean;
  votingLimit: number;
}

declare global {
  namespace Express {
    interface Request {
      retrospective?: RetrospectiveContext;
    }
  }
}

export async function requireRetrospectiveAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.tenant || !req.user) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Tenant context required' },
      });
      return;
    }

    const retrospectiveId = req.params.retrospectiveId;
    if (!retrospectiveId) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Retrospective ID required' },
      });
      return;
    }

    // Verify retrospective belongs to the tenant
    const [retro] = await db
      .select({
        id: retrospectives.id,
        tenantId: retrospectives.tenantId,
        teamId: retrospectives.teamId,
        title: retrospectives.title,
        status: retrospectives.status,
        isAnonymous: retrospectives.isAnonymous,
        votingLimit: retrospectives.votingLimit,
      })
      .from(retrospectives)
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, req.tenant.id)
        )
      )
      .limit(1);

    if (!retro) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Retrospective not found in this organization' },
      });
      return;
    }

    req.retrospective = retro;

    // Check permissions: Org OWNER and ADMIN have implied facilitator rights
    if (
      req.membership?.role === TenantRole.OWNER ||
      req.membership?.role === TenantRole.ADMIN
    ) {
      req.teamMembership = {
        id: 'admin_override',
        role: TeamRole.FACILITATOR,
      };
      next();
      return;
    }

    // Check user's membership in the team owning the retrospective
    const [teamMember] = await db
      .select({
        id: teamMemberships.id,
        role: teamMemberships.role,
      })
      .from(teamMemberships)
      .where(
        and(
          eq(teamMemberships.teamId, retro.teamId),
          eq(teamMemberships.tenantId, req.tenant.id),
          eq(teamMemberships.userId, req.user.id)
        )
      )
      .limit(1);

    if (!teamMember) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: You are not a member of the team hosting this retrospective',
        },
      });
      return;
    }

    req.teamMembership = {
      id: teamMember.id,
      role: teamMember.role as TeamRole,
    };

    next();
  } catch (error) {
    next(error);
  }
}

