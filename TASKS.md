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
- [ ] Configure PostgreSQL with custom initialization / health checks
- [ ] Create multi-stage `apps/backend/Dockerfile` and `apps/frontend/Dockerfile`
- [ ] Create root `docker-compose.yml` with health checks, named persistent volumes, and non-root users
- [ ] Define `.dockerignore` for frontend and backend
- [ ] Set up `.env.example` configurations across root, backend, and frontend
- [ ] Implement backend health check endpoint (`/api/v1/health`)
- [ ] Configure Drizzle ORM database connection and migration runner
- [ ] Verify Docker Compose build, service startup, health checks, and data persistence
- **Target Commit**: `build: add Docker development environment`
- **Status**: TODO

---

## Phase 2: Authentication & Session Management
- [ ] Define User schema in Drizzle ORM (`id`, `name`, `email`, `passwordHash`, timestamps)
- [ ] Define RefreshSession schema with family tracking, token hash, rotation, and revocation
- [ ] Implement password hashing with bcrypt/argon2
- [ ] Implement short-lived JWT access tokens + HTTP-only refresh cookies
- [ ] Build Auth Service: register, login, refresh token rotation, logout, me endpoint
- [ ] Implement auth middleware (`authenticateUser`) with strict token validation
- [ ] Implement input validation schemas with Zod (register, login, refresh)
- [ ] Build Frontend Auth UI:
  - Register page (`/register`) with form validation & error feedback
  - Login page (`/login`) with session management
  - Auth context and Protected Route wrapper
- [ ] Implement automated backend tests for auth (registration, duplicate rejection, invalid credentials, refresh rotation, logout)
- **Target Commit**: `feat(auth): implement authentication and session management`
- **Status**: TODO

---

## Phase 3: Tenant Management & Multi-Tenant Isolation
- [ ] Define Tenant (`id`, `name`, `slug`, timestamps) and TenantMembership schemas (`OWNER`, `ADMIN`, `MEMBER`)
- [ ] Define Invitation schema (`tokenHash`, `role`, `expiresAt`, `acceptedAt`)
- [ ] Ensure tenant creation transactionally provisions owner membership
- [ ] Implement Tenant resolution and middleware (`requireTenant`, `requireTenantRole`)
- [ ] Build Tenant Services:
  - Create organization & unique slug generator
  - List user organizations & organization switcher
  - Invite members (secure hashed token, expiration, acceptance)
  - Manage tenant members (role update, safe removal, prevent removing last owner)
  - Accept invitation endpoint
- [ ] Build Frontend Organization Management:
  - Organization switcher in header/sidebar
  - Create organization dialog/page
  - Organization settings & member directory
  - Invite member dialog & pending invitation list
  - Invitation acceptance page (`/invite/:token`)
- [ ] Automated tenant isolation tests (prevent cross-tenant access via manipulated IDs/headers)
- **Target Commit**: `feat(tenants): implement tenant management and isolation`
- **Status**: TODO

---

## Phase 4: Team Management
- [ ] Define Team and TeamMembership schemas (`FACILITATOR`, `MEMBER`) with tenant integrity
- [ ] Implement Team Service & Routes under `/api/v1/tenants/:tenantId/teams`
- [ ] Validate team membership belongs strictly to current tenant members
- [ ] Implement team role-based authorization (`requireTeamRole`)
- [ ] Build Frontend Teams UI:
  - Team list & team creation modal
  - Team details & member management (facilitator assignment)
  - Team retrospective overview
- [ ] Automated tests for team authorization and isolation
- **Target Commit**: `feat(teams): implement team management`
- **Status**: TODO

---

## Phase 5: Retrospective Management & Columns
- [ ] Define Retrospective schema (`id`, `tenantId`, `teamId`, `title`, `description`, `status`, `template`, `isAnonymous`, `votingLimit`, `startedAt`, `endedAt`, timestamps)
- [ ] Define RetrospectiveColumn schema (`id`, `tenantId`, `retrospectiveId`, `title`, `description`, `color`, `position`)
- [ ] Provide default templates ("What went well? / What could be improved? / What should we try next?", "Mad / Sad / Glad", "Start / Stop / Continue")
- [ ] Implement Retrospective lifecycle state transitions (`DRAFT` -> `ACTIVE` -> `COMPLETED`)
- [ ] Implement facilitator permissions for column modifications
- [ ] Build Frontend Retrospective Management:
  - Create retrospective wizard (team, template, anonymity, voting limit)
  - Retrospectives list view with status badges and filters
  - Start / Complete session controls for facilitators
- [ ] Automated tests for lifecycle transitions and column operations
- **Target Commit**: `feat(retrospectives): implement retrospective management`
- **Status**: TODO

---

## Phase 6: Retrospective Board (Feedback, Voting, Comments)
- [ ] Define FeedbackCard schema (`id`, `tenantId`, `retrospectiveId`, `columnId`, `authorId`, `content`, `position`)
- [ ] Define Vote schema (`id`, `tenantId`, `retrospectiveId`, `feedbackCardId`, `userId`)
- [ ] Define Comment schema (`id`, `tenantId`, `feedbackCardId`, `authorId`, `content`)
- [ ] Implement card CRUD with position reordering and column movement
- [ ] Implement transactional voting with strict limit enforcement and concurrency safety
- [ ] Implement strict Anonymous Feedback protection (scrub author details from participant payloads)
- [ ] Implement Comments CRUD per feedback card
- [ ] Build Frontend Kanban Retrospective Board:
  - Multi-column drag-and-drop layout
  - Add / edit / delete feedback cards with confirmation
  - Card vote button with remaining votes counter & limit enforcement
  - Card comment drawer / modal
  - Anonymous mode visual indicators
  - Mobile responsive horizontal scroll
- [ ] Automated tests for duplicate voting, limit boundaries, and author scrub
- **Target Commit**: `feat(board): implement feedback, voting, and comments`
- **Status**: TODO

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
