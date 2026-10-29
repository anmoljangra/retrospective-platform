import { Request, Response, NextFunction } from 'express';
import { teamService } from './team.service.js';
import { createTeamSchema, TeamRole } from '@retrospace/shared';
import { z } from 'zod';

const updateTeamSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
});

const addTeamMemberSchema = z.object({
  userId: z.string().min(1, 'Target user ID is required'),
  role: z.enum([TeamRole.FACILITATOR, TeamRole.MEMBER]).default(TeamRole.MEMBER),
});

const updateTeamMemberRoleSchema = z.object({
  role: z.enum([TeamRole.FACILITATOR, TeamRole.MEMBER]),
});

export class TeamController {
  async createTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = createTeamSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid team data',
          },
        });
        return;
      }

      const result = await teamService.createTeam(
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

  async listTeams(req: Request, res: Response, next: NextFunction) {
    try {
      const teams = await teamService.listTeams(req.tenant!.id);
      res.status(200).json({
        success: true,
        data: teams,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const team = await teamService.getTeamById(req.tenant!.id, req.params.teamId);
      res.status(200).json({
        success: true,
        data: team,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = updateTeamSchema.safeParse(req.body);
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

      const updated = await teamService.updateTeam(
        req.tenant!.id,
        req.params.teamId,
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

  async deleteTeam(req: Request, res: Response, next: NextFunction) {
    try {
      await teamService.deleteTeam(req.tenant!.id, req.params.teamId);
      res.status(200).json({
        success: true,
        data: { message: 'Team deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }

  async listTeamMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await teamService.listTeamMembers(
        req.tenant!.id,
        req.params.teamId
      );
      res.status(200).json({
        success: true,
        data: members,
      });
    } catch (error) {
      next(error);
    }
  }

  async addTeamMember(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = addTeamMemberSchema.safeParse(req.body);
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

      const membership = await teamService.addTeamMember(
        req.tenant!.id,
        req.params.teamId,
        validation.data.userId,
        validation.data.role
      );

      res.status(201).json({
        success: true,
        data: membership,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTeamMemberRole(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = updateTeamMemberRoleSchema.safeParse(req.body);
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

      const updated = await teamService.updateTeamMemberRole(
        req.tenant!.id,
        req.params.teamId,
        req.params.userId,
        validation.data.role
      );

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeTeamMember(req: Request, res: Response, next: NextFunction) {
    try {
      await teamService.removeTeamMember(
        req.tenant!.id,
        req.params.teamId,
        req.params.userId
      );

      res.status(200).json({
        success: true,
        data: { message: 'Team member removed successfully' },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const teamController = new TeamController();

