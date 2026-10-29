import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { db } from '../../db/index.js';
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '../../utils/security.js';

vi.mock('../../db/index.js', () => {
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

describe('Authentication & Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('successfully registers a new user with valid input and sets refresh cookie', async () => {
      // Mock existing email check -> returns empty array
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock user insert
      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'usr_123',
              name: 'Alice Cooper',
              email: 'alice@example.com',
              createdAt: new Date(),
            },
          ]),
        }),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
      (db.insert as unknown as ReturnType<typeof vi.fn>).mockImplementation(insertMock);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Alice Cooper',
          email: 'alice@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('alice@example.com');
      expect(res.body.data.accessToken).toBeDefined();
      // Ensure password hash is not exposed
      expect(res.body.data.user.passwordHash).toBeUndefined();
      // Verify refresh cookie set
      const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
      expect(cookies).toBeDefined();
      expect(cookies?.some((c) => c.includes('retrospace_refresh='))).toBe(true);
    });

    it('rejects duplicate email with 409 Conflict', async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'usr_existing' }]),
          }),
        }),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Alice Duplicate',
          email: 'alice@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('already exists');
    });

    it('validates input parameters with Zod and rejects malformed email or short password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: '',
          email: 'not-an-email',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('successfully logs in with correct credentials', async () => {
      const hashedPassword = await hashPassword('SecretPassword123');

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'usr_login_1',
                name: 'Bob Marley',
                email: 'bob@example.com',
                passwordHash: hashedPassword,
                createdAt: new Date(),
              },
            ]),
          }),
        }),
      });

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([{ id: 'ses_1' }]),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
      (db.insert as unknown as ReturnType<typeof vi.fn>).mockImplementation(insertMock);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'bob@example.com',
          password: 'SecretPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('bob@example.com');
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('rejects incorrect password with 401 Unauthorized', async () => {
      const hashedPassword = await hashPassword('CorrectPassword123');

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'usr_login_1',
                name: 'Bob Marley',
                email: 'bob@example.com',
                passwordHash: hashedPassword,
              },
            ]),
          }),
        }),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'bob@example.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid email or password');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('successfully rotates refresh token and returns new access token', async () => {
      const { rawToken } = generateRefreshToken();

      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24);

      let selectCallCount = 0;
      const selectMock = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCallCount++;
              if (selectCallCount === 1) {
                // Return refresh session
                return Promise.resolve([
                  {
                    id: 'ses_rotate_1',
                    userId: 'usr_1',
                    family: 'fam_1',
                    isRevoked: false,
                    expiresAt: futureDate,
                  },
                ]);
              }
              // Return user
              return Promise.resolve([
                {
                  id: 'usr_1',
                  name: 'Bob Marley',
                  email: 'bob@example.com',
                },
              ]);
            }),
          }),
        }),
      }));

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
      (db.update as unknown as ReturnType<typeof vi.fn>).mockImplementation(updateMock);
      (db.insert as unknown as ReturnType<typeof vi.fn>).mockImplementation(insertMock);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`retrospace_refresh=${rawToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('detects refresh token reuse and revokes token family', async () => {
      const { rawToken } = generateRefreshToken();

      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'ses_reused',
                userId: 'usr_1',
                family: 'fam_compromised',
                isRevoked: true, // Reused revoked token!
                expiresAt: new Date(Date.now() + 100000),
              },
            ]),
          }),
        }),
      });

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
      (db.update as unknown as ReturnType<typeof vi.fn>).mockImplementation(updateMock);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`retrospace_refresh=${rawToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Refresh token reuse detected');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns current user profile and tenant memberships when authenticated', async () => {
      const validToken = generateAccessToken({
        userId: 'usr_me_1',
        email: 'me@example.com',
      });

      let selectCallCount = 0;
      const selectMock = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              return Promise.resolve([
                {
                  id: 'usr_me_1',
                  name: 'Current User',
                  email: 'me@example.com',
                  createdAt: new Date(),
                },
              ]);
            }),
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: 'mem_1',
                tenantId: 'ten_1',
                role: 'OWNER',
                joinedAt: new Date(),
                tenantName: 'Acme Corp',
                tenantSlug: 'acme-corp',
              },
            ]),
          }),
        }),
      }));

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('me@example.com');
      expect(res.body.data.memberships).toHaveLength(1);
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
