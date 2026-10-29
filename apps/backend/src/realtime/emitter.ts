import type { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setSocketServer(io: SocketIOServer) {
  ioInstance = io;
}

export function getSocketServer(): SocketIOServer | null {
  return ioInstance;
}

export function broadcastToRetro(
  retrospectiveId: string,
  event: string,
  payload: unknown
) {
  if (ioInstance) {
    ioInstance.to(`retro:${retrospectiveId}`).emit(event, payload);
  }
}

