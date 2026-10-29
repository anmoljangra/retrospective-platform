import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import {
  TenantRole,
  TeamRole,
  RetrospectiveStatus,
  ActionItemStatus,
  ActionItemPriority,
} from '@retrospace/shared';

// Enums
export const tenantRoleEnum = pgEnum('tenant_role', [
  TenantRole.OWNER,
  TenantRole.ADMIN,
  TenantRole.MEMBER,
]);

export const teamRoleEnum = pgEnum('team_role', [
  TeamRole.FACILITATOR,
  TeamRole.MEMBER,
]);

export const retrospectiveStatusEnum = pgEnum('retrospective_status', [
  RetrospectiveStatus.DRAFT,
  RetrospectiveStatus.ACTIVE,
  RetrospectiveStatus.COMPLETED,
]);

export const actionItemStatusEnum = pgEnum('action_item_status', [
  ActionItemStatus.TODO,
  ActionItemStatus.IN_PROGRESS,
  ActionItemStatus.DONE,
]);

export const actionItemPriorityEnum = pgEnum('action_item_priority', [
  ActionItemPriority.LOW,
  ActionItemPriority.MEDIUM,
  ActionItemPriority.HIGH,
]);

// 1. Users
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Refresh Sessions for secure JWT rotation
export const refreshSessions = pgTable(
  'refresh_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    family: text('family').notNull(),
    isRevoked: boolean('is_revoked').default(false).notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('refresh_sessions_user_id_idx').on(table.userId),
    index('refresh_sessions_family_idx').on(table.family),
  ]
);

// 2. Tenants (Organizations)
export const tenants = pgTable(
  'tenants',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('tenants_slug_idx').on(table.slug)]
);

// 3. Tenant Memberships
export const tenantMemberships = pgTable(
  'tenant_memberships',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: tenantRoleEnum('role').default(TenantRole.MEMBER).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tenant_user_unique_idx').on(table.tenantId, table.userId),
    index('tenant_memberships_tenant_id_idx').on(table.tenantId),
    index('tenant_memberships_user_id_idx').on(table.userId),
  ]
);

// 4. Invitations
export const invitations = pgTable(
  'invitations',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: tenantRoleEnum('role').default(TenantRole.MEMBER).notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('invitations_tenant_id_idx').on(table.tenantId),
    index('invitations_token_hash_idx').on(table.tokenHash),
  ]
);

// 5. Teams
export const teams = pgTable(
  'teams',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').default('').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('teams_tenant_id_idx').on(table.tenantId)]
);

// 6. Team Memberships
export const teamMemberships = pgTable(
  'team_memberships',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: teamRoleEnum('role').default(TeamRole.MEMBER).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('team_user_unique_idx').on(table.teamId, table.userId),
    index('team_memberships_tenant_id_idx').on(table.tenantId),
    index('team_memberships_team_id_idx').on(table.teamId),
    index('team_memberships_user_id_idx').on(table.userId),
  ]
);

// 7. Retrospectives
export const retrospectives = pgTable(
  'retrospectives',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').default('').notNull(),
    status: retrospectiveStatusEnum('status').default(RetrospectiveStatus.DRAFT).notNull(),
    template: text('template').default('standard').notNull(),
    isAnonymous: boolean('is_anonymous').default(false).notNull(),
    votingLimit: integer('voting_limit').default(5).notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('retrospectives_tenant_id_idx').on(table.tenantId),
    index('retrospectives_team_id_idx').on(table.teamId),
  ]
);

// 8. Retrospective Columns
export const retrospectiveColumns = pgTable(
  'retrospective_columns',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    retrospectiveId: text('retrospective_id')
      .notNull()
      .references(() => retrospectives.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').default('').notNull(),
    color: text('color').default('#3B82F6').notNull(),
    position: integer('position').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('retro_columns_tenant_id_idx').on(table.tenantId),
    index('retro_columns_retrospective_id_idx').on(table.retrospectiveId),
  ]
);

// 9. Feedback Cards
export const feedbackCards = pgTable(
  'feedback_cards',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    retrospectiveId: text('retrospective_id')
      .notNull()
      .references(() => retrospectives.id, { onDelete: 'cascade' }),
    columnId: text('column_id')
      .notNull()
      .references(() => retrospectiveColumns.id, { onDelete: 'cascade' }),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    position: integer('position').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('feedback_cards_tenant_id_idx').on(table.tenantId),
    index('feedback_cards_retrospective_id_idx').on(table.retrospectiveId),
    index('feedback_cards_column_id_idx').on(table.columnId),
  ]
);

// 10. Votes
export const votes = pgTable(
  'votes',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    retrospectiveId: text('retrospective_id')
      .notNull()
      .references(() => retrospectives.id, { onDelete: 'cascade' }),
    feedbackCardId: text('feedback_card_id')
      .notNull()
      .references(() => feedbackCards.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('vote_card_user_unique_idx').on(table.feedbackCardId, table.userId),
    index('votes_tenant_id_idx').on(table.tenantId),
    index('votes_retrospective_id_idx').on(table.retrospectiveId),
    index('votes_user_id_idx').on(table.userId),
  ]
);

// 11. Comments
export const comments = pgTable(
  'comments',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    feedbackCardId: text('feedback_card_id')
      .notNull()
      .references(() => feedbackCards.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('comments_tenant_id_idx').on(table.tenantId),
    index('comments_feedback_card_id_idx').on(table.feedbackCardId),
  ]
);

// 12. Action Items
export const actionItems = pgTable(
  'action_items',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    retrospectiveId: text('retrospective_id')
      .notNull()
      .references(() => retrospectives.id, { onDelete: 'cascade' }),
    feedbackCardId: text('feedback_card_id').references(() => feedbackCards.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    description: text('description').default('').notNull(),
    status: actionItemStatusEnum('status').default(ActionItemStatus.TODO).notNull(),
    priority: actionItemPriorityEnum('priority').default(ActionItemPriority.MEDIUM).notNull(),
    assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('action_items_tenant_id_idx').on(table.tenantId),
    index('action_items_retrospective_id_idx').on(table.retrospectiveId),
    index('action_items_assignee_id_idx').on(table.assigneeId),
  ]
);

// 13. Activity Logs
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    metadata: text('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('activity_logs_tenant_id_idx').on(table.tenantId),
    index('activity_logs_created_at_idx').on(table.createdAt),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(tenantMemberships),
  teamMemberships: many(teamMemberships),
  refreshSessions: many(refreshSessions),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  members: many(tenantMemberships),
  teams: many(teams),
  invitations: many(invitations),
  retrospectives: many(retrospectives),
}));

export const tenantMembershipsRelations = relations(tenantMemberships, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMemberships.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [tenantMemberships.userId],
    references: [users.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [teams.tenantId],
    references: [tenants.id],
  }),
  members: many(teamMemberships),
  retrospectives: many(retrospectives),
}));

export const retrospectivesRelations = relations(retrospectives, ({ one, many }) => ({
  team: one(teams, {
    fields: [retrospectives.teamId],
    references: [teams.id],
  }),
  columns: many(retrospectiveColumns),
  feedbackCards: many(feedbackCards),
  actionItems: many(actionItems),
}));

export const retrospectiveColumnsRelations = relations(
  retrospectiveColumns,
  ({ one, many }) => ({
    retrospective: one(retrospectives, {
      fields: [retrospectiveColumns.retrospectiveId],
      references: [retrospectives.id],
    }),
    feedbackCards: many(feedbackCards),
  })
);

export const feedbackCardsRelations = relations(feedbackCards, ({ one, many }) => ({
  column: one(retrospectiveColumns, {
    fields: [feedbackCards.columnId],
    references: [retrospectiveColumns.id],
  }),
  author: one(users, {
    fields: [feedbackCards.authorId],
    references: [users.id],
  }),
  votes: many(votes),
  comments: many(comments),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  feedbackCard: one(feedbackCards, {
    fields: [votes.feedbackCardId],
    references: [feedbackCards.id],
  }),
  user: one(users, {
    fields: [votes.userId],
    references: [users.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  feedbackCard: one(feedbackCards, {
    fields: [comments.feedbackCardId],
    references: [feedbackCards.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
  retrospective: one(retrospectives, {
    fields: [actionItems.retrospectiveId],
    references: [retrospectives.id],
  }),
  assignee: one(users, {
    fields: [actionItems.assigneeId],
    references: [users.id],
  }),
  feedbackCard: one(feedbackCards, {
    fields: [actionItems.feedbackCardId],
    references: [feedbackCards.id],
  }),
}));

