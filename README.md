# RetroSpace

**RetroSpace** is a production-oriented, multi-tenant Agile retrospective SaaS platform built with React, Node.js/Express, PostgreSQL, Drizzle ORM, Docker, and GitHub Actions CI/CD.

Inspired by the clean, fast interaction models of Linear and Notion, RetroSpace allows Agile teams to collaborate seamlessly on sprint retrospectives with real-time feedback, anonymous voting, comments, action item tracking, and rigorous multi-tenant data isolation.

---

## 🏛 Architecture Overview

```
                                  +---------------------------+
                                  |   React 19 + Vite (SPA)   |
                                  | Tailwind CSS + shadcn/ui  |
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

### Multi-Tenant Architecture & Isolation Guarantees
- **Logical Tenant Isolation**: A single shared PostgreSQL database where every tenant-owned table references `tenantId`.
- **Composite Integrity & Scoping**: All queries and mutations verify tenant ownership through authentication context and middleware (`requireTenant`, `requireTenantRole`).
- **Zero Cross-Tenant Leakage**: Unpredictable IDs (CUID2/UUID) combined with strict server-side validation ensure no client can read or modify another tenant's data by tampering with headers, route parameters, or payload bodies.
- **Role-Based Access Control**:
  - **Tenant Roles**: `OWNER` (full org settings, billing, ownership transfer), `ADMIN` (member management, retrospectives), `MEMBER` (participate, vote, comment).
  - **Team Roles**: `FACILITATOR` (control session lifecycle, manage columns), `MEMBER` (collaborate within team retrospectives).

---

## 📦 Project Structure

```
platform/
├── apps/
│   ├── backend/               # Express + Drizzle ORM + Socket.IO
│   │   ├── src/
│   │   │   ├── config/        # Environment and app configuration
│   │   │   ├── db/            # Drizzle schema, relations, connection, migrations
│   │   │   ├── middlewares/   # Auth, Tenant, Role, Error, Rate Limiting
│   │   │   ├── modules/       # Auth, Tenants, Teams, Retrospectives, Board, Actions
│   │   │   ├── realtime/      # Socket.IO handlers and room authorization
│   │   │   └── utils/         # Password hashing, JWT, CUID helpers
│   │   └── Dockerfile
│   └── frontend/              # React + Vite + Tailwind + TanStack Query
│       ├── src/
│       │   ├── app/           # Router and Query / Auth providers
│       │   ├── components/    # Layout, UI components, modals
│       │   ├── features/      # Auth, Dashboard, Tenants, Teams, Board, Action items
│       │   ├── hooks/         # Custom hooks, socket hook, auth hook
│       │   └── lib/           # Axios/Fetch client, utils
│       └── Dockerfile
├── packages/
│   └── shared/                # Shared Zod schemas, TypeScript types, constants
├── docker-compose.yml         # Containerized dev & test environment
├── TASKS.md                   # Real-time implementation status tracker
└── .github/workflows/ci.yml   # Multi-stage GitHub Actions CI
```

---

## 🚀 Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, TanStack Query v5, React Hook Form, Zod, Socket.IO Client.
- **Backend**: Node.js 22, Express.js, TypeScript, PostgreSQL 16, Drizzle ORM, Drizzle Kit, Zod, Argon2/bcrypt, jsonwebtoken, Socket.IO, Pino.
- **DevOps & Infrastructure**: pnpm workspaces, Docker, Docker Compose, Vitest, Supertest, GitHub Actions CI.

---

## 📋 Implementation Roadmap

- [x] **Phase 0**: Project Audit & Foundation Setup
- [ ] **Phase 1**: Development Foundation & Docker Environment
- [ ] **Phase 2**: Authentication & Session Management
- [ ] **Phase 3**: Tenant Management & Multi-Tenant Isolation
- [ ] **Phase 4**: Team Management
- [ ] **Phase 5**: Retrospective Management & Columns
- [ ] **Phase 6**: Retrospective Board (Feedback, Voting, Comments)
- [ ] **Phase 7**: Action Items Management
- [ ] **Phase 8**: Real-Time Collaboration (Socket.IO)
- [ ] **Phase 9**: Testing, CI/CD, and Hardening
- [ ] **Phase 10**: Final Documentation & Release Verification
