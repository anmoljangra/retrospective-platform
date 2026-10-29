import { Router } from 'express';
import { retrospectiveController } from './retrospective.controller.js';
import { authenticateUser } from '../../middlewares/auth.js';
import { requireTenant } from '../../middlewares/tenant.js';
import { requireRetrospectiveAccess } from '../../middlewares/retrospective.js';
import { requireTeamRole } from '../../middlewares/team.js';
import { TeamRole } from '@retrospace/shared';

export const retrospectiveRouter = Router({ mergeParams: true });

retrospectiveRouter.use(authenticateUser, requireTenant);

// Retrospective collection
retrospectiveRouter.post('/', retrospectiveController.createRetrospective);
retrospectiveRouter.get('/', retrospectiveController.listRetrospectives);

// Retrospective detail operations
retrospectiveRouter.get(
  '/:retrospectiveId',
  requireRetrospectiveAccess,
  retrospectiveController.getRetrospective
);
retrospectiveRouter.patch(
  '/:retrospectiveId',
  requireRetrospectiveAccess,
  requireTeamRole([TeamRole.FACILITATOR]),
  retrospectiveController.updateRetrospective
);
retrospectiveRouter.delete(
  '/:retrospectiveId',
  requireRetrospectiveAccess,
  requireTeamRole([TeamRole.FACILITATOR]),
  retrospectiveController.deleteRetrospective
);

// Lifecycle transitions
retrospectiveRouter.post(
  '/:retrospectiveId/start',
  requireRetrospectiveAccess,
  requireTeamRole([TeamRole.FACILITATOR]),
  retrospectiveController.startSession
);
retrospectiveRouter.post(
  '/:retrospectiveId/complete',
  requireRetrospectiveAccess,
  requireTeamRole([TeamRole.FACILITATOR]),
  retrospectiveController.completeSession
);

// Column management
retrospectiveRouter.post(
  '/:retrospectiveId/columns',
  requireRetrospectiveAccess,
  requireTeamRole([TeamRole.FACILITATOR]),
  retrospectiveController.addColumn
);
retrospectiveRouter.patch(
  '/:retrospectiveId/columns/:columnId',
  requireRetrospectiveAccess,
  requireTeamRole([TeamRole.FACILITATOR]),
  retrospectiveController.updateColumn
);
retrospectiveRouter.delete(
  '/:retrospectiveId/columns/:columnId',
  requireRetrospectiveAccess,
  requireTeamRole([TeamRole.FACILITATOR]),
  retrospectiveController.deleteColumn
);
