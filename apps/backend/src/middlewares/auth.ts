import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/security.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.retrospace_access) {
      token = req.cookies.retrospace_access;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token missing',
        },
      });
      return;
    }

    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired access token',
      },
    });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.retrospace_access) {
      token = req.cookies.retrospace_access;
    }

    if (token) {
      const payload = verifyAccessToken(token);
      req.user = {
        id: payload.userId,
        email: payload.email,
      };
    }
  } catch {
    // Ignore invalid token in optional auth
  }
  next();
}
