# Sync protocol

**Sprint:** 3 · **Decisions:** D3-1 to D3-9 · **Last updated:** 2026-10-25

This is how a device that works offline exchanges changes with the server. Only Club Champions and Code Clubs Coordinators sync (D3-1). System Administrators and Programme Managers use the API directly.

## 1. Principles

1. **The server decides.** Every change from a device goes through the same service functions as the online endpoints, so the same Zod schemas, permission policy, scope rules and audit entries apply. A device cannot do offline what it could not do online.
2. **Nothing is lost silently.** A change the server refuses comes back with its reason and stays on the device until the user deals with it.
3. **Repeating is harmless.** Every change carries an ID made on the device (`opId`). Sending it twice applies it once.
4. **The device holds as little as possible.** It keeps only the user's own scope, never guardian contacts or consent forms once sent, and forgets everything on sign-out or after 14 days without a sync.

## 2. Records that sync

| Records           | Pulled to the device                                               | Changed offline                            |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| Schools           | In scope                                                           | No                                         |
| Clubs             | In scope                                                           | No                                         |
| Learners          | In scope, with `hasContact` (never the contact)                    | Register, edit, mark as left, reactivate   |
| Consents          | Status, date signed and whether a form is on file (never the form) | Status, date signed, attach a form         |
| Sessions          | In scope, dated in the last 120 days or in the future              | Plan, report, edit                         |
| Attendance        | For the sessions above                                             | Take attendance                            |
| Guardian contacts | Never                                                              | Enter (sent, then deleted from the device) |
| Session photos    | Never (viewed online)                                              | Add (sent, then deleted from the device)   |

## 3. Push: `POST /api/v1/sync/push`

The device sends its outbox in order, at most 50 operations per request.

```json
{
  "operations": [
    {
      "opId": "3f1c…",
      "type": "learner.update",
      "recordId": "9a7e…",
      "recordedAt": "2026-11-20T09:41:00.000Z",
      "data": { "grade": "grade_7" },
      "base": { "grade": "grade_6" }
    }
  ]
}
```

| `type`               | `recordId` | `params`   | `data` is the body of              |
| -------------------- | ---------- | ---------- | ---------------------------------- |
| `learner.create`     | (none)     |            | `POST /learners`, with `id`        |
| `learner.update`     | learner    |            | `PATCH /learners/:id`              |
| `learner.status`     | learner    |            | `PATCH /learners/:id/status`       |
| `learner.contact`    | learner    |            | `PUT /learners/:id/contact`        |
| `consent.set`        | learner    | `{ type }` | `PUT /learners/:id/consents/:type` |
| `session.create`     | (none)     |            | `POST /sessions`, with `id`        |
| `session.update`     | session    |            | `PATCH /sessions/:id`              |
| `session.attendance` | session    |            | `PUT /sessions/:id/attendance`     |

- `id` in a create is a UUID made on the device; the record keeps it on the server (D1-6).
- `recordedAt` is when the change was made on the device. See section 6.
- `base` holds the values the device saw before the change, for the fields it changes. It is used only to detect conflicts (section 5).

The answer has one result per operation, in the same order:

```json
{
  "data": {
    "results": [
      { "opId": "3f1c…", "status": "applied" },
      { "opId": "77b2…", "status": "applied", "conflicts": ["topic"] },
      { "opId": "c901…", "status": "applied", "recordId": "e4d0…", "joined": true },
      {
        "opId": "a5e3…",
        "status": "rejected",
        "error": { "code": "POSSIBLE_DUPLICATE", "message": "…", "details": [] }
      },
      { "opId": "d812…", "status": "skipped" }
    ]
  }
}
```

| Status     | Meaning                                                                                            | Device does                              |
| ---------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `applied`  | Saved. `conflicts` lists fields where someone else's value was overwritten (logged on the server). | Removes it from the outbox               |
| `rejected` | Refused with the same error the online endpoint gives                                              | Moves it to "Needs attention"            |
| `skipped`  | Not tried because an earlier operation on the same record was refused in this request              | Keeps it, blocked behind the refused one |

**Idempotency.** The server stores each `opId` with its result in `syncOperations` (kept 30 days). An `opId` it has seen gets the stored result back and changes nothing. Refused operations are stored too, so a retry gets the same answer until the device sends a new operation (for example with `confirmDuplicate: true`).

**Order.** Operations run one after another in the order sent, so a learner registered and then given consent in the same batch works.

### Files

Consent forms and session photos go to the existing upload endpoints after the operation that created their record has been applied:

- `PUT /learners/:id/consents/:type/file`: a new upload replaces the old file, so repeating it is harmless.
- `POST /sessions/:id/photos?confirmConsent=…&opId=…&recordedAt=…`: the server stores `opId` with the photo, and a second upload with the same `opId` returns the session unchanged.

## 4. Pull: `GET /api/v1/sync/pull`

```
GET /api/v1/sync/pull?cursor=<opaque>&scopeKey=<from last pull>
```

The answer:

```json
{
  "data": {
    "scopeKey": "c8f1…",
    "reset": false,
    "changes": {
      "schools": [],
      "clubs": [],
      "learners": [],
      "consents": [],
      "sessions": [],
      "attendance": []
    },
    "deleted": { "attendance": ["…"] },
    "cursor": "<opaque>",
    "more": false,
    "serverTime": "2026-11-20T10:02:11.000Z"
  }
}
```

- **Cursor.** For each kind of record, the cursor holds the last `(updatedAt, id)` the device has. The server returns records changed after it, oldest first, at most 500 of each kind per page. `more: true` means "ask again with the new cursor".
- **Overlap.** The first page of every pull starts 2 minutes before the saved cursor. Two saves that finish out of order can never be missed this way, and the device simply saves the repeated records again (D3-4).
- **Deletions.** Only attendance marks are ever deleted (when a whole list is saved online without a learner). The server keeps a tombstone for 30 days and sends its ID in `deleted`.
- **Scope changes.** `scopeKey` is a hash of the clubs in the user's scope. If it differs from the device's, the answer has `reset: true` and the full scope from the start. The device wipes its records (not its outbox) and saves the new ones. This covers a champion added to or removed from a club and a coordinator's regions changing. A device without a cursor also gets the full scope.
- **Shapes.** Records have the same fields as the online API (learners with `age` and `hasContact`, consents without file IDs). Sessions come without their attendance list; attendance marks come on their own.

After every pull, the device applies its unsent operations again on top of what it received, so the screen always shows "server state plus my unsent changes".

## 5. Conflicts

The server compares `base` with what it has now:

| Situation                                                | Result                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Field unchanged since the device saw it                  | Applied, no conflict                                                                                                                                                                                                                                                                          |
| Someone else changed a field this operation also changes | Applied (last write wins, D3-5). The overwritten value goes to `syncConflicts` and the result lists the field.                                                                                                                                                                                |
| Different fields changed by different people             | Both kept, because an update only sets the fields it carries                                                                                                                                                                                                                                  |
| Attendance                                               | Merged per learner: an offline attendance list adds or changes marks and never removes other learners' marks (D2-4)                                                                                                                                                                           |
| Two sessions for the same club and date                  | The second is joined to the first (D3-6): empty fields of the existing session are filled in, the result carries the existing `recordId` and `joined: true`, and later operations in the request that use the device's ID are pointed at the existing session. The device renames its record. |

Conflict values of fields that are never written to the audit log (`accessibilityNeeds`, contact fields) are stored as "changed" without the value. Guardian contacts are never compared.

`GET /api/v1/sync/conflicts` lists conflicts in scope for coordinators and HQ (`syncConflict:read`).

## 6. Time

- `recordedAt` comes from the device clock. The server refuses a value more than 5 minutes in the future (`INVALID_RECORDED_AT`).
- The 7-day window for champions to change a session report (D2-5) is checked against `recordedAt` when it is at most 14 days old, and against the server time otherwise (D3-7). The audit entry keeps the server time.
- A learner registered offline gets `joinedAt` from `recordedAt`; a held session gets `reportedAt` from it.

## 7. On the device

- One Dexie (IndexedDB) database per user, `cc-offline-<userId>`, with tables for each record kind, `outbox`, `pendingFiles` and `meta` (cursor, scope key, last sync).
- Screens read from it once the first pull has finished; before that they use the API.
- A sync runs on start, when the connection comes back, when the app comes to the front, 2 seconds after each change, every 5 minutes while online, and on "Sync now". Only one sync runs at a time, also across tabs.
- Each sync pushes first, then pulls. Network failures retry with growing waits (5 s, 15 s, 1 min, 5 min).

## 8. Signing in and out

- The first sign-in on a device must be online. Afterwards, if the device is offline when the app opens, it starts from the saved profile when the last successful sync was at most 14 days ago.
- When the connection comes back the refresh cookie gets a new access token. A deactivated account is refused and the app signs out.
- Signing out deletes the user's local database. If there are unsent changes the app warns first and offers to sync.
- Every start deletes local databases that have not synced for 14 days.

## 9. Errors

| Code                  | When                                                  |
| --------------------- | ----------------------------------------------------- |
| `VALIDATION_ERROR`    | The request or an operation does not match its schema |
| `INVALID_RECORDED_AT` | `recordedAt` is in the future                         |
| `SYNC_NOT_AVAILABLE`  | Pull by a role that does not sync (D3-1)              |
| Any service error     | Returned inside the operation's result, as online     |
