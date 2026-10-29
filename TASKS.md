# RetroSpace Implementation Tasks & Phase Tracker

## Status Legend
- `TODO`: Not yet started
- `IN PROGRESS`: Currently being implemented or verified
- `BLOCKED`: Blocked by a genuine external dependency or decision
- `DONE`: Fully implemented, verified with tests/builds, and committed

---

## Phase 0: Repository Audit & Planning
- [x] Inspect repository state, directory structure, and Git setup (**DONE**)
- [x] Verify toolchain versions (Node.js, pnpm, Docker, Git) (**DONE**)
- [x] Configure comprehensive `.gitignore` for monorepo and secrets protection (**DONE**)
- [x] Initialize Monorepo workspace configuration (`pnpm-workspace.yaml`, root `package.json`) (**DONE**)
- [x] Document architecture, technology stack, security boundaries, and implementation plan (**DONE**)
- [x] Create `TASKS.md` (**DONE**)
- **Target Commit**: `chore: document project architecture and implementation plan`
- **Status**: DONE

---

## Phase 1: Development Foundation & Docker Environment
- [x] Configure PostgreSQL with custom initialization / health checks (**DONE**)
- [x] Create multi-stage `apps/backend/Dockerfile` and `apps/frontend/Dockerfile` (**DONE**)
- [x] Create root `docker-compose.yml` with health checks, named persistent volumes, and non-root users (**DONE**)
- [x] Define `.dockerignore` for frontend and backend (**DONE**)
- [x] Set up `.env.example` configurations across root, backend, and frontend (**DONE**)
- [x] Implement backend health check endpoint (`/api/v1/health`) (**DONE**)
- [x] Configure Drizzle ORM database connection and migration runner (**DONE**)
- [x] Verify Docker Compose build, service startup, health checks, and data persistence (**DONE**)
- **Target Commit**: `build: add Docker development environment`
- **Status**: DONE

---

## Phase 2: Authentication & Session Management
- [x] Define User schema in Drizzle ORM (`id`, `name`, `email`, `passwordHash`, timestamps) (**DONE**)
- [x] Define RefreshSession schema with family tracking, token hash, rotation, and revocation (**DONE**)
- [x] Implement password hashing with bcrypt/argon2 (**DONE**)
- [x] Implement short-lived JWT access tokens + HTTP-only refresh cookies (**DONE**)
- [x] Build Auth Service: register, login, refresh token rotation, logout, me endpoint (**DONE**)
- [x] Implement auth middleware (`authenticateUser`) with strict token validation (**DONE**)
- [x] Implement input validation schemas with Zod (register, login, refresh) (**DONE**)
- [x] Build Frontend Auth UI:
  - Register page (`/register`) with form validation & error feedback (**DONE**)
  - Login page (`/login`) with session management (**DONE**)
  - Auth context and Protected Route wrapper (**DONE**)
- [x] Implement automated backend tests for auth (registration, duplicate rejection, invalid credentials, refresh rotation, logout) (**DONE**)
- **Target Commit**: `feat(auth): implement authentication and session management`
- **Status**: DONE

---

## Phase 3: Tenant Management & Multi-Tenant Isolation
- [x] Define Tenant (`id`, `name`, `slug`, timestamps) and TenantMembership schemas (`OWNER`, `ADMIN`, `MEMBER`) (**DONE**)
- [x] Define Invitation schema (`tokenHash`, `role`, `expiresAt`, `acceptedAt`) (**DONE**)
- [x] Ensure tenant creation transactionally provisions owner membership (**DONE**)
- [x] Implement Tenant resolution and middleware (`requireTenant`, `requireTenantRole`) (**DONE**)
- [x] Build Tenant Services:
  - Create organization & unique slug generator (**DONE**)
  - List user organizations & organization switcher (**DONE**)
  - Invite members (secure hashed token, expiration, acceptance) (**DONE**)
  - Manage tenant members (role update, safe removal, prevent removing last owner) (**DONE**)
  - Accept invitation endpoint (**DONE**)
- [x] Build Frontend Organization Management:
  - Organization switcher in header/sidebar (**DONE**)
  - Create organization dialog/page (**DONE**)
  - Organization settings & member directory (**DONE**)
  - Invite member dialog & pending invitation list (**DONE**)
  - Invitation acceptance page (`/invite/:token`) (**DONE**)
- [x] Automated tenant isolation tests (prevent cross-tenant access via manipulated IDs/headers) (**DONE**)
- **Target Commit**: `feat(tenants): implement tenant management and isolation`
- **Status**: DONE

---

## Phase 4: Team Management
- [x] Define Team and TeamMembership schemas (`FACILITATOR`, `MEMBER`) with tenant integrity (**DONE**)
- [x] Implement Team Service & Routes under `/api/v1/tenants/:tenantId/teams` (**DONE**)
- [x] Validate team membership belongs strictly to current tenant members (**DONE**)
- [x] Implement team role-based authorization (`requireTeamRole`) (**DONE**)
- [x] Build Frontend Teams UI:
  - Team list & team creation modal (**DONE**)
  - Team details & member management (facilitator assignment) (**DONE**)
  - Team retrospective overview (**DONE**)
- [x] Automated tests for team authorization and isolation (**DONE**)
- **Target Commit**: `feat(teams): implement team management`
- **Status**: DONE

---

## Phase 5: Retrospective Management & Columns
- [x] Define Retrospective schema (`id`, `tenantId`, `teamId`, `title`, `description`, `status`, `template`, `isAnonymous`, `votingLimit`, `startedAt`, `endedAt`, timestamps) (**DONE**)
- [x] Define RetrospectiveColumn schema (`id`, `tenantId`, `retrospectiveId`, `title`, `description`, `color`, `position`) (**DONE**)
- [x] Provide default templates ("What went well? / What could be improved? / What should we try next?", "Mad / Sad / Glad", "Start / Stop / Continue") (**DONE**)
- [x] Implement Retrospective lifecycle state transitions (`DRAFT` -> `ACTIVE` -> `COMPLETED`) (**DONE**)
- [x] Implement facilitator permissions for column modifications (**DONE**)
- [x] Build Frontend Retrospective Management:
  - Create retrospective wizard (team, template, anonymity, voting limit) (**DONE**)
  - Retrospectives list view with status badges and filters (**DONE**)
  - Start / Complete session controls for facilitators (**DONE**)
- [x] Automated tests for lifecycle transitions and column operations (**DONE**)
- **Target Commit**: `feat(retrospectives): implement retrospective management`
- **Status**: DONE

---

## Phase 6: Retrospective Board (Feedback, Voting, Comments)
- [x] Define FeedbackCard schema (`id`, `tenantId`, `retrospectiveId`, `columnId`, `authorId`, `content`, `position`) (**DONE**)
- [x] Define Vote schema (`id`, `tenantId`, `retrospectiveId`, `feedbackCardId`, `userId`) (**DONE**)
- [x] Define Comment schema (`id`, `tenantId`, `feedbackCardId`, `authorId`, `content`) (**DONE**)
- [x] Implement card CRUD with position reordering and column movement (**DONE**)
- [x] Implement transactional voting with strict limit enforcement and concurrency safety (**DONE**)
- [x] Implement strict Anonymous Feedback protection (scrub author details from participant payloads) (**DONE**)
- [x] Implement Comments CRUD per feedback card (**DONE**)
- [x] Build Frontend Kanban Retrospective Board:
  - Multi-column drag-and-drop layout (**DONE**)
  - Add / edit / delete feedback cards with confirmation (**DONE**)
  - Card vote button with remaining votes counter & limit enforcement (**DONE**)
  - Card comment drawer / modal (**DONE**)
  - Anonymous mode visual indicators (**DONE**)
  - Mobile responsive horizontal scroll (**DONE**)
- [x] Automated tests for duplicate voting, limit boundaries, and author scrub (**DONE**)
- **Target Commit**: `feat(board): implement feedback, voting, and comments`
- **Status**: DONE

---

## Phase 7: Action Items Management
- [ ] Define ActionItem schema (`id`, `tenantId`, `retrospectiveId`, `feedbackCardId`, `title`, `description`, `status`, `priority`, `assigneeId`, `dueDate`)
- [ ] Implement conversion from feedback card to action item
- [ ] Support CRUD and status transitions (`TODO` -> `IN_PROGRESS` -> `DONE`)
- [ ] Validate cross-tenant assignee protection
- [ ] Build Frontend Action Items:
  - Action items board/list with filters (status, priority, assignee, due date)
  - Quick-convert action button on feedback cards
  - Dashboard widget for upcoming and overdue action items
  - Retrospective summary view
- [ ] Automated tests for action item creation and tenant isolation
- **Target Commit**: `feat(actions): implement action item management`
- **Status**: TODO

---

## Phase 8: Real-Time Collaboration (Socket.IO)
- [ ] Set up Socket.IO server with JWT authentication handshake
- [ ] Implement room authorization: verify user has tenant membership & retrospective access before joining `retro:${retrospectiveId}`
- [ ] Broadcast events:
  - Participant presence (join/leave)
  - Feedback card created, updated, moved, deleted
  - Vote cast / removed
  - Comment added / deleted
  - Retrospective status changed
- [ ] Enforce anonymous feedback masking in socket events
- [ ] Build Frontend Socket integration with TanStack Query cache updates
- [ ] Test multi-client live synchronization and unauthorized room rejection
- **Target Commit**: `feat(realtime): implement secure live collaboration`
- **Status**: TODO

---

## Phase 9: Testing, CI/CD, and Hardening
- [ ] Expand integration and tenant boundary test suite (Supertest + Vitest)
- [ ] Add frontend unit & component tests (Vitest + Testing Library)
- [ ] Configure `.github/workflows/ci.yml` (lint, typecheck, unit tests, integration tests, frontend build, backend build, docker build)
- [ ] Enforce security headers (Helmet), CORS whitelist, rate limiting, and structured logging (Pino)
- [ ] Verify TypeScript strict mode passes with 0 errors across all workspaces
- **Target Commit**: `ci: add GitHub Actions verification workflow`
- **Status**: TODO

---

## Phase 10: Final Documentation & Release Verification
- [ ] Comprehensive `README.md` covering architecture, setup, docker workflow, API documentation, testing, and deployment
- [ ] Verify clean installation from scratch
- [ ] Verify Docker Compose up, migrations, and health checks
- [ ] Check Git status, clean commit history, and push to GitHub remote
- **Target Commit**: `docs: finalize setup and deployment documentation`
- **Status**: TODO
