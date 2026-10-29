import { eq, and, sql, count } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  teams,
  teamMemberships,
  tenantMemberships,
  users,
  retrospectives,
  activityLogs,
} from '../../db/schema.js';
import { createId } from '../../utils/id.js';
import { TeamRole, type CreateTeamInput } from '@retrospace/shared';

export class TeamService {
  async createTeam(tenantId: string, userId: string, input: CreateTeamInput) {
    const teamId = createId('tem');
    const membershipId = createId('tmem');

    const [newTeam] = await db
      .insert(teams)
      .values({
        id: teamId,
        tenantId,
        name: input.name.trim(),
        description: input.description?.trim() || '',
        createdBy: userId,
      })
      .returning();

    // Assign creator as FACILITATOR
    const [membership] = await db
      .insert(teamMemberships)
      .values({
        id: membershipId,
        tenantId,
        teamId: newTeam.id,
        userId,
        role: TeamRole.FACILITATOR,
      })
      .returning();

    // Activity log
    await db.insert(activityLogs).values({
      id: createId('act'),
      tenantId,
      userId,
      action: 'TEAM_CREATED',
      resourceType: 'TEAM',
      resourceId: newTeam.id,
    });

    return {
      team: newTeam,
      membership,
    };
  }

  async listTeams(tenantId: string) {
    const teamList = await db
      .select({
        id: teams.id,
        tenantId: teams.tenantId,
        name: teams.name,
        description: teams.description,
        createdBy: teams.createdBy,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
      })
      .from(teams)
      .where(eq(teams.tenantId, tenantId));

    // Enhance with member count and retros count
    const enriched = await Promise.all(
      teamList.map(async (t) => {
        const [memberCount] = await db
          .select({ value: count() })
          .from(teamMemberships)
          .where(and(eq(teamMemberships.teamId, t.id), eq(teamMemberships.tenantId, tenantId)));

        const [retroCount] = await db
          .select({ value: count() })
          .from(retrospectives)
          .where(and(eq(retrospectives.teamId, t.id), eq(retrospectives.tenantId, tenantId)));

        return {
          ...t,
          memberCount: memberCount?.value || 0,
          retroCount: retroCount?.value || 0,
        };
      })
    );

    return enriched;
  }

  async getTeamById(tenantId: string, teamId: string) {
    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.tenantId, tenantId)))
      .limit(1);

    if (!team) {
      const error = new Error('Team not found in organization');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    return team;
  }

  async updateTeam(
    tenantId: string,
    teamId: string,
    input: { name?: string; description?: string }
  ) {
    const updates: Partial<{ name: string; description: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    if (input.name) updates.name = input.name.trim();
    if (input.description !== undefined) updates.description = input.description.trim();

    const [updated] = await db
      .update(teams)
      .set(updates)
      .where(and(eq(teams.id, teamId), eq(teams.tenantId, tenantId)))
      .returning();

    if (!updated) {
      const error = new Error('Team not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    return updated;
  }

  async deleteTeam(tenantId: string, teamId: string) {
    await db
      .delete(teams)
      .where(and(eq(teams.id, teamId), eq(teams.tenantId, tenantId)));
  }

  async listTeamMembers(tenantId: string, teamId: string) {
    return db
      .select({
        id: teamMemberships.id,
        teamId: teamMemberships.teamId,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: teamMemberships.role,
        joinedAt: teamMemberships.joinedAt,
      })
      .from(teamMemberships)
      .innerJoin(users, eq(teamMemberships.userId, users.id))
      .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.tenantId, tenantId)));
  }

  async addTeamMember(
    tenantId: string,
    teamId: string,
    targetUserId: string,
    role: TeamRole = TeamRole.MEMBER
  ) {
    // SECURITY: Ensure target user is an active member of this organization!
    const [tenantMember] = await db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.userId, targetUserId)
        )
      )
      .limit(1);

    if (!tenantMember) {
      const error = new Error(
        'User must be a member of the organization before joining a team'
      );
      (error as unknown as { statusCode: number }).statusCode = 400;
      throw error;
    }

    // Check existing team membership
    const [existing] = await db
      .select({ id: teamMemberships.id })
      .from(teamMemberships)
      .where(
        and(
          eq(teamMemberships.teamId, teamId),
          eq(teamMemberships.userId, targetUserId)
        )
      )
      .limit(1);

    if (existing) {
      const error = new Error('User is already a member of this team');
      (error as unknown as { statusCode: number }).statusCode = 409;
      throw error;
    }

    const [membership] = await db
      .insert(teamMemberships)
      .values({
        id: createId('tmem'),
        tenantId,
        teamId,
        userId: targetUserId,
        role,
      })
      .returning();

    return membership;
  }

  async updateTeamMemberRole(
    tenantId: string,
    teamId: string,
    targetUserId: string,
    role: TeamRole
  ) {
    const [updated] = await db
      .update(teamMemberships)
      .set({ role })
      .where(
        and(
          eq(teamMemberships.teamId, teamId),
          eq(teamMemberships.tenantId, tenantId),
          eq(teamMemberships.userId, targetUserId)
        )
      )
      .returning();

    if (!updated) {
      const error = new Error('Team member not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    return updated;
  }

  async removeTeamMember(tenantId: string, teamId: string, targetUserId: string) {
    await db
      .delete(teamMemberships)
      .where(
        and(
          eq(teamMemberships.teamId, teamId),
          eq(teamMemberships.tenantId, tenantId),
          eq(teamMemberships.userId, targetUserId)
        )
      );
  }
}

export const teamService = new TeamService();
