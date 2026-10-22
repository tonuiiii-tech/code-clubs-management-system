# MongoDB data layer

22 October 2026 · Approved by Enock on 22 Oct 2026 (D1-8, D1-21 to D1-23)

Decision D1-8 is recorded: **MongoDB with Mongoose**. This plan connects the API to MongoDB so that the Sprint 1 screens work against real saved data. Nothing on the screens changes; demo mode stays available.

## 1. What changes

| Area         | Change                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection   | `server/src/db/index.js` connects with Mongoose using `MONGODB_URI` (replaces `DATABASE_URL`). The server stops cleanly if MongoDB is unreachable. |
| Models       | One Mongoose model per collection in `server/src/db/models/` (below).                                                                              |
| Repositories | The existing repository functions (`listClubs`, `findClubInScope`, …) are filled in. Services, routes and controllers stay as they are (D1-16).    |
| Scope        | The engine-neutral scope filter (`{ all }`, `{ regions }`, `{ championUserId }`, `{ userId }`) is turned into Mongo queries in one helper.         |
| Seed         | `npm run seed` loads the same fictional Kenyan data as demo mode. The data file moves to `shared/` so the demo and the seed never differ (R1-12).  |
| Tests        | Repository and API tests run against mongodb-memory-server (an in-process MongoDB, nothing to install).                                            |
| Docs         | README: Windows setup for MongoDB; architecture section 7 gets the collections and indexes.                                                        |

## 2. Collections

Every document's `_id` is a **UUID string**, not a Mongo ObjectId, so devices can create records offline in Sprint 3 (D1-6). Mongoose `timestamps` set `createdAt` and `updatedAt`; services set `createdBy` and `updatedBy`.

| Collection      | Fields (as in architecture §7)                                                                                                                                          | Indexes                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `users`         | fullName, email, phone, passwordHash, role, status, regions, championProfile, permissionGrants, preferredLanguage, tokenVersion, failedLogins, lockedUntil, lastLoginAt | `email` unique · `role, status` · `regions`                                                                              |
| `refreshTokens` | userId, familyId, tokenHash, expiresAt, revokedAt                                                                                                                       | `tokenHash` unique · `familyId` · `userId` · TTL on `expiresAt` (MongoDB deletes expired tokens itself)                  |
| `schools`       | name, type, region, county, subCounty, ward, gps, contactName, contactPhone, status                                                                                     | `name + county + subCounty` unique, case-insensitive (duplicate check, R1-11) · `region, status` · `county`              |
| `clubs`         | code, name, schoolId, venueType, region, meetingDay, startTime, endTime, frequency, mainTrack, capacity, status                                                         | `code` unique · `region, status` · `schoolId`                                                                            |
| `clubChampions` | clubId, userId, role, startDate, endDate                                                                                                                                | `clubId + userId` unique **while endDate is empty** (a champion can't be assigned twice, but history is kept) · `userId` |
| `counters`      | `_id` = region prefix (NAC, WNY, CST, RVL), `seq`                                                                                                                       | Atomic `$inc` gives the next club code with no duplicates, even with two people saving at once                           |
| `auditEntries`  | at, actorId, actorRole, action, entityType, entityId, changedFields, requestId                                                                                          | `entityType + entityId + at` · `actorId + at`. Append-only: the repository has no update or delete.                      |

Assignments stay a separate collection rather than an array inside clubs. That keeps history, and keeps offline edits to different assignments from overwriting each other in Sprint 3 (D1-15).

## 3. How scope becomes a query

| Who                      | Clubs                                      | Schools                   | Users                                                                                      |
| ------------------------ | ------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------ |
| Admin, Programme Manager | everything                                 | everything                | everything                                                                                 |
| Coordinator              | `region` in their regions                  | `region` in their regions | people in their regions, champions of their region's clubs, and champions with no club yet |
| Champion                 | clubs where they have a current assignment | schools of those clubs    | only themselves                                                                            |

Out-of-scope records still come back as 404 (D1-4). This is the same rule as the demo mock, so the Playwright flows should pass unchanged against the real server.

## 4. Dashboard

`GET /dashboard/summary` uses one aggregation pipeline per count (active clubs, schools, champions, clubs by region, clubs by track), each starting from the same scope filter.

## 5. Setup on your computer (Windows)

Two options; I'll document both in the README:

1. **MongoDB Atlas free tier (recommended).** No install, works the same in production, and is already a replica set (needed for transactions later). Paste the connection string into `server\.env` as `MONGODB_URI`.
2. **MongoDB Community Server** installed locally, with `MONGODB_URI=mongodb://localhost:27017/code-clubs`.

Then `npm run seed` and `npm run dev`. Sign in with the same demo accounts as demo mode.

## 6. Tests

- Each repository: create, read in scope, out-of-scope returns nothing, duplicate school and duplicate assignment are rejected, club codes don't repeat.
- API with Supertest against a real (in-memory) MongoDB: login, lockout, refresh rotation and reuse, deactivation ends sessions, and every permission and scope case from the mock tests.
- The four Playwright flows, run once against the real server as well as the demo build (closes R1-19).

## 7. Test environment note

mongodb-memory-server downloads the MongoDB program from `fastdl.mongodb.org` the first time tests run. This works on developer machines and in GitHub Actions. Cloud development environments must allow that domain.

## 8. Order of work

1. Connection, models, indexes and the scope helper.
2. Users and auth repositories (login, refresh tokens, lockout), with tests.
3. Schools, clubs, assignments, counters, dashboard and audit, with tests.
4. Seed script from the shared demo data; README setup.
5. Playwright against the real server; lint, tests and build; push and copy to your folder.

## 9. Decisions (logged in `docs/decision-log.md`)

- **D1-21:** UUID strings as `_id` instead of ObjectId (offline creation, D1-6).
- **D1-22:** One shared fictional dataset for demo mode and the seed script.
- **D1-23:** Atlas free tier recommended for development; local Community Server supported.
