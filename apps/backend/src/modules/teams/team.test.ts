import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { db } from '../../db/index.js';
import { generateAccessToken } from '../../utils/security.js';
import { TeamRole, TenantRole } from '@retrospace/shared';

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

describe('Team Management & Authorization', () => {
  const userA = { id: 'usr_A', email: 'userA@example.com' };
  const tokenUserA = generateAccessToken({ userId: userA.id, email: userA.email });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/tenants/:tenantId/teams', () => {
    it('creates a new team and assigns the creator as FACILITATOR', async () => {
      // Mock tenant membership lookup for User A
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  membershipId: 'mem_1',
                  role: TenantRole.MEMBER,
                  tenantId: 'org_1',
                  tenantName: 'Acme',
                  tenantSlug: 'acme',
                },
              ]),
            }),
          }),
        }),
      });

      let insertCall = 0;
      const insertMock = vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((val) => {
          insertCall++;
          if (insertCall === 1) {
            // Team insert
            return {
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'tem_1',
                  tenantId: 'org_1',
                  name: val.name,
                  description: val.description,
                  createdBy: userA.id,
                },
              ]),
            };
          }
          if (insertCall === 2) {
            // Team membership insert
            return {
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'tmem_1',
                  tenantId: 'org_1',
                  teamId: 'tem_1',
                  userId: userA.id,
                  role: TeamRole.FACILITATOR,
                },
              ]),
            };
          }
          return Promise.resolve([]);
        }),
      }));

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
      (db.insert as unknown as ReturnType<typeof vi.fn>).mockImplementation(insertMock);

      const res = await request(app)
        .post('/api/v1/tenants/org_1/teams')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          name: 'Core Platform Squad',
          description: 'Responsible for infrastructure and platform features',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.team.name).toBe('Core Platform Squad');
      expect(res.body.data.membership.role).toBe(TeamRole.FACILITATOR);
    });
  });

  describe('POST /api/v1/tenants/:tenantId/teams/:teamId/members', () => {
    it('SECURITY: rejects adding a user who is not a member of the organization', async () => {
      // Mock requireTenant lookup -> User A is tenant OWNER
      let selectCount = 0;
      const selectMock = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  membershipId: 'mem_1',
                  role: TenantRole.OWNER,
                  tenantId: 'org_1',
                  tenantName: 'Acme',
                  tenantSlug: 'acme',
                },
              ]),
            }),
          }),
          where: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) {
              // Team exists check
              return {
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'tem_1',
                    tenantId: 'org_1',
                    name: 'Core Squad',
                  },
                ]),
              };
            }
            // User in organization check -> NOT FOUND!
            return {
              limit: vi.fn().mockResolvedValue([]),
            };
          }),
        })),
      }));

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const res = await request(app)
        .post('/api/v1/tenants/org_1/teams/tem_1/members')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          userId: 'usr_external_attacker',
          role: TeamRole.MEMBER,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('User must be a member of the organization');
    });
  });
});
