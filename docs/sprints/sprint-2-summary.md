# Sprint 2 summary

**Sprint:** 2, Learners, Consent, Sessions and Attendance (planned 4 – 17 Nov 2026)  
**Written:** 23 Oct 2026, when the build was finished and tested, ahead of the planned dates  
**Still to come:** Enock's review of the pull request into `main`, then a walkthrough on his PC

## What was delivered

All six Sprint 2 user stories, online, on MongoDB:

| Story                   | Delivered                                                                                                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-07 Register learners | Name, age (stored as year of birth), gender, grade, admission number (required at school clubs, unique per school), optional accessibility needs; learner numbers like `NAC-001-007`; duplicate warning; club capacity enforced; mark as left |
| US-08 Guardian contacts | Stored apart; champions and coordinators can enter or replace them but never read them; only HQ can open them, and every opening is audited                                                                                                   |
| US-09 Consent           | Participation and photo consent recorded separately, with the signed form (JPG, PNG or PDF, max 5 MB, checked by content); only HQ and the region's coordinator can download it; missing consent is flagged                                   |
| US-10 Sessions          | Topic, notes or challenges, times (default: the club's), planned or cancelled sessions; up to 3 photos shrunk on the device, with a photo-consent check; champions can change a report for 7 days                                             |
| US-11 Attendance        | One tablet-first list of the club's learners with Present, Absent, Late, Excused and an "All present" button, saved in one step                                                                                                               |
| US-12 Dashboard         | Active learners (girls and boys as totals), sessions this month, attendance rate, learners without participation consent, inside each user's scope                                                                                            |

Also: every new screen in English and Kiswahili, the same rules in demo mode, fictional learners in the seed and demo data, and the audit log for every change.

## Tests run

| Test                                         | Where                                                      | Result                         |
| -------------------------------------------- | ---------------------------------------------------------- | ------------------------------ |
| Server unit and API tests (Jest + Supertest) | Cloud workspace, on a real MongoDB 7.0; GitHub Actions     | 83 pass, 49 of them on MongoDB |
| Client tests (Vitest), incl. demo mock rules | Cloud workspace; GitHub Actions                            | 34 pass                        |
| Browser flows on the demo build (Playwright) | Cloud workspace                                            | 5 pass                         |
| Browser flows on the real API + MongoDB      | Cloud workspace (local MongoDB); GitHub Actions `e2e-real` | 5 pass                         |
| Lint, formatting, production build           | Cloud workspace; GitHub Actions                            | pass                           |

The new browser flow: a champion registers a learner with a guardian contact, records consent with a signed form, reports a session, takes attendance and adds a photo after the photo-consent check.

## Decisions and risks

D2-1 to D2-9 in `docs/decision-log.md`; R2-1 to R2-7 in `docs/risk-register.md`. One change from the plan: consent is recorded per type (`/learners/:id/consents/:type`), so participation and photo consent each have their own status and form.

## Open items carried forward

- Questions for STEAMLabs in `sprint-2.md` section 13: confirm the learner fields, a copy of the blank consent form, whether learners without participation consent may attend, how often consent is renewed, how long to keep records after a learner leaves.
- No real learner data until the Data Protection Act steps are done (R1-13, R2-1).
- Still no audit log screen (the API exists).

## Next

Sprint 3: offline use and sync, building on the UUIDs and the services layer.
