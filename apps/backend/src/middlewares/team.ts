import { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { teams, teamMemberships } from '../db/schema.js';
import { TeamRole, TenantRole } from '@retrospace/shared';

export interface TeamContext {
  id: string;
  tenantId: string;
  name: string;
}

export interface TeamMembershipContext {
  id: string;
  role: TeamRole;
}

declare global {
  namespace Express {
    interface Request {
      team?: TeamContext;
      teamMembership?: TeamMembershipContext;
    }
  }
}

export async function requireTeamMember(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant || !req.user) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Tenant context required' },
      });
      return;
    }

    const teamId = req.params.teamId;
    if (!teamId) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Team ID is required' },
      });
      return;
    }

    // Verify team belongs to tenant
    const [team] = await db
      .select({
        id: teams.id,
        tenantId: teams.tenantId,
        name: teams.name,
      })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.tenantId, req.tenant.id)))
      .limit(1);

    if (!team) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Team not found in organization' },
      });
      return;
    }

    req.team = team;

    // Organization OWNER and ADMIN have implied facilitator access to all teams
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

    // Check specific team membership
    const [membership] = await db
      .select({
        id: teamMemberships.id,
        role: teamMemberships.role,
      })
      .from(teamMemberships)
      .where(
        and(
          eq(teamMemberships.teamId, teamId),
          eq(teamMemberships.tenantId, req.tenant.id),
          eq(teamMemberships.userId, req.user.id)
        )
      )
      .limit(1);

    if (!membership) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied: You are not a member of this team' },
      });
      return;
    }

    req.teamMembership = {
      id: membership.id,
      role: membership.role as TeamRole,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireTeamRole(allowedRoles: TeamRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.teamMembership) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Team membership required' },
      });
      return;
    }

    if (!allowedRoles.includes(req.teamMembership.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Team action requires one of the following roles: ${allowedRoles.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}

