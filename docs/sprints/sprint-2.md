# Sprint 2: Learners, Consent, Sessions, and Attendance

**Project:** STEAMLabs Africa Code Clubs Management System  
**Sprint duration:** 2 weeks (Tue 4 Nov – Mon 17 Nov 2026)  
**Status:** Draft for approval (not started)  
**Last updated:** 2026-10-22  
**Sprint goal:** Champions can enrol learners in their clubs, record consent, run sessions and take attendance online, with guardian contacts and consent forms visible only to the people allowed to see them.

## 1. Background

Sprint 1 delivered users, schools, clubs and champion assignments. Sprint 2 adds the records champions handle every week: who is in the club, whether a guardian has given consent, which sessions took place and who attended. Today this information is shared over WhatsApp.

Everything in Sprint 2 is online only. Offline capture and sync come in Sprint 3 and depend on this data model being stable (roadmap, sprint-1.md section 12).

## 2. Before the sprint starts (gates)

Learners are children aged 9–14. These must be done before any learner code is merged:

1. **Privacy review (R1-3).** The product owner approves the learner and guardian-contact fields in section 5. Every field must have a reason to exist.
2. **Data protection (R1-13).** STEAMLabs HQ confirms its registration with the Office of the Data Protection Commissioner, and a data protection impact assessment and a retention period for learner records and consent forms are agreed. Legal review is needed.
3. **Session report format.** STEAMLabs staff confirm what a session report contains (sprint-1.md section 1 lists this as unconfirmed).
4. **Sprint 1 Definition of Done is met**, in particular that data persists in MongoDB.

If a gate is not met, the sprint starts with sessions and attendance using placeholder learner fields, and learner fields are finalised once the gate is cleared.

## 3. In scope

- Learner records in a club, with the minimum personal data (section 5).
- Guardian contacts in a separate record, readable only by HQ roles or a person with a grant.
- Consent records per learner (participation, photos), with an uploaded signed form (PDF or photo).
- Sessions: scheduled from the club's meeting pattern or added by hand; marked held or cancelled; a short session report.
- Attendance per session: present, absent or excused for each enrolled learner.
- Moving a learner between clubs and withdrawing a learner, with history kept.
- Club and dashboard counts: enrolled learners, consent outstanding, sessions held, attendance rate.
- Audit events for every read of guardian contacts and consent files, and every learner create, update or withdrawal.
- English and Kiswahili text for all new screens.
- Fictional learner data in the shared demo dataset (R1-12): invented names, fake +254700000xxx phone numbers.

## 4. Out of scope

- Offline capture, Dexie, outbox and sync (Sprint 3).
- Learner logins or a learner-facing app.
- Project submissions, photos of learners' work and media galleries.
- SMS or WhatsApp messages to guardians (Sprint 4, behind a stub).
- Progress tracking and certificates (Sprint 5).
- Events and event consent (Sprint 4).
- PDF reports (Sprint 4).

## 5. Data model (proposed)

Same rules as Sprint 1: UUID string `_id` (D1-21), `timestamps`, `createdBy` and `updatedBy`, access only through repositories (D1-16), shared Zod schemas (D1-17).

| Collection        | Fields                                                                                                                                                   | Indexes                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `learners`        | firstName, lastName, gender (optional), birthYear (not full date of birth), grade, clubId, region, status (enrolled, withdrawn), enrolledOn, withdrawnOn | `clubId, status` · `region`                                   |
| `learnerContacts` | learnerId, guardianName, relationship, phone, alternatePhone (optional), preferredLanguage                                                               | `learnerId`                                                   |
| `consents`        | learnerId, type (participation, photo), status (pending, given, refused, withdrawn), signedOn, fileId, recordedBy                                        | `learnerId + type` unique                                     |
| `files`           | Stored in MongoDB GridFS: filename, contentType, size, uploadedBy, entityType, entityId                                                                  | `entityType + entityId`                                       |
| `sessions`        | clubId, region, date, startTime, endTime, status (scheduled, held, cancelled), topic, track, report, cancelReason, championIds                           | `clubId + date` unique · `region, date`                       |
| `attendance`      | sessionId, learnerId, clubId, status (present, absent, excused), note                                                                                    | `sessionId + learnerId` unique · `learnerId`                  |
| `enrolments`      | learnerId, clubId, startDate, endDate (history when a learner moves club)                                                                                | `learnerId` · `clubId + learnerId` unique while endDate empty |

Not collected: full date of birth, home address, school admission number, learner phone or email, photos of learners. Adding any of these needs a new privacy review.

Consent files: PDF, JPEG or PNG, at most 5 MB, type checked on the server from the file content, not the name. Files are never served from a public URL; they are streamed through an authenticated endpoint that checks scope and writes an audit event.

## 6. Permissions (additions to `shared/permissions.js`)

| Permission             | System Administrator | Programme Manager | Coordinator     | Champion        |
| ---------------------- | -------------------- | ----------------- | --------------- | --------------- |
| `learner:read`         | All                  | All               | Assigned scope  | Assigned clubs  |
| `learner:write`        | All                  | All               | Assigned scope  | Assigned clubs  |
| `learnerContact:read`  | All                  | All               | Only if granted | Only if granted |
| `learnerContact:write` | All                  | All               | Only if granted | Only if granted |
| `consent:read`         | All                  | All               | Assigned scope  | Assigned clubs  |
| `consent:write`        | All                  | All               | Assigned scope  | Assigned clubs  |
| `consentFile:read`     | All                  | All               | Only if granted | No              |
| `session:read`         | All                  | All               | Assigned scope  | Assigned clubs  |
| `session:write`        | All                  | All               | Assigned scope  | Assigned clubs  |
| `attendance:write`     | All                  | All               | Assigned scope  | Assigned clubs  |

Open question: should champions see guardian phone numbers for their own clubs (for example to call when a child is not collected)? The current policy says no unless granted.

## 7. Proposed API endpoints

Prefix: `/api/v1`. Same response format (D1-19) and server-side permission and scope checks as Sprint 1.

| Method | Endpoint                       | Purpose                                                                    |
| ------ | ------------------------------ | -------------------------------------------------------------------------- |
| GET    | `/learners?clubId=`            | List learners in scope                                                     |
| POST   | `/learners`                    | Enrol a learner in a club                                                  |
| GET    | `/learners/:id`                | Get a learner                                                              |
| PATCH  | `/learners/:id`                | Update learner details                                                     |
| POST   | `/learners/:id/move`           | Move to another club (history kept)                                        |
| PATCH  | `/learners/:id/status`         | Withdraw or re-enrol                                                       |
| GET    | `/learners/:id/contacts`       | Guardian contacts (audited)                                                |
| PUT    | `/learners/:id/contacts`       | Set guardian contacts                                                      |
| GET    | `/learners/:id/consents`       | Consent status                                                             |
| PUT    | `/learners/:id/consents/:type` | Record consent, with optional file                                         |
| GET    | `/files/:id`                   | Download a consent form (audited)                                          |
| GET    | `/sessions?clubId=&from=&to=`  | List sessions in scope                                                     |
| POST   | `/clubs/:id/sessions/generate` | Create scheduled sessions for a date range from the club's meeting pattern |
| POST   | `/sessions`                    | Add a one-off session                                                      |
| PATCH  | `/sessions/:id`                | Mark held or cancelled, write the report                                   |
| GET    | `/sessions/:id/attendance`     | Attendance list for a session                                              |
| PUT    | `/sessions/:id/attendance`     | Save attendance for the whole session                                      |
| GET    | `/dashboard/summary`           | Extended with learner and session counts                                   |

## 8. User stories

### US-07: Enrol learners

As a champion, I can add a learner to my club with only the agreed fields, so that I have a register for my sessions.

- Cannot enrol into a club outside my scope (403) or above the club's capacity (409).
- Duplicate warning when the same first name, last name and birth year already exist in the club.

### US-08: Guardian contacts

As a programme manager, I can record and view guardian contacts, so that HQ can reach families when needed.

- Champions and coordinators without a grant never receive contact fields, in lists or in single records.
- Every view is written to the audit log.

### US-09: Consent

As a champion, I can record whether a guardian has given consent and attach the signed form.

- A learner without participation consent is flagged on the club page and in attendance.
- Photo consent is tracked separately and shown wherever photos would be used later.

### US-10: Sessions

As a champion, I can see my upcoming sessions, mark a session as held or cancelled, and write a short report.

- A session cannot be marked held in the future.
- Cancelled sessions need a reason.

### US-11: Attendance

As a champion, I can take attendance for a held session in one screen, defaulting everyone to present.

- Only learners enrolled on the session date appear.
- Attendance can be corrected afterwards; corrections are audited.

### US-12: Dashboard

As a coordinator, I can see enrolment, outstanding consent, sessions held and attendance rate for clubs in my regions.

## 9. Suggested implementation plan

### Days 1–2: Contracts and data layer

- Shared enums and Zod schemas for learners, contacts, consents, sessions and attendance.
- Policy entries and generated permission tests.
- Mongoose models, indexes and repositories; mongodb-memory-server tests.
- Fictional learner data added to `shared/demo`, used by the seed and demo mode.

### Days 3–5: Learners, contacts and consent

- Learner, enrolment and contact services and routes with scope checks.
- Consent recording and file upload to GridFS with type and size checks.
- Audit events for contact and file reads.

### Days 6–7: Sessions and attendance

- Session generation from the club meeting pattern, one-off sessions, held/cancelled, report.
- Attendance save for a whole session; correction audit.
- Dashboard counts.

### Days 8–9: Frontend

- Club page: learner register, consent flags, upcoming sessions.
- Learner form, contact panel (HQ or granted only), consent upload.
- Session screen with report and attendance; mobile layout first, since champions use phones.
- Mock API updated so demo mode covers the new endpoints.

### Day 10: Verification and demo

- Lint, tests and builds; permission matrix positive and negative cases.
- Check that champions never receive guardian contact fields.
- Update architecture section 7, risk register and README.
- Demo to STEAMLabs stakeholders.

## 10. Definition of Done

- [ ] Section 2 gates are recorded as met in the decision log or risk register.
- [ ] Learners, contacts, consents, sessions and attendance persist in MongoDB.
- [ ] Guardian contacts and consent files are returned only to permitted users, and every read is audited.
- [ ] Uploads are limited by type and size, checked on the server, and never publicly reachable.
- [ ] Champions can complete enrol → consent → session → attendance for their own clubs only.
- [ ] Server-side permission and scope tests cover every new endpoint, including denial cases.
- [ ] All new UI text exists in English and Kiswahili; screens work at phone width.
- [ ] Seed and demo mode include fictional learners only; no real children's data is committed.
- [ ] Architecture, risk register and setup docs match the implementation.

## 11. Open questions

1. Which learner fields does STEAMLabs actually need? Is gender needed, and is birth year enough?
2. Should champions see guardian phone numbers for their own clubs?
3. What does a session report contain: topic, track, activity, number of devices, issues?
4. Is consent collected once per learner, or once per year or term?
5. How long are learner records and consent forms kept after a learner leaves?
6. File storage: GridFS in the existing Atlas database (proposed, nothing extra to run) or an object store such as S3 or Cloudinary? The Atlas free tier has a 512 MB limit.
7. Does a session belong to one club only, or can two clubs meet together?

## 12. Sprint 2 risks

| Risk                                                      | Mitigation                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Privacy and data protection gates are not cleared in time | Start with sessions and attendance; keep learner fields behind the agreed list                    |
| Consent uploads fill the Atlas free tier                  | 5 MB limit, compress photos on the client, monitor storage; decide on object storage (question 6) |
| Session report format changes after STEAMLabs feedback    | Keep the report a small set of optional fields until confirmed                                    |
| Data model changes during Sprint 2 delay Sprint 3 sync    | Freeze the model at the end of Sprint 2; record changes in the decision log                       |
