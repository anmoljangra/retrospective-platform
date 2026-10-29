import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO, type Socket as ClientSocket } from 'socket.io-client';
import { setupSocketServer } from './socket.js';
import { generateAccessToken } from '../utils/security.js';
import { db } from '../db/index.js';
import { SOCKET_EVENTS } from '@retrospace/shared';

vi.mock('../db/index.js', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return {
    db: mockDb,
    queryClient: { end: vi.fn() },
    schema: {},
  };
});

describe('Real-Time Collaboration & Socket Security', () => {
  let ioServer: SocketIOServer;
  let httpServer: any;
  let port: number;

  const userA = { id: 'usr_A', email: 'userA@example.com', name: 'Alice' };
  const tokenUserA = generateAccessToken({ userId: userA.id, email: userA.email });

  beforeEach(async () => {
    vi.clearAllMocks();
    httpServer = createServer();
    ioServer = new SocketIOServer(httpServer);
    setupSocketServer(ioServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as any).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    ioServer.close();
    await new Promise<void>((resolve) => httpServer.close(resolve));
  });

  it('rejects unauthenticated socket connections', async () => {
    const client = ClientIO(`http://localhost:${port}`, {
      auth: { token: '' }, // No token
      transports: ['websocket'],
      reconnection: false,
    });

    const error = await new Promise<string>((resolve) => {
      client.on('connect_error', (err) => {
        resolve(err.message);
      });
    });

    expect(error).toContain('Authentication token required');
    client.close();
  });

  it('authenticates socket and allows joining authorized retrospective room', async () => {
    // Mock user lookup on handshake
    let selectCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          selectCount++;
          if (selectCount === 1) {
            // Handshake user query
            return {
              limit: vi.fn().mockResolvedValue([userA]),
            };
          }
          if (selectCount === 2) {
            // Retro exists query
            return {
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'ret_100',
                  tenantId: 'org_1',
                  isAnonymous: false,
                },
              ]),
            };
          }
          // Tenant membership query -> active member
          return {
            limit: vi.fn().mockResolvedValue([{ id: 'mem_1' }]),
          };
        }),
      })),
    }));

    (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const client = ClientIO(`http://localhost:${port}`, {
      auth: { token: tokenUserA },
      transports: ['websocket'],
      reconnection: false,
    });

    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        client.emit(SOCKET_EVENTS.JOIN_RETRO, { retrospectiveId: 'ret_100' });
        // Small delay to allow join event processing
        setTimeout(resolve, 50);
      });
    });

    expect(client.connected).toBe(true);
    client.close();
  });

  it('STRICT ISOLATION: rejects joining a retrospective room from an unauthorized tenant', async () => {
    let selectCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          selectCount++;
          if (selectCount === 1) {
            // Handshake user query
            return {
              limit: vi.fn().mockResolvedValue([userA]),
            };
          }
          if (selectCount === 2) {
            // Retro exists in Tenant B
            return {
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'ret_foreign',
                  tenantId: 'org_foreign',
                  isAnonymous: false,
                },
              ]),
            };
          }
          // Tenant membership query for userA in org_foreign -> NOT FOUND!
          return {
            limit: vi.fn().mockResolvedValue([]),
          };
        }),
      })),
    }));

    (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const client = ClientIO(`http://localhost:${port}`, {
      auth: { token: tokenUserA },
      transports: ['websocket'],
      reconnection: false,
    });

    const errorEvent = await new Promise<{ message: string }>((resolve) => {
      client.on('connect', () => {
        client.emit(SOCKET_EVENTS.JOIN_RETRO, { retrospectiveId: 'ret_foreign' });
      });
      client.on('error', (err) => {
        resolve(err);
      });
    });

    expect(errorEvent.message).toContain('Access denied: unauthorized room');
    client.close();
  });
});

