import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { db } from '../../db/index.js';
import { generateAccessToken } from '../../utils/security.js';
import { TenantRole } from '@retrospace/shared';

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

describe('Tenant Management & Multi-Tenant Isolation', () => {
  const userA = { id: 'usr_A', email: 'userA@example.com' };
  const userB = { id: 'usr_B', email: 'userB@example.com' };

  const tokenUserA = generateAccessToken({ userId: userA.id, email: userA.email });
  const tokenUserB = generateAccessToken({ userId: userB.id, email: userB.email });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/tenants', () => {
    it('creates an organization and transactionally assigns creator as OWNER', async () => {
      // Mock slug collision check -> empty
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      let insertCall = 0;
      const insertMock = vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((val) => {
          insertCall++;
          if (insertCall === 1) {
            // Tenant insert
            return {
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'org_123',
                  name: val.name,
                  slug: val.slug,
                  createdAt: new Date(),
                },
              ]),
            };
          }
          if (insertCall === 2) {
            // Membership insert
            return {
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'mem_123',
                  tenantId: 'org_123',
                  userId: userA.id,
                  role: TenantRole.OWNER,
                },
              ]),
            };
          }
          // Activity log insert
          return Promise.resolve([]);
        }),
      }));

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
      (db.insert as unknown as ReturnType<typeof vi.fn>).mockImplementation(insertMock);

      const res = await request(app)
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          name: 'Acme Dynamics',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tenant.name).toBe('Acme Dynamics');
      expect(res.body.data.membership.role).toBe(TenantRole.OWNER);
    });
  });

  describe('Tenant Boundary & Isolation Security', () => {
    it('allows a member of Tenant A to access Tenant A details', async () => {
      // Mock membership lookup for User A in Tenant A -> found
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  membershipId: 'mem_A',
                  role: TenantRole.MEMBER,
                  tenantId: 'org_A',
                  tenantName: 'Tenant A Org',
                  tenantSlug: 'tenant-a',
                },
              ]),
            }),
          }),
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'org_A',
                name: 'Tenant A Org',
                slug: 'tenant-a',
              },
            ]),
          }),
        }),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const res = await request(app)
        .get('/api/v1/tenants/org_A')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Tenant A Org');
    });

    it('STRICT ISOLATION: blocks User B from accessing Tenant A with 403 Forbidden', async () => {
      // Mock membership lookup for User B in Tenant A -> NOT found (empty array)
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const res = await request(app)
        .get('/api/v1/tenants/org_A')
        .set('Authorization', `Bearer ${tokenUserB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Access denied');
    });

    it('rejects tenant role change when performed by a regular MEMBER', async () => {
      // User is a MEMBER, not an OWNER
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  membershipId: 'mem_regular',
                  role: TenantRole.MEMBER,
                  tenantId: 'org_A',
                  tenantName: 'Tenant A Org',
                  tenantSlug: 'tenant-a',
                },
              ]),
            }),
          }),
        }),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const res = await request(app)
        .patch('/api/v1/tenants/org_A/members/mem_other')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ role: TenantRole.ADMIN });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Action requires one of the following roles: OWNER');
    });

    it('prevents accidental demotion or removal of the final organization OWNER', async () => {
      // User is an OWNER in Tenant A
      let selectCount = 0;
      const selectMock = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  membershipId: 'mem_owner_1',
                  role: TenantRole.OWNER,
                  tenantId: 'org_A',
                  tenantName: 'Tenant A Org',
                  tenantSlug: 'tenant-a',
                },
              ]),
            }),
          }),
          where: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) {
              // Target member lookup -> role is OWNER
              return {
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'mem_owner_1',
                    tenantId: 'org_A',
                    userId: userA.id,
                    role: TenantRole.OWNER,
                  },
                ]),
              };
            }
            // Owner count query -> only 1 owner left
            return Promise.resolve([{ value: 1 }]);
          }),
        })),
      }));

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const res = await request(app)
        .patch('/api/v1/tenants/org_A/members/mem_owner_1')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ role: TenantRole.MEMBER });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Cannot demote the final organization owner');
    });
  });

  describe('Invitations & Acceptance Flow', () => {
    it('allows an ADMIN or OWNER to create a secure invitation', async () => {
      let innerJoinCount = 0;
      const selectMock = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockImplementation(() => {
            innerJoinCount++;
            return {
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(
                  innerJoinCount === 1
                    ? [
                        {
                          membershipId: 'mem_owner_1',
                          role: TenantRole.OWNER,
                          tenantId: 'org_A',
                          tenantName: 'Tenant A Org',
                          tenantSlug: 'tenant-a',
                        },
                      ]
                    : []
                ),
              }),
            };
          }),
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No duplicate invite
          }),
        })),
      }));

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'inv_123',
              tenantId: 'org_A',
              email: 'newcolleague@example.com',
              role: TenantRole.MEMBER,
              expiresAt: new Date(Date.now() + 100000),
            },
          ]),
        }),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
      (db.insert as unknown as ReturnType<typeof vi.fn>).mockImplementation(insertMock);

      const res = await request(app)
        .post('/api/v1/tenants/org_A/invitations')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          email: 'newcolleague@example.com',
          role: TenantRole.MEMBER,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inviteUrl).toContain('/invite/');
      expect(res.body.data.token).toBeDefined();
    });
  });
});
