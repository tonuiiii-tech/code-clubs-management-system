# Sprint 5: Equipment, Resources and Learner Progress

**Project:** STEAMLabs Africa Code Clubs Management System  
**Sprint duration:** 2 weeks (Tue 6 Jan – Mon 19 Jan 2027, after the school holidays)  
**Status:** Approved by Enock on 2026-10-26 with the recommended answers to section 15; built and in review (see `sprint-5-summary.md`)  
**Last updated:** 2026-10-26  
**Sprint goal:** HQ knows where every laptop and robotics kit is and what state it is in; champions have lesson plans on their device even without internet; and each learner's projects and scores are recorded, so HQ can show what learners actually learn.

## 1. Background

Sprints 1 to 4 cover who runs the clubs, who attends, and what HQ reports. The questionnaire ranked "curriculum and progress" and "equipment inventory" as v1 features, like the rest (Q49). Sprint 5 adds them, which completes the roadmap in `sprint-1.md`.

| Question | Answer                                                                                     | In this plan                                                  |
| -------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Q25      | Equipment: laptops and robotics kits                                                       | Equipment types (section 4)                                   |
| Q26      | Per item: name, type, serial number, condition, check-out and return dates, repair history | Items, check-outs and repairs (section 4)                     |
| Q22, Q27 | Raspberry Pi Foundation curriculum; store lesson plans, slides and videos for download     | Resource library with offline download (section 5)            |
| Q23      | Track projects submitted (link, file or photo) and assessment or quiz scores               | Learner projects and assessments (section 6)                  |
| Q24      | Automatic certificates: not done today, "a good addition"                                  | Question 5                                                    |
| Q36      | Internet at venues: mostly none                                                            | Resources, projects and scores work offline (section 7)       |
| Q43      | Learner data for STEAMLabs only                                                            | Scores and projects stay in scope; reports show averages only |

## 2. In scope

- **Equipment inventory:** items with type, serial number, asset tag and condition; where each item is (the HQ store or a club); check-out to a club and return, with due dates; a repair history.
- **Resource library:** lesson plans, slides, worksheets and videos by track and age, as uploaded files or links (for example to the Raspberry Pi Foundation's projects site). Champions save chosen resources to their device for offline use.
- **Learner progress:** projects a learner made (title, track, link, file or photo, date) and assessment scores (an assessment per club and date, a score per learner). A progress page per learner and a summary per club.
- **Reports and dashboard:** equipment counts by condition and region; projects and average scores per track in the termly report (counts and averages only, D4-3).
- **Offline:** champions read their club's equipment, report an item as damaged or lost, record projects and scores, and open saved resources, all without internet, through the Sprint 3 outbox.
- **Carried over from Sprint 4:** dismissing an alert for 7 days (R4-4); removing an event from devices when its club is uninvited (D4-8); a load test with 300 clubs and 9,000 learners (R4-6). Also from the check on Enock's PC: when the app goes offline before the dashboard, alerts or events have loaded once, show "No saved numbers yet: connect once" instead of a general error, and make the offline browser test wait for the numbers first. And the check on a real tablet and phone (R3-6), still open from Sprint 3.
- **Kiswahili review:** a list of every Kiswahili text in the app, grouped by screen, for a native speaker at STEAMLabs to check (question 6). Corrections are made in this sprint.
- English and Kiswahili for everything new, the same rules in demo mode, and audit entries for every change.

## 3. Out of scope

- Certificates (question 5).
- Before-and-after learner surveys (marked "nice to have" in the questionnaire).
- Buying, costs or depreciation of equipment (not asked for in Q26).
- Uploading video files: videos are links, to save data and storage (question 3).
- Quizzes taken by learners in the app: champions enter scores from paper or another tool.
- A parent or learner portal (unchanged from Sprint 4).
- The redesign in PR #4, which is paused.

## 4. Equipment

| Record             | Fields                                                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `equipmentItems`   | id, asset tag (e.g. `EQ-0042`, given by the server), name, type (laptop, tablet, robotics kit, micro:bit, Raspberry Pi, other), serial number, condition (working, needs repair, damaged, lost, retired), location (HQ store or club), region, notes |
| `equipmentLoans`   | itemId, clubId, out date, due date, returned date, condition when out and when returned, who checked it out and in                                                                                                                                   |
| `equipmentRepairs` | itemId, date, problem, action taken, cost (optional), condition after                                                                                                                                                                                |

Rules:

- An item is either in the HQ store or on loan to one club. A new loan needs the item to be in the store and not damaged, lost or retired.
- Kits can be lent as one item (for example "Robotics kit 3, 10 micro:bits") with a contents note, so HQ does not have to tag every part (question 2).
- Champions see the items their clubs hold and can report one as needing repair, damaged or lost, with a note. They cannot lend or return items.
- Alerts (Sprint 4) gain two rules: an item past its due date, and an item reported damaged or lost in the last 7 days.

## 5. Resource library

| Record      | Fields                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resources` | id, title, description, type (lesson plan, slides, worksheet, video, other), tracks, age band, language (en, sw), link or file (GridFS, up to 20 MB), status (draft, published), size |

- HQ adds and publishes resources. Links to the Raspberry Pi Foundation's projects are stored as links, not copied, which respects their licence (R5-2).
- Files: PDF, slides (PPTX, ODP), images, Scratch projects (`.sb3`) and ZIP. No video files (question 3).
- Everyone signed in can browse and search by track, type, age and language.
- **Save for offline:** a champion taps "Save on this device" on a file resource. The file is kept in the browser's storage beside the local database (D5-3), with a limit of 300 MB per device and the space used shown. Saved files are updated when HQ replaces them, and deleted on sign-out like the rest of the local data (D3-2).

## 6. Learner progress

| Record             | Fields                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `learnerProjects`  | id, learnerIds (one or more, same club), clubId, sessionId (optional), title, track, link, file or photo (one, up to 5 MB), date, note |
| `assessments`      | id, clubId, title, track, date, maximum score                                                                                          |
| `assessmentScores` | assessmentId, learnerId, score                                                                                                         |

- Champions record projects and assessments for their own clubs; coordinators and HQ see them in scope.
- A project photo with a learner in it needs photo consent (D2-7), as session photos do.
- **Learner progress page:** attendance rate, projects and scores for one learner, per term. Visible to the same roles as the learner record.
- **Club progress:** projects per track and the average score per assessment, for the champion and coordinator.
- **Termly report:** projects per track and average scores per track, never a learner's name or score (D4-3).
- Event projects (Sprint 4) appear on the learner's progress page too.

## 7. Offline

| Action                                          | Offline                                               |
| ----------------------------------------------- | ----------------------------------------------------- |
| See the club's equipment                        | Yes (pulled with the club)                            |
| Report an item damaged, lost, or needing repair | Yes, through the outbox                               |
| Lend or return an item                          | No (HQ, online)                                       |
| Browse the resource list                        | Yes (list pulled; files only if saved)                |
| Open a saved resource                           | Yes                                                   |
| Record a project, with a link or photo          | Yes, the photo waits to upload as in Sprint 3         |
| Record an assessment and scores                 | Yes, merged learner by learner like attendance (D3-9) |

## 8. Permissions

| Permission         | Admin | Programme Manager | Coordinator | Champion         |
| ------------------ | ----- | ----------------- | ----------- | ---------------- |
| `equipment:read`   | All   | All               | Assigned    | Own clubs' items |
| `equipment:manage` | All   | All               | Assigned    | No               |
| `equipment:report` | All   | All               | Assigned    | Own clubs' items |
| `resource:read`    | Yes   | Yes               | Yes         | Yes              |
| `resource:manage`  | Yes   | Yes               | No          | No               |
| `progress:read`    | All   | All               | Assigned    | Own clubs        |
| `progress:record`  | All   | All               | Assigned    | Own clubs        |

These follow the Sprint 1 policy style; the roles meeting (Q34) can still change them.

## 9. API

```
GET    /equipment                  POST /equipment     GET/PATCH /equipment/:id
POST   /equipment/:id/loans        PATCH /equipment/:id/loans/:loanId   (return)
POST   /equipment/:id/repairs      POST /equipment/:id/report           (champion: damaged, lost, needs repair)
GET    /resources                  POST /resources     GET/PATCH/DELETE /resources/:id
PUT    /resources/:id/file         GET  /resources/:id/file
GET    /learners/:id/progress
GET    /clubs/:id/progress
POST   /projects                   PATCH /projects/:id   DELETE /projects/:id
PUT    /projects/:id/file          GET  /projects/:id/file
POST   /assessments                PATCH /assessments/:id
PUT    /assessments/:id/scores
POST   /alerts/:key/dismiss
```

Sync pull adds `equipmentItems` (own clubs), `resources` (published, without files), `learnerProjects`, `assessments`, `assessmentScores`; push adds `equipment.report`, `project.save`, `assessment.save`, `assessment.scores`.

## 10. User stories

- **US-25 Equipment register.** HQ records each laptop, tablet and kit with its serial number and condition, and sees where every item is.
- **US-26 Lending.** HQ lends items to a club with a due date and records their return and condition; overdue items show as alerts.
- **US-27 Condition and repairs.** A champion reports an item as damaged or lost, also offline; HQ records repairs.
- **US-28 Resource library.** HQ publishes lesson plans, slides, worksheets and video links by track and age; champions find them and save files for offline use.
- **US-29 Projects.** A champion records a learner's project with a link, file or photo, also offline.
- **US-30 Assessments.** A champion records an assessment and each learner's score, also offline; the learner and club progress pages and the termly report show the results.

## 11. Server and client changes

**Shared:** enums (equipment types and conditions, resource types, file limits), Zod schemas, new permissions, error texts, alert rules, report fields, demo data.

**Server:** modules `equipment`, `resources`, `progress` (projects and assessments); GridFS buckets `resourceFiles` and `projectFiles`; sync pull and push additions; alert dismissals; report and dashboard additions.

**Client:** Equipment pages (list, item, lend and return, report); Resources (library, detail, save on device, storage used); learner progress tab; club progress tab; assessment entry screen like attendance; Dexie version 3 with the new tables and saved files; demo-mode API for all of it.

## 12. Order of work

1. Shared enums, schemas and permissions; demo data.
2. Equipment: server, tests, screens.
3. Resources: server and file storage, screens, save on device.
4. Projects and assessments: server, tests, screens; progress pages.
5. Offline: pull, push and outbox for the new records.
6. Reports, dashboard and alerts additions; carried-over items from Sprint 4.
7. Kiswahili review list, then corrections.
8. Playwright flows, docs, summary.

## 13. Decisions to log once approved

- **D5-1** An item is in the HQ store or lent to one club; kits are lent as one item with a contents note.
- **D5-2** Resources are files up to 20 MB or links; videos are links only.
- **D5-3** Saved resources are kept in the browser's storage, up to 300 MB per device, and deleted on sign-out.
- **D5-4** Links to Raspberry Pi Foundation material are stored as links, not copies.
- **D5-5** Projects and assessment scores are recorded offline through the outbox; scores merge learner by learner.
- **D5-6** Scores and projects are learner data: visible like the learner record, and only as averages and counts in reports.

## 14. New risks

| ID   | Risk                                                                          | Mitigation                                                                         |
| ---- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| R5-1 | Saved resources fill up champions' devices                                    | 300 MB limit, space used shown, saved files removable one by one, no video files   |
| R5-2 | Raspberry Pi Foundation material is re-hosted against its licence             | Links only for their material (D5-4); HQ confirms the licence of anything uploaded |
| R5-3 | Disputes over who lost or damaged an item                                     | Every loan, return and report records who, when and the condition; audit log       |
| R5-4 | Learner scores are seen by the wrong people or used to rank children publicly | Same scope as learner records; reports show averages only (D5-6); tested           |
| R5-5 | No one is available to review the Kiswahili                                   | Review list ready early in the sprint; Enock names a reviewer (question 6)         |
| R5-6 | Large files over a slow connection fail halfway                               | 20 MB limit; uploads retried by the outbox; progress shown                         |

## 15. Questions for Enock

My recommendation is listed first in each.

1. **Sprint size.** Everything above in one sprint (recommended, as the roadmap planned), or equipment and progress now and the resource library in Sprint 6?
2. **Kits.** Lend a kit as one item with a contents note (recommended, less work for HQ), or tag every part (each micro:bit, each laptop charger)?
3. **Videos.** Links only, for example to YouTube or the Raspberry Pi Foundation site (recommended, saves storage and data), or uploaded video files?
4. **Offline progress.** Projects and scores recorded offline (recommended, because venues mostly have no internet), or online only to save about 2 days?
5. **Certificates (Q24).** A later sprint (recommended, so this sprint stays two weeks), or a simple participation certificate PDF per learner at the end of each term in this sprint (about 2 extra days, and it prints the learner's name)?
6. **Kiswahili reviewer.** Who at STEAMLabs can check the Kiswahili, and by when?

## 16. Definition of Done

- [ ] All six user stories meet their criteria, in English and Kiswahili.
- [ ] Every new endpoint checks permission and scope (tested on MongoDB).
- [ ] Lending refuses items that are on loan, damaged, lost or retired (tested).
- [ ] Saved resources open with no internet and are deleted on sign-out (tested).
- [ ] Projects and scores recorded offline sync once, with no duplicates (tested).
- [ ] Reports hold no learner names or individual scores (tested).
- [ ] Playwright flows for lending an item, saving a resource offline, and recording an assessment pass on the demo build and the real server.
- [ ] Kiswahili review list delivered and corrections made.
- [ ] Architecture, decision log, risk register and end-of-sprint summary updated.
