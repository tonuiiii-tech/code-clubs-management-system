# Sprint 1 summary

**Sprint:** 1, Foundation, Access Control, Schools, and Clubs (21 Oct – 3 Nov 2026)  
**Written:** 23 Oct 2026, after the Definition of Done was met  
**Still to come:** the stakeholder demo before 3 Nov

## What was delivered

All six Sprint 1 user stories, online, on MongoDB Atlas:

| Story                     | Delivered                                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-01 Authentication      | Email and password sign-in, 15-minute access token, rotating refresh cookie with reuse detection, lockout after 5 wrong passwords, rate limit on failed sign-ins |
| US-02 Roles and scope     | Four roles; every endpoint checks permission and scope on the server; records outside a user's scope look like missing pages (404)                               |
| US-03 User administration | Create users with a temporary password, edit, activate and deactivate (ends their sessions at once), change own password                                         |
| US-04 Schools             | Create, edit, deactivate; duplicate names in the same sub-county refused; coordinators limited to their regions                                                  |
| US-05 Clubs               | Create under a school with an automatic code per region (e.g. `NAC-004`), schedule check, assign and end champion assignments with history                       |
| US-06 Dashboard           | Counts inside each user's scope; navigation follows the role                                                                                                     |

Also: English and Kiswahili for every screen and every server error, the STEAMLabs UI kit, an installable PWA shell, a demo mode that needs no database, a password show/hide button, and the audit log for every sensitive change.

## Tests run

| Test                                         | Where                                                                           | Result                         |
| -------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------ |
| Server unit and API tests (Jest + Supertest) | GitHub Actions, on a real in-memory MongoDB                                     | 57 pass, 23 of them on MongoDB |
| Client tests (Vitest)                        | GitHub Actions and the cloud workspace                                          | 26 pass                        |
| Browser flows on the demo build (Playwright) | Cloud workspace                                                                 | 4 pass                         |
| Browser flows on the real API + MongoDB      | GitHub Actions, every push (new job `e2e-real`)                                 | 4 pass                         |
| Manual walkthrough on Enock's PC, real Atlas | 23 Oct: each role, school → club → champion, deactivation, audit log, Kiswahili | 30 checks pass                 |
| Lint, formatting, production build           | GitHub Actions, every push                                                      | pass                           |

## Found and fixed during the sprint's checks

- **A coordinator could move a school to another region** on the real server (the demo mock already refused it). Fixed and tested; this is exactly the drift R1-19 warned about.
- **Server errors stayed in English** in Kiswahili mode. Error texts now live in one shared list used by the server and the mock, and the app shows them in the user's language.
- **Successful sign-ins counted towards the rate limit**, so signing in and out 5 times locked a shared tablet for 15 minutes. Only failed attempts count now.
- **The demo mock used different error codes** from the server (`BAD_REQUEST`, `UNAUTHORIZED`). They now match.
- **The server restarted by itself on Windows** whenever files in `node_modules` changed. It now watches only our own code.
- **Setup problems on Windows** (old `.env` names, short secrets, wrong port, Atlas IP list) are now covered in the README's "If something goes wrong" table.

## Decisions taken this sprint

D1-1 to D1-23 in `docs/decision-log.md`, including MongoDB with Mongoose (D1-8), UUID ids for offline creation (D1-21), one shared fictional dataset for demo and seed (D1-22) and Atlas for development (D1-23).

## Open items carried forward

- Questions for STEAMLabs in `sprint-1.md` section 10, mainly the roles and permissions meeting (questionnaire Q34) and the region of online clubs.
- Atlas allows `0.0.0.0/0` for development; remove it before going live.
- Test records left in Atlas by the walkthrough ("Walkthrough Test …", inactive or closed); harmless, can be deleted.
- No audit log screen yet (the API exists); a candidate for Sprint 2 or 4.

## Next

Sprint 2 (4 – 17 Nov): learners, consent, sessions and attendance, as planned in `sprint-2.md`.
