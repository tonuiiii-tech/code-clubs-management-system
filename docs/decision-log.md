# Architecture Decision Log

This log records decisions that affect the architecture or long-term maintenance of the STEAMLabs Africa Code Clubs Management System.

IDs use the format `D<sprint>-<number>`, for example `D1-1`. Decisions stay **Proposed** until confirmed, **Accepted** once Enock or the STEAMLabs team confirms them, and **Pending** when a choice is deliberately left open.

| ID    | Decision                                                   | Status   |
| ----- | ---------------------------------------------------------- | -------- |
| D1-1  | Modular monolith                                           | Proposed |
| D1-2  | npm workspaces: client, server, shared                     | Proposed |
| D1-3  | Share schemas, enforce trust on the server                 | Proposed |
| D1-4  | Role and resource scope on every protected operation       | Proposed |
| D1-5  | Offline synchronisation in Sprint 3                        | Accepted |
| D1-6  | Device-generatable UUIDs; deactivate instead of delete     | Proposed |
| D1-7  | CI for lint, tests and builds                              | Proposed |
| D1-8  | Database: MongoDB with Mongoose                            | Accepted |
| D1-9  | UI built with the STEAMLabs UI kit (`steamlabsui`)         | Accepted |
| D1-10 | Self-host the Poppins font                                 | Proposed |
| D1-11 | English and Kiswahili from day one                         | Proposed |
| D1-12 | Authentication: access token + rotating refresh cookie     | Proposed |
| D1-13 | Four roles from Enock's Sprint 1 proposal                  | Accepted |
| D1-14 | Folder structure                                           | Accepted |
| D1-15 | Schools as an entity; club–champion assignments as records | Accepted |
| D1-16 | Data access through repositories                           | Proposed |
| D1-17 | Zod for validation                                         | Proposed |
| D1-18 | JavaScript (ES modules), not TypeScript                    | Proposed |
| D1-19 | API prefix `/api/v1` and consistent responses              | Proposed |
| D1-20 | Demo mode: in-browser mock API while D1-8 is pending       | Accepted |

## D1-1: Use a modular monolith

- **Status:** Proposed
- **Date:** 2026-10-21
- **Context:** Sprint 1 needs a maintainable backend without the operational complexity of multiple services.
- **Decision:** Use one Express backend organised into business modules with routes, controllers, services and repositories.
- **Alternatives considered:** A flat Express application; microservices.
- **Consequences:** Easier local development and deployment; modules must keep clear boundaries as the application grows.

## D1-2: Use npm workspaces

- **Status:** Proposed
- **Date:** 2026-10-21
- **Context:** Client, server and shared contracts are developed in one repository.
- **Decision:** Use npm workspaces for `client`, `server` and `shared`.
- **Alternatives considered:** Separate repositories; a single package without workspace boundaries.
- **Consequences:** Shared schemas and policies are versioned together; package exports and dependencies must be explicit.

## D1-3: Share schemas, enforce trust on the server

- **Status:** Proposed
- **Date:** 2026-10-21
- **Context:** Shared Zod schemas and permission definitions reduce duplication between client and server.
- **Decision:** Put reusable data-shape schemas and permission metadata in `shared/`, while enforcing authentication, authorisation, scope and database-dependent rules on the server.
- **Alternatives considered:** Duplicated client/server schemas; client-only validation.
- **Consequences:** Better consistency without treating browser code as trusted.

## D1-4: Enforce role and resource scope on every protected API operation

- **Status:** Proposed
- **Date:** 2026-10-21
- **Context:** Users have different responsibilities and must only access assigned schools and clubs.
- **Decision:** Apply server-side permission and resource-scope checks to reads and writes. Out-of-scope records return 404 so their existence is not revealed.
- **Alternatives considered:** Frontend-only route guards; role checks without record-level scope.
- **Consequences:** More authorisation tests are required, but access control is substantially stronger.

## D1-5: Defer offline synchronisation to Sprint 3

- **Status:** Accepted (Enock, 2026-10-21)
- **Date:** 2026-10-21
- **Context:** Offline support adds local persistence, queues, retries, conflict resolution and data privacy concerns. The core management features should be stable first.
- **Decision:** Sprints 1 and 2 are online-only and isolate API calls in the client services layer. Dexie, the outbox and sync workflows are built in Sprint 3.
- **Alternatives considered:** Offline in Sprint 1 or Sprint 2.
- **Consequences:** Clearer finish lines for Sprints 1–2. Facilitators cannot use the app at venues without internet until Sprint 3 (R1-14). IDs and the services layer must not block offline support later.

## D1-6: Use device-generatable identifiers and preserve operational history

- **Status:** Proposed
- **Date:** 2026-10-21
- **Context:** Records will later be created offline, and schools, clubs and users may become inactive while their history remains important. Records are kept indefinitely.
- **Decision:** Every record uses a UUID that a device can generate. Operational records are deactivated, never permanently deleted.
- **Alternatives considered:** Hard deletion; server-generated IDs only.
- **Consequences:** Queries and UI must distinguish active and inactive records; Sprint 3 needs a documented deletion (tombstone) strategy.

## D1-7: Add CI for lint, tests and builds

- **Status:** Proposed
- **Date:** 2026-10-21
- **Context:** The project needs repeatable quality checks for every contribution.
- **Decision:** A GitHub Actions workflow runs linting, automated tests and client/server builds on pushes and pull requests, on a pinned Node 24 LTS with `npm ci`.
- **Alternatives considered:** Manual checks only.
- **Consequences:** CI scripts and environment-independent tests must be maintained.

## D1-8: Database engine

- **Status:** Accepted (Enock, 2026-10-22: "we are now going back to using MongoDb and leaving postgresql")
- **Date:** 2026-10-22
- **Context:** The original brief specified MongoDB with Mongoose. PostgreSQL was considered on 21 Oct and the choice was left open.
- **Decision:** MongoDB with Mongoose. Tests use mongodb-memory-server. Only the repository files (D1-16) talk to Mongoose.
- **Alternatives considered:** PostgreSQL with Drizzle or Prisma (better fit for joins in reports, but not chosen).
- **Consequences:** Matches the Shule Safe stack and the brief. Club–champion assignments stay a separate collection (D1-15), and dashboard and report counts use aggregation pipelines. Club codes need an atomic counter. Multi-document transactions need a replica set (Atlas provides one; local development uses a single-node replica set).

## D1-9: Build the UI with the STEAMLabs UI kit

- **Status:** Accepted (Enock, 2026-10-21)
- **Date:** 2026-10-21
- **Context:** The app should look like other STEAMLabs Africa products. The kit is published on npm as `steamlabsui` (React components, design tokens, logos, optional Tailwind v4 theme).
- **Decision:** Build all screens from `steamlabsui` components and tokens. Pin the exact version. Tailwind is not added in Sprint 1; the kit's Tailwind theme can be added later if layout needs it.
- **Alternatives considered:** Tailwind with hand-made components; another component library.
- **Consequences:** Consistent branding with little custom CSS; the project depends on a new 1.0.0 package (R1-16).

## D1-10: Self-host the Poppins font

- **Status:** Proposed
- **Date:** 2026-10-21
- **Context:** The kit's all-in-one stylesheet loads Poppins from Google Fonts, which fails without internet.
- **Decision:** Import the kit's `tokens.css` and `components.css` and self-host Poppins (SIL Open Font License) so the service worker can cache it.
- **Alternatives considered:** Loading from Google Fonts; falling back to system fonts.
- **Consequences:** Correct branding offline; slightly larger app bundle.

## D1-11: English and Kiswahili from day one

- **Status:** Proposed
- **Date:** 2026-10-21
- **Context:** The brief requires English and Kiswahili with i18n from day one. Retrofitting translation later means touching every screen.
- **Decision:** Use react-i18next from Sprint 1. All UI text uses translation keys in `en` and `sw` files; English is the fallback. A full Kiswahili review happens in a later sprint.
- **Alternatives considered:** English only until translations are ready.
- **Consequences:** Small extra effort per screen; no rework later.

## D1-12: Authentication design

- **Status:** Proposed
- **Date:** 2026-10-21
- **Context:** Users need secure sessions that can be revoked when an account is deactivated, and later must survive long offline periods.
- **Decision:** Login with email (phone later) and password hashed with bcrypt. A 15-minute JWT access token is kept in memory; a rotating 30-day refresh token is stored hashed on the server and sent as an httpOnly, Secure, SameSite cookie. Reuse of an old refresh token revokes the whole session family. Account status and token version are checked on every request.
- **Alternatives considered:** Server sessions in a session store; long-lived JWTs.
- **Consequences:** Deactivation takes effect on the next request; refresh tokens need a small table/collection.

## D1-13: Use the four roles from Enock's Sprint 1 proposal

- **Status:** Accepted (Enock, 2026-10-21)
- **Date:** 2026-10-21
- **Context:** The brief listed provisional roles (Super Admin/HQ, Regional Coordinator, Facilitator). Enock's proposal uses STEAMLabs' own titles.
- **Decision:** Roles are System Administrator, Programme Manager, Code Clubs Coordinator and Club Champion. The Club Champion is the facilitator who runs a club (teacher, volunteer or staff). Permissions live in `shared/permissions.js` so they can change after STEAMLabs confirms them.
- **Alternatives considered:** The brief's three roles.
- **Consequences:** The permissions matrix in `docs/sprints/sprint-1.md` is a baseline until confirmed (R1-9).

## D1-14: Folder structure

- **Status:** Accepted (Enock, 2026-10-21)
- **Date:** 2026-10-21
- **Decision:** Enock's structure (client `components`, `layouts`, `pages`, `routes`, `services`, `context`, `utils`; server `config`, `middleware`, `modules`, `utils`) plus `shared/`, `client/src/i18n`, `client/src/ui`, `docs/`, CI, tests next to each workspace and separate `.env.example` files. Client `db/` and `sync/` and server `modules/sync` are added in Sprint 3.
- **Consequences:** See the tree in `docs/sprints/sprint-1.md`.

## D1-15: Schools as their own entity; club–champion assignments as records

- **Status:** Accepted (Enock, 2026-10-21)
- **Date:** 2026-10-21
- **Context:** Clubs are hosted by schools, community centres or libraries. A club can have several champions, and a champion can run several clubs.
- **Decision:** School is an entity that clubs reference. Each club–champion assignment is its own record with start and end dates.
- **Consequences:** No retyping of host details; assignment history is preserved; offline edits to different assignments will not overwrite each other in Sprint 3.

## D1-16: Data access through repositories

- **Status:** Proposed
- **Date:** 2026-10-21
- **Context:** The database engine is still open (D1-8), and services should stay testable.
- **Decision:** Services call repository functions (`findClubById`, `listClubs(scope, filters)`, …); only repositories touch the database.
- **Alternatives considered:** Calling the ORM/ODM directly from services.
- **Consequences:** One layer to change if the engine changes; one more file per module.

## D1-17: Zod for validation

- **Status:** Proposed
- **Date:** 2026-10-21
- **Context:** The brief allows Zod or Joi.
- **Decision:** Zod, because it runs in the browser too and the same schemas validate forms (including offline in Sprint 3) and API requests.
- **Alternatives considered:** Joi.
- **Consequences:** One validation library across the stack.

## D1-18: JavaScript (ES modules), not TypeScript

- **Status:** Proposed
- **Date:** 2026-10-21
- **Context:** The brief does not specify. Volunteer contributors may be new to TypeScript.
- **Decision:** JavaScript with ES modules, JSDoc on shared types and Zod for runtime shapes.
- **Alternatives considered:** TypeScript.
- **Consequences:** Lower barrier to contribute; fewer compile-time checks. Revisit if the team prefers TypeScript.

## D1-19: API prefix and response format

- **Status:** Proposed
- **Date:** 2026-10-21
- **Decision:** All routes under `/api/v1`. Responses: `{ data }`, lists `{ data, page, pageSize, total }`, errors `{ error: { code, message, details? } }`.
- **Consequences:** A future `/api/v2` can coexist; clients can handle errors in one place.

## D1-20: Demo mode with an in-browser mock API

- **Status:** Accepted (Enock, 2026-10-21: "okay lets start building" on the frontend plan)
- **Date:** 2026-10-21
- **Context:** The frontend can be built before the database is chosen (D1-8), but every data request to the real API returns 501 until then.
- **Decision:** With `VITE_USE_MOCKS=true` (`npm run demo`), `client/src/services/http.js` sends requests to `client/src/services/mock/mockApi.js` instead of the network. The mock answers the same `/api/v1` routes with the same shapes and error codes, validates with the shared schemas and applies the shared permission policy and scopes. Data is fictional (R1-12) and kept in that browser's localStorage. Vite leaves the mock code out of real builds.
- **Alternatives considered:** Waiting for the database; a separate mock server (MSW or json-server).
- **Consequences:** Every screen can be built, tested with Playwright and demonstrated now. The mock must be kept in step with the real API; once the database is connected, the same Playwright flows should run against the real server. The mock is a demo tool and not a security boundary.

## D1-21: UUID strings as MongoDB `_id`

- **Status:** Accepted (Enock, 2026-10-22, data layer plan)
- **Date:** 2026-10-22
- **Context:** Records will be created offline on devices in Sprint 3 (D1-6). MongoDB's default ObjectId is generated by the driver, and the API already validates IDs as UUIDs.
- **Decision:** Every collection uses a UUID string as `_id`, generated with `crypto.randomUUID()` on the server now and on devices later.
- **Alternatives considered:** ObjectId with a separate `uuid` field.
- **Consequences:** One ID everywhere (URLs, API, offline sync); slightly larger indexes than ObjectId.

## D1-22: One fictional dataset for demo mode and the seed script

- **Status:** Accepted (Enock, 2026-10-22, data layer plan)
- **Date:** 2026-10-22
- **Decision:** The demo dataset lives in `shared/` and is used by both the client mock API and `npm run seed`.
- **Consequences:** Demo mode and a seeded database show the same schools, clubs and people; only fictional data is ever seeded (R1-12).

## D1-23: MongoDB Atlas free tier for development

- **Status:** Accepted (Enock, 2026-10-22, data layer plan)
- **Date:** 2026-10-22
- **Decision:** Developers use a free MongoDB Atlas cluster by default; a local MongoDB Community Server is also supported. Tests use mongodb-memory-server.
- **Consequences:** No local install needed; Atlas is a replica set, so transactions are available when needed. The connection string goes only in `server/.env` as `MONGODB_URI`.

## D2-1: Guardian contacts in their own collection; champions can write but not read them

- **Status:** Accepted (Enock approved the Sprint 2 plan, 2026-10-23)
- **Date:** 2026-10-23
- **Context:** Questionnaire Q43: learner contact details are seen by STEAMLabs Africa only.
- **Decision:** `learnerContacts` is a separate collection. `learnerContact:read` is System Administrator and Programme Manager only (or a per-person grant); coordinators and champions have `learnerContact:write`. Learner responses carry only `hasContact`. Reading a contact is audited, and guardian names and phones are redacted in the audit log.
- **Alternatives considered:** Contact fields on the learner record, hidden by projection.
- **Consequences:** One query can never leak a contact by mistake; HQ needs one extra request to see it.

## D2-2: Age is stored as a year of birth, never a full date of birth

- **Status:** Accepted (Enock approved the Sprint 2 plan, 2026-10-23)
- **Date:** 2026-10-23
- **Context:** The form asks for age; ages change every year and a full date of birth is more personal data than needed.
- **Decision:** The API takes `age` (9–14) and stores `birthYear`; responses give `age` back.
- **Alternatives considered:** Storing age; storing date of birth.
- **Consequences:** Age stays right without edits; it can be off by one before a birthday, which is fine for grouping.

## D2-3: Consent forms and session photos in MongoDB GridFS, sent as the raw request body

- **Status:** Accepted (Enock approved the Sprint 2 plan, 2026-10-23)
- **Date:** 2026-10-23
- **Context:** Signed forms must be stored, never public, and Atlas is the only storage we have.
- **Decision:** GridFS buckets `consentFiles` and `sessionPhotos`. Uploads are the raw body (no multipart library), max 5 MB; the server checks the real type from the first bytes (JPG, PNG, PDF). Files are only served through authorised endpoints as downloads with `Cache-Control: no-store`.
- **Alternatives considered:** Object storage (S3, Cloudinary); multer for multipart uploads.
- **Consequences:** No new service or dependency; watch Atlas storage (R2-4) and move to object storage later if needed.

## D2-4: Attendance as its own collection, one record per learner per session

- **Status:** Accepted (Enock approved the Sprint 2 plan, 2026-10-23)
- **Date:** 2026-10-23
- **Context:** Attendance will be edited offline in Sprint 3.
- **Decision:** `attendance` has a unique `sessionId + learnerId`. The API saves the whole list at once (`PUT /sessions/:id/attendance`); learners left out are removed.
- **Alternatives considered:** An array inside the session.
- **Consequences:** Two devices editing different learners will not overwrite each other in Sprint 3.

## D2-5: Champions can change a session report for 7 days

- **Status:** Accepted (Enock approved the Sprint 2 plan, 2026-10-23)
- **Date:** 2026-10-23
- **Context:** Reports should be final, but champions often enter them after the session because venues have no internet.
- **Decision:** Champions can create or change a session, its attendance and photos only up to 7 days after its date. Coordinators (in their regions) and HQ have `session:editLate`. The rule lives in `shared` (`sessionEditWindowOpen`) and is used by the server, the demo mock and the screens.
- **Alternatives considered:** No limit; a lock after the end of the month.
- **Consequences:** Old reports stay reliable; a coordinator fixes late mistakes.

## D2-6: `clubId` and `region` copied onto learners, sessions, attendance and consents

- **Status:** Accepted (Enock approved the Sprint 2 plan, 2026-10-23)
- **Date:** 2026-10-23
- **Context:** Scope queries for coordinators (regions) and champions (clubs) should not need joins.
- **Decision:** Copied from the club when the record is created. Learners cannot move clubs (D2-8), so the copy never goes stale.
- **Alternatives considered:** Looking up the club on every query.
- **Consequences:** One shared scope query (`clubRecordScopeQuery`) for all four collections.

## D2-7: Up to 3 session photos, shrunk on the device, with a photo-consent check

- **Status:** Accepted (Enock approved the Sprint 2 plan, 2026-10-23)
- **Date:** 2026-10-23
- **Context:** Questionnaire Q20 and Q42: photos are part of the session report, under the consent form's conditions.
- **Decision:** Photos are shrunk to about 300 KB in the browser. If any learner marked present has no photo consent, the API answers 409 `PHOTO_CONSENT_MISSING` with their names until the champion confirms they are not in the photo; the confirmation is audited. Anyone who can still edit the session can remove a photo.
- **Alternatives considered:** No photos; blocking photos whenever a learner lacks consent.
- **Consequences:** Photos are possible without exposing children whose guardians said no (R2-7).

## D2-8: A learner belongs to one club; no club moves

- **Status:** Accepted (Enock approved the Sprint 2 plan, 2026-10-23)
- **Date:** 2026-10-23
- **Context:** Questionnaire Q17: learners cannot move between clubs.
- **Decision:** `clubId` cannot be changed. A learner who leaves is marked `left` (with `leftAt`) and keeps their attendance history; re-activating needs a free place.
- **Alternatives considered:** Enrolment history across clubs.
- **Consequences:** Simpler model; revisit if STEAMLabs changes the rule.

## D2-9: Learner details: name, age, gender, grade and school admission number

- **Status:** Accepted (Enock approved the Sprint 2 plan, 2026-10-23)
- **Date:** 2026-10-23
- **Context:** Questionnaire Q15 left this open; Enock decided on 22 Oct.
- **Decision:** Required: first and last name, age, gender (girl, boy, prefer not to say), grade (CBC Grade 4–9). Admission number is required at primary-school clubs and unique per school; accessibility needs are optional (max 200 characters). Nothing else is accepted (the schemas are strict). Gender appears only as totals on the dashboard.
- **Alternatives considered:** More fields (address, date of birth, learner phone).
- **Consequences:** Minimal personal data; still to confirm with STEAMLabs HQ (sprint-2 open question 1).

## Decision template

Copy this template for future entries:

```md
## D<sprint>-<number>: <Short title>

- **Status:** Proposed / Accepted / Pending / Superseded
- **Date:** YYYY-MM-DD
- **Context:** What problem or constraint led to this decision?
- **Decision:** What are we choosing?
- **Alternatives considered:** What else was considered?
- **Consequences:** What trade-offs or follow-up work result?
```
