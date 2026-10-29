import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/security.js';
import { db } from '../db/index.js';
import { retrospectives, tenantMemberships, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { SOCKET_EVENTS } from '@retrospace/shared';
import { logger } from '../app.js';
import { setSocketServer, broadcastToRetro } from './emitter.js';

export interface SocketUser {
  id: string;
  email: string;
  name?: string;
}

export function setupSocketServer(io: SocketIOServer) {
  setSocketServer(io);

  // 1. Authentication Middleware for WebSockets
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = verifyAccessToken(token);

      // Fetch user name
      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.data.user = user;
      next();
    } catch (err) {
      return next(new Error('Invalid or expired socket authentication token'));
    }
  });

  // 2. Connection and Room Management
  io.on('connection', (socket: Socket) => {
    const user: SocketUser = socket.data.user;
    logger.info({ userId: user.id, socketId: socket.id }, 'Authenticated socket connected');

    // Join Retrospective Room
    socket.on(SOCKET_EVENTS.JOIN_RETRO, async (data: { retrospectiveId: string }) => {
      try {
        const { retrospectiveId } = data || {};
        if (!retrospectiveId) return;

        // Security check: verify retrospective exists and user belongs to its organization
        const [retro] = await db
          .select({
            id: retrospectives.id,
            tenantId: retrospectives.tenantId,
            isAnonymous: retrospectives.isAnonymous,
          })
          .from(retrospectives)
          .where(eq(retrospectives.id, retrospectiveId))
          .limit(1);

        if (!retro) {
          socket.emit('error', { message: 'Retrospective not found' });
          return;
        }

        const [membership] = await db
          .select({ id: tenantMemberships.id })
          .from(tenantMemberships)
          .where(
            and(
              eq(tenantMemberships.tenantId, retro.tenantId),
              eq(tenantMemberships.userId, user.id)
            )
          )
          .limit(1);

        if (!membership) {
          socket.emit('error', { message: 'Access denied: unauthorized room' });
          return;
        }

        const roomName = `retro:${retrospectiveId}`;
        socket.join(roomName);

        // Broadcast user joined
        socket.to(roomName).emit(SOCKET_EVENTS.USER_JOINED, {
          userId: user.id,
          name: retro.isAnonymous ? 'Anonymous Teammate' : user.name,
        });

        logger.info({ userId: user.id, room: roomName }, 'User joined retrospective room');
      } catch (err) {
        logger.error({ err }, 'Error joining retrospective room');
      }
    });

    // Leave Retrospective Room
    socket.on(SOCKET_EVENTS.LEAVE_RETRO, (data: { retrospectiveId: string }) => {
      if (data?.retrospectiveId) {
        const roomName = `retro:${data.retrospectiveId}`;
        socket.leave(roomName);
        socket.to(roomName).emit(SOCKET_EVENTS.USER_LEFT, {
          userId: user.id,
        });
      }
    });

    socket.on('disconnect', () => {
      logger.info({ userId: user.id, socketId: socket.id }, 'Socket disconnected');
    });
  });
}

export { broadcastToRetro };
