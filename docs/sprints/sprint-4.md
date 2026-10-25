# Sprint 4: HQ Dashboard, Reports, Events and Announcements

**Project:** STEAMLabs Africa Code Clubs Management System  
**Sprint duration:** 2 weeks (Tue 2 Dec – Mon 15 Dec 2026)  
**Status:** Approved by Enock on 2026-10-25 with the recommended answers to section 15; built and in review (see the [summary](sprint-4-summary.md))  
**Last updated:** 2026-10-25  
**Sprint goal:** STEAMLabs HQ can see at a glance which clubs need help, send a termly PDF report to funders, run events with the right consent, and reach champions with one announcement instead of many WhatsApp messages.

## 1. Background

The Head of Code Clubs named the biggest frustration: "constant communication about different events is confusing; hard to keep track of what each club is doing at a given time" (Q47). Sprints 1 to 3 give HQ the records: clubs, learners, sessions and attendance, also from venues without internet. Sprint 4 turns those records into answers and replaces the WhatsApp threads.

What the questionnaire asks for:

| Question | Answer                                                                                               | In this plan                                                      |
| -------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Q28–Q29  | All event types; record name, date, venue, clubs, learners, projects, results, photos, consent forms | Events module (section 6)                                         |
| Q30      | Learners or parents can register for events through the system                                       | Champions register their learners; a parent portal is question 2  |
| Q31–Q32  | Reports as PDF and emailed automatically                                                             | Termly PDF report, scheduled email (section 5)                    |
| Q37      | SMS, WhatsApp and in-app announcements                                                               | In-app announcements; SMS and WhatsApp through a stub (section 7) |
| Q47      | Hard to track what each club is doing                                                                | HQ dashboard and alerts (section 4)                               |
| Q9       | Clubs follow the school term calendar                                                                | Terms set by HQ, used by reports and the dashboard                |
| Q43      | Learner contacts are for STEAMLabs only                                                              | Reports and announcements never contain learner names or contacts |

## 2. In scope

- **HQ dashboard:** trends and comparisons across regions and tracks, filtered by term and region, in the user's scope.
- **Alerts:** a list of clubs that need attention (section 4.2), computed from the records, with a link to each club.
- **School terms:** HQ sets the term dates once a year; reports and the dashboard use them.
- **Termly PDF report:** for the whole programme, a region, or one club, made on the server and downloaded from the app.
- **Scheduled email:** at the end of each term the report is emailed to a list HQ keeps. Email goes through a provider interface with a stub that records the message instead of sending it, until STEAMLabs chooses a provider.
- **Events:** create and manage hackathons, showcases, competitions and camps; invite clubs; champions register their learners; event consent per learner with the signed form; projects presented; results and awards; photos with the same consent check as sessions.
- **Announcements:** HQ and coordinators send a message to roles, regions or clubs. It shows in the app with a "new" badge and a read count. SMS and WhatsApp copies go through a provider interface with a stub.
- **Offline:** events and announcements are pulled to champions' and coordinators' devices and readable offline; marking an announcement as read works offline.
- English and Kiswahili for everything new, the same rules in demo mode, and audit entries for every change.

## 3. Out of scope

- A parent or learner portal, and messages to guardians (question 2).
- Sending real SMS, WhatsApp or email. The stubs make the switch a configuration change once STEAMLabs picks providers and a budget (Q51).
- Registering learners for events or creating events offline (question 4).
- Excel or CSV export (not asked for in Q32).
- Equipment, resources, progress tracking and certificates (Sprint 5 and later).
- The redesign in PR #4, which is paused.

## 4. HQ dashboard and alerts

### 4.1 Dashboard

The existing dashboard keeps its counts. New, below them, for Programme Managers and System Administrators (national) and Coordinators (their regions):

| Panel                        | Shows                                                         |
| ---------------------------- | ------------------------------------------------------------- |
| Attendance trend             | Attendance rate per week for the selected term                |
| Sessions per region          | Sessions held this term, per region, against sessions planned |
| Learners by gender and track | Active learners, girls and boys, per track                    |
| Clubs by status              | Active, paused, closed                                        |
| Upcoming events              | The next five events in scope                                 |

Filters: term (default: the current one) and region. Charts are small SVG components built on the kit's colours, with the numbers also shown as a table for screen readers. No chart library (proposed D4-1).

Champions keep the Sprint 2 dashboard for their own clubs, plus upcoming events and new announcements.

### 4.2 Alerts

Rules, checked when the dashboard loads (nothing stored, so they are never out of date):

| Alert                 | Rule (proposed; question 3)                                               |
| --------------------- | ------------------------------------------------------------------------- |
| No recent session     | An active club has no held session in the last 14 days during a term      |
| Low attendance        | Attendance below 60% over the club's last 4 held sessions                 |
| Missing consent       | Active learners without participation consent                             |
| Near capacity         | 28 or more active learners (capacity is 30, Q8)                           |
| Event consent missing | A learner registered for an event in the next 7 days has no event consent |

Each alert names the club and links to it. Coordinators see alerts for their regions, champions for their own clubs.

## 5. Terms and the termly report

- **Terms:** `terms` collection with year, number (1–3), start and end dates. HQ enters them; the app suggests the usual Kenyan school terms.
- **Report contents:** cover page with the STEAMLabs logo; summary numbers; clubs per region and track; learners by gender and age band; sessions held and attendance rate per region; events held and participants; a per-club table (sessions, attendance rate, active learners). Counts only: no learner names, no contacts, no photos (proposed D4-3).
- **How it is made:** on the server with `pdfkit` (plain JavaScript, no browser needed), streamed as a download from `GET /reports/termly.pdf?termId=&region=&clubId=`. Scope rules decide what a user may ask for.
- **Scheduled email:** each day the server checks whether a term ended yesterday. If so, it builds the national report and one per region, and sends them to the recipients HQ keeps under Settings. Sending goes through `EmailProvider`; the stub stores each message in `outboundMessages` so it can be seen and tested. A lock in MongoDB stops two servers sending twice.

## 6. Events

| Record              | Fields                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events`            | id, name, type (hackathon, showcase, competition, camp), start and end dates, venue, region or national, description, capacity, registration closes, status (planned, open, closed, held, cancelled) |
| `eventClubs`        | eventId, clubId: which clubs are invited                                                                                                                                                             |
| `eventParticipants` | eventId, learnerId, clubId, status (registered, attended, absent, withdrawn)                                                                                                                         |
| `eventConsents`     | eventId, learnerId, status, signedOn, file: one per learner per event, same rules as Sprint 2 consent                                                                                                |
| `eventProjects`     | eventId, title, description, link, learnerIds, clubId                                                                                                                                                |
| `eventResults`      | eventId, projectId or learnerId, award or rank                                                                                                                                                       |
| Event photos        | Up to 10 per event, with the Sprint 2 photo-consent check (D2-7)                                                                                                                                     |

Flow:

1. HQ or a coordinator creates an event and invites clubs (all clubs in a region, or chosen clubs).
2. Champions of invited clubs see it, and register learners until registration closes or the event is full.
3. Each registered learner needs event consent. The signed form can be attached as in Sprint 2. Learners without it are flagged on the event and in alerts.
4. On the day, attendance is marked per participant, projects and results are recorded, and photos are added.
5. Event numbers feed the termly report.

## 7. Announcements

- **Writing:** title, message (plain text, up to 1,000 characters), audience (roles, regions, clubs), optional "also send by SMS" and "also send by WhatsApp".
- **Reading:** a bell with a count in the top bar, an Announcements page, newest first. Opening one marks it as read; senders see how many have read it.
- **SMS and WhatsApp:** `MessageProvider` interface. The stub records each message and recipient in `outboundMessages` and sends nothing. Recipients are app users only (champions, coordinators), using the phone number on their account. Never guardians.
- **Offline:** announcements for the user are pulled with the other records, and "read" marks go through the Sprint 3 outbox.

## 8. Permissions

| Permission                | Admin | Programme Manager | Coordinator | Champion      |
| ------------------------- | ----- | ----------------- | ----------- | ------------- |
| `dashboard:hq`            | All   | All               | Assigned    | No            |
| `report:read`             | All   | All               | Assigned    | No            |
| `report:schedule`         | Yes   | Yes               | No          | No            |
| `term:manage`             | Yes   | Yes               | No          | No            |
| `event:manage`            | All   | All               | Assigned    | No            |
| `event:read`              | All   | All               | Assigned    | Invited clubs |
| `eventParticipant:manage` | All   | All               | Assigned    | Own clubs     |
| `announcement:send`       | All   | All               | Assigned    | No            |
| `announcement:read`       | Yes   | Yes               | Yes         | Yes           |

These follow the Sprint 1 policy style; the roles meeting (Q34) can still change them.

## 9. API

```
GET    /dashboard/hq?termId=&region=
GET    /alerts?region=&clubId=
GET    /terms                      POST /terms         PATCH /terms/:id
GET    /reports/termly.pdf?termId=&region=&clubId=
GET    /reports/recipients         PUT  /reports/recipients
GET    /events                     POST /events        GET/PATCH /events/:id
PUT    /events/:id/clubs
GET    /events/:id/participants    POST /events/:id/participants   PATCH /events/:id/participants/:learnerId
PUT    /events/:id/consents/:learnerId           PUT /events/:id/consents/:learnerId/file
POST   /events/:id/projects        PATCH /events/:id/projects/:projectId
PUT    /events/:id/results
POST   /events/:id/photos          DELETE /events/:id/photos/:photoId
GET    /announcements              POST /announcements GET /announcements/:id
POST   /announcements/:id/read
```

Sync pull adds `events`, `eventParticipants` (own clubs), `announcements` and `announcementReads`; push adds `announcement.read`.

## 10. User stories

- **US-19 HQ dashboard.** A Programme Manager sees attendance trends, sessions per region and learners by gender and track for a term, filtered by region.
- **US-20 Alerts.** HQ and coordinators see which clubs need attention and why, and open the club from the alert.
- **US-21 Termly report.** A Programme Manager downloads a termly PDF for the programme, a region or a club; at the end of each term it is emailed to the saved recipients.
- **US-22 Events.** HQ creates an event and invites clubs; champions register learners with event consent; results, projects and photos are recorded.
- **US-23 Announcements.** HQ or a coordinator sends an announcement to chosen roles, regions or clubs; recipients see it in the app, also offline, and the sender sees how many read it.
- **US-24 SMS and WhatsApp ready.** Announcements can be queued for SMS and WhatsApp; with the stub nothing is sent, and every message is visible for checking.

## 11. Server and client changes

**Shared:** enums (event types and statuses, term numbers, alert types), Zod schemas for every new body, new permissions, error texts.

**Server:** modules `terms`, `alerts`, `reports`, `events`, `announcements`, `notifications` (providers and stubs); `dashboard` gains the HQ summary; `sync` pulls the new records; daily scheduler with a MongoDB lock; `pdfkit` dependency.

**Client:** dashboard panels and alert list; Terms and Report recipients under a new Settings page; Reports page; Events list, detail, form and registration; Announcements page, composer and top-bar bell; offline tables for events and announcements; mock API for everything new.

## 12. Order of work

1. Plan approved; decisions logged.
2. Shared: enums, schemas, permissions.
3. Terms, alerts and the HQ dashboard (server, then client).
4. Reports: PDF, recipients, scheduler and the email stub.
5. Events: records, registration, consent, projects, results, photos.
6. Announcements: in-app, read marks, SMS and WhatsApp stubs.
7. Offline: pull events and announcements, read marks in the outbox.
8. Demo mode, Kiswahili, Playwright flows, docs, end-of-sprint summary.

## 13. Decisions to log once approved

- **D4-1** Charts are small SVG components on kit colours, with a table alongside; no chart library.
- **D4-2** Alerts are computed when asked for, not stored.
- **D4-3** Reports hold counts only: no learner names, contacts or photos.
- **D4-4** PDFs are made on the server with `pdfkit`.
- **D4-5** Email, SMS and WhatsApp go through provider interfaces; stubs record messages until real providers are chosen.
- **D4-6** Event consent is separate from club consent, one per learner per event.
- **D4-7** Announcements go to app users only, never to guardians.
- **D4-8** Events and announcements are readable offline; event changes need a connection.

## 14. New risks

| ID   | Risk                                               | Mitigation                                                                                |
| ---- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| R4-1 | A report leaks children's personal data to funders | Counts only (D4-3); groups under 5 learners shown as "fewer than 5"; tested               |
| R4-2 | Scheduled email sends twice, or not at all         | MongoDB lock and a sent log per term; the stub lets it be tested before a provider exists |
| R4-3 | SMS costs grow without control                     | Stub until a budget is set (Q51); a per-announcement recipient count shown before sending |
| R4-4 | Alerts are noisy and get ignored                   | Rules agreed with HQ (question 3); each alert can be dismissed for 7 days                 |
| R4-5 | Event photos published without consent             | Same photo-consent check as sessions (D2-7), plus event consent                           |
| R4-6 | Dashboard queries slow down as data grows          | Aggregations on indexed fields; tested with 300 clubs and 9,000 learners of demo data     |

## 15. Questions for Enock

My recommendation is listed first in each.

1. **Sprint size.** Everything above in one sprint (recommended, as the roadmap planned), or split: dashboard, alerts and reports now, events and announcements in Sprint 5?
2. **Parents registering for events (Q30).** Champions register their learners, with no parent accounts (recommended, because guardian data stays with HQ), or a simple parent sign-up page later?
3. **Alert rules.** The thresholds in section 4.2 (recommended), or other numbers from the Head of Code Clubs?
4. **Events offline.** Read-only offline (recommended), or also registering learners and marking event attendance offline (about 2 extra days)?
5. **Report recipients and email provider.** Who gets the termly email, and which provider later? A stub is fine for this sprint either way.

## 16. Definition of Done

- [ ] All six user stories meet their criteria, in English and Kiswahili.
- [ ] Every new endpoint checks permission and scope (tested on MongoDB).
- [ ] The termly PDF holds no learner names or contacts (tested).
- [ ] The scheduled report is sent once per term even with two servers (tested).
- [ ] Event registration enforces invitation, capacity, closing date and consent flags (tested).
- [ ] Announcements reach exactly the chosen audience and are readable offline (tested).
- [ ] SMS, WhatsApp and email stubs record every message; nothing is sent (tested).
- [ ] Playwright flows for an event and an announcement pass on the demo build and the real server.
- [ ] Architecture, decision log, risk register and end-of-sprint summary updated.
