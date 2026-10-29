import { Router } from 'express';
import { boardController } from './board.controller.js';
import { authenticateUser } from '../../middlewares/auth.js';
import { requireTenant } from '../../middlewares/tenant.js';
import { requireRetrospectiveAccess } from '../../middlewares/retrospective.js';

export const boardRouter = Router({ mergeParams: true });

boardRouter.use(authenticateUser, requireTenant, requireRetrospectiveAccess);

// Full board state
boardRouter.get('/board', boardController.getBoardData);

// Cards
boardRouter.post('/cards', boardController.createCard);
boardRouter.patch('/cards/:cardId', boardController.updateCard);
boardRouter.patch('/cards/:cardId/move', boardController.moveCard);
boardRouter.delete('/cards/:cardId', boardController.deleteCard);

// Voting
boardRouter.post('/cards/:cardId/vote', boardController.toggleVote);

// Comments
boardRouter.get('/cards/:cardId/comments', boardController.listComments);
boardRouter.post('/cards/:cardId/comments', boardController.addComment);
boardRouter.delete('/cards/:cardId/comments/:commentId', boardController.deleteComment);
