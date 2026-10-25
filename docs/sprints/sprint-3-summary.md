# Sprint 3 summary

**Sprint:** 3, Working Offline and Syncing (planned 18 Nov – 1 Dec 2026)  
**Written:** 25 Oct 2026, when the build was finished and tested, ahead of the planned dates  
**Still to come:** Enock's review of the pull request into `main`, then a check on his PC and on a real tablet and phone

## What was delivered

All six Sprint 3 user stories, for Club Champions and Code Clubs Coordinators (D3-1):

| Story                      | Delivered                                                                                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-13 Work offline         | The app opens with no internet for a user who synced in the last 14 days; clubs, learners, consents, sessions and attendance are read from the device; the dashboard shows the last saved numbers with their date                   |
| US-14 Record offline       | Register, edit, mark as left or reactivate learners; consent with a signed form; guardian contacts; report or edit sessions; take attendance; add photos. Learner numbers say "Given after sync"; files show as waiting to upload   |
| US-15 Sync                 | Sync on start, when the connection comes back, when the app comes to the front, 1.5 s after a change, every 5 minutes and on "Sync now"; push then pull; retries at 5 s, 15 s, 1 min, 5 min; a sync status pill on every screen     |
| US-16 No duplicates/losses | Every change has an `opId` and the server stores its result, so sending twice saves once. Refused changes go to "Needs attention" on the new Sync page, where they can be fixed and retried, confirmed, or discarded                |
| US-17 Conflicts            | Field-level merge: the last write wins and the overwritten value is logged (sensitive values redacted); two offline sessions for the same club and date are joined; offline attendance is merged; coordinators and HQ see conflicts |
| US-18 Shared devices       | One local database per user, deleted on sign-out (with a warning if changes are unsent) and on start after 14 days without sync; guardian contacts, forms and photos leave the device once sent                                     |

Server: a new `/sync` module (`POST /sync/push`, `GET /sync/pull`, `GET /sync/conflicts`) that runs every change through the existing services, so the same validation, permissions, scope rules and audit entries apply. Client: Dexie (IndexedDB) storage, an outbox, the sync engine, the Sync page, all in English and Kiswahili. Demo mode simulates offline too. The full protocol is in [sync-protocol.md](../sync-protocol.md).

## Tests run

| Test                                         | Where                                                  | Result                         |
| -------------------------------------------- | ------------------------------------------------------ | ------------------------------ |
| Server unit and API tests (Jest + Supertest) | Cloud workspace, on a real MongoDB 7.0; GitHub Actions | 106 pass (19 new sync tests)   |
| Client tests (Vitest), incl. offline engine  | Cloud workspace; GitHub Actions                        | 42 pass (8 new offline tests)  |
| Browser flows on the demo build (Playwright) | Cloud workspace                                        | 6 pass, incl. the offline flow |
| Browser flows on the real API + MongoDB      | Cloud workspace (local MongoDB), 3 runs                | 6 pass                         |
| Lint, formatting, production build           | Cloud workspace; GitHub Actions                        | pass                           |

The sync tests on MongoDB cover: a repeated `opId` saved once, refused and skipped changes, every operation refused outside the user's scope, conflicts logged with sensitive values redacted, joined sessions, merged attendance, future device times refused, the 7-day window using device time, pull paging, tombstones and scope resets.

The new browser flow: a champion goes offline, reloads the app, registers a learner, reports a session and takes attendance, then comes back online and sees everything sync once, with a learner number from the server.

## Decisions and risks

D3-1 to D3-9 in `docs/decision-log.md`; R3-1 to R3-6 in `docs/risk-register.md`. Two changes from the plan:

- **D3-4:** the pull uses each record's `updatedAt` and ID as its cursor, with a 2-minute overlap, instead of a separate `syncSeq` counter. It needs no change to every write and cannot miss a record saved out of order.
- **D3-9:** attendance sent from a device is merged learner by learner and never removes other marks, so two people taking attendance offline both keep their marks.

## Open items carried forward

- Which tablets and phones champions use (R3-6). Chrome on Android and Windows laptops is assumed; the Sync page still needs a check on a real tablet and phone.
- A PIN to encrypt local data is a later option (R3-2).
- Atlas allows connections from any address for development only; restrict it before go-live.
- No real learner data until the Data Protection Act steps are done (R1-13, R2-1).

## Next

Sprint 4, as planned in Sprint 1: events and reports.
