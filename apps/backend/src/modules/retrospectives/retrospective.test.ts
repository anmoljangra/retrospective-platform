import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { db } from '../../db/index.js';
import { generateAccessToken } from '../../utils/security.js';
import { RetrospectiveStatus, TeamRole, TenantRole } from '@retrospace/shared';

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

describe('Retrospective Management & Session Lifecycle', () => {
  const userA = { id: 'usr_A', email: 'userA@example.com' };
  const tokenUserA = generateAccessToken({ userId: userA.id, email: userA.email });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/tenants/:tenantId/retrospectives', () => {
    it('creates a retrospective and initializes default template columns', async () => {
      // Mock tenant membership lookup -> User A is tenant OWNER
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
            // Team belongs to tenant check
            return {
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'tem_1',
                  name: 'Payments Squad',
                },
              ]),
            };
          }),
        })),
      }));

      let insertCall = 0;
      const insertMock = vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((val) => {
          insertCall++;
          if (insertCall === 1) {
            // Retrospective insert
            return {
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'ret_1',
                  tenantId: 'org_1',
                  teamId: 'tem_1',
                  title: val.title,
                  status: RetrospectiveStatus.DRAFT,
                  template: 'standard',
                  votingLimit: 5,
                },
              ]),
            };
          }
          if (insertCall === 2) {
            // Columns insert (should have 3 columns for standard template)
            expect(Array.isArray(val)).toBe(true);
            expect(val.length).toBe(3);
            return {
              returning: vi.fn().mockResolvedValue(
                val.map((c: any) => ({
                  ...c,
                  id: `col_${Math.random()}`,
                }))
              ),
            };
          }
          return Promise.resolve([]);
        }),
      }));

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
      (db.insert as unknown as ReturnType<typeof vi.fn>).mockImplementation(insertMock);

      const res = await request(app)
        .post('/api/v1/tenants/org_1/retrospectives')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          teamId: 'tem_1',
          title: 'Sprint 20 Retrospective',
          template: 'standard',
          votingLimit: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.retrospective.title).toBe('Sprint 20 Retrospective');
      expect(res.body.data.columns).toHaveLength(3);
    });
  });

  describe('Lifecycle State Transitions', () => {
    it('transitions DRAFT -> ACTIVE when started by facilitator', async () => {
      // Mock requireTenant & requireRetrospectiveAccess -> User is facilitator
      let selectCount = 0;
      const selectMock = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  membershipId: 'mem_1',
                  role: TenantRole.OWNER, // OWNER has facilitator rights
                  tenantId: 'org_1',
                  tenantName: 'Acme',
                  tenantSlug: 'acme',
                },
              ]),
            }),
          }),
          where: vi.fn().mockImplementation(() => {
            selectCount++;
            return {
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'ret_1',
                  tenantId: 'org_1',
                  teamId: 'tem_1',
                  title: 'Sprint 20',
                  status: RetrospectiveStatus.DRAFT, // currently DRAFT
                  isAnonymous: false,
                  votingLimit: 5,
                },
              ]),
            };
          }),
        })),
      }));

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'ret_1',
                status: RetrospectiveStatus.ACTIVE,
                startedAt: new Date(),
              },
            ]),
          }),
        }),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
      (db.update as unknown as ReturnType<typeof vi.fn>).mockImplementation(updateMock);

      const res = await request(app)
        .post('/api/v1/tenants/org_1/retrospectives/ret_1/start')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(RetrospectiveStatus.ACTIVE);
    });

    it('rejects restarting a COMPLETED retrospective with 400 Bad Request', async () => {
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
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'ret_completed',
                tenantId: 'org_1',
                teamId: 'tem_1',
                status: RetrospectiveStatus.COMPLETED, // already completed!
              },
            ]),
          }),
        })),
      }));

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const res = await request(app)
        .post('/api/v1/tenants/org_1/retrospectives/ret_completed/start')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Cannot restart a completed retrospective');
    });
  });
});
