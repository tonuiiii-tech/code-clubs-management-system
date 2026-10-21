# Risk register

IDs are R<sprint>-<n>. Status of every risk below: open. Full context: [sprints/sprint-1.md](sprints/sprint-1.md).

| ID | Risk | Mitigation |
| --- | --- | --- |
| R1-1 | Roles change after the HQ meeting | Policy file + tests generated from the policy table |
| R1-2 | Wrong device clocks distort last-write-wins | Server sequence for pull; clamp future timestamps; consider a hybrid logical clock in Sprint 3 |
| R1-3 | Lost or shared laptops/tablets hold learner data in IndexedDB | Cache only the facilitator's own clubs, never contacts without permission; wipe Dexie on logout; local PIN / encryption reviewed in Sprint 3 |
| R1-4 | Kenya Data Protection Act: children's data and indefinite retention | Needs HQ confirmation of ODPC registration, a DPIA and a written retention justification; I can draft, but it needs legal review |
| R1-5 | Sprint 3 is heavy (sync engine, file queue, offline caching, offline tests) | Sync engine first; if time runs short, the file upload queue moves to early Sprint 4 |
| R1-6 | PWA storage can be evicted, especially on iOS Safari | Request persistent storage; show a warning if denied; confirm devices in use |
| R1-7 | Facilitators without email cannot self-reset passwords | HQ or coordinator resets until the SMS provider exists |
| R1-8 | mongodb-memory-server binary download blocked on some networks | Cache in CI; README fallback to a local MongoDB for tests |
| R1-9 | steamlabsui is a new v1.0.0, marked UNLICENSED, and brand colours limit contrast (white on Clover Green 3.4:1) | Pin the exact version; confirm STEAMLabs owns the package; follow the kit's contrast rules and run axe checks in Playwright |
| R1-10 | Offline is the top field requirement (most venues have no internet) but arrives in Sprint 3, so facilitators cannot use the app at venues until then | Sync fields and `services/` layer from Sprint 1 so Sprint 3 needs no rework; Friday demo is presented as online-first with offline on the roadmap |
