import { Router } from 'express';
import { tenantController } from './tenant.controller.js';
import { authenticateUser } from '../../middlewares/auth.js';
import { requireTenant, requireTenantRole } from '../../middlewares/tenant.js';
import { TenantRole } from '@retrospace/shared';

export const tenantRouter = Router();
export const invitationRouter = Router();

// Tenant collections
tenantRouter.post('/', authenticateUser, tenantController.createTenant);
tenantRouter.get('/', authenticateUser, tenantController.listUserTenants);

// Tenant-scoped operations
tenantRouter.get('/:tenantId', authenticateUser, requireTenant, tenantController.getTenant);
tenantRouter.patch(
  '/:tenantId',
  authenticateUser,
  requireTenant,
  requireTenantRole([TenantRole.OWNER, TenantRole.ADMIN]),
  tenantController.updateTenant
);

// Members
tenantRouter.get(
  '/:tenantId/members',
  authenticateUser,
  requireTenant,
  tenantController.listMembers
);
tenantRouter.patch(
  '/:tenantId/members/:membershipId',
  authenticateUser,
  requireTenant,
  requireTenantRole([TenantRole.OWNER]),
  tenantController.updateMemberRole
);
tenantRouter.delete(
  '/:tenantId/members/:membershipId',
  authenticateUser,
  requireTenant,
  requireTenantRole([TenantRole.OWNER, TenantRole.ADMIN]),
  tenantController.removeMember
);

// Invitations
tenantRouter.post(
  '/:tenantId/invitations',
  authenticateUser,
  requireTenant,
  requireTenantRole([TenantRole.OWNER, TenantRole.ADMIN]),
  tenantController.inviteMember
);
tenantRouter.get(
  '/:tenantId/invitations',
  authenticateUser,
  requireTenant,
  requireTenantRole([TenantRole.OWNER, TenantRole.ADMIN]),
  tenantController.listInvitations
);
tenantRouter.delete(
  '/:tenantId/invitations/:invitationId',
  authenticateUser,
  requireTenant,
  requireTenantRole([TenantRole.OWNER, TenantRole.ADMIN]),
  tenantController.revokeInvitation
);

// Public/Authenticated Invitation endpoints
invitationRouter.get('/:token', tenantController.getInvitation);
invitationRouter.post('/:token/accept', authenticateUser, tenantController.acceptInvitation);
