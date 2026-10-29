import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { registerSchema, loginSchema } from '@retrospace/shared';
import { env } from '../../config/env.js';

const REFRESH_COOKIE_NAME = 'retrospace_refresh';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
}

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = registerSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid input data',
            details: validation.error.flatten(),
          },
        });
        return;
      }

      const meta = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      };

      const result = await authService.register(validation.data, meta);
      setRefreshCookie(res, result.refreshToken);

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid input data',
            details: validation.error.flatten(),
          },
        });
        return;
      }

      const meta = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      };

      const result = await authService.login(validation.data, meta);
      setRefreshCookie(res, result.refreshToken);

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const rawRefreshToken =
        req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

      if (!rawRefreshToken) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Refresh token not found',
          },
        });
        return;
      }

      const meta = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      };

      const result = await authService.refresh(rawRefreshToken, meta);
      setRefreshCookie(res, result.refreshToken);

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      clearRefreshCookie(res);
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const rawRefreshToken =
        req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

      await authService.logout(rawRefreshToken);
      clearRefreshCookie(res);

      res.status(200).json({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          },
        });
        return;
      }

      const result = await authService.getCurrentUser(req.user.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
