# Sprint 4 summary

**Sprint:** 4, HQ Dashboard, Reports, Events and Announcements (planned 2 – 15 Dec 2026)  
**Written:** 25 Oct 2026, when the build was finished and tested, ahead of the planned dates  
**Still to come:** Enock's review of the pull request into `main`, then a check on his PC and on a real tablet and phone

## What was delivered

All six Sprint 4 user stories, built in one sprint with the recommended answers Enock approved:

| Story                        | Delivered                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| US-19 HQ dashboard           | For HQ (national) and coordinators (their regions): term and region filters, summary numbers, attendance trend per week, sessions held against planned per region, upcoming events. Charts have a table alongside (D4-1) |
| US-20 Alerts                 | No recent session, low attendance, missing consent, near capacity and missing event consent, grouped per club and linked to it, in each user's scope; computed on request (D4-2)                                         |
| US-21 Termly report          | Report page and server-made PDF for the programme, a region or a club; counts only, small groups as "<5" (D4-3, D4-4). The day after a term ends it is emailed once to the recipients kept under Settings (D4-5)         |
| US-22 Events                 | HQ or coordinators create events and invite clubs; champions register learners within capacity and the closing date; event consent with a signed form (D4-6); attendance, projects, awards and up to 10 photos           |
| US-23 Announcements          | Sent to chosen roles, regions and clubs with a preview of how many it reaches; a bell with the unread count; read marks, also offline; senders see how many read it (D4-7, D4-8)                                         |
| US-24 SMS and WhatsApp ready | Announcements can also go by SMS and WhatsApp through provider stubs that record every message and send nothing; HQ sees them under Settings                                                                             |

Also new: school terms (HQ enters them), a Settings page for report recipients and the message outbox, and everything in English and Kiswahili. Demo mode (the Vercel build) has all of it with fictional data.

## Tests run

| Test                                         | Where                                                  | Result                                         |
| -------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| Server unit and API tests (Jest + Supertest) | Cloud workspace, on a real MongoDB 7.0; GitHub Actions | 127 pass (20 new Sprint 4 tests + permissions) |
| Client tests (Vitest), incl. demo-mode API   | Cloud workspace; GitHub Actions                        | 46 pass (4 new)                                |
| Browser flows on the demo build (Playwright) | Cloud workspace                                        | 8 pass, incl. new event and announcement flows |
| Browser flows on the real API + MongoDB      | Cloud workspace (local MongoDB)                        | 8 pass                                         |
| Lint, formatting, production build           | Cloud workspace; GitHub Actions                        | pass                                           |

The Sprint 4 tests on MongoDB cover: every new endpoint refused outside the user's role and scope, the report holding no learner names and hiding small groups, the PDF download, the termly email sent once even when two servers run at once, event registration rules (invitation, capacity, closing date, status), event consent apart from club consent, the photo-consent check, announcements reaching exactly the chosen audience, read marks counted once, and sync pulling events and announcements without other people's recipient lists.

The sample PDF was rendered and checked by eye.

## Decisions and risks

D4-1 to D4-8 in `docs/decision-log.md`; R4-1 to R4-6 in `docs/risk-register.md`. Changes from the plan:

- **Results** (award and rank) are stored on the event's projects, not in a separate `eventResults` collection (D4-6).
- **Events and announcements** are read from the server first, with the device copy used when offline (D4-8), instead of always reading from the device.
- **Dismissing an alert for 7 days** (R4-4) is not built yet; alerts are grouped per club instead.

## Open items

- If a club is removed from an event's invitations, that event stays on the club's devices until the local database is reset (D4-8).
- Load test with 300 clubs and 9,000 learners (R4-6).
- Choose the email, SMS and WhatsApp providers and the report recipients (Q51).
- Still from Sprint 3: check on a real tablet and phone (R3-6).
