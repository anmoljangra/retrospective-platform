import { eq, and, desc, asc, isNull, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  actionItems,
  retrospectives,
  feedbackCards,
  tenantMemberships,
  users,
} from '../../db/schema.js';
import { createId } from '../../utils/id.js';
import {
  ActionItemStatus,
  ActionItemPriority,
  type CreateActionItemInput,
  type UpdateActionItemInput,
} from '@retrospace/shared';

export interface ActionItemFilter {
  status?: ActionItemStatus;
  priority?: ActionItemPriority;
  assigneeId?: string;
  retrospectiveId?: string;
}

export class ActionItemService {
  async listActionItems(tenantId: string, filters: ActionItemFilter = {}) {
    const conditions = [eq(actionItems.tenantId, tenantId)];

    if (filters.status) {
      conditions.push(eq(actionItems.status, filters.status));
    }
    if (filters.priority) {
      conditions.push(eq(actionItems.priority, filters.priority));
    }
    if (filters.assigneeId) {
      conditions.push(eq(actionItems.assigneeId, filters.assigneeId));
    }
    if (filters.retrospectiveId) {
      conditions.push(eq(actionItems.retrospectiveId, filters.retrospectiveId));
    }

    const items = await db
      .select({
        id: actionItems.id,
        tenantId: actionItems.tenantId,
        retrospectiveId: actionItems.retrospectiveId,
        retrospectiveTitle: retrospectives.title,
        feedbackCardId: actionItems.feedbackCardId,
        title: actionItems.title,
        description: actionItems.description,
        status: actionItems.status,
        priority: actionItems.priority,
        assigneeId: actionItems.assigneeId,
        assigneeName: users.name,
        assigneeEmail: users.email,
        dueDate: actionItems.dueDate,
        createdBy: actionItems.createdBy,
        createdAt: actionItems.createdAt,
        updatedAt: actionItems.updatedAt,
      })
      .from(actionItems)
      .leftJoin(retrospectives, eq(actionItems.retrospectiveId, retrospectives.id))
      .leftJoin(users, eq(actionItems.assigneeId, users.id))
      .where(and(...conditions))
      .orderBy(desc(actionItems.createdAt));

    return items;
  }

  async getActionItemById(tenantId: string, actionItemId: string) {
    const [item] = await db
      .select({
        id: actionItems.id,
        tenantId: actionItems.tenantId,
        retrospectiveId: actionItems.retrospectiveId,
        retrospectiveTitle: retrospectives.title,
        feedbackCardId: actionItems.feedbackCardId,
        title: actionItems.title,
        description: actionItems.description,
        status: actionItems.status,
        priority: actionItems.priority,
        assigneeId: actionItems.assigneeId,
        assigneeName: users.name,
        assigneeEmail: users.email,
        dueDate: actionItems.dueDate,
        createdBy: actionItems.createdBy,
        createdAt: actionItems.createdAt,
        updatedAt: actionItems.updatedAt,
      })
      .from(actionItems)
      .leftJoin(retrospectives, eq(actionItems.retrospectiveId, retrospectives.id))
      .leftJoin(users, eq(actionItems.assigneeId, users.id))
      .where(
        and(
          eq(actionItems.id, actionItemId),
          eq(actionItems.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!item) {
      const error = new Error('Action item not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    return item;
  }

  async createActionItem(
    tenantId: string,
    userId: string,
    retrospectiveId: string,
    input: CreateActionItemInput
  ) {
    // 1. Verify retrospective belongs to tenant
    const [retro] = await db
      .select({ id: retrospectives.id })
      .from(retrospectives)
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

    // 2. SECURITY: Verify assignee belongs to the same tenant if assigned!
    if (input.assigneeId) {
      const [member] = await db
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, tenantId),
            eq(tenantMemberships.userId, input.assigneeId)
          )
        )
        .limit(1);

      if (!member) {
        const error = new Error('Assignee is not a member of this organization');
        (error as unknown as { statusCode: number }).statusCode = 400;
        throw error;
      }
    }

    const [newItem] = await db
      .insert(actionItems)
      .values({
        id: createId('act_item'),
        tenantId,
        retrospectiveId,
        feedbackCardId: input.feedbackCardId || null,
        title: input.title.trim(),
        description: input.description?.trim() || '',
        status: ActionItemStatus.TODO,
        priority: input.priority || ActionItemPriority.MEDIUM,
        assigneeId: input.assigneeId || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        createdBy: userId,
      })
      .returning();

    return newItem;
  }

  async updateActionItem(
    tenantId: string,
    actionItemId: string,
    input: UpdateActionItemInput
  ) {
    const [existing] = await db
      .select()
      .from(actionItems)
      .where(
        and(
          eq(actionItems.id, actionItemId),
          eq(actionItems.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      const error = new Error('Action item not found');
      (error as unknown as { statusCode: number }).statusCode = 404;
      throw error;
    }

    // Verify assignee belongs to tenant if being updated
    if (input.assigneeId) {
      const [member] = await db
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, tenantId),
            eq(tenantMemberships.userId, input.assigneeId)
          )
        )
        .limit(1);

      if (!member) {
        const error = new Error('Assignee is not a member of this organization');
        (error as unknown as { statusCode: number }).statusCode = 400;
        throw error;
      }
    }

    const updates: Partial<{
      title: string;
      description: string;
      status: ActionItemStatus;
      priority: ActionItemPriority;
      assigneeId: string | null;
      dueDate: Date | null;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (input.title) updates.title = input.title.trim();
    if (input.description !== undefined) updates.description = input.description.trim();
    if (input.status) updates.status = input.status;
    if (input.priority) updates.priority = input.priority;
    if (input.assigneeId !== undefined) updates.assigneeId = input.assigneeId || null;
    if (input.dueDate !== undefined)
      updates.dueDate = input.dueDate ? new Date(input.dueDate) : null;

    const [updated] = await db
      .update(actionItems)
      .set(updates)
      .where(
        and(
          eq(actionItems.id, actionItemId),
          eq(actionItems.tenantId, tenantId)
        )
      )
      .returning();

    return updated;
  }

  async deleteActionItem(tenantId: string, actionItemId: string) {
    await db
      .delete(actionItems)
      .where(
        and(
          eq(actionItems.id, actionItemId),
          eq(actionItems.tenantId, tenantId)
        )
      );
  }
}

export const actionItemService = new ActionItemService();
