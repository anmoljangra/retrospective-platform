import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { db } from '../../db/index.js';
import { generateAccessToken } from '../../utils/security.js';
import { ActionItemPriority, ActionItemStatus, TenantRole } from '@retrospace/shared';

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

describe('Action Item Management & Assignment Security', () => {
  const userA = { id: 'usr_A', email: 'userA@example.com' };
  const tokenUserA = generateAccessToken({ userId: userA.id, email: userA.email });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/tenants/:tenantId/action-items', () => {
    it('creates an action item linked to retrospective', async () => {
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
            // Retrospective belongs to tenant check
            return {
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'ret_1',
                  tenantId: 'org_1',
                },
              ]),
            };
          }),
        })),
      }));

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'act_1',
              tenantId: 'org_1',
              retrospectiveId: 'ret_1',
              title: 'Add automated smoke tests to CI pipeline',
              status: ActionItemStatus.TODO,
              priority: ActionItemPriority.HIGH,
            },
          ]),
        }),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
      (db.insert as unknown as ReturnType<typeof vi.fn>).mockImplementation(insertMock);

      const res = await request(app)
        .post('/api/v1/tenants/org_1/action-items')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          retrospectiveId: 'ret_1',
          title: 'Add automated smoke tests to CI pipeline',
          priority: ActionItemPriority.HIGH,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Add automated smoke tests to CI pipeline');
      expect(res.body.data.status).toBe(ActionItemStatus.TODO);
    });

    it('SECURITY: rejects assigning action item to user who is not a tenant member', async () => {
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
              // Retro exists check
              return {
                limit: vi.fn().mockResolvedValue([{ id: 'ret_1' }]),
              };
            }
            // Assignee membership check -> NOT FOUND!
            return {
              limit: vi.fn().mockResolvedValue([]),
            };
          }),
        })),
      }));

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const res = await request(app)
        .post('/api/v1/tenants/org_1/action-items')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          retrospectiveId: 'ret_1',
          title: 'Invalid cross-tenant assignment',
          assigneeId: 'usr_outsider',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Assignee is not a member of this organization');
    });
  });

  describe('PATCH /api/v1/tenants/:tenantId/action-items/:actionItemId', () => {
    it('updates action item status and priority', async () => {
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
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
                id: 'act_1',
                tenantId: 'org_1',
                title: 'Task 1',
                status: ActionItemStatus.TODO,
              },
            ]),
          }),
        }),
      });

      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'act_1',
                status: ActionItemStatus.DONE,
              },
            ]),
          }),
        }),
      });

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
      (db.update as unknown as ReturnType<typeof vi.fn>).mockImplementation(updateMock);

      const res = await request(app)
        .patch('/api/v1/tenants/org_1/action-items/act_1')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          status: ActionItemStatus.DONE,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ActionItemStatus.DONE);
    });
  });
});

