import { Request, Response, NextFunction } from 'express';
import { boardService } from './board.service.js';
import {
  createFeedbackSchema,
  updateFeedbackSchema,
  createCommentSchema,
  TeamRole,
  TenantRole,
} from '@retrospace/shared';
import { z } from 'zod';

const moveCardSchema = z.object({
  columnId: z.string().min(1, 'Column ID is required'),
  position: z.number().int().min(0, 'Position must be a positive integer'),
});

export class BoardController {
  async getBoardData(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await boardService.getBoardData(
        req.tenant!.id,
        req.params.retrospectiveId,
        req.user!.id
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async createCard(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = createFeedbackSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid card content',
          },
        });
        return;
      }

      const card = await boardService.createCard(
        req.tenant!.id,
        req.params.retrospectiveId,
        req.user!.id,
        validation.data
      );

      res.status(201).json({
        success: true,
        data: card,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCard(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = updateFeedbackSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid update data',
          },
        });
        return;
      }

      const isFacilitatorOrAdmin =
        req.membership?.role === TenantRole.OWNER ||
        req.membership?.role === TenantRole.ADMIN ||
        req.teamMembership?.role === TeamRole.FACILITATOR;

      const updated = await boardService.updateCard(
        req.tenant!.id,
        req.params.retrospectiveId,
        req.params.cardId,
        req.user!.id,
        isFacilitatorOrAdmin,
        validation.data
      );

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async moveCard(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = moveCardSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid move coordinates',
          },
        });
        return;
      }

      const moved = await boardService.moveCard(
        req.tenant!.id,
        req.params.retrospectiveId,
        req.params.cardId,
        validation.data.columnId,
        validation.data.position
      );

      res.status(200).json({
        success: true,
        data: moved,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCard(req: Request, res: Response, next: NextFunction) {
    try {
      const isFacilitatorOrAdmin =
        req.membership?.role === TenantRole.OWNER ||
        req.membership?.role === TenantRole.ADMIN ||
        req.teamMembership?.role === TeamRole.FACILITATOR;

      await boardService.deleteCard(
        req.tenant!.id,
        req.params.retrospectiveId,
        req.params.cardId,
        req.user!.id,
        isFacilitatorOrAdmin
      );

      res.status(200).json({
        success: true,
        data: { message: 'Card deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }

  async toggleVote(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await boardService.toggleVote(
        req.tenant!.id,
        req.params.retrospectiveId,
        req.params.cardId,
        req.user!.id
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async listComments(req: Request, res: Response, next: NextFunction) {
    try {
      const list = await boardService.listComments(
        req.tenant!.id,
        req.params.cardId
      );

      res.status(200).json({
        success: true,
        data: list,
      });
    } catch (error) {
      next(error);
    }
  }

  async addComment(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = createCommentSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid comment',
          },
        });
        return;
      }

      const comment = await boardService.addComment(
        req.tenant!.id,
        req.params.cardId,
        req.user!.id,
        validation.data
      );

      res.status(201).json({
        success: true,
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteComment(req: Request, res: Response, next: NextFunction) {
    try {
      const isFacilitatorOrAdmin =
        req.membership?.role === TenantRole.OWNER ||
        req.membership?.role === TenantRole.ADMIN ||
        req.teamMembership?.role === TeamRole.FACILITATOR;

      const result = await boardService.deleteComment(
        req.tenant!.id,
        req.params.commentId,
        req.user!.id,
        isFacilitatorOrAdmin
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const boardController = new BoardController();
