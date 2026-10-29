import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { db } from '../../db/index.js';
import { generateAccessToken } from '../../utils/security.js';
import { RetrospectiveStatus, TenantRole, TeamRole } from '@retrospace/shared';

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

describe('Retrospective Board (Feedback, Voting, Comments, Anonymity)', () => {
  const userA = { id: 'usr_A', email: 'userA@example.com' };
  const tokenUserA = generateAccessToken({ userId: userA.id, email: userA.email });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/tenants/:tenantId/retrospectives/:retrospectiveId/board', () => {
    it('ANONYMITY ENFORCEMENT: completely strips author info when retrospective is anonymous', async () => {
      // Mock requireTenant & requireRetrospectiveAccess
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
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: 'crd_1',
                  tenantId: 'org_1',
                  retrospectiveId: 'ret_anon',
                  columnId: 'col_1',
                  authorId: 'usr_secret_author',
                  authorName: 'Secret Author',
                  content: 'We need better test coverage',
                  position: 0,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ]),
            }),
          }),
          where: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) {
              // Retrospective query in requireRetrospectiveAccess
              return {
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'ret_anon',
                    tenantId: 'org_1',
                    teamId: 'tem_1',
                    title: 'Anonymous Retro',
                    status: RetrospectiveStatus.ACTIVE,
                    isAnonymous: true, // ANONYMOUS MODE ENABLED!
                    votingLimit: 5,
                  },
                ]),
              };
            }
            if (selectCount === 2) {
              // Retrospective query in getBoardData
              return {
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'ret_anon',
                    tenantId: 'org_1',
                    teamId: 'tem_1',
                    title: 'Anonymous Retro',
                    status: RetrospectiveStatus.ACTIVE,
                    isAnonymous: true,
                    votingLimit: 5,
                  },
                ]),
              };
            }
            if (selectCount === 3) {
              // Columns query
              return {
                orderBy: vi.fn().mockResolvedValue([
                  {
                    id: 'col_1',
                    title: 'What went well',
                    position: 0,
                    color: '#10B981',
                  },
                ]),
              };
            }
            if (selectCount === 4) {
              // Votes query
              return Promise.resolve([]);
            }
            // Comments query
            return Promise.resolve([]);
          }),
        })),
      }));

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const res = await request(app)
        .get('/api/v1/tenants/org_1/retrospectives/ret_anon/board')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.retrospective.isAnonymous).toBe(true);

      const returnedCard = res.body.data.cards[0];
      expect(returnedCard).toBeDefined();
      expect(returnedCard.content).toBe('We need better test coverage');
      // STRICT VERIFICATION: author must be null and no author id / name exposed
      expect(returnedCard.author).toBeNull();
      expect(returnedCard.authorId).toBeUndefined();
      expect(returnedCard.authorName).toBeUndefined();
    });
  });

  describe('POST /api/v1/tenants/:tenantId/retrospectives/:retrospectiveId/cards/:cardId/vote', () => {
    it('enforces voting limit and rejects vote when user exceeds limit', async () => {
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
              // Retrospective in requireRetrospectiveAccess
              return {
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'ret_vote_limit',
                    tenantId: 'org_1',
                    teamId: 'tem_1',
                    status: RetrospectiveStatus.ACTIVE,
                    votingLimit: 3,
                  },
                ]),
              };
            }
            if (selectCount === 2) {
              // Retrospective in toggleVote
              return {
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'ret_vote_limit',
                    tenantId: 'org_1',
                    teamId: 'tem_1',
                    status: RetrospectiveStatus.ACTIVE,
                    votingLimit: 3,
                  },
                ]),
              };
            }
            if (selectCount === 3) {
              // Check existing vote on this card -> NOT voted on this card yet
              return {
                limit: vi.fn().mockResolvedValue([]),
              };
            }
            // Count user votes cast so far -> 3 votes already cast (limit reached!)
            return Promise.resolve([{ value: 3 }]);
          }),
        })),
      }));

      (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const res = await request(app)
        .post('/api/v1/tenants/org_1/retrospectives/ret_vote_limit/cards/crd_target/vote')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('reached your limit of 3 votes');
    });
  });
});

