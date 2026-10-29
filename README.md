# RetroSpace

**RetroSpace** is a production-oriented, multi-tenant Agile retrospective SaaS platform built with React, Node.js/Express, PostgreSQL, Drizzle ORM, Docker, and GitHub Actions CI/CD.

Inspired by the clean, fast interaction models of Linear and Notion, RetroSpace empowers Agile teams to run effective sprint retrospectives with real-time feedback, anonymous voting, comments, action item tracking, and rigorous multi-tenant data isolation.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [Architecture & Multi-Tenancy](#-architecture--multi-tenancy)
  - [Logical Isolation Model](#logical-isolation-model)
  - [Role-Based Access Control](#role-based-access-control)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Quick Start with Docker Compose](#-quick-start-with-docker-compose)
- [Local Development Setup](#-local-development-setup)
- [Running Automated Tests](#-running-automated-tests)
- [REST API Reference](#-rest-api-reference)
- [Real-Time WebSocket Architecture](#-real-time-websocket-architecture)
- [Security & Privacy Guarantees](#-security--privacy-guarantees)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Git Commit History](#-git-commit-history)

---

## ✨ Key Features

- 🏢 **Multi-Tenant Workspaces**: Seamless organization switching, dedicated subdomain/slugs, custom settings, and strict data isolation across tenants.
- 👥 **Team & Role Management**: Organization-level roles (`OWNER`, `ADMIN`, `MEMBER`) and team-level roles (`FACILITATOR`, `MEMBER`) with safeguards against orphan workspaces.
- 📋 **Agile Retrospective Templates**: Pre-configured standard templates:
  - *Standard*: What Went Well? / What Could Be Improved? / What Should We Try Next?
  - *Mad / Sad / Glad*: Emotional team resonance format.
  - *Start / Stop / Continue*: Action-oriented process evolution.
  - *4Ls*: Liked / Learned / Lacked / Longed For.
- 🎯 **Interactive Kanban Board**: Drag-and-drop feedback columns, real-time card ordering, color-coded themes, and persistent positions powered by `@hello-pangea/dnd`.
- 🔒 **Strict Anonymous Mode**: Toggleable anonymous retrospectives that scrub author identity in both database queries and real-time WebSocket payloads.
- 🗳️ **Concurrency-Safe Voting**: Configurable per-user voting limits enforced transactionally in PostgreSQL with optimistic UI feedback.
- 💬 **Discussion & Comments**: Threaded card discussions with facilitator moderation.
- ✅ **Action Items Conversion & Metrics**: Direct 1-click conversion from feedback cards to assigned action items with due dates, priority filters, and dashboard overdue tracking.
- ⚡ **Real-Time Live Collaboration**: Socket.IO connection authenticated via JWT handshake with authorized tenant rooms and atomic state synchronization.

---

## 🏛 Architecture & Multi-Tenancy

```
                              +---------------------------+
                              |   React 18 + Vite (SPA)   |
                              | Tailwind CSS + Lucide UI  |
                              | TanStack Query + Socket.IO|
                              +-------------+-------------+
                                            |
                                    REST / WebSocket
                                            |
                              +-------------v-------------+
                              | Node.js / Express Backend |
                              |   TypeScript + Zod Valid  |
                              | JWT Auth + Tenant Scoping |
                              | Socket.IO Collaboration   |
                              +-------------+-------------+
                                            |
                                       Drizzle ORM
                                            |
                              +-------------v-------------+
                              | PostgreSQL 16 (Multi-Tenant|
                              |   Logical Schema Isolation|
                              +---------------------------+
```

### Logical Isolation Model

RetroSpace employs a **shared database, logical tenant isolation** architecture:
- Every tenant resource (`teams`, `team_memberships`, `invitations`, `retrospectives`, `retrospective_columns`, `feedback_cards`, `votes`, `comments`, `action_items`, `activity_logs`) possesses an indexed `tenantId` column.
- Authentication validates short-lived JWT access tokens and resolves the active tenant context via `x-tenant-id` header or URL parameters.
- Middleware (`requireTenant`, `requireTenantRole`) guarantees that the requesting user belongs to the target organization before any database operation executes.
- Relational joins strictly enforce composite foreign keys and tenant matches to eliminate cross-tenant data traversal.

### Role-Based Access Control

| Scope | Role | Capabilities |
| :--- | :--- | :--- |
| **Tenant** | `OWNER` | Full organization control, settings, billing, member deletion, role promotion, ownership transfer. |
| **Tenant** | `ADMIN` | Member invitation, team management, retrospective administration. |
| **Tenant** | `MEMBER` | Participate in assigned teams, join retrospectives, create cards, vote, and manage action items. |
| **Team** | `FACILITATOR` | Manage sprint columns, open/close retro phases, facilitate voting sessions. |
| **Team** | `MEMBER` | Submit cards, vote within limits, comment, and convert items. |

---

## 🛠 Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, `@hello-pangea/dnd`, TanStack Query v5, React Hook Form, Zod, Socket.IO Client, Sonner toasts.
- **Backend**: Node.js 22, Express.js, TypeScript, PostgreSQL 16, Drizzle ORM, Drizzle Kit, Zod, bcryptjs, jsonwebtoken, Socket.IO, Pino structured logging, Helmet, CORS, express-rate-limit.
- **DevOps & Testing**: pnpm v11 workspaces, Docker, Docker Compose, Vitest, Supertest, Testing Library, GitHub Actions CI.

---

## 📂 Project Structure

```
platform/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI workflow
├── apps/
│   ├── backend/                 # Express REST & Socket.IO server
│   │   ├── src/
│   │   │   ├── config/          # Environment variables & constants
│   │   │   ├── db/              # Drizzle schema, migrations, connection pool
│   │   │   ├── middlewares/     # Auth, tenant isolation, rate-limit, error handler
│   │   │   ├── modules/         # Auth, Tenants, Teams, Retros, Board, Actions
│   │   │   ├── realtime/        # Socket.IO connection auth & room handlers
│   │   │   └── utils/           # JWT tokens, password hashing, nanoid helpers
│   │   ├── drizzle/             # Generated SQL migration files
│   │   └── Dockerfile           # Multi-stage production Dockerfile
│   └── frontend/                # React 18 SPA
│       ├── src/
│       │   ├── app/             # App shell, Router, and Provider tree
│       │   ├── components/      # Common UI components (Navbar, Modals, Switchers)
│       │   ├── features/        # Auth, Dashboard, Tenants, Teams, Board, Actions
│       │   ├── hooks/           # Custom React hooks (useAuth, useRetroSocket)
│       │   └── lib/             # API client & helper utilities
│       ├── nginx.conf           # Production Nginx reverse proxy configuration
│       └── Dockerfile           # Multi-stage production Nginx Dockerfile
├── packages/
│   └── shared/                  # Common TypeScript interfaces, DTOs, Zod schemas
├── docker-compose.yml           # Local multi-container Docker stack
├── TASKS.md                     # Phase-by-phase implementation tracker
└── README.md                    # System documentation
```

---

## 📋 Prerequisites

- **Node.js**: v20.x or v22.x LTS
- **pnpm**: v11.x (or Corepack enabled: `corepack enable`)
- **Docker & Docker Compose**: v24.0+ (optional for containerized deployment)
- **PostgreSQL**: v16+ (if running without Docker)

---

## 🐳 Quick Start with Docker Compose

The fastest way to run the entire RetroSpace platform with a dedicated PostgreSQL database, backend service, and frontend web server is via Docker Compose:

### 1. Clone & Configure Environment

```bash
git clone <repository-url>
cd platform
cp .env.example .env
```

### 2. Launch the Application Stack

```bash
docker compose up --build -d
```

### 3. Apply Database Migrations

Once the database and backend containers pass health checks:

```bash
docker compose exec backend pnpm db:migrate
```

### 4. Access the Application

- **Frontend Web UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- **Health Check Endpoint**: [http://localhost:4000/health](http://localhost:4000/health)

To view real-time logs:

```bash
docker compose logs -f backend frontend
```

To stop all services:

```bash
docker compose down
```

---

## 💻 Local Development Setup

To run RetroSpace natively on your host machine for development:

### 1. Install Workspace Dependencies

```bash
pnpm install
```

### 2. Configure Local PostgreSQL & Environment

Ensure PostgreSQL is running locally on port `5432`. Create a database named `retrospace`:

```sql
CREATE DATABASE retrospace;
```

Create `.env` in the root:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/retrospace
FRONTEND_URL=http://localhost:5173
JWT_SECRET=retrospace_dev_jwt_access_secret_32_characters_minimum
JWT_REFRESH_SECRET=retrospace_dev_jwt_refresh_secret_32_characters_minimum
COOKIE_SECRET=retrospace_dev_cookie_secret_32_characters_minimum
VITE_API_URL=http://localhost:4000/api/v1
VITE_SOCKET_URL=http://localhost:4000
```

### 3. Build Shared Packages & Run Migrations

```bash
pnpm --filter @retrospace/shared build
pnpm --filter @retrospace/backend db:migrate
```

### 4. Start Development Servers

```bash
pnpm dev
```

This concurrently runs:
- Backend server on `http://localhost:4000` (with live reload via `tsx watch`)
- Frontend application on `http://localhost:5173` (with Vite HMR)

---

## 🧪 Running Automated Tests

RetroSpace includes extensive unit and integration tests covering authentication, tenant isolation, team memberships, retrospective lifecycles, transactional voting limits, anonymous feedback privacy, and real-time socket authorization.

### Run All Tests Across Workspace

```bash
pnpm test
```

### Run Backend Integration Tests (Vitest + Supertest)

```bash
pnpm --filter @retrospace/backend test
```

*Results: 8 test suites, 31 passing unit & integration tests.*

### Run Frontend Component Tests (Vitest + Testing Library)

```bash
pnpm --filter @retrospace/frontend test
```

### Run Strict TypeScript Typechecking

```bash
pnpm typecheck
```

### Build Production Bundles

```bash
pnpm build
```

---

## 📡 REST API Reference

All protected endpoints require an `Authorization: Bearer <token>` header and an `x-tenant-id: <tenantId>` header (or URL tenant scoping).

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/register` | Register new user account. |
| `POST` | `/login` | Authenticate with email/password; returns access token + sets HTTP-only refresh cookie. |
| `POST` | `/refresh` | Rotate refresh token with reuse detection; returns fresh access token. |
| `POST` | `/logout` | Revoke active refresh session and clear cookies. |
| `GET` | `/me` | Retrieve authenticated user profile and associated organizations. |

### Tenant Management (`/api/v1/tenants`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/` | Create a new organization tenant (creator assigned `OWNER`). |
| `GET` | `/` | List all organizations the user belongs to. |
| `GET` | `/:tenantId` | Get tenant details, settings, and member list. |
| `PATCH` | `/:tenantId` | Update tenant name or slug (`OWNER`/`ADMIN` only). |
| `POST` | `/:tenantId/invitations` | Invite a user to the organization by email. |
| `PATCH` | `/:tenantId/members/:userId/role` | Update organization membership role. |
| `DELETE` | `/:tenantId/members/:userId` | Remove member (final owner deletion protected). |

### Team Management (`/api/v1/tenants/:tenantId/teams`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | List teams within the active tenant. |
| `POST` | `/` | Create a new team (`OWNER`/`ADMIN`). |
| `GET` | `/:teamId` | Get team details and assigned members. |
| `PATCH` | `/:teamId` | Update team details. |
| `DELETE` | `/:teamId` | Delete a team and its associations. |
| `POST` | `/:teamId/members` | Add an existing tenant member to the team (`FACILITATOR`/`MEMBER`). |
| `DELETE` | `/:teamId/members/:userId` | Remove member from team. |

### Retrospectives (`/api/v1/tenants/:tenantId/retrospectives`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | List retrospectives (optional filter by `?teamId=`). |
| `POST` | `/` | Create retrospective using an Agile template (`standard`, `mad_sad_glad`, etc.). |
| `GET` | `/:retroId` | Retrieve full retrospective board, columns, cards, and votes. |
| `PATCH` | `/:retroId` | Update retrospective metadata or state (`DRAFT` → `ACTIVE` → `COMPLETED`). |
| `DELETE` | `/:retroId` | Remove retrospective session. |

### Feedback Cards & Voting (`/api/v1/tenants/:tenantId/retrospectives/:retroId`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/cards` | Submit feedback card to a specific column. |
| `PATCH` | `/cards/:cardId` | Update card content, position, or move across columns. |
| `DELETE` | `/cards/:cardId` | Delete card (author or facilitator only). |
| `POST` | `/cards/:cardId/vote` | Atomically toggle upvote/unvote (enforces user voting limit). |
| `POST` | `/cards/:cardId/comments` | Add discussion comment to feedback card. |
| `DELETE` | `/cards/:cardId/comments/:id`| Remove comment. |

### Action Items (`/api/v1/tenants/:tenantId`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/actions` | List action items with filters (`status`, `priority`, `assigneeId`, `retroId`). |
| `POST` | `/retrospectives/:retroId/actions` | Convert feedback card to action item or create standalone item. |
| `PATCH` | `/actions/:actionId` | Update title, description, status (`TODO`, `IN_PROGRESS`, `DONE`), or assignee. |
| `DELETE` | `/actions/:actionId` | Remove action item. |
| `GET` | `/actions/metrics` | Dashboard statistics (overdue count, completion rate, open actions). |

---

## ⚡ Real-Time WebSocket Architecture

RetroSpace implements bidirectional real-time collaboration using Socket.IO:

- **Handshake Authentication**: Clients must present a valid JWT during the WebSocket handshake (`auth: { token }`). Unauthenticated connections are rejected immediately.
- **Tenant & Retrospective Room Authorization**: Clients emit `retro:join` with `{ retrospectiveId, tenantId }`. The server validates that the user possesses an active membership in the tenant before joining the socket room `retro:<retrospectiveId>`.
- **Event Catalog**:
  - `retro:card_created`: New card placed in a column.
  - `retro:card_moved`: Position or column change reflected instantly across peers.
  - `retro:card_deleted`: Card removed from board.
  - `retro:vote_updated`: Real-time vote count and voter list broadcast.
  - `retro:comment_added` / `retro:comment_deleted`: Live discussion updates.
  - `retro:action_created` / `retro:action_updated`: Synchronized action item changes.
  - `retro:status_changed`: Session lifecycle transitions (`ACTIVE` ↔ `COMPLETED`).
- **Privacy Enforcement**: For anonymous retrospectives, broadcast payloads scrub author identification (`author: null`) before emitting to room participants.

---

## 🔐 Security & Privacy Guarantees

1. **Password Security**: Passwords hashed with bcrypt (salt rounds = 12).
2. **Session Rotation**: Short-lived JWT access tokens (15 minutes). HTTP-only `SameSite=Lax` refresh cookies rotated on every use with refresh token family tracking and reuse detection.
3. **Data Isolation**: All queries enforce `tenantId = activeTenantId`. SQL statements use parameterized queries via Drizzle ORM to protect against injection.
4. **Final Owner Safeguard**: Organizations cannot accidentally delete or demote their last remaining `OWNER`.
5. **Cross-Tenant Validation**: Action item assignees and team members must belong to the same tenant.
6. **Network & Headers**: Production headers enforced via Helmet (CSP, HSTS, X-Frame-Options), strict CORS whitelist, and IP-based rate limiting on sensitive routes.

---

## 🚀 CI/CD Pipeline

The repository includes a production-grade GitHub Actions workflow (`.github/workflows/ci.yml`) triggering on pushes and pull requests to `main`:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Lint & Typecheck│     │  Backend Tests  │     │  Frontend Tests │
│ (pnpm typecheck)│     │  (Postgres 16)  │     │ (Vitest + DOM)  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                        ┌────────v────────┐
                        │ Production Build│
                        │  (pnpm build)   │
                        └────────┬────────┘
                                 │
                        ┌────────v────────┐
                        │  Docker Builds  │
                        │(Backend+Frontend│
                        └─────────────────┘
```

---

## 📜 Git Commit History

The project adheres strictly to the Conventional Commits specification, reflecting every completed development phase:

1. `50745e2` `chore: document project architecture and implementation plan` *(Phase 0)*
2. `864a408` `build: add Docker development environment` *(Phase 1)*
3. `88f9c69` `feat(auth): implement authentication and session management` *(Phase 2)*
4. `f5bf282` `feat(tenants): implement tenant management and isolation` *(Phase 3)*
5. `a71ea4e` `feat(teams): implement team management` *(Phase 4)*
6. `ad1f763` `feat(retrospectives): implement retrospective management` *(Phase 5)*
7. `d4c6bae` `feat(board): implement feedback, voting, and comments` *(Phase 6)*
8. `c8da275` `feat(actions): implement action item management` *(Phase 7)*
9. `58e4fe9` `feat(realtime): implement secure live collaboration` *(Phase 8)*
10. `0f70321` `ci: add GitHub Actions verification workflow` *(Phase 9)*
11. `docs: finalize setup and deployment documentation` *(Phase 10)*

---

## 📄 License

This project is licensed under the MIT License.
