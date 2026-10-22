# Sprint 2: Learners, Consent, Sessions, and Attendance

**Project:** STEAMLabs Africa Code Clubs Management System  
**Sprint duration:** 2 weeks (Tue 4 Nov – Mon 17 Nov 2026)  
**Status:** Proposed, awaiting Enock's approval  
**Last updated:** 2026-10-22  
**Sprint goal:** Champions can register the learners in their clubs, record guardian consent, report each session and take attendance, online, with children's personal data minimised and restricted by role.

## 1. Background

Sprint 1 delivered users, roles, schools, clubs and champion assignments on MongoDB. Today session reports and attendance are shared on WhatsApp, so HQ cannot see which clubs are meeting or how many children attend.

Sprint 2 adds the records closest to the children. It is the sprint with the highest privacy risk (R1-3, R1-13), so the data model starts from "collect as little as possible" and every new field below has a reason.

Everything stays online in this sprint. The data model is designed so Sprint 3 can add offline sync without changing it (D1-5, D1-6, D1-15).

## 2. Before this sprint starts

- Sprint 1 is closed: real-database checks, Playwright against the real server, Definition of Done ticked.
- **No real learner data** is entered until STEAMLabs confirms its registration with the Office of the Data Protection Commissioner and a data protection impact assessment exists (R1-13). Sprint 2 is built and demonstrated with fictional data only.
- If the learner fields are not yet approved when the sprint starts, it begins with sessions and attendance, and the learner fields are finalised once they are.

## 3. In scope

- Learner records, linked to one club.
- Guardian contacts in a separate record, readable only by HQ roles unless granted (R1-3).
- Consent form upload (photo or PDF of the signed paper form) and consent status per learner.
- Sessions: planned, held or cancelled, with a short report.
- Attendance per session, taken from the club's learner list.
- Dashboard additions: learners, sessions this month, attendance rate, learners missing consent.
- Demo mode (mock API) extended with the same endpoints and fictional learners.
- English and Kiswahili text for every new screen.

## 4. Out of scope

- Offline use of any of this (Sprint 3).
- Learner logins or learner-facing screens.
- Photos of children or project media.
- Progress tracking, certificates (Sprint 5).
- Event consent (Sprint 4).
- Bulk import from spreadsheets (candidate for a later sprint).
- SMS or WhatsApp to guardians (Sprint 4, behind a stub).

## 5. Data model

All `_id`s are UUID strings (D1-21). All records get `createdAt`, `updatedAt`, `createdBy`, `updatedBy`. `region` is copied onto learners and sessions from the club so scope queries need no join (proposed D2-6).

### learners

| Field                   | Why it is needed                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `learnerNumber`         | Short reference without using names, e.g. `NAC-014-023` (club code + sequence)       |
| `firstName`, `lastName` | Taking attendance                                                                    |
| `birthYear`             | Age band for reporting. Not the full date of birth (proposed D2-2)                   |
| `gender`                | Programme reporting on girls' participation; includes "prefer not to say"            |
| `grade`                 | Grade 4 to Grade 9 (CBC), for grouping and reporting                                 |
| `clubId`, `region`      | Scope                                                                                |
| `status`                | `active` or `left`; leaving keeps history                                            |
| `accessibilityNeeds`    | Optional, free text, max 200 characters, visible to the club's champions and HQ only |

Not collected: learner phone or email, full date of birth, home address, national or birth certificate numbers, school admission number, photos.

### learnerContacts (separate collection, proposed D2-1)

`learnerId`, `guardianName`, `relationship`, `phone`, `altPhone`.

Champions and coordinators can **enter** a guardian contact when registering a learner but cannot **read** it back. Only System Administrators and Programme Managers can read contacts, plus anyone given the `learnerContact:read` grant. API responses for other roles never include these fields.

### enrolments (history)

`learnerId`, `clubId`, `startDate`, `endDate`. One open enrolment per learner, so moving a learner to another club keeps their history and attendance. Enrolling above the club's capacity is refused.

### consents

`learnerId`, `type` (`participation`, `photo`), `status` (`pending`, `given`, `refused`, `withdrawn`), `signedOn`, `fileId`, `recordedBy`. Unique `learnerId + type`. Photo consent is recorded now so later sprints can check it before any photo is used.

### consentFiles (GridFS bucket, proposed D2-3)

The signed paper consent form, scanned or photographed: JPG, PNG or PDF, max 5 MB. The server checks the file's real type from its first bytes, not its name. Files are only served through an authorised endpoint (never a public URL), are sent as downloads, and the service worker never caches them.

### sessions

`clubId`, `region`, `date`, `startTime`, `endTime`, `status` (`planned`, `held`, `cancelled`), `track`, `topic`, `summary` (what was done, max 1000 characters), `challenges` (optional), `cancellationReason` (required when cancelled), `championIds` (who ran it), `reportedBy`, `reportedAt`. One session per club per date (unique index).

### attendance (separate collection, proposed D2-4)

`sessionId`, `learnerId`, `clubId`, `region`, `status` (`present`, `absent`, `late`, `excused`). Unique `sessionId + learnerId`. Kept separate from sessions so two people editing attendance offline in Sprint 3 do not overwrite each other, the same reasoning as champion assignments (D1-15).

## 6. Proposed permissions

| Capability                         | System Administrator | Programme Manager | Coordinator     | Champion           |
| ---------------------------------- | -------------------- | ----------------- | --------------- | ------------------ |
| View learners                      | All                  | All               | Their regions   | Their clubs        |
| Register and edit learners         | All                  | All               | Their regions   | Their clubs        |
| Enter guardian contact             | All                  | All               | Their regions   | Their clubs        |
| Read guardian contact              | All                  | All               | Only if granted | Only if granted    |
| Upload consent form                | All                  | All               | Their regions   | Their clubs        |
| View consent form                  | All                  | All               | Their regions   | No (status only)   |
| Create and report sessions         | All                  | All               | Their regions   | Their clubs        |
| Take attendance                    | All                  | All               | Their regions   | Their clubs        |
| Edit a session report after 7 days | All                  | All               | Their regions   | No (proposed D2-5) |

As in Sprint 1, out-of-scope records return 404 and every rule is enforced on the server.

## 7. Proposed API endpoints

Prefix: `/api/v1`

| Method | Endpoint                     | Purpose                                         |
| ------ | ---------------------------- | ----------------------------------------------- |
| GET    | `/learners`                  | List learners in scope (filter by club, status) |
| POST   | `/learners`                  | Register a learner (with optional contact)      |
| GET    | `/learners/:id`              | Get a learner                                   |
| PATCH  | `/learners/:id`              | Update a learner                                |
| POST   | `/learners/:id/move`         | Move to another club (history kept)             |
| PATCH  | `/learners/:id/status`       | Mark as left or re-activate                     |
| GET    | `/learners/:id/contact`      | Guardian contact (HQ or grant only)             |
| PUT    | `/learners/:id/contact`      | Enter or replace guardian contact               |
| POST   | `/learners/:id/consent`      | Upload consent form, set status received        |
| GET    | `/learners/:id/consent/file` | Download consent form                           |
| PATCH  | `/learners/:id/consent`      | Mark consent withdrawn                          |
| GET    | `/sessions`                  | List sessions in scope (filter by club, month)  |
| POST   | `/sessions`                  | Plan or report a session                        |
| GET    | `/sessions/:id`              | Get a session with attendance                   |
| PATCH  | `/sessions/:id`              | Update report, status                           |
| PUT    | `/sessions/:id/attendance`   | Save the whole attendance list at once          |
| GET    | `/dashboard/summary`         | Adds learner, session and attendance counts     |

Every learner, contact, consent and attendance change is written to the audit log. Reading a guardian contact or a consent file is also audited, because it is access to a child's personal data.

## 8. Screens

- **Learners list**: search, filter by club and status, consent badge.
- **Learner form**: the fields above; guardian contact section that champions can fill in but not see again.
- **Learner detail**: details, consent status and upload, guardian contact only for permitted users.
- **Club detail**: new Learners and Sessions sections.
- **Sessions list**: by club and month, with status.
- **Session report**: one mobile-first page with the report and an attendance checklist of the club's learners (large tap targets, "all present" shortcut), designed for a champion's phone.
- **Dashboard**: new counts and a "missing consent" list for coordinators and HQ.

## 9. User stories

- **US-07 Register learners.** A champion registers a learner in their club with only the agreed fields; duplicates (same name, birth year and club) are warned about.
- **US-08 Guardian contacts.** Contacts are stored separately; only HQ or granted users can read them; reads are audited.
- **US-09 Consent.** Participation and photo consent are recorded separately; a signed form can be uploaded; learners without participation consent are flagged on the club page and in attendance.
- **US-10 Sessions.** A champion plans or reports a session for their club, or records why it was cancelled.
- **US-11 Attendance.** A champion takes attendance in one step from the club's learner list.
- **US-12 Dashboard.** Counts and attendance rate respect each user's scope.

## 10. Order of work

1. Shared: enums, Zod schemas, permissions for learners, contacts, consent, sessions, attendance.
2. Server: models and indexes, repositories, services, routes; GridFS upload with type check; audit of reads.
3. Tests: scope and permission cases for every new endpoint, contact hiding, file type rejection, edit window.
4. Client: screens above, i18n en/sw, demo mode data and mock endpoints.
5. Playwright: register learner → upload consent → report session → take attendance, on demo and real server.
6. Docs: architecture data model, decision log D2-x, risk register R2-x, README.

## 11. Decisions to log once approved

- **D2-1** Guardian contacts in a separate collection; champions can write but not read them.
- **D2-2** Birth year only, no full date of birth.
- **D2-3** Consent files in MongoDB GridFS for now, served only through an authorised endpoint, type checked by content.
- **D2-4** Attendance as its own collection, one record per learner per session.
- **D2-5** Champions can edit a session report for 7 days; coordinators and HQ after that.
- **D2-6** `region` copied onto learners, sessions and attendance for scope queries.

## 12. New risks

| ID   | Risk                                                                       | Mitigation                                                                                       |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| R2-1 | Real learner data is entered before the Data Protection Act steps are done | Fictional data only until R1-13 is closed; say so in the README and the demo                     |
| R2-2 | Consent files leak (they show guardian names and signatures)               | No public URLs, authorised download only, audited, never cached by the service worker            |
| R2-3 | Champions upload photos of children instead of the form                    | Upload screen says what to photograph; HQ can delete a wrong file                                |
| R2-4 | Atlas free tier storage (512 MB) fills with consent files                  | 5 MB limit; client shrinks photos before upload; watch usage; move files to object storage later |
| R2-5 | Session reports differ between champions                                   | Short structured form agreed with STEAMLabs before building it (question 1 below)                |

## 13. Questions for STEAMLabs

1. What should a session report contain today? (Proposed: topic, what was done, challenges, who ran it.)
2. Is birth year enough, or is an age band (9–10, 11–12, 13–14) better?
3. Should learners without received consent be allowed to attend and be marked present?
4. Who may read guardian contacts: HQ only, or also the club's coordinator?
5. How long should records of learners who have left be kept before they are anonymised?
6. Can a learner belong to more than one club?
7. Is consent collected once, or again every year or term?
8. Should champions see guardian phone numbers for their own clubs, for example to call when a child is not collected?

## 14. Definition of Done

- [ ] All six user stories meet their criteria, online.
- [ ] Guardian contacts never appear in responses for roles without permission (tested).
- [ ] Consent files are type checked, size limited and only downloadable in scope (tested).
- [ ] Every new endpoint has allowed and denied scope tests.
- [ ] Reads of contacts and consent files are audited.
- [ ] New screens work on a phone, in English and Kiswahili.
- [ ] Demo mode and the real server pass the same Playwright flow.
- [ ] Seed and demo data contain only fictional learners.
- [ ] Docs, decision log and risk register updated.
