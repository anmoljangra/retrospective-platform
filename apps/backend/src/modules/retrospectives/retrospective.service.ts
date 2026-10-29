import { eq, and, asc, count } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  retrospectives,
  retrospectiveColumns,
  teams,
  feedbackCards,
  activityLogs,
} from '../../db/schema.js';
import { createId } from '../../utils/id.js';
import {
  RetrospectiveStatus,
  RETRO_TEMPLATES,
  type CreateRetrospectiveInput,
} from '@retrospace/shared';

export class RetrospectiveService {
  async createRetrospective(
    tenantId: string,
    userId: string,
    input: CreateRetrospectiveInput
  ) {
    // Verify team belongs to tenant
    const [team] = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(and(eq(teams.id, input.teamId), eq(teams.tenantId, tenantId)))
      .limit(1);

    if (!team) {
      const error = new Error('Team does not belong to this organization');
      (error as unknown as { statusCode: number }).statusCode = 400;
      throw error;
    }

    const retroId = createId('ret');
    const templateDef = RETRO_TEMPLATES[input.template] || RETRO_TEMPLATES.standard;

    const [newRetro] = await db
      .insert(retrospectives)
      .values({
        id: retroId,
        tenantId,
        teamId: input.teamId,
        title: input.title.trim(),
        description: input.description?.trim() || '',
        status: RetrospectiveStatus.DRAFT,
        template: templateDef.id,
        isAnonymous: input.isAnonymous || false,
        votingLimit: input.votingLimit || 5,
        createdBy: userId,
      })
      .returning();

    // Populate columns from template
    const columnInserts = templateDef.columns.map((col, idx) => ({
      id: createId('col'),
      tenantId,
      retrospectiveId: newRetro.id,
      title: col.title,
      description: col.description,
      color: col.color,
      position: idx,
    }));

    const createdColumns = await db
      .insert(retrospectiveColumns)
      .values(columnInserts)
      .returning();

    // Activity log
    await db.insert(activityLogs).values({
      id: createId('act'),
      tenantId,
      userId,
      action: 'RETROSPECTIVE_CREATED',
      resourceType: 'RETROSPECTIVE',
      resourceId: newRetro.id,
    });

    return {
      retrospective: newRetro,
      team,
      columns: createdColumns,
    };
  }

  async listRetrospectives(
    tenantId: string,
    filters: { teamId?: string; status?: RetrospectiveStatus } = {}
  ) {
    const conditions = [eq(retrospectives.tenantId, tenantId)];

    if (filters.teamId) {
      conditions.push(eq(retrospectives.teamId, filters.teamId));
    }
    if (filters.status) {
      conditions.push(eq(retrospectives.status, filters.status));
    }

    const retros = await db
      .select({
        id: retrospectives.id,
        tenantId: retrospectives.tenantId,
        teamId: retrospectives.teamId,
        teamName: teams.name,
        title: retrospectives.title,
        description: retrospectives.description,
        status: retrospectives.status,
        template: retrospectives.template,
        isAnonymous: retrospectives.isAnonymous,
        votingLimit: retrospectives.votingLimit,
        startedAt: retrospectives.startedAt,
        endedAt: retrospectives.endedAt,
        createdAt: retrospectives.createdAt,
      })
      .from(retrospectives)
      .innerJoin(teams, eq(retrospectives.teamId, teams.id))
      .where(and(...conditions));

    // Enhance with card count
    const enriched = await Promise.all(
      retros.map(async (r) => {
        const [cardCount] = await db
          .select({ value: count() })
          .from(feedbackCards)
          .where(
            and(
              eq(feedbackCards.retrospectiveId, r.id),
              eq(feedbackCards.tenantId, tenantId)
            )
          );

        return {
          ...r,
          cardCount: cardCount?.value || 0,
        };
      })
    );

    return enriched;
  }

  async getRetrospectiveById(tenantId: string, retrospectiveId: string) {
    const [retro] = await db
      .select({
        id: retrospectives.id,
        tenantId: retrospectives.tenantId,
        teamId: retrospectives.teamId,
        teamName: teams.name,
        title: retrospectives.title,
        description: retrospectives.description,
        status: retrospectives.status,
        template: retrospectives.template,
        isAnonymous: retrospectives.isAnonymous,
        votingLimit: retrospectives.votingLimit,
        startedAt: retrospectives.startedAt,
        endedAt: retrospectives.endedAt,
        createdAt: retrospectives.createdAt,
      })
      .from(retrospectives)
      .innerJoin(teams, eq(retrospectives.teamId, teams.id))
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!retro) {
      const error = new Error('Retrospective not found in this organization');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    const columns = await db
      .select()
      .from(retrospectiveColumns)
      .where(
        and(
          eq(retrospectiveColumns.retrospectiveId, retrospectiveId),
          eq(retrospectiveColumns.tenantId, tenantId)
        )
      )
      .orderBy(asc(retrospectiveColumns.position));

    return {
      retrospective: retro,
      columns,
    };
  }

  async updateRetrospective(
    tenantId: string,
    retrospectiveId: string,
    input: {
      title?: string;
      description?: string;
      votingLimit?: number;
      isAnonymous?: boolean;
    }
  ) {
    const [current] = await db
      .select()
      .from(retrospectives)
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!current) {
      const error = new Error('Retrospective not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    if (current.status === RetrospectiveStatus.COMPLETED) {
      const error = new Error('Cannot modify a completed retrospective');
      (error as unknown as { statusCode: number }).statusCode = 400;
      throw error;
    }

    const updates: Partial<{
      title: string;
      description: string;
      votingLimit: number;
      isAnonymous: boolean;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (input.title) updates.title = input.title.trim();
    if (input.description !== undefined) updates.description = input.description.trim();
    if (input.votingLimit !== undefined) updates.votingLimit = input.votingLimit;
    if (input.isAnonymous !== undefined) updates.isAnonymous = input.isAnonymous;

    const [updated] = await db
      .update(retrospectives)
      .set(updates)
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, tenantId)
        )
      )
      .returning();

    return updated;
  }

  async startSession(tenantId: string, retrospectiveId: string) {
    const [current] = await db
      .select()
      .from(retrospectives)
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!current) {
      const error = new Error('Retrospective not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    if (current.status === RetrospectiveStatus.COMPLETED) {
      const error = new Error('Cannot restart a completed retrospective');
      (error as unknown as { statusCode: number }).statusCode = 400;
      throw error;
    }

    if (current.status === RetrospectiveStatus.ACTIVE) {
      return current; // Idempotent
    }

    const [updated] = await db
      .update(retrospectives)
      .set({
        status: RetrospectiveStatus.ACTIVE,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, tenantId)
        )
      )
      .returning();

    return updated;
  }

  async completeSession(tenantId: string, retrospectiveId: string) {
    const [current] = await db
      .select()
      .from(retrospectives)
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!current) {
      const error = new Error('Retrospective not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    if (current.status === RetrospectiveStatus.COMPLETED) {
      return current; // Idempotent
    }

    const [updated] = await db
      .update(retrospectives)
      .set({
        status: RetrospectiveStatus.COMPLETED,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, tenantId)
        )
      )
      .returning();

    return updated;
  }

  async deleteRetrospective(tenantId: string, retrospectiveId: string) {
    await db
      .delete(retrospectives)
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, tenantId)
        )
      );
  }

  // Column management
  async addColumn(
    tenantId: string,
    retrospectiveId: string,
    input: { title: string; description?: string; color?: string; position?: number }
  ) {
    const [retro] = await db
      .select()
      .from(retrospectives)
      .where(
        and(
          eq(retrospectives.id, retrospectiveId),
          eq(retrospectives.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!retro) {
      const error = new Error('Retrospective not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    if (retro.status === RetrospectiveStatus.COMPLETED) {
      const error = new Error('Cannot add columns to a completed retrospective');
      (error as unknown as { statusCode: number }).statusCode = 400;
      throw error;
    }

    let position = input.position;
    if (position === undefined) {
      const [lastCol] = await db
        .select({ pos: retrospectiveColumns.position })
        .from(retrospectiveColumns)
        .where(
          and(
            eq(retrospectiveColumns.retrospectiveId, retrospectiveId),
            eq(retrospectiveColumns.tenantId, tenantId)
          )
        )
        .orderBy(asc(retrospectiveColumns.position))
        .limit(1);
      position = (lastCol?.pos || 0) + 1;
    }

    const [newCol] = await db
      .insert(retrospectiveColumns)
      .values({
        id: createId('col'),
        tenantId,
        retrospectiveId,
        title: input.title.trim(),
        description: input.description?.trim() || '',
        color: input.color || '#3B82F6',
        position,
      })
      .returning();

    return newCol;
  }

  async updateColumn(
    tenantId: string,
    retrospectiveId: string,
    columnId: string,
    input: { title?: string; description?: string; color?: string; position?: number }
  ) {
    const updates: Partial<{
      title: string;
      description: string;
      color: string;
      position: number;
    }> = {};

    if (input.title) updates.title = input.title.trim();
    if (input.description !== undefined) updates.description = input.description.trim();
    if (input.color) updates.color = input.color;
    if (input.position !== undefined) updates.position = input.position;

    const [updated] = await db
      .update(retrospectiveColumns)
      .set(updates)
      .where(
        and(
          eq(retrospectiveColumns.id, columnId),
          eq(retrospectiveColumns.retrospectiveId, retrospectiveId),
          eq(retrospectiveColumns.tenantId, tenantId)
        )
      )
      .returning();

    return updated;
  }

  async deleteColumn(tenantId: string, retrospectiveId: string, columnId: string) {
    await db
      .delete(retrospectiveColumns)
      .where(
        and(
          eq(retrospectiveColumns.id, columnId),
          eq(retrospectiveColumns.retrospectiveId, retrospectiveId),
          eq(retrospectiveColumns.tenantId, tenantId)
        )
      );
  }
}

export const retrospectiveService = new RetrospectiveService();
