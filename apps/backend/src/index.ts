import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app, logger } from './app.js';
import { env } from './config/env.js';

const server = http.createServer(app);

export const io = new SocketIOServer(server, {
  cors: {
    origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Socket client connected');

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Socket client disconnected');
  });
});

const port = env.PORT;

server.listen(port, () => {
  logger.info(`🚀 RetroSpace Backend server listening on port ${port} in ${env.NODE_ENV} mode`);
});
