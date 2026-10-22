# Sprint 1: Foundation, Access Control, Schools, and Clubs

**Project:** STEAMLabs Africa Code Clubs Management System  
**Sprint duration:** 2 weeks (Tue 21 Oct – Mon 3 Nov 2026), with a stakeholder checkpoint on Fri 23 Oct  
**Status:** In progress (scaffold created 21 Oct)  
**Last updated:** 2026-10-21  
**Sprint goal:** Establish the application foundation and deliver secure, online management of users, schools, and clubs, with architecture ready for offline-first capabilities in Sprint 3.

## 1. Background

Code Clubs coordination currently relies heavily on WhatsApp for announcements, school updates, session reports, attendance information, project sharing, and follow-ups. The system will gradually centralize operational records and make programme activity easier to track.

Sprint 1 establishes the foundations. The exact session-reporting format and detailed programme workflows still need confirmation from STEAMLabs staff.

## 2. Roles in scope

1. System Administrator
2. Programme Manager
3. Code Clubs Coordinator
4. Club Champion

The Club Champion is the facilitator who runs a club: a host-school teacher, a volunteer or STEAMLabs staff. A club can have several champions and a champion can run several clubs.

A separate read-only/evaluator role is not included in the current scope.

The final permissions and assignment model must be confirmed with STEAMLabs. This sprint assumes that coordinators and champions have restricted school/club assignments.

## 3. In scope

- Repository setup with npm workspaces: `client`, `server`, and `shared`, in the agreed folder structure (section 4a).
- GitHub Actions CI for linting, tests, and builds.
- Architecture, coding principles, decision log, and risk register.
- Authentication: login, logout, current-user endpoint.
- Server-side RBAC and resource-scope authorization.
- User administration: create, update permitted fields, role assignment, activate/deactivate.
- School CRUD and deactivation.
- Club CRUD, association to a school, and champion assignment.
- Basic role-aware application shell and dashboard counts, built with the STEAMLabs UI kit (`steamlabsui`).
- English and Kiswahili set up with react-i18next; all UI text uses translation keys.
- Installable PWA shell (manifest, icons, cached app shell); no offline data yet.
- Seed script with fictional Kenyan example data across the four regions.
- Shared Zod schemas and shared enums/policy definitions.
- Audit events for sensitive administrative actions.
- Automated tests for core workflows and authorization denial.

## 4. Out of scope

- Learner accounts and detailed learner records.
- Session reports and attendance management.
- Project submissions and media uploads.
- School visit scheduling.
- WhatsApp integration or automated messaging.
- Full analytics and report exports.
- Dexie/IndexedDB persistence, outbox queue, and offline synchronization (Sprint 3).
- Full Playwright offline E2E suite (Sprint 3).
- Database: MongoDB with Mongoose (D1-8, decided 22 Oct).

A PWA manifest or icons may be added as preparation, but this does not count as offline functionality.

## 4a. Folder structure (agreed 21 Oct, D1-14)

Folders marked Sprint 3 are created when offline sync is built.

```text
code-clubs-management-system/
├── .github/workflows/ci.yml          # lint + tests + build on every push/PR
├── docs/
│   ├── architecture.md               # diagram + stack choice (for Friday)
│   ├── coding-principles.md          # (for Friday)
│   ├── decision-log.md               # D<sprint>-<n>
│   ├── risk-register.md              # R<sprint>-<n>
│   └── sprints/sprint-1.md
├── shared/                           # used by server AND client
│   ├── enums.js                      # regions, counties, tracks, venue types, statuses
│   ├── permissions.js                # role → permission → scope policy (one place to change roles)
│   └── schemas/                      # Zod: club, school, user, auth
│
├── client/
│   ├── .env.example                  # client-only vars (VITE_API_URL)
│   ├── public/                       # PWA icons, manifest assets
│   ├── e2e/                          # Playwright tests (offline flow from Sprint 3)
│   └── src/
│       ├── components/
│       ├── layouts/
│       ├── pages/
│       │   ├── Login/
│       │   ├── Dashboard/
│       │   ├── Users/
│       │   ├── Schools/
│       │   └── Clubs/
│       ├── routes/
│       ├── services/                 # API calls; in Sprint 3 they read/write the local DB first
│       ├── context/                  # AuthContext (SyncContext in Sprint 3)
│       ├── db/                       # (Sprint 3) Dexie schema + outbox table
│       ├── sync/                     # (Sprint 3) push/pull service, sync status ("3 changes waiting")
│       ├── i18n/                     # react-i18next: locales/en, locales/sw
│       ├── ui/                       # steamlabsui setup: CSS, self-hosted Poppins, ThemeProvider
│       └── utils/
│
├── server/
│   ├── .env.example                  # moved here: server-only secrets (JWT, Mongo URI)
│   ├── scripts/seed.js               # Kenyan seed data
│   ├── tests/                        # moved here from root: Jest + Supertest + mongodb-memory-server
│   └── src/
│       ├── config/
│       ├── db/                       # MongoDB connection + Mongoose models (D1-8)
│       ├── middleware/
│       │   ├── authenticate.js
│       │   ├── authorize.js          # reads shared/permissions.js
│       │   ├── validate.js           # Zod validation
│       │   ├── rateLimit.js          # auth rate limiting
│       │   └── errorHandler.js
│       ├── modules/                  # each module: routes, controller, service, model
│       │   ├── auth/
│       │   ├── users/                # facilitators, coordinators, HQ
│       │   ├── schools/
│       │   ├── clubs/
│       │   ├── audit/
│       │   └── sync/                 # (Sprint 3) /api/sync/push and /pull
│       ├── utils/
│       ├── app.js
│       └── server.js
│
├── README.md                         # Windows setup steps
└── package.json                      # npm workspaces: client, server, shared
```

## 5. User stories

### US-01: Authentication

**As a** registered user, **I want** to sign in securely, **so that** I can access functions permitted for my role.

Acceptance criteria:

- An active registered user can log in with valid credentials.
- Invalid credentials return a safe, understandable error.
- Inactive accounts cannot log in.
- Protected pages and API endpoints reject unauthenticated users.
- Logout ends the session according to the chosen authentication design.
- The current-user endpoint returns safe profile and role information only.

### US-02: Role-based and scope-based access

**As a** system administrator, **I want** access governed by roles and assignments, **so that** users can only perform permitted actions on authorized records.

Acceptance criteria:

- The four agreed roles are represented consistently.
- Backend middleware checks permissions for every protected operation.
- Resource scope is checked on reads and writes.
- A champion cannot access another club by changing an ID in the URL.
- A coordinator cannot access schools outside their assignment.
- Users cannot grant themselves roles or privileged assignments.
- Tests cover allowed and denied operations.

### US-03: User administration

**As an** authorized administrator, **I want** to manage accounts and assignments, **so that** staff and champions can use the system with appropriate access.

Acceptance criteria:

- Authorized users can create accounts and assign permitted roles.
- Email addresses are normalized and unique.
- Administrators can activate or deactivate accounts.
- Users cannot modify their own role through ordinary profile updates.
- Deactivation prevents future authenticated access according to the chosen session design.
- Sensitive account and role changes generate audit entries.

### US-04: School management

**As an** authorized programme user, **I want** to maintain school records, **so that** clubs can be organized by school.

Acceptance criteria:

- Authorized users can create, list, view, and update schools.
- A school has a name, type (primary school, community centre, library, other), region, county, sub-county, ward, optional GPS, host contact name and phone, and a status.
- Duplicate checks are implemented using an agreed identifier or documented matching policy.
- School listings are scoped to the current user's permissions.
- Deactivation preserves historical references.

### US-05: Club management

**As an** authorized programme user, **I want** to create clubs under schools and assign champions, **so that** every club has a clear school association and responsible people.

Acceptance criteria:

- Every club references a valid school (online clubs excepted).
- A club records venue type, region, meeting day, start and end time, frequency, main track (unplugged, Scratch, robotics, game design, AI basics), capacity (1–30, default 30), and status (active, paused, closed), and gets a readable code such as `NAC-001`.
- Authorized users can create, list, view, and update clubs.
- Champion assignments reference valid, eligible users; a champion profile records type (teacher, volunteer, staff), skills and safeguarding clearance (pending, cleared, expired) with its date.
- The system prevents unauthorized assignment changes.
- Club status can be changed without destroying historical records.
- Champions can only see their assigned clubs.

### US-06: Basic dashboard

**As a** user, **I want** a role-appropriate landing page, **so that** I can quickly understand the records available to me.

Acceptance criteria:

- The dashboard shows basic counts for records the user is authorized to see.
- Navigation reflects the user's role.
- Empty, loading, and error states are handled.
- Dashboard restrictions are also enforced by API scope, not merely by hiding UI elements.

## 6. Proposed permissions matrix

This matrix is a planning baseline, not a substitute for the final policy approved by STEAMLabs.

| Capability                                | System Administrator | Programme Manager              | Coordinator                             | Champion           |
| ----------------------------------------- | -------------------- | ------------------------------ | --------------------------------------- | ------------------ |
| Manage accounts and roles                 | Yes                  | No, unless separately approved | No                                      | No                 |
| View programme-wide records               | Yes                  | Yes                            | Assigned scope                          | Assigned clubs     |
| Create/edit schools                       | Yes                  | Yes                            | Assigned scope, subject to confirmation | No                 |
| Create/edit clubs                         | Yes                  | Yes                            | Assigned scope, subject to confirmation | No                 |
| Assign champions                          | Yes                  | Yes                            | Assigned scope, subject to confirmation | No                 |
| View assigned club                        | Yes                  | Yes                            | Yes                                     | Yes                |
| View learner guardian contacts (Sprint 2) | Yes                  | Yes                            | No, unless granted                      | No, unless granted |
| Update safeguarding clearance             | Yes                  | Yes                            | No                                      | No                 |
| View audit log                            | Yes                  | Yes                            | Assigned scope                          | No                 |

Confirm whether Programme Managers may manage staff accounts and whether Coordinators may create schools/clubs before treating this matrix as final.

## 7. Proposed API endpoints

Prefix: `/api/v1`

| Method | Endpoint                       | Purpose                             |
| ------ | ------------------------------ | ----------------------------------- |
| POST   | `/auth/login`                  | Sign in                             |
| POST   | `/auth/logout`                 | Sign out                            |
| POST   | `/auth/refresh`                | Rotate the refresh token            |
| GET    | `/auth/me`                     | Current user                        |
| POST   | `/auth/change-password`        | Change own password (ends sessions) |
| GET    | `/users`                       | List authorized users               |
| GET    | `/users/:id`                   | Get a user in scope                 |
| PATCH  | `/users/me`                    | Update own name, phone, language    |
| POST   | `/users`                       | Create user                         |
| PATCH  | `/users/:id`                   | Update permitted user fields        |
| PATCH  | `/users/:id/status`            | Activate/deactivate user            |
| GET    | `/schools`                     | List scoped schools                 |
| POST   | `/schools`                     | Create school                       |
| GET    | `/schools/:id`                 | Get school                          |
| PATCH  | `/schools/:id`                 | Update school                       |
| GET    | `/clubs`                       | List scoped clubs                   |
| POST   | `/clubs`                       | Create club                         |
| GET    | `/clubs/:id`                   | Get club                            |
| PATCH  | `/clubs/:id`                   | Update club details                 |
| GET    | `/clubs/:id/champions`         | Current champions of a club         |
| PUT    | `/clubs/:id/champions/:userId` | Assign a champion                   |
| DELETE | `/clubs/:id/champions/:userId` | End an assignment (kept as history) |
| GET    | `/dashboard/summary`           | Counts within the user's scope      |
| GET    | `/audit`                       | List audit entries in scope         |
| GET    | `/health`                      | Liveness check                      |

All endpoints must validate input and enforce both permission and resource scope on the server.

Until the database is chosen (D1-8), the web app can run in **demo mode** (`npm run demo`): an in-browser mock API answers these same endpoints with the same shapes and error codes, using the shared schemas and permission policy and fictional data. Real builds do not include it (D1-20).

## 8. Suggested implementation plan

### Days 1–2: Repository and shared contracts

- Set up npm workspaces and client/server scripts.
- Add `.env.example` files and `.gitignore`.
- Set up error handling and the repository layer; database decided 22 Oct (MongoDB, D1-8); add the connection.
- Add shared package exports, enums, and initial Zod schemas.
- Add CI workflow and initial documentation.

### Days 3–4: Authentication and authorization

- Implement login, logout, and current-user endpoint.
- Add authentication and authorization middleware.
- Implement role permissions and assignment-based scope checks.
- Add authentication rate limiting.
- Test inactive accounts and unauthorized access.

### Days 5–7: Schools, clubs, and users

- Implement user management.
- Implement school CRUD and deactivation.
- Implement club CRUD, school association, and champion assignments.
- Add audit logging for sensitive changes.
- Add service and API tests.

### Days 8–9: Frontend and integration

- Build login, application layout, navigation, and dashboard shell.
- Build user, school, and club screens.
- Connect UI through the frontend service layer.
- Add loading, empty, validation, and error states.

### Friday 23 Oct checkpoint (day 3)

- Show the tech stack (`docs/architecture.md` section 3) and the reasons (`docs/decision-log.md`).
- Show the architecture diagrams and the role/scope model.
- Show the coding principles applied in the running repo: workspaces, shared Zod schemas, permission and scope middleware with passing tests, the steamlabsui shell in English and Kiswahili, and CI on every push.

### Day 10: Verification and demo

- Run lint, tests, and production builds.
- Test the permission matrix with positive and negative cases.
- Verify school → club → champion assignment workflow.
- Review risks and update documentation.
- Demonstrate the sprint to STEAMLabs stakeholders.

## 9. Definition of Done

Sprint 1 is complete when:

- [ ] Client, server, and shared workspaces install and run from documented setup steps.
- [ ] CI runs lint, tests, and builds on pushes and pull requests.
- [ ] Active users can log in and log out.
- [ ] Inactive users cannot authenticate or continue accessing protected resources.
- [ ] All four roles are implemented.
- [ ] Server-side permission and resource-scope checks are tested.
- [ ] Authorized users can create and manage schools.
- [ ] Authorized users can create clubs under schools and assign champions.
- [ ] User, school, and club data persists in MongoDB (D1-8).
- [ ] Sensitive administrative actions are audited.
- [ ] UI uses steamlabsui; all text exists in English and Kiswahili files.
- [ ] Seed script creates fictional Kenyan data and refuses to run in production.
- [ ] Automated tests cover core success and failure cases.
- [ ] Architecture and setup documentation match the implementation.
- [ ] No secrets or real personal data are committed.

## 10. Dependencies and open questions

Confirm with STEAMLabs:

- Are coordinators assigned by county, region, school, or individual club? (Default: region, as in the Head of Code Clubs questionnaire.)
- ~~Which database (D1-8)?~~ MongoDB, decided 22 Oct.
- Which fields are required to identify a school and avoid duplicates?
- Who is allowed to create schools and clubs?
- Can a coordinator see champions who have no club yet, so they can assign them? (Default in the code: yes.)
- Online clubs have no school, so where does their region come from? (Not offered in the club form yet.)
- Can Programme Managers create or change staff accounts?
- What session report fields are currently expected from champions?
- What hosting and account-management requirements apply?

## 11. Sprint 1 risks

See `docs/risk-register.md`. The highest-priority risks are unauthorized access, exposing sensitive information, unclear role boundaries, and scope growth.

## 12. Roadmap after Sprint 1

| Sprint | Scope                                                                                                                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2      | Learners (with separate guardian-contact records) and consent form upload; sessions and attendance; all online                                                                                            |
| 3      | Offline: Dexie local database and outbox, `/api/v1/sync/push` and `/pull`, idempotency, conflict handling, deletion propagation, retries, sync status, file upload queue, Playwright online/offline tests |
| 4      | HQ dashboard and alerts, termly PDF report and scheduled email (stub), events and event consent, announcements with SMS/WhatsApp behind a stub provider                                                   |
| 5      | Equipment inventory, resources library (offline download), progress tracking, full Kiswahili review                                                                                                       |

Sprint 3 should not begin sync implementation until the online data model, assignment rules, and CRUD behavior are stable.
