# Sprint 2: Learners, Consent, Sessions, and Attendance

**Project:** STEAMLabs Africa Code Clubs Management System  
**Sprint duration:** 2 weeks (Tue 4 Nov – Mon 17 Nov 2026)  
**Status:** Proposed, awaiting Enock's approval  
**Last updated:** 2026-10-22 (updated with the Head of Code Clubs questionnaire answers)  
**Sprint goal:** Champions can register the learners in their clubs, record guardian consent, report each session and take attendance, online, with children's personal data minimised and restricted by role.

## 1. Background

Sprint 1 delivered users, roles, schools, clubs and champion assignments on MongoDB. Today session reports and attendance are shared on WhatsApp, so HQ cannot see which clubs are meeting or how many children attend.

Sprint 2 adds the records closest to the children. It is the sprint with the highest privacy risk (R1-3, R1-13), so the data model starts from "collect as little as possible" and every new field below has a reason.

The Head of Code Clubs answered the requirements questionnaire in October 2026. Section 2a lists what those answers change in this plan.

Everything stays online in this sprint. The data model is designed so Sprint 3 can add offline sync without changing it (D1-5, D1-6, D1-15).

## 2. Before this sprint starts

- Sprint 1 is closed: real-database checks, Playwright against the real server, Definition of Done ticked.
- **No real learner data** is entered until STEAMLabs confirms its registration with the Office of the Data Protection Commissioner and a data protection impact assessment exists (R1-13). Sprint 2 is built and demonstrated with fictional data only.
- If the learner fields are not yet approved when the sprint starts, it begins with sessions and attendance, and the learner fields are finalised once they are.

## 2a. What the questionnaire answers decide

| Answer (question number)                                                          | Effect on this plan                                                                                                                                             |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learners cannot move between clubs (Q17)                                          | No club moves or enrolment history. A learner belongs to one club; leaving sets `status: left`.                                                                 |
| Learner contact details are seen by STEAMLabs Africa only (Q43)                   | Guardian contacts readable by System Administrators and Programme Managers only. Coordinators and champions can enter them but never read them (D2-1).          |
| Session record: topic, learners present/absent, notes or challenges, photos (Q20) | The session report is exactly these, plus the date. Planned sessions and cancellation reasons are optional.                                                     |
| Photos may be stored and shared under the consent form's conditions (Q42)         | Session photos are in scope, limited to learners with photo consent (D2-7).                                                                                     |
| A consent form already exists (Q41)                                               | We record participation and photo consent and upload the signed form. We need a copy of the blank form to match its wording.                                    |
| Facilitators use laptops and tablets (Q35)                                        | Screens are designed tablet-first, and still work on a phone.                                                                                                   |
| Internet at club venues is mostly none (Q36)                                      | Sprint 2 works only where there is a connection, so champions will mostly enter records after the session. This makes Sprint 3 (offline) the top priority next. |
| Learner details at enrolment: "none" ticked, to confirm with HQ (Q15)             | The minimum below is a proposal. Names are needed to take attendance; gender, grade and birth year only stay if HQ wants them for reporting.                    |
| Keep records forever after a learner leaves (Q45)                                 | Conflicts with the Data Protection Act's rule to keep personal data no longer than necessary. See R2-6; to discuss with the data protection lead.               |
| Data protection lead: STEAMLabs Africa's named lead (Q44)                         | Owner of R1-13 and R2-6.                                                                                                                                        |
| Who uses the system and their permissions: meeting planned (Q34)                  | The four Sprint 1 roles remain an assumption until that meeting.                                                                                                |

## 3. In scope

- Learner records, linked to one club.
- Guardian contacts in a separate record, readable only by HQ roles unless granted (R1-3).
- Consent form upload (photo or PDF of the signed paper form) and consent status per learner.
- Sessions: topic, notes or challenges, and up to 3 photos, with attendance.
- Attendance per session, taken from the club's learner list.
- Dashboard additions: learners, sessions this month, attendance rate, learners missing consent.
- Demo mode (mock API) extended with the same endpoints and fictional learners.
- English and Kiswahili text for every new screen.

## 4. Out of scope

- Offline use of any of this (Sprint 3).
- Learner logins or learner-facing screens.
- Project media (Sprint 5).
- Progress tracking, certificates (Sprint 5).
- Event consent (Sprint 4).
- Bulk import from spreadsheets (candidate for a later sprint).
- SMS or WhatsApp to guardians (Sprint 4, behind a stub).

## 5. Data model

All `_id`s are UUID strings (D1-21). All records get `createdAt`, `updatedAt`, `createdBy`, `updatedBy`. `region` is copied onto learners and sessions from the club so scope queries need no join (proposed D2-6).

### learners

| Field                          | Why it is needed                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `learnerNumber`                | Short reference without using names, e.g. `NAC-014-023` (club code + sequence)       |
| `firstName`, `lastName`        | Taking attendance                                                                    |
| `birthYear`                    | Age band for reporting. Not the full date of birth (proposed D2-2)                   |
| `gender`                       | Programme reporting on girls' participation; includes "prefer not to say"            |
| `grade`                        | Grade 4 to Grade 9 (CBC), for grouping and reporting                                 |
| `clubId`, `region`             | Scope                                                                                |
| `status`, `joinedAt`, `leftAt` | `active` or `left`; leaving keeps attendance history                                 |
| `accessibilityNeeds`           | Optional, free text, max 200 characters, visible to the club's champions and HQ only |

Until HQ answers question 1 in section 13, only `firstName` and `lastName` are required; `birthYear`, `gender`, `grade` and `accessibilityNeeds` are built as optional fields and switched on only if HQ wants them.

Not collected: learner phone or email, full date of birth, home address, national or birth certificate numbers, school admission number, photos of individual learners.

Learners join by open sign-up (Q16) up to the club's capacity of 30 (Q8); enrolling above capacity is refused.

### learnerContacts (separate collection, proposed D2-1)

`learnerId`, `guardianName`, `relationship`, `phone`, `altPhone`.

Champions and coordinators can **enter** a guardian contact when registering a learner but cannot **read** it back. Only System Administrators and Programme Managers can read contacts, plus anyone given the `learnerContact:read` grant. API responses for other roles never include these fields.

### consents

`learnerId`, `type` (`participation`, `photo`), `status` (`pending`, `given`, `refused`, `withdrawn`), `signedOn`, `fileId`, `recordedBy`. Unique `learnerId + type`. Photo consent is checked before session photos are saved, and will be checked again for events and projects later.

### consentFiles (GridFS bucket, proposed D2-3)

The signed paper consent form, scanned or photographed: JPG, PNG or PDF, max 5 MB. The server checks the file's real type from its first bytes, not its name. Files are only served through an authorised endpoint (never a public URL), are sent as downloads, and the service worker never caches them.

### sessions

`clubId`, `region`, `date`, `status` (`planned`, `held`, `cancelled`), `topic`, `notes` (what was done and any challenges, max 1000 characters), `photoIds` (up to 3), `cancellationReason` (optional), `reportedBy`, `reportedAt`. Optional `startTime` and `endTime`, defaulting to the club's schedule. One session per club per date (unique index).

### sessionPhotos (GridFS bucket, proposed D2-7)

Up to 3 photos per session, shrunk on the device to about 300 KB before upload. Before saving, the app lists any present learners without photo consent and the champion must confirm they are not in the photos. Photos are visible to HQ and the club's coordinator and champions, never public, and never cached by the service worker.

### attendance (separate collection, proposed D2-4)

`sessionId`, `learnerId`, `clubId`, `region`, `status` (`present`, `absent`, `late`, `excused`). Unique `sessionId + learnerId`. Kept separate from sessions so two people editing attendance offline in Sprint 3 do not overwrite each other, the same reasoning as champion assignments (D1-15).

## 6. Proposed permissions

| Capability                         | System Administrator | Programme Manager | Coordinator   | Champion           |
| ---------------------------------- | -------------------- | ----------------- | ------------- | ------------------ |
| View learners                      | All                  | All               | Their regions | Their clubs        |
| Register and edit learners         | All                  | All               | Their regions | Their clubs        |
| Enter guardian contact             | All                  | All               | Their regions | Their clubs        |
| Read guardian contact              | All                  | All               | No            | No                 |
| Upload consent form                | All                  | All               | Their regions | Their clubs        |
| View consent form                  | All                  | All               | Their regions | No (status only)   |
| Create and report sessions         | All                  | All               | Their regions | Their clubs        |
| Take attendance                    | All                  | All               | Their regions | Their clubs        |
| Add session photos                 | All                  | All               | Their regions | Their clubs        |
| Edit a session report after 7 days | All                  | All               | Their regions | No (proposed D2-5) |

As in Sprint 1, out-of-scope records return 404 and every rule is enforced on the server.

## 7. Proposed API endpoints

Prefix: `/api/v1`

| Method | Endpoint                        | Purpose                                         |
| ------ | ------------------------------- | ----------------------------------------------- |
| GET    | `/learners`                     | List learners in scope (filter by club, status) |
| POST   | `/learners`                     | Register a learner (with optional contact)      |
| GET    | `/learners/:id`                 | Get a learner                                   |
| PATCH  | `/learners/:id`                 | Update a learner                                |
| PATCH  | `/learners/:id/status`          | Mark as left or re-activate                     |
| GET    | `/learners/:id/contact`         | Guardian contact (HQ or grant only)             |
| PUT    | `/learners/:id/contact`         | Enter or replace guardian contact               |
| POST   | `/learners/:id/consent`         | Upload consent form, set status received        |
| GET    | `/learners/:id/consent/file`    | Download consent form                           |
| PATCH  | `/learners/:id/consent`         | Mark consent withdrawn                          |
| GET    | `/sessions`                     | List sessions in scope (filter by club, month)  |
| POST   | `/sessions`                     | Plan or report a session                        |
| GET    | `/sessions/:id`                 | Get a session with attendance                   |
| PATCH  | `/sessions/:id`                 | Update report, status                           |
| PUT    | `/sessions/:id/attendance`      | Save the whole attendance list at once          |
| POST   | `/sessions/:id/photos`          | Add a photo (photo consent check)               |
| GET    | `/sessions/:id/photos/:photoId` | View a photo in scope                           |
| DELETE | `/sessions/:id/photos/:photoId` | Remove a photo                                  |
| GET    | `/dashboard/summary`            | Adds learner, session and attendance counts     |

Every learner, contact, consent and attendance change is written to the audit log. Reading a guardian contact or a consent file is also audited, because it is access to a child's personal data.

## 8. Screens

- **Learners list**: search, filter by club and status, consent badge.
- **Learner form**: the fields above; guardian contact section that champions can fill in but not see again.
- **Learner detail**: details, consent status and upload, guardian contact only for permitted users.
- **Club detail**: new Learners and Sessions sections.
- **Sessions list**: by club and month, with status.
- **Session report**: one tablet-first page with topic, notes, photos and an attendance checklist of the club's learners (large tap targets, "all present" shortcut).
- **Dashboard**: new counts and a "missing consent" list for coordinators and HQ.

## 9. User stories

- **US-07 Register learners.** A champion registers a learner in their club with only the agreed fields; duplicates (same name, birth year and club) are warned about.
- **US-08 Guardian contacts.** Contacts are stored separately; only STEAMLabs HQ roles can read them; reads are audited.
- **US-09 Consent.** Participation and photo consent are recorded separately; a signed form can be uploaded; learners without participation consent are flagged on the club page and in attendance.
- **US-10 Sessions.** A champion reports a session for their club: topic, notes or challenges, and up to 3 photos, only of learners with photo consent.
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
- **D2-7** Session photos (max 3, about 300 KB each) in GridFS, with a photo-consent confirmation before saving.
- **D2-8** A learner belongs to one club for life; no club moves (questionnaire Q17).

## 12. New risks

| ID   | Risk                                                                                        | Mitigation                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2-1 | Real learner data is entered before the Data Protection Act steps are done                  | Fictional data only until R1-13 is closed; say so in the README and the demo                                                                                    |
| R2-2 | Consent files leak (they show guardian names and signatures)                                | No public URLs, authorised download only, audited, never cached by the service worker                                                                           |
| R2-3 | Champions upload photos of children instead of the form                                     | Upload screen says what to photograph; HQ can delete a wrong file                                                                                               |
| R2-4 | Atlas free tier storage (512 MB) fills with consent files                                   | 5 MB limit; client shrinks photos before upload; watch usage; move files to object storage later                                                                |
| R2-5 | Session reports differ between champions                                                    | Fixed short form from the questionnaire answers; compare with the existing feedback form (Q31)                                                                  |
| R2-6 | Keeping learner records forever (Q45) breaches the Data Protection Act's storage limitation | Propose: keep anonymised attendance counts forever, remove names and contacts a set time after a learner leaves; agree the period with the data protection lead |
| R2-7 | A session photo shows a child without photo consent                                         | Consent check and confirmation before saving; HQ can delete any photo; deletions audited                                                                        |

## 13. Questions for STEAMLabs

Answered by the questionnaire: session report contents, who reads guardian contacts, club moves, photos. Still open:

1. Which learner details does HQ want? Names are needed for attendance; are gender, grade and birth year wanted for reporting? (Q15 said "none", to confirm.)
2. Can we have a copy of the blank consent form and the existing session feedback form (Q31)?
3. Should learners without participation consent be allowed to attend and be marked present?
4. Is consent collected once, or again every year or term?
5. How long after a learner leaves should their name and contacts be kept? (Q45 said forever; see R2-6.)
6. The roles and permissions meeting (Q34): when is it, and can we join with the Sprint 1 permission matrix?

## 14. Definition of Done

- [ ] All six user stories meet their criteria, online.
- [ ] Guardian contacts never appear in responses for roles without permission (tested).
- [ ] Consent files are type checked, size limited and only downloadable in scope (tested).
- [ ] Every new endpoint has allowed and denied scope tests.
- [ ] Reads of contacts and consent files are audited.
- [ ] New screens work on a tablet and a phone, in English and Kiswahili.
- [ ] Session photos are refused or confirmed when a present learner has no photo consent (tested).
- [ ] Demo mode and the real server pass the same Playwright flow.
- [ ] Seed and demo data contain only fictional learners.
- [ ] Docs, decision log and risk register updated.
