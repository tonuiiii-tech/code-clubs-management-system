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

## D3-1: Offline is for Club Champions and Coordinators only

- **Status:** Accepted (Enock approved the Sprint 3 plan, 2026-10-25)
- **Date:** 2026-10-25
- **Context:** Champions run sessions at venues with mostly no internet (questionnaire Q36). HQ roles work with internet and have national scope, too large and too sensitive to keep on a device.
- **Decision:** Champions and coordinators keep their own scope on the device and sync it (`sync:use`). System Administrators and Programme Managers keep using the API directly. Coordinators and HQ can read the conflict log (`syncConflict:read`).
- **Alternatives considered:** Offline for every role.
- **Consequences:** Less data on devices; HQ screens are online-only.

## D3-2: One local database per user, deleted on sign-out and after 14 days without sync

- **Status:** Accepted (Enock, 2026-10-25)
- **Date:** 2026-10-25
- **Context:** Clubs often share one laptop or tablet (R1-8, R3-2).
- **Decision:** Dexie (IndexedDB) database `cc-offline-<userId>`. Signing out deletes it, after a warning if changes are unsent. Every start deletes databases that have not synced for 14 days, and the app opens offline only within those 14 days. No PIN encryption in Sprint 3.
- **Alternatives considered:** A device PIN that encrypts local data (about 3 extra days); a longer offline limit.
- **Consequences:** A stolen, unlocked device can still show learner names for up to 14 days; PIN encryption remains a later option.

## D3-3: Push through the existing services with a device-made operation id

- **Status:** Accepted (Enock, 2026-10-25)
- **Date:** 2026-10-25
- **Context:** Retries after a lost reply must not create duplicates (R1-5), and offline must not bypass any rule.
- **Decision:** `POST /sync/push` takes up to 50 operations in order. Each runs through the same service function, schema and permission as its online endpoint. Each `opId` is stored with its result for 30 days; a repeat returns the stored result. After a refused operation, later ones for the same record are skipped. Photos carry their `opId` to the upload endpoint, which adds a repeated photo once.
- **Alternatives considered:** A separate sync code path; replaying raw HTTP requests.
- **Consequences:** One set of rules for online and offline. A refused operation needs a new `opId` to be tried again.

## D3-4: Pull by (updatedAt, id) with a 2-minute overlap, tombstones and scope resets

- **Status:** Accepted (changed from the plan's single `syncSeq` counter, 2026-10-25)
- **Date:** 2026-10-25
- **Context:** The plan proposed a `syncSeq` number stamped on every write. Mongoose writes records in several ways (create, update, bulk write), and a missed stamp would hide a change from devices.
- **Decision:** Devices pull records in `(updatedAt, _id)` order per kind, 500 at a time, with an opaque cursor. Every pull starts 2 minutes before the saved cursor, so saves that finished out of order are never missed; repeats are saved again harmlessly. Removed attendance marks leave a tombstone for 30 days. A hash of the clubs in scope tells the device when to start again from scratch.
- **Alternatives considered:** A global `syncSeq` counter; MongoDB change streams.
- **Consequences:** No extra write per save and nothing to forget in new code. Relies on the server clock, which all writes share.

## D3-5: Field-level merge; the last write wins and the overwritten value is logged

- **Status:** Accepted (Enock, 2026-10-25)
- **Date:** 2026-10-25
- **Context:** Two people can change the same record offline (R1-6).
- **Decision:** An update only sets the fields it carries, so changes to different fields are both kept. Each operation sends the values it saw (`base`); if someone changed the same field since, the later change wins and the replaced value goes to `syncConflicts`. Values of fields never written to the audit log (accessibility needs, contact details) are logged as "changed" only.
- **Alternatives considered:** Rejecting conflicting changes; asking the user to merge.
- **Consequences:** No change is blocked; coordinators can see and correct what was overwritten on the Sync page.

## D3-6: Two offline sessions for the same club and date are joined

- **Status:** Accepted (Enock, 2026-10-25)
- **Date:** 2026-10-25
- **Context:** A champion and a coordinator might both report the same session offline; only one session per club per day is allowed.
- **Decision:** The second report is joined to the first: its empty fields are filled in, its attendance is merged, and the device renames its record to the server's id.
- **Alternatives considered:** Rejecting the second report.
- **Consequences:** No attendance taken offline is lost.

## D3-7: The 7-day edit window uses the time the change was made on the device

- **Status:** Accepted (Enock, 2026-10-25)
- **Date:** 2026-10-25
- **Context:** A champion editing a report offline on day 6 might only sync on day 9 (D2-5).
- **Decision:** The window is checked against `recordedAt` when it is at most 14 days old and against server time otherwise. A time more than 5 minutes in the future is refused (`INVALID_RECORDED_AT`).
- **Alternatives considered:** Server time only.
- **Consequences:** Fair to champions without connection; a wrong device clock can stretch the window by at most 14 days (R3-3).

## D3-8: Guardian contacts, consent forms and photos stay on the device only until sent

- **Status:** Accepted (Enock, 2026-10-25)
- **Date:** 2026-10-25
- **Context:** These are the most sensitive records (D2-1, R2-2, R2-7).
- **Decision:** They can be entered offline but are kept only in the outbox, then deleted from the device once the server has them. They are never pulled to a device; consent forms and photos are viewed online only.
- **Alternatives considered:** Online-only entry of these records.
- **Consequences:** Champions can complete the whole registration offline.

## D3-9: Attendance taken offline is merged learner by learner

- **Status:** Accepted
- **Date:** 2026-10-25
- **Context:** The online endpoint replaces the whole list. An offline list could remove marks another device added.
- **Decision:** Pushed attendance only adds or changes the marks it carries and never removes others. Marks removed online leave a tombstone so devices remove them too.
- **Alternatives considered:** Replacing the list on push.
- **Consequences:** Builds on D2-4 (one record per learner per session).

## D3-10: Vercel hosts the demo build only

- **Status:** Accepted
- **Date:** 2026-10-25
- **Context:** Enock connected the repository to Vercel so stakeholders can open the app. Vercel serves static sites well, but the API needs a long-running Node server and MongoDB, which Vercel does not host in this setup.
- **Decision:** `vercel.json` builds the client in demo mode (`build:demo`, in-browser mock API with fictional data, D1-20) and installs only the client and shared workspaces. Every route falls back to `index.html`; the service worker is never cached by the CDN.
- **Alternatives considered:** Pointing the Vercel build at a hosted API (no API is hosted yet); running Express as Vercel functions (file uploads, rate limits and the sync module expect one long-running server).
- **Consequences:** The Vercel site holds no real data and needs no secrets. Hosting the API (for example Render or Railway with Atlas) is a later decision; then a second Vercel build with `VITE_API_URL` can serve the real app.

## D4-1: Charts are small SVG components on kit colours, with a table alongside

- **Status:** Accepted
- **Date:** 2026-10-25
- **Context:** The HQ dashboard needs an attendance trend and sessions per region. Chart libraries add 50–150 KB to an app used on slow connections, and their default colours and gradients do not match the STEAMLabs look.
- **Decision:** Two small components in `client/src/components/Charts.jsx` (column chart and stacked bars) drawn with SVG in flat kit colours. Each chart has a "Show as a table" section with the same numbers, for screen readers and printing.
- **Alternatives considered:** Recharts or Chart.js.
- **Consequences:** No new dependency. New chart types are written by hand; if many are needed, a library can be added later.

## D4-2: Alerts are computed when asked for, not stored

- **Status:** Accepted
- **Date:** 2026-10-25
- **Context:** HQ wants to see which clubs need help: no recent session, low attendance, missing consent, near capacity, missing event consent.
- **Decision:** `computeAlerts` in `shared/src/insights.js` checks the rules (thresholds as in the plan, agreed by Enock) each time `GET /alerts` is called, inside the user's scope. The demo mock uses the same function, so the numbers match.
- **Alternatives considered:** A nightly job that stores alerts.
- **Consequences:** Alerts are never out of date. Dismissing an alert for 7 days (R4-4) needs stored state and was added in Sprint 5 (D5-8); alerts are grouped per club on the dashboard to keep the list short.

## D4-3: Reports hold counts only

- **Status:** Accepted
- **Date:** 2026-10-25
- **Context:** Termly reports go to funders and partners outside STEAMLabs. Learners are children (Kenya DPA 2019).
- **Decision:** The termly report (screen and PDF) holds counts only: no names, contacts or photos. Any learner count from 1 to 4 shows as "<5" (`suppressSmall`), in the age and gender table and in the region and track tables.
- **Alternatives considered:** Per-learner tables for HQ only.
- **Consequences:** Tested on MongoDB: the PDF and JSON contain no learner names. Small clubs show "<5" rather than a number.

## D4-4: PDFs are made on the server with pdfkit

- **Status:** Accepted
- **Date:** 2026-10-25
- **Context:** The termly report must be emailed automatically, with no person in the loop.
- **Decision:** `GET /reports/termly.pdf` builds the PDF with `pdfkit` (plain JavaScript, no browser). The demo build, which has no server, prints the report page with print styles instead.
- **Alternatives considered:** Puppeteer (needs Chromium on the server); making the PDF in the browser (cannot run for the scheduled email).
- **Consequences:** The PDF layout is code, not HTML. Fonts are pdfkit's built-in Helvetica.

## D4-5: Email, SMS and WhatsApp go through provider stubs

- **Status:** Accepted
- **Date:** 2026-10-25
- **Context:** No email, SMS or WhatsApp provider or budget is chosen yet (Q51).
- **Decision:** `server/src/modules/notifications/providers.js` defines email and message providers. The stubs store every message in `outboundMessages` and send nothing; HQ can see them under Settings. A daily job sends the termly report the day after a term ends; a `reportRuns` record with id `termly:<termId>` is the lock that stops two servers sending it twice.
- **Alternatives considered:** Choosing a provider now (Africa's Talking, Twilio, SendGrid).
- **Consequences:** Real providers plug in with `setProviders` without changing callers. Tested: the report is sent once per term.

## D4-6: Event consent is separate from club consent

- **Status:** Accepted
- **Date:** 2026-10-25
- **Context:** Events often take learners away from school to a venue, which club consent does not cover.
- **Decision:** One `eventConsents` record per learner per event, with status, signed date and an optional signed form, following the Sprint 2 consent rules. Learners registered without it are flagged on the event and raise an alert in the 7 days before it. Event photos follow the Sprint 2 photo-consent check (D2-7), up to 10 per event. Champions register learners; there are no parent accounts.
- **Alternatives considered:** Reusing club consent; a parent sign-up page.
- **Consequences:** Guardian data stays with HQ. Results (award, rank) are stored on the event's projects rather than in a separate `eventResults` collection, because every result in the plan belongs to a project.

## D4-7: Announcements go to app users only

- **Status:** Accepted
- **Date:** 2026-10-25
- **Context:** HQ reaches champions through many WhatsApp groups today.
- **Decision:** Announcements go to app users chosen by role, region and club, shown in the app with a bell count; SMS and WhatsApp copies go through the stub (D4-5) to the phone on the user's account. Never to guardians. A preview shows how many people it will reach before sending (R4-3).
- **Alternatives considered:** Sending to guardians.
- **Consequences:** Senders see how many have read each announcement. The recipient list is never sent to devices.

## D4-8: Events and announcements are read online first, with a saved copy offline

- **Status:** Accepted
- **Date:** 2026-10-25
- **Context:** Enock chose read-only events offline. Champions should still see events and announcements without internet.
- **Decision:** Sync pulls events, participants, event consents, announcements and read marks to the device. Event and announcement screens ask the server first and fall back to the device copy when offline (`onlineFirst`); "mark as read" goes through the Sprint 3 outbox. Creating or changing events, and registering learners, need a connection. The HQ dashboard and alerts show the last saved numbers with their date when offline.
- **Alternatives considered:** Reading only from the device (as clubs and learners do); full offline event registration (about 2 more days).
- **Consequences:** Known gap: if a club is removed from an event's invitations, that event stays on the club's devices until the local database is reset. Fixed in Sprint 5 (D5-8).

## D5-1: An item is in an HQ store or lent to one club; kits are one item

- **Status:** Accepted
- **Date:** 2026-10-26
- **Context:** HQ needs to know where every laptop and robotics kit is (Q25, Q26). Tagging each part of a kit (every micro:bit, every cable) is more work than HQ can keep up.
- **Decision:** Every item belongs to the HQ store of a region and is either there or lent to one club. A kit is one item with a contents note (Enock's answer to question 2). A loan needs the item to be in the store and working or needing repair; a partial unique index on open loans means two people lending the same item at once get one loan and one refusal. Champions see their clubs' items and report damage or loss; they cannot lend or return.
- **Alternatives considered:** Tagging every part; letting items move between clubs directly.
- **Consequences:** Every loan, return, repair and report records who and when (R5-3). Retired items stay in the register but are left out of dashboard counts. A coordinator manages items in their regions' stores and sees items lent to their regions' clubs.

## D5-2: Resources are files up to 20 MB or links; videos are links only

- **Status:** Accepted
- **Date:** 2026-10-26
- **Context:** Champions need lesson plans, slides, worksheets and videos (Q22, Q27). Storage and data are costly; most venues have no internet.
- **Decision:** A resource has a link, a file in GridFS (up to 20 MB), or both. Videos are links only (question 3). Allowed files: PDF, PowerPoint (PPTX), OpenDocument slides and text (ODP, ODT), Word (DOCX), Scratch (SB3), ZIP, JPG and PNG. The server checks the file's first bytes match its name (PDF, ZIP container, PNG or JPEG). A resource can only be published with a link or a file. Only HQ adds and publishes; everyone signed in reads published resources.
- **Alternatives considered:** Uploading videos; any file type.
- **Consequences:** Word and ODT were added to the plan's list, because many worksheets are written in Word. A Word file renamed to `.pdf` is refused.

## D5-3: Saved resources are kept in the browser's storage, up to 300 MB

- **Status:** Accepted
- **Date:** 2026-10-26
- **Context:** Champions need lesson plans in class with no internet.
- **Decision:** Champions and coordinators (who keep data on their device, D3-1) can save a resource's file on the device. The file goes in the user's local database, in a `savedResources` table outside the synced tables, with a limit of 300 MB and the space used shown on the Resources page. After each sync a replaced file is fetched again and an unpublished or deleted one is removed. Saved files are deleted on sign-out with the rest of the local data (D3-2).
- **Alternatives considered:** The service worker cache (harder to count and to delete per user); saving every resource automatically.
- **Consequences:** Tested: a saved file opens offline and is gone after signing out.

## D5-4: Raspberry Pi Foundation material is linked, not copied

- **Status:** Accepted
- **Date:** 2026-10-26
- **Context:** STEAMLabs uses the Raspberry Pi Foundation curriculum (Q22). Its projects have their own licence.
- **Decision:** Their projects are added as links. The resource form reminds HQ of this, and HQ confirms the licence of anything it uploads (R5-2).
- **Alternatives considered:** Uploading PDF copies of their projects.
- **Consequences:** Their links need internet. A worksheet STEAMLabs writes itself can be uploaded and saved for offline use.

## D5-5: Projects and scores are recorded offline; scores merge learner by learner

- **Status:** Accepted
- **Date:** 2026-10-26
- **Context:** Most venues have no internet (Q36). Enock chose offline recording (question 4).
- **Decision:** Four new outbox operations: `equipment.report`, `project.save`, `assessment.save` and `assessment.scores`, plus a project file upload that waits like session photos (D3-8). `project.save` and `assessment.save` carry the whole record with the id made on the device, so the server creates it the first time and updates it after. Only changed scores are sent, and the server merges them learner by learner like attendance (D3-9), so two people can enter scores for one assessment. A project photo with learners who have no photo consent needs the same confirmation as session photos (D2-7).
- **Alternatives considered:** Online only (saves about 2 days).
- **Consequences:** These operations are not checked for conflicts: the later save wins, without an entry in the conflict log. Tested: changes sent twice are applied once.

## D5-6: Scores and projects are learner data

- **Status:** Accepted
- **Date:** 2026-10-26
- **Context:** Scores are about children and could be used to rank them publicly (R5-4).
- **Decision:** Projects and scores have the same scope as the learner record: champions their own clubs, coordinators their regions, HQ everything. The termly report shows only counts of projects and assessments and the average score per track, and hides an average made of fewer than 5 scores, like other small groups (D4-3).
- **Alternatives considered:** Scores visible to all champions; per-learner scores in the report.
- **Consequences:** Tested on MongoDB: the report JSON holds no learner names, project titles or individual scores.

## D5-7: Some API paths differ from the plan

- **Status:** Accepted
- **Date:** 2026-10-26
- **Context:** The plan listed `/projects`, `/assessments`, `/learners/:id/progress`, `/clubs/:id/progress`, `PATCH /equipment/:id/loans/:loanId` and `POST /alerts/:key/dismiss`.
- **Decision:** Projects, assessments and the progress pages are under one router, `/api/v1/progress` (`/progress/projects`, `/progress/assessments`, `/progress/learners/:id`, `/progress/clubs/:id`). A return is `POST /equipment/:id/return`, since an item has at most one open loan. Hiding an alert is `POST /alerts/dismissals` with `{ key }`, because keys contain colons.
- **Alternatives considered:** The paths as planned.
- **Consequences:** Each module owns one path prefix, as in Sprints 1 to 4.

## D5-8: Equipment and resources are read online first; records that leave scope leave the device

- **Status:** Accepted
- **Date:** 2026-10-26
- **Context:** Equipment history (loans, repairs, reports) is only needed online. D4-8 left a gap: an event stayed on a device after its club was uninvited.
- **Decision:** Equipment and the resource list are read from the server first and from the device copy when offline, like events (D4-8). A champion's damage report goes straight to the server when online and through the outbox when not. The first page of every pull now carries `inScope`, the ids of events, items, resources and projects the user may keep; the device deletes the others. Alerts can be hidden for 7 days by each person (R4-4), stored in `alertDismissals`.
- **Alternatives considered:** Tombstones for every record that leaves scope.
- **Consequences:** Closes the D4-8 gap (tested: an uninvited event is no longer in `inScope`). The device copy of an item has no loan history.

## D5-10: The Code Club logo in the app

- **Status:** Accepted (Enock, 2026-10-27)
- **Date:** 2026-10-27
- **Context:** Enock sent the official green horizontal Code Club logo. The STEAMLabs logo and partner credit live in the paused redesign (PR #4), so the current app showed no logo.
- **Decision:** Show the Code Club logo, cropped but not recoloured, above the sign-in card and at the top of the menu, where it sits on a white tile so the green logo stays visible on the green menu. It is hidden in the phone bottom bar. It moves into the redesign when that resumes.
- **Alternatives considered:** Waiting for the redesign; waiting for a white or SVG version from HQ.
- **Consequences:** Code Club is a Raspberry Pi Foundation brand; the D3-12 point on partner wording and permission still applies. An SVG would stay sharper than the PNG.

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
