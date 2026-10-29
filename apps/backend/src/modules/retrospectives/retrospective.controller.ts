import { Request, Response, NextFunction } from 'express';
import { retrospectiveService } from './retrospective.service.js';
import {
  createRetrospectiveSchema,
  RetrospectiveStatus,
  TeamRole,
} from '@retrospace/shared';
import { z } from 'zod';

const updateRetrospectiveSchema = z.object({
  title: z.string().min(2).max(200).trim().optional(),
  description: z.string().max(1000).trim().optional(),
  votingLimit: z.number().int().min(1).max(20).optional(),
  isAnonymous: z.boolean().optional(),
});

const addColumnSchema = z.object({
  title: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex code').optional(),
  position: z.number().int().min(0).optional(),
});

const updateColumnSchema = z.object({
  title: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).optional(),
});

export class RetrospectiveController {
  async createRetrospective(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = createRetrospectiveSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid retrospective data',
          },
        });
        return;
      }

      const result = await retrospectiveService.createRetrospective(
        req.tenant!.id,
        req.user!.id,
        validation.data
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async listRetrospectives(req: Request, res: Response, next: NextFunction) {
    try {
      const teamId = req.query.teamId as string | undefined;
      const status = req.query.status as RetrospectiveStatus | undefined;

      const retros = await retrospectiveService.listRetrospectives(req.tenant!.id, {
        teamId,
        status,
      });

      res.status(200).json({
        success: true,
        data: retros,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRetrospective(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await retrospectiveService.getRetrospectiveById(
        req.tenant!.id,
        req.params.retrospectiveId
      );

      res.status(200).json({
        success: true,
        data: {
          ...result,
          currentUserTeamRole: req.teamMembership?.role || TeamRole.MEMBER,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateRetrospective(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = updateRetrospectiveSchema.safeParse(req.body);
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

      const updated = await retrospectiveService.updateRetrospective(
        req.tenant!.id,
        req.params.retrospectiveId,
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

  async startSession(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await retrospectiveService.startSession(
        req.tenant!.id,
        req.params.retrospectiveId
      );

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async completeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await retrospectiveService.completeSession(
        req.tenant!.id,
        req.params.retrospectiveId
      );

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteRetrospective(req: Request, res: Response, next: NextFunction) {
    try {
      await retrospectiveService.deleteRetrospective(
        req.tenant!.id,
        req.params.retrospectiveId
      );

      res.status(200).json({
        success: true,
        data: { message: 'Retrospective deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }

  async addColumn(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = addColumnSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid column data',
          },
        });
        return;
      }

      const column = await retrospectiveService.addColumn(
        req.tenant!.id,
        req.params.retrospectiveId,
        validation.data
      );

      res.status(201).json({
        success: true,
        data: column,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateColumn(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = updateColumnSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid column data',
          },
        });
        return;
      }

      const updated = await retrospectiveService.updateColumn(
        req.tenant!.id,
        req.params.retrospectiveId,
        req.params.columnId,
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

  async deleteColumn(req: Request, res: Response, next: NextFunction) {
    try {
      await retrospectiveService.deleteColumn(
        req.tenant!.id,
        req.params.retrospectiveId,
        req.params.columnId
      );

      res.status(200).json({
        success: true,
        data: { message: 'Column deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const retrospectiveController = new RetrospectiveController();
