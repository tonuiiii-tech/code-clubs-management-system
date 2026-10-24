# Sprint 3: Working Offline and Syncing

**Project:** STEAMLabs Africa Code Clubs Management System  
**Sprint duration:** 2 weeks (Tue 18 Nov – Mon 1 Dec 2026)  
**Status:** Plan, awaiting Enock's approval  
**Last updated:** 2026-10-24  
**Sprint goal:** A Club Champion can open the app at a venue with no internet, register learners, record consent, report a session and take attendance, and everything reaches the server safely the next time the device is online, without duplicates or lost changes.

## 1. Background

The questionnaire says internet at most club venues is "mostly none" (Q36). Sprints 1 and 2 are online-only (D1-5), so champions today write things down and enter them later. This is the biggest gap between the app and how clubs really work (R1-14).

Sprints 1 and 2 prepared for this:

- Every record has a UUID that a device can create (D1-6, D1-21), so a record made offline keeps its ID on the server.
- Pages call the API only through `client/src/services/` (coding principle 3), so offline storage goes in that layer and pages barely change.
- Records are never hard-deleted, except session photos, so changes can be replayed.
- Attendance and champion assignments are one record each (D1-15, D2-4), so two people working offline rarely touch the same record.

## 2. In scope

- A local database on the device (Dexie on IndexedDB) holding the user's own clubs, learners, consent status, sessions and attendance.
- An outbox: every change made on the device is saved locally first and queued for the server.
- A sync engine that pushes the outbox and pulls changes from the server when the device is online: on app start, when the connection comes back, every 5 minutes while online, and from a "Sync now" button.
- Server endpoints `POST /sync/push` and `GET /sync/pull` that reuse the existing services, so every validation, permission and audit rule from Sprints 1 and 2 still applies.
- Repeated pushes never create duplicates (idempotent operations).
- Conflict handling, plus a "Needs attention" list for changes the server refused.
- A sync status everyone can see: "Saved on this device · 3 changes waiting to sync", "All changes synced 2 minutes ago", "Offline".
- Signing in once online, then opening the app offline for up to 14 days.
- Protection of children's data on shared devices (section 7).
- Demo mode supports the same offline behaviour, and Playwright tests it by switching the browser offline.
- English and Kiswahili text for everything new.

## 3. Out of scope

- Offline use for System Administrators and Programme Managers. They work at HQ with internet and their national scope is too large to keep on a device (proposed D3-1).
- Creating or editing users, schools and clubs offline. These change rarely and are HQ tasks.
- Reading guardian contacts or downloading consent forms offline. They are never stored on the device.
- Encrypting the local database with a PIN (see question 3; candidate for a later sprint).
- Dashboard numbers offline. The dashboard shows the last synced numbers with their date.
- Native Android or iOS apps.

## 4. What works offline

| Task                             | Champion    | Coordinator | Notes                                                                            |
| -------------------------------- | ----------- | ----------- | -------------------------------------------------------------------------------- |
| Open the app and see their clubs | Yes         | Yes         | After signing in online within the last 14 days                                  |
| View learners and consent status | Yes         | Yes         | No guardian contacts, no consent forms                                           |
| Register a learner               | Yes         | Yes         | The learner number shows "Given after sync"; duplicate check runs on sync        |
| Edit a learner, mark as left     | Yes         | Yes         |                                                                                  |
| Enter a guardian contact         | Yes         | Yes         | Kept only in the outbox and deleted from the device once sent                    |
| Record consent status            | Yes         | Yes         |                                                                                  |
| Attach the signed consent form   | Yes         | Yes         | Kept only until uploaded, then deleted from the device                           |
| Plan or report a session         | Yes         | Yes         |                                                                                  |
| Take attendance                  | Yes         | Yes         |                                                                                  |
| Add session photos               | Yes         | Yes         | Shrunk on the device, kept only until uploaded; photo-consent check runs offline |
| Dashboard                        | Last synced | Last synced |                                                                                  |

## 5. How sync works (summary)

The full protocol goes in `docs/sync-protocol.md` during the sprint. In short:

### 5.1 Push

The device sends its outbox in order, in batches of up to 50 operations:

```json
{
  "operations": [
    {
      "opId": "uuid made on the device",
      "entity": "attendance",
      "action": "save",
      "recordId": "session uuid",
      "baseVersion": 12,
      "recordedAt": "2026-11-20T09:41:00Z",
      "data": { "...": "the same body the online endpoint takes" }
    }
  ]
}
```

- The server runs each operation through the same service function the online endpoint uses, so the same Zod schema, permission check, scope check and audit entry apply.
- Every `opId` is stored with its result in a `syncOperations` collection. If the same operation arrives again (a lost reply, a retry), the server returns the stored result and changes nothing. This is what stops duplicates.
- Each operation gets its own result: `applied`, `applied_with_conflict` or `rejected` with the usual error code (for example `POSSIBLE_DUPLICATE`, `CLUB_FULL`, `SESSION_LOCKED`).
- Files (consent forms, photos) are uploaded after the record they belong to, through the existing upload endpoints, and also carry an `opId`.

### 5.2 Pull

- Every write to a syncable record stamps it with `syncSeq`, a number from one counter that only goes up (a Mongoose plugin, so no service can forget).
- `GET /sync/pull?cursor=<last syncSeq>` returns everything in the user's scope with a higher `syncSeq`, in pages of 500, plus the new cursor.
- Removed session photos are sent as tombstones (`{entity, id, deleted: true}`).
- When a user's scope changes (a champion is assigned to or removed from a club), their `scopeVersion` goes up. The next pull answers "resync": the device wipes its local data, keeps unsent changes, and pulls again from zero. This is also how a device recovers if its cursor is lost or too old.

### 5.3 Conflicts

| Situation                                                      | What happens                                                                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Two people edit different fields of the same record            | Both changes kept (fields are merged).                                                                                             |
| Two people edit the same field                                 | The change that reaches the server last wins. The losing value is saved in `syncConflicts`, and coordinators and HQ can see it.    |
| Two people take attendance for the same session                | Merged per learner, because each mark is its own record (D2-4). Same learner: last write wins, logged.                             |
| Two people report a session for the same club and date offline | The second is joined to the first: its attendance and photos are added to the existing session, and it goes on "Needs attention".  |
| A learner registered offline looks like an existing one        | Rejected with `POSSIBLE_DUPLICATE`, shown on "Needs attention", where the champion confirms "different child" or discards it.      |
| The club is full by the time the learner reaches the server    | Rejected with `CLUB_FULL`, shown on "Needs attention".                                                                             |
| A champion edits a session offline on day 6 and syncs on day 9 | Accepted: the 7-day window is checked against when the change was made on the device (`recordedAt`), if it arrives within 14 days. |

`recordedAt` is the device's clock, so the server refuses times more than 5 minutes in the future, and records server time next to it in the audit log.

### 5.4 Device side

- One Dexie database per signed-in user: `clubs`, `schools`, `learners`, `consents` (status only), `sessions`, `attendance`, `outbox`, `pendingFiles`, `meta` (cursor, last sync, scope version).
- Champion and coordinator services read from Dexie and write to Dexie plus the outbox. Pages keep calling the same service functions.
- HQ roles keep calling the API directly, as today.
- The service worker caches the app itself only. API responses, consent forms and photos are never cached by it (R2-2).

## 6. Signing in offline

- The first sign-in on a device must be online.
- The access token stays short-lived. Offline, the app opens from the saved profile if the last online sign-in or sync was within 14 days. After 14 days it asks the user to go online and sign in again.
- When the device is back online, the refresh cookie gets a new access token before syncing. If the account was deactivated in the meantime, the server refuses the push and the app signs out (unsent changes are kept for 14 days so HQ can recover them if the deactivation was a mistake; see question 4).

## 7. Children's data on shared devices

Many clubs share one laptop or tablet. The rules:

- Only the user's own scope is stored: a champion's clubs, a coordinator's regions.
- Never stored on the device: guardian contacts (except an unsent one in the outbox), consent forms and photos after upload, accessibility notes for roles that cannot read them.
- Signing out deletes that user's local database. If there are unsent changes, the app warns first and offers "Sync now".
- Local data is deleted automatically after 14 days without a successful sync.
- Another user signing in on the same device gets their own empty database and cannot see the first user's data.

This makes R3-2 lower but does not remove it. A stolen, unlocked device could still show learner names. Question 3 asks whether to add a PIN later.

## 8. Server changes

- New module `server/src/modules/sync/` (routes, controller, service). It calls the learner and session services and does not touch the database directly.
- Mongoose plugin `syncSeq` on learners, consents, sessions, attendance, clubs, schools and champion assignments.
- New collections: `syncOperations` (opId, userId, result, kept 30 days), `syncConflicts`, `tombstones`.
- `scopeVersion` on users, increased when assignments or regions change.
- The existing online endpoints stay as they are.

## 9. Client changes

- `client/src/offline/`: Dexie database, outbox, sync engine, network status.
- Learner and session services switch to local-first for champions and coordinators.
- New components: sync status bar, "Sync now" button, "Needs attention" page.
- Learner pages show "Given after sync" for learner numbers not yet assigned.
- The mock API gains `/sync/push` and `/sync/pull` so demo mode behaves the same.

## 10. User stories

- **US-13 Work offline.** A champion who signed in online in the last 14 days can open the app with no internet and see their clubs, learners and sessions.
- **US-14 Record offline.** A champion can register a learner, record consent, report a session, take attendance and add photos offline. Each change says "Saved on this device".
- **US-15 Sync.** When the device is back online, changes reach the server without the user doing anything, and changes made by others appear on the device.
- **US-16 No duplicates or losses.** A change pushed twice is saved once. A change refused by the server is never silently dropped; it appears on "Needs attention".
- **US-17 Conflicts.** When two people change the same thing, the rules in 5.3 apply and coordinators can see what was overwritten.
- **US-18 Shared devices.** Signing out deletes local data; another user on the same device sees none of it.

## 11. Order of work

1. Write `docs/sync-protocol.md` in full (push, pull, conflicts, resync, errors).
2. Shared: sync operation schemas (Zod), entity list, conflict types.
3. Server: `syncSeq` plugin, `syncOperations`, `syncConflicts`, tombstones, `scopeVersion`, the sync module.
4. Server tests on real MongoDB: idempotent replay, every operation refused outside scope, conflict merging, duplicate session joining, resync after scope change, edit window with `recordedAt`.
5. Client: Dexie database, outbox, sync engine, local-first services, status bar, "Needs attention" page, i18n en/sw.
6. Client tests: outbox order, retries with back-off, sign-out wipe, 14-day expiry.
7. Mock API sync endpoints.
8. Playwright, on demo and on the real server: go offline → register learner → report session with attendance → go online → check the server has it once; then two browsers editing the same session.
9. Docs: architecture section 10, decision log D3-x, risk register R3-x, README.

## 12. Decisions to log once approved

- **D3-1** Offline is for Club Champions and Coordinators only; HQ roles stay online.
- **D3-2** Dexie, one local database per user, deleted on sign-out and after 14 days without sync.
- **D3-3** Push through the existing services with a device-made `opId`; results stored for idempotency.
- **D3-4** Pull by a single increasing `syncSeq` with tombstones; full resync when the user's scope changes.
- **D3-5** Field-level merge, last write wins per field, losing values logged in `syncConflicts`.
- **D3-6** Two offline sessions for the same club and date are joined, not rejected.
- **D3-7** The 7-day edit window is checked against `recordedAt` for changes that arrive within 14 days.
- **D3-8** Guardian contacts, consent forms and photos are kept on the device only until sent.

## 13. New risks

| ID   | Risk                                                                | Mitigation                                                                                                     |
| ---- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| R3-1 | Changes are lost (browser storage cleared, device lost before sync) | Sync as soon as there is a connection; visible count of unsent changes; ask the browser for persistent storage |
| R3-2 | Children's names are read from a shared or stolen device            | Section 7; PIN encryption as a later option                                                                    |
| R3-3 | A wrong device clock lets a champion edit a locked session          | Future times refused; server time recorded next to `recordedAt`; 14-day limit                                  |
| R3-4 | Sync bugs create duplicates or overwrite good data                  | Idempotent `opId`; conflict log; real-database tests for replay and conflicts; two-browser Playwright test     |
| R3-5 | Devices fill up with photos waiting to upload                       | Photos shrunk to about 300 KB; max 3 per session; warning when more than 20 files are waiting                  |
| R3-6 | Old devices or browsers lack IndexedDB or evict its data            | Check on start and fall back to online-only with a message; test on the tablets STEAMLabs uses (question 5)    |

## 14. Questions for Enock

My recommendation is listed first in each.

1. **Who works offline?** Champions and coordinators only (recommended), or every role?
2. **Photos and consent forms offline?** Yes, kept on the device only until uploaded (recommended), or online only?
3. **PIN to lock local data?** Not in Sprint 3, rely on sign-out wipe and 14-day expiry (recommended), or add a device PIN that encrypts local data now (about 3 extra days)?
4. **How long can a device stay offline?** 14 days (recommended), or another limit?
5. Which tablets and browsers do champions use? We will test on them.

## 15. Definition of Done

- [ ] All six user stories meet their criteria.
- [ ] A change pushed twice is saved once (tested on real MongoDB).
- [ ] Every sync operation is refused outside the user's scope (tested).
- [ ] No refused change is dropped silently; each appears on "Needs attention".
- [ ] Conflicts follow section 5.3 and are logged (tested).
- [ ] Signing out deletes local data; a second user sees none of it (tested).
- [ ] Guardian contacts, consent forms and photos are not on the device after they are sent (tested).
- [ ] The Playwright offline flow passes on the demo build and the real server.
- [ ] Sync status and "Needs attention" work on a tablet and a phone, in English and Kiswahili.
- [ ] `docs/sync-protocol.md`, architecture, decision log and risk register updated.
