import { Request, Response, NextFunction } from 'express';
import { actionItemService } from './action.service.js';
import {
  createActionItemSchema,
  updateActionItemSchema,
  ActionItemStatus,
  ActionItemPriority,
} from '@retrospace/shared';

export class ActionItemController {
  async listActionItems(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as ActionItemStatus | undefined;
      const priority = req.query.priority as ActionItemPriority | undefined;
      const assigneeId = req.query.assigneeId as string | undefined;
      const retrospectiveId = (req.params.retrospectiveId || req.query.retrospectiveId) as
        | string
        | undefined;

      const items = await actionItemService.listActionItems(req.tenant!.id, {
        status,
        priority,
        assigneeId,
        retrospectiveId,
      });

      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  async getActionItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await actionItemService.getActionItemById(
        req.tenant!.id,
        req.params.actionItemId
      );

      res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  async createActionItem(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = createActionItemSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid action item input',
          },
        });
        return;
      }

      const retrospectiveId =
        req.params.retrospectiveId || (req.body.retrospectiveId as string);

      if (!retrospectiveId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'retrospectiveId is required',
          },
        });
        return;
      }

      const newItem = await actionItemService.createActionItem(
        req.tenant!.id,
        req.user!.id,
        retrospectiveId,
        validation.data
      );

      res.status(201).json({
        success: true,
        data: newItem,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateActionItem(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = updateActionItemSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid input',
          },
        });
        return;
      }

      const updated = await actionItemService.updateActionItem(
        req.tenant!.id,
        req.params.actionItemId,
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

  async deleteActionItem(req: Request, res: Response, next: NextFunction) {
    try {
      await actionItemService.deleteActionItem(
        req.tenant!.id,
        req.params.actionItemId
      );

      res.status(200).json({
        success: true,
        data: { message: 'Action item deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const actionItemController = new ActionItemController();
