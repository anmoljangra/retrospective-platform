import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app, logger } from './app.js';
import { env } from './config/env.js';
import { setupSocketServer } from './realtime/socket.js';

const server = http.createServer(app);

export const io = new SocketIOServer(server, {
  cors: {
    origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  },
});

setupSocketServer(io);

const port = env.PORT;

if (env.NODE_ENV !== 'test') {
  server.listen(port, () => {
    logger.info(`🚀 RetroSpace Backend server listening on port ${port} in ${env.NODE_ENV} mode`);
  });
}
