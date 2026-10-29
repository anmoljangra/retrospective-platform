import { Request, Response, NextFunction } from 'express';
import { tenantService } from './tenant.service.js';
import {
  createTenantSchema,
  inviteMemberSchema,
  TenantRole,
} from '@retrospace/shared';
import { z } from 'zod';

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
});

const updateRoleSchema = z.object({
  role: z.enum([TenantRole.OWNER, TenantRole.ADMIN, TenantRole.MEMBER]),
});

export class TenantController {
  async createTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = createTenantSchema.safeParse(req.body);
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

      const result = await tenantService.createTenant(req.user!.id, validation.data);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async listUserTenants(req: Request, res: Response, next: NextFunction) {
    try {
      const tenants = await tenantService.listUserTenants(req.user!.id);
      res.status(200).json({
        success: true,
        data: tenants,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const tenant = await tenantService.getTenantById(req.tenant!.id);
      res.status(200).json({
        success: true,
        data: {
          ...tenant,
          currentUserRole: req.membership!.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = updateTenantSchema.safeParse(req.body);
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

      const updated = await tenantService.updateTenant(req.tenant!.id, validation.data);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async listMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await tenantService.listMembers(req.tenant!.id);
      res.status(200).json({
        success: true,
        data: members,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMemberRole(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = updateRoleSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid role',
          },
        });
        return;
      }

      const updated = await tenantService.updateMemberRole(
        req.tenant!.id,
        req.params.membershipId,
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

  async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      await tenantService.removeMember(req.tenant!.id, req.params.membershipId);
      res.status(200).json({
        success: true,
        data: { message: 'Member removed successfully' },
      });
    } catch (error) {
      next(error);
    }
  }

  async inviteMember(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = inviteMemberSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid invite data',
          },
        });
        return;
      }

      const result = await tenantService.inviteMember(
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

  async listInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const invites = await tenantService.listInvitations(req.tenant!.id);
      res.status(200).json({
        success: true,
        data: invites,
      });
    } catch (error) {
      next(error);
    }
  }

  async revokeInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      await tenantService.revokeInvitation(req.tenant!.id, req.params.invitationId);
      res.status(200).json({
        success: true,
        data: { message: 'Invitation revoked successfully' },
      });
    } catch (error) {
      next(error);
    }
  }

  async getInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const invite = await tenantService.getInvitationByToken(req.params.token);
      res.status(200).json({
        success: true,
        data: invite,
      });
    } catch (error) {
      next(error);
    }
  }

  async acceptInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.acceptInvitation(
        req.user!.id,
        req.params.token
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

export const tenantController = new TenantController();
