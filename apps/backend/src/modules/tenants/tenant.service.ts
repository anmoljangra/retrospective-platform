import { eq, and, gt, isNull, count } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../../db/index.js';
import {
  tenants,
  tenantMemberships,
  invitations,
  users,
  activityLogs,
} from '../../db/schema.js';
import { createId } from '../../utils/id.js';
import { hashToken } from '../../utils/security.js';
import {
  TenantRole,
  type CreateTenantInput,
  type InviteMemberInput,
} from '@retrospace/shared';

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'workspace';
}

export class TenantService {
  async createTenant(userId: string, input: CreateTenantInput) {
    const baseSlug = input.slug || generateSlug(input.name);
    let uniqueSlug = baseSlug;

    // Check slug collisions
    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, uniqueSlug))
      .limit(1);

    if (existing) {
      uniqueSlug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
    }

    const tenantId = createId('org');
    const membershipId = createId('mem');

    // Create tenant and assign initial OWNER membership transactionally
    const [newTenant] = await db
      .insert(tenants)
      .values({
        id: tenantId,
        name: input.name.trim(),
        slug: uniqueSlug,
      })
      .returning();

    const [membership] = await db
      .insert(tenantMemberships)
      .values({
        id: membershipId,
        tenantId: newTenant.id,
        userId,
        role: TenantRole.OWNER,
      })
      .returning();

    // Log activity
    await db.insert(activityLogs).values({
      id: createId('act'),
      tenantId: newTenant.id,
      userId,
      action: 'ORGANIZATION_CREATED',
      resourceType: 'TENANT',
      resourceId: newTenant.id,
    });

    return {
      tenant: newTenant,
      membership,
    };
  }

  async listUserTenants(userId: string) {
    return db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        createdAt: tenants.createdAt,
        role: tenantMemberships.role,
        membershipId: tenantMemberships.id,
        joinedAt: tenantMemberships.joinedAt,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .where(eq(tenantMemberships.userId, userId));
  }

  async getTenantById(tenantId: string) {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      const error = new Error('Organization not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    return tenant;
  }

  async updateTenant(tenantId: string, input: { name?: string }) {
    const updates: Partial<{ name: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    if (input.name) updates.name = input.name.trim();

    const [updated] = await db
      .update(tenants)
      .set(updates)
      .where(eq(tenants.id, tenantId))
      .returning();

    return updated;
  }

  async listMembers(tenantId: string) {
    return db
      .select({
        membershipId: tenantMemberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: tenantMemberships.role,
        joinedAt: tenantMemberships.joinedAt,
      })
      .from(tenantMemberships)
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(eq(tenantMemberships.tenantId, tenantId));
  }

  async updateMemberRole(tenantId: string, membershipId: string, newRole: TenantRole) {
    const [target] = await db
      .select()
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.id, membershipId),
          eq(tenantMemberships.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!target) {
      const error = new Error('Member not found in organization');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    // Protect final owner from demotion
    if (target.role === TenantRole.OWNER && newRole !== TenantRole.OWNER) {
      const [ownerCount] = await db
        .select({ value: count() })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, tenantId),
            eq(tenantMemberships.role, TenantRole.OWNER)
          )
        );

      if (ownerCount.value <= 1) {
        const error = new Error('Cannot demote the final organization owner');
        (error as unknown as { statusCode: number }).statusCode = 400;
        throw error;
      }
    }

    const [updated] = await db
      .update(tenantMemberships)
      .set({ role: newRole })
      .where(eq(tenantMemberships.id, membershipId))
      .returning();

    return updated;
  }

  async removeMember(tenantId: string, membershipId: string) {
    const [target] = await db
      .select()
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.id, membershipId),
          eq(tenantMemberships.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!target) {
      const error = new Error('Member not found in organization');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    // Protect final owner from removal
    if (target.role === TenantRole.OWNER) {
      const [ownerCount] = await db
        .select({ value: count() })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, tenantId),
            eq(tenantMemberships.role, TenantRole.OWNER)
          )
        );

      if (ownerCount.value <= 1) {
        const error = new Error('Cannot remove the final organization owner');
        (error as unknown as { statusCode: number }).statusCode = 400;
        throw error;
      }
    }

    await db.delete(tenantMemberships).where(eq(tenantMemberships.id, membershipId));
  }

  async inviteMember(tenantId: string, invitedById: string, input: InviteMemberInput) {
    const email = input.email.toLowerCase().trim();

    // Check if user already a member of this tenant
    const [existingMember] = await db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          eq(users.email, email)
        )
      )
      .limit(1);

    if (existingMember) {
      const error = new Error('This user is already a member of the organization');
      (error as unknown as { statusCode: number }).statusCode = 400;
      throw error;
    }

    // Check pending unexpired invite
    const [existingInvite] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.tenantId, tenantId),
          eq(invitations.email, email),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, new Date())
        )
      )
      .limit(1);

    if (existingInvite) {
      const error = new Error('An active invitation has already been sent to this email');
      (error as unknown as { statusCode: number }).statusCode = 409;
      throw error;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [newInvite] = await db
      .insert(invitations)
      .values({
        id: createId('inv'),
        tenantId,
        email,
        role: input.role,
        tokenHash,
        invitedBy: invitedById,
        expiresAt,
      })
      .returning();

    return {
      invitation: newInvite,
      inviteUrl: `/invite/${rawToken}`,
      token: rawToken,
    };
  }

  async listInvitations(tenantId: string) {
    return db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
        invitedByName: users.name,
      })
      .from(invitations)
      .innerJoin(users, eq(invitations.invitedBy, users.id))
      .where(
        and(
          eq(invitations.tenantId, tenantId),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, new Date())
        )
      );
  }

  async revokeInvitation(tenantId: string, invitationId: string) {
    await db
      .delete(invitations)
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.tenantId, tenantId)
        )
      );
  }

  async getInvitationByToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);

    const [invite] = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
        acceptedAt: invitations.acceptedAt,
        tenantId: tenants.id,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        inviterName: users.name,
      })
      .from(invitations)
      .innerJoin(tenants, eq(invitations.tenantId, tenants.id))
      .innerJoin(users, eq(invitations.invitedBy, users.id))
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1);

    if (!invite) {
      const error = new Error('Invitation not found or invalid');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    if (invite.acceptedAt) {
      const error = new Error('This invitation has already been accepted');
      (error as unknown as { statusCode: number }).statusCode = 400;
      throw error;
    }

    if (new Date() > new Date(invite.expiresAt)) {
      const error = new Error('This invitation has expired');
      (error as unknown as { statusCode: number }).statusCode = 400;
      throw error;
    }

    return invite;
  }

  async acceptInvitation(userId: string, rawToken: string) {
    const invite = await this.getInvitationByToken(rawToken);

    // Check if already a member
    const [alreadyMember] = await db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, invite.tenantId),
          eq(tenantMemberships.userId, userId)
        )
      )
      .limit(1);

    if (alreadyMember) {
      // Mark accepted if already joined
      await db
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, invite.id));

      return { tenantId: invite.tenantId, alreadyMember: true };
    }

    // Add membership
    await db.insert(tenantMemberships).values({
      id: createId('mem'),
      tenantId: invite.tenantId,
      userId,
      role: invite.role,
    });

    // Mark invitation accepted
    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invite.id));

    return {
      tenantId: invite.tenantId,
      tenantName: invite.tenantName,
      alreadyMember: false,
    };
  }
}

export const tenantService = new TenantService();

