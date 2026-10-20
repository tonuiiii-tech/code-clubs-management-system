# STEAMLabs Code Clubs: Sprint 1 plan

20 October 2026 · Status: awaiting Enock's approval

## Summary

Sprint 1 delivers a working monorepo with login, configurable role-based access, an audit log, Club and Facilitator management, a realistic Kenyan seed dataset and a CI pipeline that runs lint and tests on every push. The repo is empty today, so this sprint also sets the conventions every later sprint builds on.

The biggest choice in this plan is to put the offline-sync foundations into the data model now (client-generated UUIDs, per-field timestamps, a server change sequence and soft deletes), even though the sync engine itself is built in Sprint 2. That way Sprint 2 adds sync without migrating any data.

What I need from you: an OK on this plan, plus answers to the open questions at the end (or I will go with the defaults stated there). No code is written until you say go.

## Sprint 1 scope

Sprint 1 is backend-heavy: the server is complete and tested, and the client is a thin but installable PWA shell that already speaks English and Kiswahili.

1. **Repo setup.** npm workspaces monorepo, ESLint + Prettier, `.editorconfig`, `.env.example` files, Windows-first README, `/docs` with the decision log, risk register and sprint notes.
2. **Shared package.** Zod schemas, enums (regions, tracks, venue types, statuses) and the RBAC policy in `packages/shared`, used by both server and client so validation works offline in the browser too.
3. **Server foundation.** Express app with helmet, CORS allowlist, request IDs, central error handler, env validated at startup, Mongo connection, sync-fields plugin applied to every model.
4. **Auth.** Login with email or phone, bcrypt (cost 12), 15-minute JWT access token, rotating 30-day refresh token in an httpOnly cookie, logout, change password, rate limiting and lockout on failed logins.
5. **RBAC + audit log.** `authorize(permission)` middleware, scope filters (all / region / own clubs), field redaction, and an append-only audit log with field-level diffs.
6. **Club CRUD** with server-assigned human-readable codes, filters (region, county, status, track, search) and pagination.
7. **Facilitator CRUD** (facilitators are users), club assignments (many-to-many), safeguarding status, and HQ user management (create coordinators, change roles, grant learner-contact access).
8. **Seed script** with realistic Kenyan data across all four regions.
9. **Client shell.** Vite + React + React Router, vite-plugin-pwa (installable, app shell cached), react-i18next with `en` and `sw` files, login, Clubs list/detail/form, Facilitators list/detail/form, a placeholder sync-status bar, and Dexie schema v1 declared but not yet used for sync. All screens use the `steamlabsui` 1.0.0 package (STEAMLabs Africa UI library, on npm): its React components (Button, Field, Input, Select, Table, Card, Stat, Badge, Alert, Dialog, Tabs, Pagination, Toast, EmptyState), tokens and Logo. Poppins is self-hosted and precached instead of loaded from Google Fonts, so the app looks right offline.
10. **CI.** GitHub Actions running lint, server tests (Jest + Supertest + mongodb-memory-server), client unit tests (Vitest), client build and one Playwright smoke test.

### Sprint roadmap (small adjustments)

| Sprint | Scope | Change from your plan |
| --- | --- | --- |
| 1 | Repo, auth + RBAC + audit, Clubs, Facilitators, seed, CI | Adds sync fields to models and Playwright setup now |
| 2 | Offline sync engine first, then Learners + consent upload, Sessions + attendance, file upload queue | Sync built first so Learners and Sessions are offline from day one; offline Playwright tests start here, not Sprint 4 |
| 3 | HQ dashboard + alerts, PDF termly report + scheduled email (stub), Events + event consent, Announcements + SMS/WhatsApp stub provider | None |
| 4 | Equipment inventory, Resources library (offline download), Progress tracking, full Kiswahili review, full offline end-to-end suite | Kiswahili keys exist from Sprint 1; Sprint 4 is the translation review |

In Sprint 1 the client calls the REST API directly, through a small data-access layer. In Sprint 2 that layer switches to Dexie + outbox, so no screen has to be rewritten.

## Folder structure

One repo with npm workspaces: `server`, `client` and a small `packages/shared` so the server and the offline client validate data with the same rules. Server code is grouped by feature module, which keeps each sprint's work in its own folder.

```text
code-clubs-management-system/
├── .github/workflows/ci.yml        # lint + tests + build on push/PR
├── .editorconfig  .gitignore  .nvmrc  .prettierrc  eslint.config.js
├── package.json                    # npm workspaces + root scripts (dev, test, lint, seed)
├── README.md                       # Windows setup steps first
├── docs/
│   ├── decision-log.md             # D<sprint>-<n>
│   ├── risk-register.md            # R<sprint>-<n>
│   ├── data-model.md
│   ├── rbac.md                     # role/permission matrix
│   ├── sync-protocol.md            # push/pull contract (fields defined now, engine in S2)
│   └── sprints/sprint-1.md         # plan + end-of-sprint summary
├── packages/shared/
│   └── src/
│       ├── enums.js                # regions, counties, tracks, venue types, statuses
│       ├── permissions.js          # default RBAC policy (one place to change roles)
│       └── schemas/                # Zod: club.js, user.js, facilitator.js, auth.js
├── server/
│   ├── .env.example  jest.config.js  package.json
│   ├── scripts/
│   │   ├── seed.js
│   │   └── seed-data/              # kenya-locations.js, clubs.js, people.js
│   ├── src/
│   │   ├── app.js                  # builds the Express app (used by Supertest)
│   │   ├── server.js               # connects DB and listens
│   │   ├── config/env.js           # env validated with Zod, fails fast
│   │   ├── db/                     # connect.js, plugins/syncFields.js, counters.js
│   │   ├── middleware/             # authenticate, validate, rateLimit, errorHandler, requestId
│   │   ├── rbac/                   # authorize.js, scope.js, redact.js
│   │   ├── models/                 # User, Club, ClubFacilitator, AuditLog, RefreshToken
│   │   └── modules/
│   │       ├── auth/               # auth.routes.js, auth.controller.js, auth.service.js
│   │       ├── users/
│   │       ├── clubs/
│   │       ├── facilitators/
│   │       ├── audit/
│   │       └── meta/               # enums for the client, health check
│   └── tests/
│       ├── setup.js                # mongodb-memory-server lifecycle
│       ├── helpers/                # factories, login helper
│       └── auth / rbac / clubs / facilitators / audit .test.js
└── client/
    ├── .env.example  index.html  vite.config.js  playwright.config.js  package.json
    ├── public/icons/               # PWA icons
    ├── e2e/smoke.spec.js
    └── src/
        ├── main.jsx  App.jsx  routes.jsx
        ├── i18n/                   # index.js, locales/en/*.json, locales/sw/*.json
        ├── api/                    # http.js (token refresh), data-access layer per entity
        ├── db/dexie.js             # schema v1 (sync in Sprint 2)
        ├── auth/                   # AuthProvider, RequirePermission
        ├── ui/                     # steamlabsui setup: CSS imports, self-hosted Poppins, ThemeProvider, app compositions (FormField, DataTable)
        ├── components/             # Layout, SyncStatusBar, LanguageSwitcher, forms (built from ui/)
        ├── features/               # login/, clubs/, facilitators/
        └── test/                   # Vitest setup
```

Your local copy (`C:\Users\PC\STEAMlabs\code-clubs-management-system`) has no code yet, only a root `package.json` with `steamlabsui` installed. In this layout `steamlabsui` moves into `client/package.json`, since only the client uses it.

## Data model

Every synced record carries the same sync fields, added by one Mongoose plugin. Sprint 1 builds five collections; the rest are designed now so their shape is settled before Sprint 2.

### Sync fields on every synced record

| Field | Type | Purpose |
| --- | --- | --- |
| `_id` | String (UUID v7) | Generated on the device; time-ordered so indexes stay compact |
| `createdAt`, `updatedAt` | Date | Client time of the write (clamped if more than 5 min ahead of the server) |
| `fieldUpdatedAt` | Map field → Date | Per-field timestamps for last-write-wins per field |
| `serverSeq` | Number, indexed | Monotonic server change counter; pull uses `since=<serverSeq>`, not device clocks |
| `version` | Number | Incremented on every accepted change |
| `deletedAt` | Date or null | Soft delete (tombstone); nothing is hard-deleted |
| `createdBy`, `updatedBy` | User id | Who made the change |
| `lastDeviceId` | String | Which device the last change came from |

### User (facilitators, coordinators, HQ) — Sprint 1

| Field | Type / rules |
| --- | --- |
| `fullName` | String, required |
| `email` | String, lowercase, unique when present |
| `phone` | String, Kenyan E.164 (`+2547…`/`+2541…`), unique when present; email or phone required |
| `passwordHash` | bcrypt, never returned by the API |
| `role` | `super_admin` \| `regional_coordinator` \| `facilitator` (values come from the policy file) |
| `regions` | Region codes, for coordinators |
| `permissionGrants` | Extra permissions HQ grants one person, e.g. `learnerContact:read` |
| `facilitator.type` | `teacher` \| `volunteer` \| `staff` |
| `facilitator.skills` | String list (tracks and free-text skills) |
| `facilitator.safeguarding` | `{ status: pending \| cleared \| expired, date, expiresAt? }` |
| `preferredLanguage` | `en` \| `sw` |
| `status` | `active` \| `disabled` |
| `failedLogins`, `lockedUntil`, `lastLoginAt`, `tokenVersion` | Lockout and session revocation |

### Club — Sprint 1

| Field | Type / rules |
| --- | --- |
| `code` | Human-readable unique ID, server-assigned per region: `NAC-001`, `WNY-001`, `CST-001`, `RVL-001` |
| `name` | String, required |
| `host` | `{ name, organisationType }` (school or organisation) |
| `venueType` | `primary_school` \| `community_centre` \| `library` \| `online` |
| `region` | `nairobi_central` \| `western_nyanza` \| `coast` \| `rift_valley` |
| `location` | `{ county, subCounty, ward, gps: GeoJSON Point }`; optional for online clubs; county validated against the 47 counties |
| `hostContact` | `{ name, phone }` |
| `schedule` | `{ dayOfWeek, startTime "HH:mm", endTime, frequency: weekly \| fortnightly \| monthly }` |
| `status` | `active` \| `paused` \| `closed` |
| `mainTrack` | `unplugged` \| `scratch` \| `robotics` \| `game_design` \| `ai_basics` |
| `capacity` | Integer 1–30, default 30 |

Indexes: `code` unique, `region + status`, `location.gps` 2dsphere, `serverSeq`.

### ClubFacilitator (assignment) — Sprint 1

| Field | Type / rules |
| --- | --- |
| `clubId`, `userId` | Required; unique pair among non-deleted rows |
| `role` | `lead` \| `assistant` |
| `startDate`, `endDate` | Assignment history is kept, not overwritten |

A separate collection instead of an array on Club or User, so two offline devices adding different facilitators never overwrite each other.

### AuditLog and RefreshToken — Sprint 1 (not synced)

| Collection | Fields |
| --- | --- |
| AuditLog | `at`, `actorId`, `actorRole`, `action` (create, update, delete, login, login_failed, role_change, grant), `entity`, `entityId`, `changes [{ field, from, to }]` with sensitive values redacted, `source` (api, sync, seed), `ip`, `requestId`. Append-only: no update or delete route. |
| RefreshToken | `userId`, `tokenHash`, `familyId`, `expiresAt`, `revokedAt`, `deviceId`, `userAgent`. Reuse of a rotated token revokes the whole family. |

### Designed now, built later

| Collection | Key fields | Sprint |
| --- | --- | --- |
| Learner | `clubId`, `fullName`, `gender`, `school`, `grade`, `ageAtEnrolment` (9–14) + `enrolledOn` (age computed later), `consent { received, attachmentId }`, `photoPermission`, `status` active/left, `leftReason` | 2 |
| LearnerContact | `learnerId`, guardian name and phone. Separate collection so it is never sent to roles without `learnerContact:read`, online or in sync | 2 |
| ClubSession | `clubId`, `date`, `start`, `end`, `facilitatorIds`, `topic`, `track`, `notes`, `photoIds` | 2 |
| Attendance | `sessionId`, `learnerId`, `present`. Deterministic `_id` from session + learner, so two devices marking the same learner merge instead of duplicating | 2 |
| Attachment | File metadata (`owner`, `kind`, `mime`, `size`, `sha256`, `storageKey`, `uploadedAt`); bytes queue in IndexedDB until online | 2 |
| SyncMutation, SyncConflict | Processed mutation IDs (idempotent pushes) and the conflict log | 2 |
| Term | School term calendar: `year`, `term`, `start`, `end` | 2 |
| Event, EventParticipation | Event details and club list; per-learner participation, event consent status, project presented, award | 3 |
| Announcement, AnnouncementReceipt, MessageDelivery | Audience (all, region, club), channels, text; read receipts; SMS/WhatsApp delivery records via the stub provider | 3 |
| Equipment, EquipmentLoan, RepairLog | Item, type, serial, holding club, condition; check-out and return; repair history | 4 |
| Resource | Title, track, type (lesson plan, slides, video), file, language, offline flag | 4 |
| ProgressRecord | `learnerId`, `kind` (project or assessment), link/file/photo, score, `track`, `date` | 4 |
| Certificate (later) | `learnerId`, `track`, `level`, `criteriaMet [progressRecordIds]`, `issuedOn`. Fits without changing ProgressRecord | later |

## Access control, audit and sync groundwork

Roles live in one policy file (`packages/shared/src/permissions.js`), so changing them after the HQ meeting means editing that file only. Each permission maps a role to a scope: `all`, `region` (the coordinator's regions) or `own` (clubs the facilitator is assigned to).

Every protected route uses three pieces: `authorize('club:update')` checks the permission, `scopeFilter(user, 'club')` turns the scope into a Mongo filter so lists and lookups only see allowed records, and `redact()` strips fields the role may not see. Per-person grants (for example HQ letting one facilitator see learner contacts) are added on top of the role.

| Permission | Super Admin / HQ | Regional Coordinator | Facilitator |
| --- | --- | --- | --- |
| `club:read` | all | region | own |
| `club:create`, `club:update` | all | region | — |
| `club:close` | all | region | — |
| `assignment:manage` | all | region | — |
| `facilitator:read` | all | region | co-facilitators of own clubs (name and type only) |
| `facilitator:create`, `facilitator:update` | all | region | own profile only |
| `safeguarding:update` | all | — | — |
| `user:manage` (roles, grants, disable) | all | — | — |
| `audit:read` | all | region | — |
| `learner:read` (Sprint 2) | all | region | own |
| `learnerContact:read` (Sprint 2) | all | — (open question) | only if granted |

**Audit log.** Services, not Mongoose hooks, write audit entries, because they know the actor, request and the before/after values. Each entry stores only the changed fields, with passwords and learner contact values redacted. Logins and failed logins are logged too.

**Sync groundwork in Sprint 1.** The sync-fields plugin, the `serverSeq` counter and soft deletes are in place and tested, and REST writes already stamp them. `docs/sync-protocol.md` will define the Sprint 2 contract: a push is a batch of mutations, each with its own `mutationId`, so a repeated push is answered from `SyncMutation` without applying anything twice; field conflicts resolve by newest `fieldUpdatedAt` and the losing value goes to `SyncConflict`.

## Sprint 1 API

All routes sit under `/api`, take and return JSON, validate input with the shared Zod schemas, and return `{ data, page, total }` for lists.

| Method and path | What it does | Who |
| --- | --- | --- |
| `POST /auth/login` | Email or phone + password; returns access token, sets refresh cookie. Rate-limited (5 tries per 15 min per IP + identifier) | public |
| `POST /auth/refresh` | Rotates the refresh token | signed in |
| `POST /auth/logout` | Revokes the refresh token | signed in |
| `GET /auth/me` | Current user, role, effective permissions | signed in |
| `POST /auth/change-password` | Requires the old password | signed in |
| `GET /clubs`, `GET /clubs/:id` | List (filters: region, county, status, track, q; paginated) and detail, scoped | `club:read` |
| `POST /clubs`, `PATCH /clubs/:id` | Create and update | `club:create`, `club:update` |
| `DELETE /clubs/:id` | Soft delete; normal use is status `closed` | `club:close` |
| `GET /clubs/:id/facilitators` | Assigned facilitators | `club:read` |
| `PUT /clubs/:id/facilitators/:userId`, `DELETE …` | Assign or end assignment | `assignment:manage` |
| `GET /facilitators`, `GET /facilitators/:id` | List (filters: region, club, type, safeguarding status) and detail | `facilitator:read` |
| `POST /facilitators`, `PATCH /facilitators/:id` | Create (with a temporary password) and update | `facilitator:create`, `facilitator:update` |
| `PATCH /facilitators/:id/safeguarding` | Set status and date | `safeguarding:update` |
| `GET /users`, `POST /users`, `PATCH /users/:id` | HQ manages coordinators, roles, grants, disabling | `user:manage` |
| `GET /audit` | Filter by entity, entityId, actor, date range | `audit:read` |
| `GET /meta` | Enums, regions, counties, tracks for forms | signed in |
| `GET /health` | Liveness and DB status | public |

### Seed data

`npm run seed` creates 1 HQ admin, 4 regional coordinators, about 16 facilitators (teachers, volunteers, staff; safeguarding cleared, pending and expired) and 12 clubs, three per region: for example Kibera and Kawangware (Nairobi), Kisumu and Kakamega (Western & Nyanza), Mombasa and Kilifi (Coast), Nakuru and Eldoret (Rift Valley). Counties, sub-counties, wards and GPS points are real; host names and people are fictional, and phone numbers use an obviously fake `+254700000xxx` range. It covers every venue type, track and club status, including one full club. The script refuses to run when `NODE_ENV=production` and reads the default password from `.env`.

## Proposed decisions and risks

These go into `docs/decision-log.md` and `docs/risk-register.md` once you approve.

| ID | Decision | Why |
| --- | --- | --- |
| D1-1 | npm workspaces monorepo with `server`, `client`, `packages/shared` | One install, one CI run, one set of schemas for server and offline client |
| D1-2 | JavaScript (ES modules) with JSDoc, not TypeScript | Lower barrier for volunteer contributors; see open question 1 |
| D1-3 | Zod rather than Joi | Runs in the browser too, so offline forms validate with the server's rules |
| D1-4 | Client-generated UUID v7 as `_id` on all synced records | Records can be created offline with no ID clash; time-ordered for index locality |
| D1-5 | Sync fields on every model from Sprint 1; pull checkpoint is a server sequence number | No data migration in Sprint 2; immune to wrong device clocks |
| D1-6 | Soft deletes everywhere | Deletes must sync as tombstones, and records are kept indefinitely |
| D1-7 | Facilitators are Users; club assignments in a ClubFacilitator collection | Many-to-many that merges cleanly offline and keeps assignment history |
| D1-8 | RBAC policy in one shared file + `authorize` / `scopeFilter` / `redact` | Roles can change after the HQ meeting without touching routes; a database-backed role editor can come later |
| D1-9 | 15-min access JWT in memory, rotating 30-day refresh token in httpOnly cookie | Limits token theft; long enough for facilitators who are offline for weeks |
| D1-10 | Learner contacts in their own collection (Sprint 2) | Contacts structurally never reach a device or API response without permission |
| D1-11 | Human-readable club codes assigned by the server per region | Readable IDs for reports and phone calls; clubs are created online by HQ or coordinators |
| D1-12 | Node 24 LTS, MongoDB 7+; Atlas free tier or local MongoDB for dev | Current LTS; tests need no MongoDB install thanks to mongodb-memory-server |
| D1-13 | Playwright set up in Sprint 1; offline end-to-end tests start in Sprint 2 | Sync is the riskiest part, so test it as soon as it exists |
| D1-14 | Audit entries written by services with field diffs and redaction | Hooks lack actor and request context; diffs keep the log readable |
| D1-15 | UI built on steamlabsui 1.0.0 components and tokens; no Tailwind for now | Brand-consistent with other STEAMLabs apps; the kit covers forms, tables, stats, dialogs and toasts, so Tailwind adds little (its Tailwind v4 theme can be added later) |
| D1-16 | Import tokens.css + components.css, not styles.css; self-host Poppins via @fontsource/poppins | styles.css loads Poppins from Google Fonts, which fails offline; self-hosted fonts are precached by the service worker |

| ID | Risk | Mitigation |
| --- | --- | --- |
| R1-1 | Roles change after the HQ meeting | Policy file + tests generated from the policy table |
| R1-2 | Wrong device clocks distort last-write-wins | Server sequence for pull; clamp future timestamps; consider a hybrid logical clock in Sprint 2 |
| R1-3 | Lost or shared laptops/tablets hold learner data in IndexedDB | Cache only the facilitator's own clubs, never contacts without permission; wipe Dexie on logout; local PIN / encryption reviewed in Sprint 2 |
| R1-4 | Kenya Data Protection Act: children's data and indefinite retention | Needs HQ confirmation of ODPC registration, a DPIA and a written retention justification; I can draft, but it needs legal review |
| R1-5 | Sprint 2 is heavy (sync, learners, consent upload, sessions, file queue) | Sync first; if time runs short, file upload queue moves to early Sprint 3 |
| R1-6 | PWA storage can be evicted, especially on iOS Safari | Request persistent storage; show a warning if denied; confirm devices in use |
| R1-7 | Facilitators without email cannot self-reset passwords | HQ or coordinator resets until the SMS provider exists |
| R1-8 | mongodb-memory-server binary download blocked on some networks | Cache in CI; README fallback to a local MongoDB for tests |
| R1-9 | steamlabsui is a new v1.0.0, marked UNLICENSED, and brand colours limit contrast (white on Clover Green 3.4:1) | Pin the exact version; confirm STEAMLabs owns the package; follow the kit's contrast rules and run axe checks in Playwright |

## Testing, done criteria and open questions

Sprint 1 is done when CI is green on the branch and every item below passes locally on Windows and in CI.

- [ ] Server: auth (login by email and phone, wrong password, lockout, rate limit, refresh rotation and reuse detection, logout)
- [ ] Server: RBAC matrix tests generated from the policy file, one per role × permission × scope, including a facilitator trying another region's club (404, not 403, so club existence does not leak)
- [ ] Server: Club and Facilitator CRUD, validation errors (capacity over 30, bad county, bad phone), soft delete, assignment uniqueness
- [ ] Server: sync fields stamped on every write, `serverSeq` strictly increasing, future timestamps clamped
- [ ] Server: audit entries written with diffs and redaction; no audit update or delete route
- [ ] Seed runs twice without duplicates and refuses production
- [ ] Client: Vitest units for the data-access layer, permission guard and language switch
- [ ] Client: Playwright smoke test (log in, see clubs, switch to Kiswahili)
- [ ] README setup steps tried on Windows (PowerShell), `.env.example` complete, no secrets in git
- [ ] Sprint 1 summary in `docs/sprints/sprint-1.md`: built, decisions, risks, how to run

### Open questions (defaults I will use if you do not say otherwise)

1. **JavaScript or TypeScript?** Default: JavaScript, matching what I assume Shule Safe uses. Tell me if Shule Safe is TypeScript and I will match it.
2. **Can Regional Coordinators see learner contact details?** The questionnaire says HQ only. Default: no, unless granted per person.
3. **Can facilitators edit their club's details** (meeting day, time, host contact)? Default: no, coordinators and HQ only.
4. **Which UI theme?** `steamlabsui` has program themes: academy, elevate, showcase, nextgen and educators. Default: the base STEAMLabs theme, no program theme.
