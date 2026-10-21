# Decision log

IDs are D<sprint>-<n>. Sprint 1 decisions were proposed on 20 Oct 2026 and updated on 21 Oct 2026 after Enock accepted the folder structure and deferred offline sync. Full context: [sprints/sprint-1.md](sprints/sprint-1.md).

| ID | Decision | Why |
| --- | --- | --- |
| D1-1 | npm workspaces monorepo with `server`, `client`, `shared` (Enock's structure, D1-19) | One install, one CI run, one set of schemas for server and offline client |
| D1-2 | JavaScript (ES modules) with JSDoc, not TypeScript | Lower barrier for volunteer contributors; see open question 1 |
| D1-3 | Zod rather than Joi | Runs in the browser too, so offline forms validate with the server's rules |
| D1-4 | Client-generated UUID v7 as `_id` on all synced records | Records can be created offline with no ID clash; time-ordered for index locality |
| D1-5 | Sync fields on every model from Sprint 1; pull checkpoint is a server sequence number | No data migration when offline sync arrives in Sprint 3; immune to wrong device clocks |
| D1-6 | Soft deletes everywhere | Deletes must sync as tombstones, and records are kept indefinitely |
| D1-7 | Facilitators are Users; club assignments in a ClubFacilitator collection | Many-to-many that merges cleanly offline and keeps assignment history |
| D1-8 | RBAC policy in one shared file + `authorize` / `scopeFilter` / `redact` | Roles can change after the HQ meeting without touching routes; a database-backed role editor can come later |
| D1-9 | 15-min access JWT in memory, rotating 30-day refresh token in httpOnly cookie | Limits token theft; long enough for facilitators who are offline for weeks |
| D1-10 | Learner contacts in their own collection (Sprint 2) | Contacts structurally never reach a device or API response without permission |
| D1-11 | Human-readable club codes assigned by the server per region | Readable IDs for reports and phone calls; clubs are created online by HQ or coordinators |
| D1-12 | Node 24 LTS, MongoDB 7+; Atlas free tier or local MongoDB for dev | Current LTS; tests need no MongoDB install thanks to mongodb-memory-server |
| D1-13 | Playwright set up in Sprint 1; offline end-to-end tests start in Sprint 3 with the sync engine | Sync is the riskiest part, so test it as soon as it exists |
| D1-14 | Audit entries written by services with field diffs and redaction | Hooks lack actor and request context; diffs keep the log readable |
| D1-15 | UI built on steamlabsui 1.0.0 components and tokens; no Tailwind for now | Brand-consistent with other STEAMLabs apps; the kit covers forms, tables, stats, dialogs and toasts, so Tailwind adds little (its Tailwind v4 theme can be added later) |
| D1-16 | Import tokens.css + components.css, not styles.css; self-host Poppins via @fontsource/poppins | styles.css loads Poppins from Google Fonts, which fails offline; self-hosted fonts are precached by the service worker |
| D1-17 | Offline sync (Dexie, outbox, push/pull, conflict handling, offline caching) deferred to Sprint 3; Sprints 1–2 are online only | Enock's call on 21 Oct: get the core management features working and presentable first |
| D1-18 | Schools are their own entity; clubs link to a School | Enock added Schools; avoids retyping host details and lets learners link to their school |
| D1-19 | Adopt Enock's folder structure (pages, layouts, routes, services, context; feature modules) plus shared/, i18n/, ui/, docs/, CI, per-package tests and .env.example | Agreed on 21 Oct |
