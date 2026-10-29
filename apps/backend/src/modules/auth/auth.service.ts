import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, refreshSessions, tenantMemberships, tenants } from '../../db/schema.js';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '../../utils/security.js';
import { createId } from '../../utils/id.js';
import type { RegisterInput, LoginInput } from '@retrospace/shared';

export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

export class AuthService {
  async register(input: RegisterInput, meta: SessionMeta = {}) {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check existing email
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      const error = new Error('An account with this email address already exists');
      (error as unknown as { statusCode: number }).statusCode = 409;
      throw error;
    }

    const passwordHash = await hashPassword(input.password);
    const userId = createId('usr');

    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      });

    // Create initial refresh session & tokens
    const { accessToken, rawToken: refreshToken } = await this.createSession(
      newUser.id,
      newUser.email,
      createId('fam'),
      meta
    );

    return {
      user: newUser,
      accessToken,
      refreshToken,
    };
  }

  async login(input: LoginInput, meta: SessionMeta = {}) {
    const normalizedEmail = input.email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      const error = new Error('Invalid email or password');
      (error as unknown as { statusCode: number }).statusCode = 401;
      throw error;
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      const error = new Error('Invalid email or password');
      (error as unknown as { statusCode: number }).statusCode = 401;
      throw error;
    }

    const { accessToken, rawToken: refreshToken } = await this.createSession(
      user.id,
      user.email,
      createId('fam'),
      meta
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(rawRefreshToken: string, meta: SessionMeta = {}) {
    if (!rawRefreshToken) {
      const error = new Error('Refresh token is required');
      (error as unknown as { statusCode: number }).statusCode = 401;
      throw error;
    }

    const tokenHash = hashToken(rawRefreshToken);

    const [session] = await db
      .select()
      .from(refreshSessions)
      .where(eq(refreshSessions.tokenHash, tokenHash))
      .limit(1);

    if (!session) {
      const error = new Error('Invalid refresh token');
      (error as unknown as { statusCode: number }).statusCode = 401;
      throw error;
    }

    // Reuse detection: if an already revoked token is used, invalidate its entire token family
    if (session.isRevoked) {
      await db
        .update(refreshSessions)
        .set({ isRevoked: true })
        .where(eq(refreshSessions.family, session.family));

      const error = new Error('Refresh token reuse detected. Session terminated for security.');
      (error as unknown as { statusCode: number }).statusCode = 401;
      throw error;
    }

    // Check expiration
    if (new Date() > new Date(session.expiresAt)) {
      const error = new Error('Refresh token expired');
      (error as unknown as { statusCode: number }).statusCode = 401;
      throw error;
    }

    // Revoke old session
    await db
      .update(refreshSessions)
      .set({ isRevoked: true })
      .where(eq(refreshSessions.id, session.id));

    // Get user
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) {
      const error = new Error('User associated with session not found');
      (error as unknown as { statusCode: number }).statusCode = 401;
      throw error;
    }

    // Rotate: Issue new token in same family
    const { accessToken, rawToken: nextRefreshToken } = await this.createSession(
      user.id,
      user.email,
      session.family,
      meta
    );

    return {
      user,
      accessToken,
      refreshToken: nextRefreshToken,
    };
  }

  async logout(rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await db
        .update(refreshSessions)
        .set({ isRevoked: true })
        .where(eq(refreshSessions.tokenHash, tokenHash));
    }
  }

  async getCurrentUser(userId: string) {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      const error = new Error('User not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    // Get active tenant memberships
    const memberships = await db
      .select({
        id: tenantMemberships.id,
        tenantId: tenantMemberships.tenantId,
        role: tenantMemberships.role,
        joinedAt: tenantMemberships.joinedAt,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .where(eq(tenantMemberships.userId, userId));

    return {
      user,
      memberships,
    };
  }

  private async createSession(
    userId: string,
    email: string,
    family: string,
    meta: SessionMeta
  ) {
    const { rawToken, tokenHash } = generateRefreshToken();
    const sessionId = createId('ses');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(refreshSessions).values({
      id: sessionId,
      userId,
      tokenHash,
      family,
      isRevoked: false,
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
      expiresAt,
    });

    const accessToken = generateAccessToken({ userId, email });

    return {
      accessToken,
      rawToken,
    };
  }
}

export const authService = new AuthService();
