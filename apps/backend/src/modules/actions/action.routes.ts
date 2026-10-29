import { Router } from 'express';
import { actionItemController } from './action.controller.js';
import { authenticateUser } from '../../middlewares/auth.js';
import { requireTenant } from '../../middlewares/tenant.js';

export const actionItemRouter = Router({ mergeParams: true });
export const retroActionItemRouter = Router({ mergeParams: true });

actionItemRouter.use(authenticateUser, requireTenant);
retroActionItemRouter.use(authenticateUser, requireTenant);

// Tenant-level action items routes
actionItemRouter.get('/', actionItemController.listActionItems);
actionItemRouter.post('/', actionItemController.createActionItem);
actionItemRouter.get('/:actionItemId', actionItemController.getActionItem);
actionItemRouter.patch('/:actionItemId', actionItemController.updateActionItem);
actionItemRouter.delete('/:actionItemId', actionItemController.deleteActionItem);

// Retrospective-specific action item routes
retroActionItemRouter.get('/', actionItemController.listActionItems);
retroActionItemRouter.post('/', actionItemController.createActionItem);
