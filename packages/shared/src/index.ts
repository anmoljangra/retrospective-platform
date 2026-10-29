import { z } from 'zod';

// Roles
export const TenantRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;
export type TenantRole = (typeof TenantRole)[keyof typeof TenantRole];

export const TeamRole = {
  FACILITATOR: 'FACILITATOR',
  MEMBER: 'MEMBER',
} as const;
export type TeamRole = (typeof TeamRole)[keyof typeof TeamRole];

// Retrospective Status
export const RetrospectiveStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
} as const;
export type RetrospectiveStatus = (typeof RetrospectiveStatus)[keyof typeof RetrospectiveStatus];

// Action Item Status & Priority
export const ActionItemStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;
export type ActionItemStatus = (typeof ActionItemStatus)[keyof typeof ActionItemStatus];

export const ActionItemPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type ActionItemPriority = (typeof ActionItemPriority)[keyof typeof ActionItemPriority];

// Retrospective Templates
export interface TemplateColumnDefinition {
  title: string;
  description: string;
  color: string;
  position: number;
}

export interface RetrospectiveTemplateDefinition {
  id: string;
  name: string;
  description: string;
  columns: TemplateColumnDefinition[];
}

export const RETRO_TEMPLATES: Record<string, RetrospectiveTemplateDefinition> = {
  standard: {
    id: 'standard',
    name: 'What Went Well? / What Could Be Improved?',
    description: 'Classic three-column retrospective format focused on positives, growth opportunities, and next experiments.',
    columns: [
      { title: 'What went well?', description: 'Celebrate wins, milestones, and great practices', color: '#10B981', position: 0 },
      { title: 'What could be improved?', description: 'Pain points, bottlenecks, and frustrations', color: '#F59E0B', position: 1 },
      { title: 'What should we try next?', description: 'Ideas, experiments, and proposed tweaks', color: '#6366F1', position: 2 },
    ],
  },
  mad_sad_glad: {
    id: 'mad_sad_glad',
    name: 'Mad / Sad / Glad',
    description: 'Emotional-resonance format focusing on team wellbeing and team dynamics.',
    columns: [
      { title: 'Mad', description: 'Things that blocked us or made us frustrated', color: '#EF4444', position: 0 },
      { title: 'Sad', description: 'Things that disappointed us or could have been better', color: '#F59E0B', position: 1 },
      { title: 'Glad', description: 'Things that made us proud and energised', color: '#10B981', position: 2 },
    ],
  },
  start_stop_continue: {
    id: 'start_stop_continue',
    name: 'Start / Stop / Continue',
    description: 'Action-oriented format focusing directly on process evolution.',
    columns: [
      { title: 'Start', description: 'New activities or habits we should adopt', color: '#3B82F6', position: 0 },
      { title: 'Stop', description: 'Ineffective practices we should immediately abandon', color: '#EF4444', position: 1 },
      { title: 'Continue', description: 'Proven habits that are working well', color: '#10B981', position: 2 },
    ],
  },
  four_ls: {
    id: 'four_ls',
    name: '4Ls: Liked / Learned / Lacked / Longed For',
    description: 'Comprehensive retrospective reviewing achievements, insights, and systemic gaps.',
    columns: [
      { title: 'Liked', description: 'What did you appreciate this sprint?', color: '#10B981', position: 0 },
      { title: 'Learned', description: 'What new insights or lessons did you gain?', color: '#3B82F6', position: 1 },
      { title: 'Lacked', description: 'What was missing or needed more attention?', color: '#F59E0B', position: 2 },
      { title: 'Longed For', description: 'What do you wish we had or could do?', color: '#8B5CF6', position: 3 },
    ],
  },
};

// Common Validation Schemas
export const emailSchema = z.string().email('Please enter a valid email address').toLowerCase().trim();
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters long');
export const nameSchema = z.string().min(2, 'Name must be at least 2 characters').max(100).trim();
export const slugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(50)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must consist of lowercase alphanumeric characters and single hyphens');

// Auth DTOs
export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Tenant DTOs
export const createTenantSchema = z.object({
  name: nameSchema,
  slug: slugSchema.optional(),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum([TenantRole.ADMIN, TenantRole.MEMBER]).default(TenantRole.MEMBER),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// Team DTOs
export const createTeamSchema = z.object({
  name: nameSchema,
  description: z.string().max(500).optional().default(''),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

// Retrospective DTOs
export const createRetrospectiveSchema = z.object({
  teamId: z.string().min(1, 'Team is required'),
  title: z.string().min(2, 'Title must be at least 2 characters').max(200).trim(),
  description: z.string().max(1000).optional().default(''),
  template: z.string().default('standard'),
  isAnonymous: z.boolean().default(false),
  votingLimit: z.number().int().min(1).max(20).default(5),
});
export type CreateRetrospectiveInput = z.infer<typeof createRetrospectiveSchema>;

// Feedback Card DTOs
export const createFeedbackSchema = z.object({
  columnId: z.string().min(1, 'Column is required'),
  content: z.string().min(1, 'Feedback content cannot be empty').max(2000).trim(),
});
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

export const updateFeedbackSchema = z.object({
  content: z.string().min(1).max(2000).trim().optional(),
  columnId: z.string().optional(),
  position: z.number().int().min(0).optional(),
});
export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>;

// Comment DTOs
export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(1000).trim(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// Action Item DTOs
export const createActionItemSchema = z.object({
  feedbackCardId: z.string().optional().nullable(),
  title: z.string().min(2, 'Title must be at least 2 characters').max(250).trim(),
  description: z.string().max(2000).optional().default(''),
  priority: z.enum([ActionItemPriority.LOW, ActionItemPriority.MEDIUM, ActionItemPriority.HIGH]).default(ActionItemPriority.MEDIUM),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});
export type CreateActionItemInput = z.infer<typeof createActionItemSchema>;

export const updateActionItemSchema = z.object({
  title: z.string().min(2).max(250).trim().optional(),
  description: z.string().max(2000).optional(),
  status: z.enum([ActionItemStatus.TODO, ActionItemStatus.IN_PROGRESS, ActionItemStatus.DONE]).optional(),
  priority: z.enum([ActionItemPriority.LOW, ActionItemPriority.MEDIUM, ActionItemPriority.HIGH]).optional(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});
export type UpdateActionItemInput = z.infer<typeof updateActionItemSchema>;

// Socket Event Constants
export const SOCKET_EVENTS = {
  JOIN_RETRO: 'retro:join',
  LEAVE_RETRO: 'retro:leave',
  USER_JOINED: 'retro:user_joined',
  USER_LEFT: 'retro:user_left',
  CARD_CREATED: 'retro:card_created',
  CARD_UPDATED: 'retro:card_updated',
  CARD_MOVED: 'retro:card_moved',
  CARD_DELETED: 'retro:card_deleted',
  VOTE_UPDATED: 'retro:vote_updated',
  COMMENT_ADDED: 'retro:comment_added',
  COMMENT_DELETED: 'retro:comment_deleted',
  ACTION_CREATED: 'retro:action_created',
  ACTION_UPDATED: 'retro:action_updated',
  STATUS_CHANGED: 'retro:status_changed',
} as const;

