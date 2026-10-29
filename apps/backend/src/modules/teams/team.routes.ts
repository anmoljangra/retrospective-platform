import { Router } from 'express';
import { teamController } from './team.controller.js';
import { authenticateUser } from '../../middlewares/auth.js';
import { requireTenant, requireTenantRole } from '../../middlewares/tenant.js';
import { requireTeamMember, requireTeamRole } from '../../middlewares/team.js';
import { TenantRole, TeamRole } from '@retrospace/shared';

export const teamRouter = Router({ mergeParams: true });

// All team routes require authentication & active tenant membership
teamRouter.use(authenticateUser, requireTenant);

teamRouter.post('/', teamController.createTeam);
teamRouter.get('/', teamController.listTeams);

teamRouter.get('/:teamId', requireTeamMember, teamController.getTeam);
teamRouter.patch(
  '/:teamId',
  requireTeamMember,
  requireTeamRole([TeamRole.FACILITATOR]),
  teamController.updateTeam
);
teamRouter.delete(
  '/:teamId',
  requireTenantRole([TenantRole.OWNER, TenantRole.ADMIN]),
  teamController.deleteTeam
);

// Team Members
teamRouter.get('/:teamId/members', requireTeamMember, teamController.listTeamMembers);
teamRouter.post(
  '/:teamId/members',
  requireTeamMember,
  requireTeamRole([TeamRole.FACILITATOR]),
  teamController.addTeamMember
);
teamRouter.patch(
  '/:teamId/members/:userId',
  requireTeamMember,
  requireTeamRole([TeamRole.FACILITATOR]),
  teamController.updateTeamMemberRole
);
teamRouter.delete(
  '/:teamId/members/:userId',
  requireTeamMember,
  requireTeamRole([TeamRole.FACILITATOR]),
  teamController.removeTeamMember
);
