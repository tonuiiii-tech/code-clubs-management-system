# Sprint 2: Learners, Consent, Sessions, and Attendance

**Project:** STEAMLabs Africa Code Clubs Management System  
**Sprint duration:** 2 weeks (Tue 4 Nov – Mon 17 Nov 2026)  
**Status:** Draft for approval (not started)  
**Last updated:** 2026-10-22 (updated with the Head of Code Clubs' questionnaire answers)  
**Sprint goal:** Champions can enrol learners in their clubs, record consent, record sessions and take attendance, with guardian contacts and consent forms visible only to STEAMLabs HQ.

## 1. Background

Sprint 1 delivered users, schools, clubs and champion assignments. Sprint 2 adds the records champions handle every week: who is in the club, whether a guardian has given consent, what each session covered and who attended. Today this is kept in paper registers, spreadsheets and WhatsApp groups, and HQ finds it hard to know what each club is doing at a given time.

## 1a. What the questionnaire changed (Oct 2026)

The Head of Code Clubs answered the requirements questionnaire. Answers that affect this sprint:

| Topic                   | Answer                                                             | Effect on this plan                                                                                                  |
| ----------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Internet at club venues | Mostly none                                                        | Online-only attendance cannot be taken at most venues. See decision needed in section 2a.                            |
| Devices                 | Laptops, desktops and tablets; both web and mobile app wanted      | Design screens for tablet first, not phones. The PWA covers "mobile app" for now.                                    |
| Learner details         | None ticked; "to confirm with HQ"                                  | Product owner chose name, gender, age, grade and admission number (22 Oct); data protection lead signs off (gate 1). |
| How learners join       | Open sign-up                                                       | Champions enrol learners directly; no approval step.                                                                 |
| Moving between clubs    | Not allowed                                                        | Removed the move endpoint and enrolment history. A learner belongs to one club.                                      |
| Guardian contacts       | STEAMLabs HQ only                                                  | Champions and coordinators never see contacts. No per-person grant in this sprint.                                   |
| Consent                 | A consent form already exists; photos allowed under its conditions | Record consent against the existing form; photo consent tracked separately.                                          |
| Per session             | Topic, learners present/absent, notes or challenges, photos        | Session report = topic, notes, attendance, optional photos. No facilitator list, no cancel reason.                   |
| Capacity and calendar   | 30 learners; clubs follow the school term calendar                 | Capacity check at 30; generated sessions skip school holidays (needs term dates).                                    |
| Retention               | Forever                                                            | Conflicts with the Data Protection Act. See gate 2.                                                                  |
| Data protection lead    | Named at STEAMLabs; Kenya Data Protection Act 2019 applies         | That person signs off gates 1 and 2.                                                                                 |
| Roles and permissions   | To be discussed in a meeting this week                             | Section 6 stays a proposal until that meeting (R1-9).                                                                |
| Existing data to import | None                                                               | No import tool needed.                                                                                               |

## 2. Before the sprint starts (gates)

Learners are children aged 9–14. These must be done before any learner code is merged:

1. **Learner fields (R1-3).** The product owner chose the fields on 22 Oct: name, gender, age, grade and school admission number (section 5). The data protection lead confirms them. Reasons: name for the register, gender for reporting participation by girls and boys, age and grade for reporting by age group and level, admission number to match the school's own register and tell apart learners with the same name.
2. **Retention (R1-13).** The answer "keep forever" conflicts with the Data Protection Act's storage-limitation principle. The data protection lead agrees a retention period (for example, delete or anonymise learner records a set number of years after the learner leaves; keep anonymised attendance counts for impact reporting). Registration with the Office of the Data Protection Commissioner and a data protection impact assessment are still needed.
3. **Roles meeting.** The permissions meeting the Head of Code Clubs proposed confirms section 6.
4. **Sprint 1 Definition of Done is met**, in particular that data persists in MongoDB.

If a gate is not met, the sprint starts with sessions and attendance and learners are entered with the chosen fields; any field the data protection lead rejects is removed before launch.

## 2a. Decision needed: offline before or after this sprint

Club venues mostly have no internet. If Sprint 2 stays online-only, champions can only enter attendance after the session, from somewhere with a connection.

| Option                                    | Effect                                                                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Keep the order (recommended)           | Sprint 2 builds the data model online; champions enter records after the session. Sprint 3 adds offline capture on the stable model, as the roadmap says. |
| B. Bring offline attendance into Sprint 2 | Usable at venues sooner, but sync is built on a model that is still changing. Higher risk; the sprint would need to drop consent uploads or photos.       |

## 3. In scope

- Learner records in one club, with the agreed minimum personal data (section 5).
- Guardian contacts in a separate record, readable and writable only by HQ roles.
- Consent records per learner (participation, photo) against the existing STEAMLabs consent form, with an uploaded signed copy (PDF or photo).
- Sessions: generated from the club's meeting pattern within school term dates, or added by hand; a report with topic and notes or challenges.
- Attendance per session: present or absent for each enrolled learner.
- Session photos (optional, stretch): uploaded by the champion, only when every learner shown has photo consent, which the champion confirms on upload.
- Withdrawing a learner (no moves between clubs).
- Club and dashboard counts: enrolled learners and capacity, consent outstanding, sessions held, attendance rate.
- Audit events for every read of guardian contacts and consent files, and every learner create, update or withdrawal.
- English and Kiswahili text for all new screens.
- Fictional learner data in the shared demo dataset (R1-12): invented names, fake +254700000xxx phone numbers.

## 4. Out of scope

- Offline capture, Dexie, outbox and sync (Sprint 3), unless option B in section 2a is chosen.
- Learner or parent logins, and parent or learner event registration (Sprint 4).
- Project submissions and quiz scores (Sprint 5, progress tracking).
- SMS, WhatsApp and in-app announcements (Sprint 4, behind a stub provider).
- Events and event consent (Sprint 4).
- PDF reports and scheduled email (Sprint 4).
- Equipment inventory and resource library (Sprint 5).
- Importing existing data (not needed).

## 5. Data model (proposed)

Same rules as Sprint 1: UUID string `_id` (D1-21), `timestamps`, `createdBy` and `updatedBy`, access only through repositories (D1-16), shared Zod schemas (D1-17).

| Collection        | Fields                                                                                                                                                                                                   | Indexes                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `learners`        | firstName, lastName, gender, birthYear (from the age entered), grade, admissionNumber (optional), clubId, schoolId (copied from the club), region, status (enrolled, withdrawn), enrolledOn, withdrawnOn | `clubId, status` · `region` · `schoolId + admissionNumber` unique (partial) |
| `learnerContacts` | learnerId, guardianName, relationship, phone, preferredLanguage                                                                                                                                          | `learnerId`                                                                 |
| `consents`        | learnerId, type (participation, photo), status (pending, given, refused, withdrawn), signedOn, fileId, recordedBy                                                                                        | `learnerId + type` unique                                                   |
| `files`           | Stored in MongoDB GridFS: filename, contentType, size, uploadedBy, entityType, entityId                                                                                                                  | `entityType + entityId`                                                     |
| `terms`           | year, name, startDate, endDate (school term calendar)                                                                                                                                                    | `year + name` unique                                                        |
| `sessions`        | clubId, region, date, status (scheduled, held), topic, notes, photoFileIds                                                                                                                               | `clubId + date` unique · `region, date`                                     |
| `attendance`      | sessionId, learnerId, clubId, status (present, absent)                                                                                                                                                   | `sessionId + learnerId` unique · `learnerId`                                |

Age: the champion enters the learner's age (9–14); the server stores the birth year (enrolment year minus age) so the age shown stays correct in later years without storing a date of birth.

Grade: Grade 1–9 under the Competency-Based Curriculum (shared enum).

Admission number: optional, because clubs at community centres or online have no school register. When given, it must be unique within the club's host school (`schoolId + admissionNumber` unique, partial index). It is visible to the same people as the learner record.

Gender: girl, boy or prefer not to say (shared enum). Required, so that reports can show participation by gender; "prefer not to say" is always allowed and is reported as its own group.

Not collected: full date of birth, home address, learner phone or email. Adding any of these needs a new privacy review.

Files: PDF, JPEG or PNG, at most 5 MB, type checked on the server from the file content, not the name. Photos are resized on the client before upload. Files are never served from a public URL; they are streamed through an authenticated endpoint that checks scope and writes an audit event for consent forms.

## 6. Permissions (additions to `shared/permissions.js`)

Proposal until the roles meeting (gate 3).

| Permission             | System Administrator | Programme Manager | Coordinator    | Champion       |
| ---------------------- | -------------------- | ----------------- | -------------- | -------------- |
| `learner:read`         | All                  | All               | Assigned scope | Assigned clubs |
| `learner:write`        | All                  | All               | Assigned scope | Assigned clubs |
| `learnerContact:read`  | All                  | All               | No             | No             |
| `learnerContact:write` | All                  | All               | No             | No             |
| `consent:read`         | All                  | All               | Assigned scope | Assigned clubs |
| `consent:write`        | All                  | All               | Assigned scope | Assigned clubs |
| `consentFile:read`     | All                  | All               | No             | No             |
| `session:read`         | All                  | All               | Assigned scope | Assigned clubs |
| `session:write`        | All                  | All               | Assigned scope | Assigned clubs |
| `attendance:write`     | All                  | All               | Assigned scope | Assigned clubs |
| `term:write`           | All                  | All               | No             | No             |

Contacts are STEAMLabs HQ only, as the questionnaire answered. The existing per-person grant mechanism stays in the code but is not used for contacts unless HQ asks for it.

## 7. Proposed API endpoints

Prefix: `/api/v1`. Same response format (D1-19) and server-side permission and scope checks as Sprint 1.

| Method | Endpoint                       | Purpose                                                                      |
| ------ | ------------------------------ | ---------------------------------------------------------------------------- |
| GET    | `/learners?clubId=`            | List learners in scope                                                       |
| POST   | `/learners`                    | Enrol a learner in a club                                                    |
| GET    | `/learners/:id`                | Get a learner                                                                |
| PATCH  | `/learners/:id`                | Update learner details                                                       |
| PATCH  | `/learners/:id/status`         | Withdraw or re-enrol                                                         |
| GET    | `/learners/:id/contacts`       | Guardian contacts (HQ only, audited)                                         |
| PUT    | `/learners/:id/contacts`       | Set guardian contacts (HQ only)                                              |
| GET    | `/learners/:id/consents`       | Consent status                                                               |
| PUT    | `/learners/:id/consents/:type` | Record consent, with optional signed copy                                    |
| GET    | `/files/:id`                   | Download a file (scope-checked; consent forms audited)                       |
| GET    | `/terms`                       | School term dates                                                            |
| PUT    | `/terms/:year`                 | Set term dates for a year (HQ)                                               |
| GET    | `/sessions?clubId=&from=&to=`  | List sessions in scope                                                       |
| POST   | `/clubs/:id/sessions/generate` | Create scheduled sessions from the meeting pattern, skipping school holidays |
| POST   | `/sessions`                    | Add a one-off session                                                        |
| PATCH  | `/sessions/:id`                | Mark held, write topic and notes                                             |
| POST   | `/sessions/:id/photos`         | Add a session photo (stretch)                                                |
| GET    | `/sessions/:id/attendance`     | Attendance list for a session                                                |
| PUT    | `/sessions/:id/attendance`     | Save attendance for the whole session                                        |
| GET    | `/dashboard/summary`           | Extended with learner and session counts                                     |

## 8. User stories

### US-07: Enrol learners

As a champion, I can add a learner to my club with only the agreed fields, so that I have a register for my sessions.

- Cannot enrol into a club outside my scope (403) or when the club already has 30 learners (409).
- Age must be 9–14 and grade one of the agreed grades (400 otherwise).
- Admission number already used at the same school is rejected (409).
- Duplicate warning when the same first and last name already exist in the club.

### US-08: Guardian contacts

As a programme manager, I can record and view guardian contacts, so that HQ can reach families when needed.

- Champions and coordinators never receive contact fields, in lists or in single records.
- Every view is written to the audit log.

### US-09: Consent

As a champion, I can record that a guardian has signed the STEAMLabs consent form and attach a copy.

- A learner without participation consent is flagged on the club page and in attendance.
- Photo consent is tracked separately; learners without it are flagged on the photo upload screen.

### US-10: Sessions

As a champion, I can see my upcoming sessions for the term, mark a session as held, and record the topic and any notes or challenges.

- A session cannot be marked held in the future.
- No sessions are generated during school holidays.

### US-11: Attendance

As a champion, I can mark each learner present or absent for a held session in one screen, defaulting everyone to present.

- Only learners enrolled on the session date appear.
- Attendance can be corrected afterwards; corrections are audited.

### US-12: Dashboard

As a coordinator, I can see enrolment against capacity, outstanding consent, sessions held and attendance rate for clubs in my regions, so I know what each club is doing.

## 9. Suggested implementation plan

### Days 1–2: Contracts and data layer

- Shared enums and Zod schemas for learners, contacts, consents, terms, sessions and attendance.
- Policy entries and generated permission tests.
- Mongoose models, indexes and repositories; mongodb-memory-server tests.
- Fictional learners and term dates added to `shared/demo`, used by the seed and demo mode.

### Days 3–5: Learners, contacts and consent

- Learner and contact services and routes with scope checks.
- Consent recording and file upload to GridFS with type and size checks.
- Audit events for contact and consent-file reads.

### Days 6–7: Sessions and attendance

- Term dates; session generation from the club meeting pattern; one-off sessions; topic and notes.
- Attendance save for a whole session; correction audit.
- Dashboard counts. Session photos if time allows.

### Days 8–9: Frontend

- Club page: learner register, capacity, consent flags, upcoming sessions.
- Learner form, contact panel (HQ only), consent upload.
- Session screen with topic, notes and attendance; tablet layout first.
- Mock API updated so demo mode covers the new endpoints.

### Day 10: Verification and demo

- Lint, tests and builds; permission matrix positive and negative cases.
- Check that champions and coordinators never receive guardian contact fields.
- Update architecture section 7, risk register and README.
- Demo to STEAMLabs stakeholders.

## 10. Definition of Done

- [ ] Section 2 gates are recorded as met in the decision log or risk register, including the agreed retention period.
- [ ] The section 2a decision is recorded in the decision log.
- [ ] Learners, contacts, consents, terms, sessions and attendance persist in MongoDB.
- [ ] Guardian contacts and consent files are returned only to HQ roles, and every read is audited.
- [ ] Uploads are limited by type and size, checked on the server, and never publicly reachable.
- [ ] Champions can complete enrol → consent → session → attendance for their own clubs only.
- [ ] Server-side permission and scope tests cover every new endpoint, including denial cases.
- [ ] All new UI text exists in English and Kiswahili; screens work on a tablet and at phone width.
- [ ] Seed and demo mode include fictional learners only; no real children's data is committed.
- [ ] Architecture, risk register and setup docs match the implementation.

## 11. Open questions

Answered by the questionnaire: guardian contact visibility (HQ only), moving between clubs (not allowed), session report contents (topic, attendance, notes, photos), consent form (exists).

Still open:

1. Does the data protection lead accept the chosen learner fields (name, gender, age, grade, admission number)?
2. What retention period will the data protection lead approve, given that "forever" conflicts with the Act?
3. Is consent collected once per learner, or each year or term?
4. Who enters school term dates each year, and are they the national Ministry of Education calendar?
5. File storage: GridFS in the existing Atlas database (proposed) or an object store? Session photos could fill the Atlas free tier (512 MB) quickly; the hosting budget is confirmed in principle.
6. Can a session be marked cancelled? The questionnaire did not tick it, but generated sessions that do not happen need to be cleared from the schedule.
7. Option A or B in section 2a?

## 12. Sprint 2 risks

| Risk                                                        | Mitigation                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Privacy and data protection gates are not cleared in time   | Start with sessions and attendance; remove any field the data protection lead rejects before launch     |
| Retention "forever" is not lawful for children's data       | Data protection lead agrees a period before launch; design for deletion or anonymisation from the start |
| Champions cannot enter data at venues with no internet      | Section 2a decision; Sprint 3 offline capture; allow entering a past session's attendance later         |
| Session photos and consent uploads fill the Atlas free tier | 5 MB limit, client-side resizing, photos as a stretch goal; decide on object storage (question 5)       |
| Roles change after the permissions meeting                  | One policy file (`shared/permissions.js`); permission tests generated from the policy table             |
| Data model changes during Sprint 2 delay Sprint 3 sync      | Freeze the model at the end of Sprint 2; record changes in the decision log                             |
