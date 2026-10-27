# Sprint 5 summary

**Sprint:** 5, Equipment, Resources and Learner Progress (planned 6 – 19 Jan 2027)  
**Written:** 26 Oct 2026, when the build was finished and tested, ahead of the planned dates  
**Still to come:** Enock's review of the pull request into `main`, a check on his PC, the Kiswahili review, and a check on a real tablet and phone

## What was delivered

All six Sprint 5 user stories, built in one sprint with the recommended answers Enock approved (one sprint; kits as one item; videos as links; projects and scores offline; certificates later):

| Story                          | Delivered                                                                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| US-25 Equipment register       | Laptops, tablets, robotics kits, micro:bits and Raspberry Pis with asset tag, serial number, condition and contents; filters by type, condition and where each item is (D5-1)                                                        |
| US-26 Lending                  | HQ and coordinators lend an item from the store to a club with a due date and record its return and condition; an item cannot be lent twice or while damaged, lost or retired; overdue items raise an alert                          |
| US-27 Condition and repairs    | Champions report an item as needing repair, damaged or lost, also offline; HQ records repairs and the condition after; reports in the last 7 days raise an alert                                                                     |
| US-28 Resource library         | HQ adds lesson plans, slides, worksheets and video links by track, age and language, as drafts or published; files up to 20 MB checked by content (D5-2); champions save files on their device and open them with no internet (D5-3) |
| US-29 Projects                 | Champions record projects for one or more learners with a link and a photo or file, also offline; photos of learners without photo consent need confirmation (D2-7)                                                                  |
| US-30 Assessments and progress | Assessments with a maximum score and scores entered per learner like attendance, also offline (D5-5); a progress card on each learner (attendance, projects, results) and club; projects and average scores per track in the report  |

Also delivered from the Sprint 4 carry-over list:

- **Hide an alert for 7 days**, per person (R4-4).
- **Events leave the device** when their club is uninvited: every pull now says which records the device may keep (D5-8).
- **Offline before the numbers have loaded** now says "No saved copy yet" with a hint to connect once, instead of an error. The offline browser test waits for the numbers to load before going offline (the failure seen on Enock's PC).
- **Load test** with 300 clubs and 9,000 learners (below).
- **Kiswahili review list**: `docs/kiswahili-review.md`, all 967 texts beside the English, grouped by screen.

The HQ dashboard has an equipment panel, and the termly report and its PDF have "Projects and assessments" and "Equipment" sections. Everything new is in English and Kiswahili and works in demo mode with fictional data. The seed now stores a real one-page PDF for the Kiswahili worksheet, so saving a file for offline use can be tried straight away.

## Tests run

| Test                                               | Where                                                  | Result                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Server unit and API tests (Jest + Supertest)       | Cloud workspace, on a real MongoDB 7.0; GitHub Actions | 143 pass (16 new: Sprint 5 on MongoDB and the permission table)                               |
| Client tests (Vitest), incl. demo-mode API         | Cloud workspace; GitHub Actions                        | 56 pass (9 new: demo-mode rules and the device side of sync)                                  |
| Browser flows on the demo build (Playwright)       | Cloud workspace                                        | 11 pass, incl. 3 new: lend an item, save a resource and open it offline, record an assessment |
| Browser flows on the real API + MongoDB            | Cloud workspace (local MongoDB)                        | 11 pass                                                                                       |
| Load test (`npm run load-test --workspace server`) | Cloud workspace (local MongoDB)                        | Every request under 0.7 s (table below)                                                       |
| Lint, formatting, production build                 | Cloud workspace; GitHub Actions                        | pass                                                                                          |

The Sprint 5 tests on MongoDB cover: what each role sees and may change for equipment, resources, projects and assessments, including 404 outside scope and 403 for read-only users; two people lending the same item at the same moment (one loan, one refusal); returns and repairs setting the condition; drafts hidden from champions; a file whose content does not match its name refused, and files over 20 MB refused; videos as links only; project members from one club only; the photo-consent question for project photos; scores above the maximum refused and scores merged learner by learner; the learner and club progress pages; equipment alerts and hiding an alert for one person only; the report holding no names or individual scores; sync pulling only the records in scope, applying offline changes once when sent twice, and dropping an uninvited event.

### Load test

Demo data plus 300 clubs, 9,000 learners, 3,000 sessions and 90,000 attendance marks, 600 items, and a project and an assessment per club. Median of 3 runs on a local MongoDB 7.0; Atlas adds its network time to each.

| Request                                    | Median (ms) | Slowest (ms) | Response (KB) |
| ------------------------------------------ | ----------- | ------------ | ------------- |
| HQ dashboard (national)                    | 338         | 424          | 2             |
| Alerts (national)                          | 526         | 529          | 67            |
| Termly report (national)                   | 484         | 487          | 47            |
| Termly report PDF (national)               | 622         | 661          | 20            |
| Learners list, page 1                      | 16          | 22           | 35            |
| Coordinator dashboard (one region)         | 94          | 99           | 2             |
| Coordinator sync pull, first page (region) | 102         | 120          | 1,233         |

No change was needed. A coordinator's first sync on a slow connection downloads about 1.2 MB per page; later pulls send only changes.

## Decisions and risks

D5-1 to D5-8 in `docs/decision-log.md`; R5-1 to R5-6 in `docs/risk-register.md`; R4-4 and R4-6 updated. Changes from the plan:

- **API paths** (D5-7): projects, assessments and progress pages are under `/progress`; a return is `POST /equipment/:id/return`; hiding an alert is `POST /alerts/dismissals`.
- **Word and ODT files** are allowed for worksheets, as well as the planned types (D5-2).
- **Equipment and resources** are read from the server first and from the device when offline, like events (D5-8).
- **Offline project and score changes** are not checked for conflicts: the later save wins (D5-5).

## Open items

- A Kiswahili reviewer at STEAMLabs (question 6) to go through `docs/kiswahili-review.md`; corrections follow.
- Still from Sprint 3: a check on a real tablet and phone (R3-6).
- Repeat the load test against Atlas before the pilot (R4-6).
- Certificates (Q24) in a later sprint.
