/**
 * Sprint 4 in the demo API: terms, HQ dashboard, alerts, termly report, events and announcements.
 * Same rules, numbers and errors as server/src/modules (R1-19): the numbers come from the same
 * shared/src/insights.js, so demo and server agree.
 */
import { EVENT_MAX_PHOTOS, PHOTO_TYPES, ROLES, UPLOAD_TYPES } from '@code-clubs/shared/enums';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { buildHqDashboard, buildTermReport, computeAlerts } from '@code-clubs/shared/insights';
import { scopeFor } from '@code-clubs/shared/permissions';
import {
  alertsQuerySchema,
  createAnnouncementSchema,
  createEventProjectSchema,
  createEventSchema,
  createTermSchema,
  eventClubsSchema,
  eventConsentSchema,
  eventPhotoQuerySchema,
  hqDashboardQuerySchema,
  idSchema,
  listAnnouncementsQuerySchema,
  listEventsQuerySchema,
  listOutboxQuerySchema,
  participantStatusSchema,
  registerParticipantsSchema,
  reportRecipientsSchema,
  termForDate,
  termReportQuerySchema,
  updateEventProjectSchema,
  updateEventSchema,
  updateTermSchema,
} from '@code-clubs/shared/schemas';

const ALERT_LOOKBACK_DAYS = 90;
const isPresent = (status) => status === 'present' || status === 'late';
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

/** @param {object} ctx helpers from mockApi.js, which owns the store */
export function sprint4Routes(ctx) {
  const {
    getDb,
    authorize,
    scopeFilter,
    clubInFilter,
    clubRecordInFilter,
    currentAssignments,
    validate,
    paginate,
    checkFile,
    files,
    errors: { badRequest, forbidden, notFound, conflict },
    today,
    now,
  } = ctx;
  const idParam = (id, name = 'id') => validate(idSchema, id, `params.${name}`);
  const stampNew = (actor) => ({
    createdAt: now(),
    updatedAt: now(),
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  const stampChange = (actor) => ({ updatedAt: now(), updatedBy: actor.id });
  const fullName = (l) => `${l.firstName} ${l.lastName}`;
  const filterFor = (actor, permission) => scopeFilter(actor, scopeFor(actor, permission));

  // -------------------------------------------------------------------------
  // Insights: the same rows the server's insights.repository returns.

  function clubData(filter, { region, clubId, from, to }) {
    const db = getDb();
    const clubs = db.clubs
      .filter((c) => clubInFilter(c, filter))
      .filter((c) => (!region || c.region === region) && (!clubId || c.id === clubId));
    const ids = new Set(clubs.map((c) => c.id));
    const learners = db.learners.filter((l) => ids.has(l.clubId));
    const sessions = db.sessions.filter(
      (s) => ids.has(s.clubId) && (!from || s.date >= from) && (!to || s.date <= to),
    );
    const sessionIds = new Set(sessions.map((s) => s.id));
    const bySession = {};
    for (const a of db.attendance) {
      if (!sessionIds.has(a.sessionId)) continue;
      bySession[a.sessionId] ??= { sessionId: a.sessionId, present: 0, total: 0 };
      bySession[a.sessionId].total += 1;
      if (isPresent(a.status)) bySession[a.sessionId].present += 1;
    }
    return {
      clubs,
      clubIds: [...ids],
      learners,
      sessions,
      sessionAttendance: Object.values(bySession),
    };
  }

  const eventInFilter = (event, filter) => {
    if (filter.all) return true;
    if (filter.regions) return event.region === null || filter.regions.includes(event.region);
    if (filter.championUserId) {
      return event.clubIds.some((id) =>
        currentAssignments(id).some((a) => a.userId === filter.championUserId),
      );
    }
    return false;
  };
  const eventsInFilter = (filter) => getDb().events.filter((e) => eventInFilter(e, filter));
  const eventsFor = (events, clubIds, { region, clubId }) =>
    events.filter((e) => {
      if (clubId) return e.clubIds.includes(clubId);
      if (region) return e.region === region || e.clubIds.some((id) => clubIds.includes(id));
      return true;
    });

  function findTerm(id) {
    const term = getDb().terms.find((t) => t.id === id);
    if (!term) throw notFound(ERROR_MESSAGES.termNotFound);
    return term;
  }

  function termReport(actor, scope, query) {
    const filter = scopeFilter(actor, scope);
    const { termId, region, clubId } = validate(termReportQuerySchema, query, 'query');
    const term = findTerm(termId);
    const data = clubData(filter, { region, clubId, from: term.startDate, to: term.endDate });
    if (clubId && !data.clubs.length) throw notFound(ERROR_MESSAGES.clubNotFound);
    const events = eventsFor(
      eventsInFilter(filter).filter(
        (e) => e.endDate >= term.startDate && e.startDate <= term.endDate,
      ),
      data.clubIds,
      { region, clubId },
    );
    const eventIds = new Set(events.map((e) => e.id));
    const participants = getDb().eventParticipants.filter(
      (p) => eventIds.has(p.eventId) && data.clubIds.includes(p.clubId),
    );
    return buildTermReport({
      term,
      scope: {
        region: region ?? null,
        regions: filter.regions ?? null,
        club: clubId ? data.clubs[0] : null,
      },
      ...data,
      events,
      participants,
      generatedAt: now(),
    });
  }

  function checkTermDates(term, id) {
    if (
      getDb().terms.some(
        (t) => t.id !== id && t.startDate <= term.endDate && term.startDate <= t.endDate,
      )
    ) {
      throw conflict(ERROR_MESSAGES.termOverlap);
    }
  }

  // -------------------------------------------------------------------------
  // Events

  function findEvent(actor, id) {
    const event = getDb().events.find((e) => e.id === id);
    if (!event || !eventInFilter(event, filterFor(actor, 'event:read'))) {
      throw notFound(ERROR_MESSAGES.eventNotFound);
    }
    return event;
  }

  function findManagedEvent(actor, scope, id) {
    const filter = scopeFilter(actor, scope);
    const event = findEvent(actor, id);
    if (filter.all || (filter.regions && filter.regions.includes(event.region))) return event;
    throw forbidden(ERROR_MESSAGES.eventOwnRegion);
  }

  function checkRegionAndClubs(actor, scope, { region, clubIds }) {
    const filter = scopeFilter(actor, scope);
    if (filter.regions && !filter.regions.includes(region)) {
      throw forbidden(ERROR_MESSAGES.eventOwnRegion);
    }
    const clubs = getDb().clubs.filter((c) => clubIds.includes(c.id));
    if (clubs.length !== new Set(clubIds).size) throw badRequest(ERROR_MESSAGES.clubNotFound);
    if (region && clubs.some((c) => c.region !== region)) {
      throw badRequest(ERROR_MESSAGES.eventClubNotInRegion);
    }
    if (filter.regions && clubs.some((c) => !filter.regions.includes(c.region))) {
      throw forbidden(ERROR_MESSAGES.eventOwnRegion);
    }
  }

  const registrationOpen = (event) =>
    ['planned', 'open'].includes(event.status) &&
    today() <= (event.registrationCloses ?? event.startDate);

  const activeParticipants = (eventId) =>
    getDb().eventParticipants.filter((p) => p.eventId === eventId && p.status !== 'withdrawn');

  function eventDetail(actor, event) {
    const db = getDb();
    const manage = filterFor(actor, 'eventParticipant:manage');
    const mine = activeParticipants(event.id).filter((p) => clubRecordInFilter(p, manage));
    const given = mine.filter((p) =>
      db.eventConsents.some(
        (c) => c.eventId === event.id && c.learnerId === p.learnerId && c.status === 'given',
      ),
    ).length;
    return {
      ...event,
      clubs: db.clubs
        .filter((c) => event.clubIds.includes(c.id))
        .map(({ id, code, name, region }) => ({ id, code, name, region })),
      registered: activeParticipants(event.id).length,
      registrationOpen: registrationOpen(event),
      myParticipants: mine.length,
      consentMissing: mine.length - given,
    };
  }

  function participantList(actor, scope, eventId) {
    const db = getDb();
    const filter = scopeFilter(actor, scope);
    return db.eventParticipants
      .filter((p) => p.eventId === eventId && clubRecordInFilter(p, filter))
      .map((p) => {
        const learner = db.learners.find((l) => l.id === p.learnerId);
        const consent = db.eventConsents.find(
          (c) => c.eventId === eventId && c.learnerId === p.learnerId,
        );
        return {
          learnerId: p.learnerId,
          name: learner ? fullName(learner) : '',
          learnerNumber: learner?.learnerNumber ?? null,
          clubId: p.clubId,
          clubCode: db.clubs.find((c) => c.id === p.clubId)?.code ?? null,
          status: p.status,
          consent: consent?.status ?? 'pending',
          consentSignedOn: consent?.signedOn ?? null,
          hasConsentFile: Boolean(consent?.fileId),
        };
      })
      .sort(
        (a, b) =>
          (a.clubCode ?? '').localeCompare(b.clubCode ?? '') || a.name.localeCompare(b.name),
      );
  }

  function findParticipant(actor, scope, eventId, learnerId) {
    findEvent(actor, eventId);
    const learner = getDb().learners.find((l) => l.id === learnerId);
    const participant =
      learner &&
      clubRecordInFilter(learner, scopeFilter(actor, scope)) &&
      getDb().eventParticipants.find((p) => p.eventId === eventId && p.learnerId === learnerId);
    if (!participant) throw notFound(ERROR_MESSAGES.participantNotFound);
    return { participant, learner };
  }

  function upsertEventConsent(actor, participant, changes) {
    const db = getDb();
    let consent = db.eventConsents.find(
      (c) => c.eventId === participant.eventId && c.learnerId === participant.learnerId,
    );
    if (!consent) {
      consent = {
        id: crypto.randomUUID(),
        eventId: participant.eventId,
        learnerId: participant.learnerId,
        clubId: participant.clubId,
        region: participant.region,
        status: 'pending',
        signedOn: null,
        fileId: null,
        ...stampNew(actor),
      };
      db.eventConsents.push(consent);
    }
    Object.assign(consent, changes, stampChange(actor));
    return consent;
  }

  function projectList(actor, eventId) {
    const db = getDb();
    const visible = filterFor(actor, 'learner:read');
    return db.eventProjects
      .filter((p) => p.eventId === eventId)
      .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.createdAt.localeCompare(b.createdAt))
      .map(({ learnerIds, ...p }) => {
        const club = db.clubs.find((c) => c.id === p.clubId);
        return {
          ...p,
          clubCode: club?.code ?? null,
          clubName: club?.name ?? null,
          learnerCount: learnerIds.length,
          learners: learnerIds
            .map((id) => db.learners.find((l) => l.id === id))
            .filter((l) => l && clubRecordInFilter(l, visible))
            .map((l) => ({ id: l.id, name: fullName(l) })),
        };
      });
  }

  function checkProject(actor, scope, eventId, input) {
    if (('award' in input || 'rank' in input) && !scopeFor(actor, 'event:manage')) {
      throw forbidden();
    }
    if (!input.learnerIds) return {};
    const filter = scopeFilter(actor, scope);
    const registered = new Set(activeParticipants(eventId).map((p) => p.learnerId));
    const learners = input.learnerIds.map((id) => getDb().learners.find((l) => l.id === id));
    if (learners.some((l) => !l || !clubRecordInFilter(l, filter) || !registered.has(l.id))) {
      throw badRequest(ERROR_MESSAGES.eventProjectLearners);
    }
    return { clubId: learners[0].clubId, region: learners[0].region };
  }

  // -------------------------------------------------------------------------
  // Announcements

  function audienceUsers({ roles, regions, clubIds }, excludeId) {
    const db = getDb();
    const located = regions.length || clubIds.length;
    const regionClubIds = db.clubs.filter((c) => regions.includes(c.region)).map((c) => c.id);
    const championIds = new Set(
      db.assignments
        .filter((a) => !a.endDate && [...regionClubIds, ...clubIds].includes(a.clubId))
        .map((a) => a.userId),
    );
    return db.users.filter(
      (u) =>
        u.status === 'active' &&
        u.id !== excludeId &&
        (!roles.length || roles.includes(u.role)) &&
        (!located ||
          (u.role === ROLES.COORDINATOR && u.regions?.some((r) => regions.includes(r))) ||
          (u.role === ROLES.CHAMPION && championIds.has(u.id))),
    );
  }

  function scopedAudience(actor, scope, audience) {
    const filter = scopeFilter(actor, scope);
    if (!filter.regions) return audience;
    const outside = (r) => !filter.regions.includes(r);
    if (audience.regions.some(outside)) throw forbidden(ERROR_MESSAGES.announcementOwnRegion);
    const clubs = getDb().clubs.filter((c) => audience.clubIds.includes(c.id));
    if (clubs.length !== new Set(audience.clubIds).size) {
      throw badRequest(ERROR_MESSAGES.clubNotFound);
    }
    if (clubs.some((c) => outside(c.region))) throw forbidden(ERROR_MESSAGES.announcementOwnRegion);
    return audience.regions.length || audience.clubIds.length
      ? audience
      : { ...audience, regions: filter.regions };
  }

  const readCount = (id) => getDb().announcementReads.filter((r) => r.announcementId === id).length;
  const isRead = (id, userId) =>
    getDb().announcementReads.some((r) => r.announcementId === id && r.userId === userId);

  function findAnnouncement(actor, id) {
    const a = getDb().announcements.find((x) => x.id === id);
    if (!a || (a.senderId !== actor.id && !a.recipientIds.includes(actor.id))) {
      throw notFound(ERROR_MESSAGES.announcementNotFound);
    }
    return a;
  }

  function markRead(actor, id, readAt = now()) {
    const a = getDb().announcements.find((x) => x.id === id);
    if (!a || !a.recipientIds.includes(actor.id)) {
      throw notFound(ERROR_MESSAGES.announcementNotFound);
    }
    if (!isRead(id, actor.id)) {
      getDb().announcementReads.push({
        id: crypto.randomUUID(),
        announcementId: id,
        userId: actor.id,
        readAt,
        createdAt: now(),
        updatedAt: now(),
      });
    }
    return { announcementId: id, read: true };
  }

  function recordMessage(message) {
    const db = getDb();
    db.outboundMessages ??= [];
    db.outboundMessages.push({
      id: crypto.randomUUID(),
      provider: 'stub',
      status: 'recorded',
      ...message,
      createdAt: now(),
      updatedAt: now(),
    });
  }

  const routes = [
    // Terms
    [
      'GET',
      '/terms',
      () => [
        200,
        { data: [...getDb().terms].sort((a, b) => a.startDate.localeCompare(b.startDate)) },
      ],
    ],
    [
      'POST',
      '/terms',
      ({ actor, body }) => {
        authorize(actor, 'term:manage');
        const input = validate(createTermSchema, body, 'body');
        const db = getDb();
        if (db.terms.some((t) => t.year === input.year && t.number === input.number)) {
          throw conflict(ERROR_MESSAGES.duplicateTerm);
        }
        checkTermDates(input);
        const term = { id: crypto.randomUUID(), ...input, ...stampNew(actor) };
        db.terms.push(term);
        return [201, { data: term }];
      },
    ],
    [
      'PATCH',
      '/terms/:id',
      ({ actor, params, body }) => {
        authorize(actor, 'term:manage');
        const term = findTerm(idParam(params.id));
        const changes = validate(updateTermSchema, body, 'body');
        const merged = { ...term, ...changes };
        if (merged.endDate <= merged.startDate) {
          throw badRequest(ERROR_MESSAGES.invalidFields, [
            { field: 'body.endDate', message: 'End date must be after start date' },
          ]);
        }
        checkTermDates(merged, term.id);
        Object.assign(term, changes, stampChange(actor));
        return [200, { data: term }];
      },
    ],

    // HQ dashboard and alerts
    [
      'GET',
      '/dashboard/hq',
      ({ actor, query }) => {
        const filter = scopeFilter(actor, authorize(actor, 'dashboard:hq'));
        const { termId, region } = validate(hqDashboardQuerySchema, query, 'query');
        const day = today();
        const term = termId ? findTerm(termId) : termForDate(getDb().terms, day);
        const data = clubData(filter, {
          region,
          from: term?.startDate ?? day,
          to: term?.endDate ?? day,
        });
        const events = eventsFor(
          eventsInFilter(filter).filter((e) => e.endDate >= day),
          data.clubIds,
          { region },
        );
        return [200, { data: buildHqDashboard({ term, ...data, events, today: day }) }];
      },
    ],
    [
      'GET',
      '/alerts',
      ({ actor, query }) => {
        const filter = scopeFilter(actor, authorize(actor, 'club:read'));
        const { region, clubId } = validate(alertsQuerySchema, query, 'query');
        const db = getDb();
        const day = today();
        const data = clubData(filter, {
          region,
          clubId,
          from: daysAgo(ALERT_LOOKBACK_DAYS),
          to: day,
        });
        const events = eventsInFilter(filter).filter((e) => e.endDate >= day);
        const eventIds = new Set(events.map((e) => e.id));
        const alerts = computeAlerts({
          ...data,
          consentGivenLearnerIds: db.consents
            .filter((c) => c.type === 'participation' && c.status === 'given')
            .map((c) => c.learnerId),
          events,
          participants: db.eventParticipants.filter(
            (p) => eventIds.has(p.eventId) && data.clubIds.includes(p.clubId),
          ),
          eventConsents: db.eventConsents.filter((c) => eventIds.has(c.eventId)),
          terms: db.terms,
          today: day,
        });
        return [200, { data: alerts }];
      },
    ],

    // Termly report: on screen in demo mode; the PDF needs the server (D4-4).
    [
      'GET',
      '/reports/termly',
      ({ actor, query }) => [
        200,
        { data: termReport(actor, authorize(actor, 'report:read'), query) },
      ],
    ],
    [
      'GET',
      '/reports/recipients',
      ({ actor }) => {
        authorize(actor, 'report:schedule');
        return [200, { data: getDb().reportRecipients ?? [] }];
      },
    ],
    [
      'PUT',
      '/reports/recipients',
      ({ actor, body }) => {
        authorize(actor, 'report:schedule');
        const { recipients } = validate(reportRecipientsSchema, body, 'body');
        getDb().reportRecipients = recipients;
        return [200, { data: recipients }];
      },
    ],
    [
      'GET',
      '/notifications/outbox',
      ({ actor, query }) => {
        authorize(actor, 'report:schedule');
        const q = validate(listOutboxQuerySchema, query, 'query');
        const rows = [...(getDb().outboundMessages ?? [])].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        return [200, paginate(rows, q)];
      },
    ],

    // Events
    [
      'GET',
      '/events',
      ({ actor, query }) => {
        const filter = scopeFilter(actor, authorize(actor, 'event:read'));
        const q = validate(listEventsQuerySchema, query, 'query');
        const rows = eventsInFilter(filter)
          .filter(
            (e) =>
              (!q.status || e.status === q.status) &&
              (!q.from || e.endDate >= q.from) &&
              (!q.region || e.region === q.region),
          )
          .sort((a, b) =>
            q.from
              ? a.startDate.localeCompare(b.startDate)
              : b.startDate.localeCompare(a.startDate),
          );
        return [200, paginate(rows, q)];
      },
    ],
    [
      'POST',
      '/events',
      ({ actor, body }) => {
        const scope = authorize(actor, 'event:manage');
        const { clubIds, ...fields } = validate(createEventSchema, body, 'body');
        checkRegionAndClubs(actor, scope, { region: fields.region, clubIds });
        const event = {
          id: crypto.randomUUID(),
          description: '',
          ...fields,
          clubIds: [...new Set(clubIds)],
          photoIds: [],
          ...stampNew(actor),
        };
        getDb().events.push(event);
        return [201, { data: eventDetail(actor, event) }];
      },
    ],
    [
      'GET',
      '/events/:id',
      ({ actor, params }) => {
        authorize(actor, 'event:read');
        return [200, { data: eventDetail(actor, findEvent(actor, idParam(params.id))) }];
      },
    ],
    [
      'PATCH',
      '/events/:id',
      ({ actor, params, body }) => {
        const scope = authorize(actor, 'event:manage');
        const event = findManagedEvent(actor, scope, idParam(params.id));
        const changes = validate(updateEventSchema, body, 'body');
        const merged = { ...event, ...changes };
        if (merged.endDate < merged.startDate) {
          throw badRequest(ERROR_MESSAGES.invalidFields, [
            { field: 'body.endDate', message: 'End date cannot be before start date' },
          ]);
        }
        if ('region' in changes) checkRegionAndClubs(actor, scope, merged);
        Object.assign(event, changes, stampChange(actor));
        return [200, { data: eventDetail(actor, event) }];
      },
    ],
    [
      'PUT',
      '/events/:id/clubs',
      ({ actor, params, body }) => {
        const scope = authorize(actor, 'event:manage');
        const event = findManagedEvent(actor, scope, idParam(params.id));
        const { clubIds } = validate(eventClubsSchema, body, 'body');
        checkRegionAndClubs(actor, scope, { region: event.region, clubIds });
        Object.assign(event, { clubIds: [...new Set(clubIds)] }, stampChange(actor));
        return [200, { data: eventDetail(actor, event) }];
      },
    ],
    [
      'GET',
      '/events/:id/participants',
      ({ actor, params }) => {
        const scope = authorize(actor, 'eventParticipant:manage');
        const id = idParam(params.id);
        findEvent(actor, id);
        return [200, { data: participantList(actor, scope, id) }];
      },
    ],
    [
      'POST',
      '/events/:id/participants',
      ({ actor, params, body }) => {
        const scope = authorize(actor, 'eventParticipant:manage');
        const id = idParam(params.id);
        const event = findEvent(actor, id);
        const { learnerIds } = validate(registerParticipantsSchema, body, 'body');
        if (!registrationOpen(event)) throw conflict(ERROR_MESSAGES.eventClosed);
        const db = getDb();
        const filter = scopeFilter(actor, scope);
        const learners = learnerIds.map((l) => db.learners.find((x) => x.id === l));
        if (learners.some((l) => !l || !clubRecordInFilter(l, filter))) {
          throw notFound(ERROR_MESSAGES.learnerNotFound);
        }
        const fail = (message, list) =>
          conflict(
            message,
            'CONFLICT',
            list.map((l) => ({ learnerId: l.id, name: fullName(l) })),
          );
        const inactive = learners.filter((l) => l.status !== 'active');
        if (inactive.length) throw fail(ERROR_MESSAGES.learnerInactive, inactive);
        const notInvited = learners.filter((l) => !event.clubIds.includes(l.clubId));
        if (notInvited.length) throw fail(ERROR_MESSAGES.eventClubNotInvited, notInvited);
        const existing = db.eventParticipants.filter((p) => p.eventId === id);
        const already = learners.filter((l) =>
          existing.some((p) => p.learnerId === l.id && p.status !== 'withdrawn'),
        );
        if (already.length) throw fail(ERROR_MESSAGES.alreadyRegistered, already);
        if (event.capacity && activeParticipants(id).length + learners.length > event.capacity) {
          throw conflict(ERROR_MESSAGES.eventFull);
        }
        for (const l of learners) {
          const row = existing.find((p) => p.learnerId === l.id);
          if (row) Object.assign(row, { status: 'registered' }, stampChange(actor));
          else {
            db.eventParticipants.push({
              id: crypto.randomUUID(),
              eventId: id,
              learnerId: l.id,
              clubId: l.clubId,
              region: l.region,
              status: 'registered',
              ...stampNew(actor),
            });
          }
        }
        return [201, { data: participantList(actor, scope, id) }];
      },
    ],
    [
      'PATCH',
      '/events/:id/participants/:learnerId',
      ({ actor, params, body }) => {
        const scope = authorize(actor, 'eventParticipant:manage');
        const id = idParam(params.id);
        const { participant } = findParticipant(
          actor,
          scope,
          id,
          idParam(params.learnerId, 'learnerId'),
        );
        const { status } = validate(participantStatusSchema, body, 'body');
        Object.assign(participant, { status }, stampChange(actor));
        return [200, { data: participantList(actor, scope, id) }];
      },
    ],
    [
      'PUT',
      '/events/:id/consents/:learnerId',
      ({ actor, params, body }) => {
        const scope = authorize(actor, 'eventParticipant:manage');
        const id = idParam(params.id);
        const { participant } = findParticipant(
          actor,
          scope,
          id,
          idParam(params.learnerId, 'learnerId'),
        );
        const input = validate(eventConsentSchema, body, 'body');
        upsertEventConsent(actor, participant, {
          status: input.status,
          signedOn: input.signedOn ?? null,
        });
        return [200, { data: participantList(actor, scope, id) }];
      },
    ],
    [
      'PUT',
      '/events/:id/consents/:learnerId/file',
      async ({ actor, params, body }) => {
        const scope = authorize(actor, 'eventParticipant:manage');
        const id = idParam(params.id);
        const { participant } = findParticipant(
          actor,
          scope,
          id,
          idParam(params.learnerId, 'learnerId'),
        );
        const fileId = await checkFile(body, UPLOAD_TYPES, ERROR_MESSAGES.fileTypeNotAllowed);
        const before = getDb().eventConsents.find(
          (c) => c.eventId === id && c.learnerId === participant.learnerId,
        );
        upsertEventConsent(actor, participant, {
          fileId,
          ...(!before && { status: 'given', signedOn: today() }),
        });
        return [200, { data: participantList(actor, scope, id) }];
      },
    ],
    [
      'GET',
      '/events/:id/consents/:learnerId/file',
      ({ actor, params }) => {
        const scope = authorize(actor, 'consentFile:read');
        const id = idParam(params.id);
        const learnerId = idParam(params.learnerId, 'learnerId');
        findParticipant(actor, scope, id, learnerId);
        const consent = getDb().eventConsents.find(
          (c) => c.eventId === id && c.learnerId === learnerId,
        );
        const file = consent?.fileId && files.get(consent.fileId);
        if (!file) throw notFound(ERROR_MESSAGES.consentFileNotFound);
        return [200, file];
      },
    ],
    [
      'GET',
      '/events/:id/projects',
      ({ actor, params }) => {
        authorize(actor, 'event:read');
        const id = idParam(params.id);
        findEvent(actor, id);
        return [200, { data: projectList(actor, id) }];
      },
    ],
    [
      'POST',
      '/events/:id/projects',
      ({ actor, params, body }) => {
        const scope = authorize(actor, 'eventParticipant:manage');
        const id = idParam(params.id);
        findEvent(actor, id);
        const input = validate(createEventProjectSchema, body, 'body');
        const club = checkProject(actor, scope, id, input);
        getDb().eventProjects.push({
          id: crypto.randomUUID(),
          eventId: id,
          link: null,
          ...input,
          ...club,
          ...stampNew(actor),
        });
        return [201, { data: projectList(actor, id) }];
      },
    ],
    [
      'PATCH',
      '/events/:id/projects/:projectId',
      ({ actor, params, body }) => {
        const scope = authorize(actor, 'eventParticipant:manage');
        const id = idParam(params.id);
        findEvent(actor, id);
        const project = getDb().eventProjects.find(
          (p) => p.id === idParam(params.projectId, 'projectId') && p.eventId === id,
        );
        if (!project) throw notFound(ERROR_MESSAGES.eventProjectNotFound);
        const changes = validate(updateEventProjectSchema, body, 'body');
        if (!scopeFor(actor, 'event:manage')) {
          const filter = scopeFilter(actor, scope);
          const own = project.learnerIds.every((l) =>
            getDb().learners.some((x) => x.id === l && clubRecordInFilter(x, filter)),
          );
          if (!own) throw forbidden();
        }
        const club = checkProject(actor, scope, id, changes);
        Object.assign(project, changes, club, stampChange(actor));
        return [200, { data: projectList(actor, id) }];
      },
    ],
    [
      'POST',
      '/events/:id/photos',
      async ({ actor, params, query, body }) => {
        const scope = authorize(actor, 'eventParticipant:manage');
        const id = idParam(params.id);
        const event = findEvent(actor, id);
        const { confirmConsent } = validate(eventPhotoQuerySchema, query, 'query');
        if (event.photoIds.length >= EVENT_MAX_PHOTOS)
          throw conflict(ERROR_MESSAGES.tooManyEventPhotos);
        const db = getDb();
        const filter = scopeFilter(actor, scope);
        const rows = db.eventParticipants.filter(
          (p) =>
            p.eventId === id &&
            ['registered', 'attended'].includes(p.status) &&
            clubRecordInFilter(p, filter),
        );
        const inPhoto = rows.some((p) => p.status === 'attended')
          ? rows.filter((p) => p.status === 'attended')
          : rows;
        const missing = inPhoto
          .map((p) => p.learnerId)
          .filter(
            (l) =>
              !db.consents.some(
                (c) => c.learnerId === l && c.type === 'photo' && c.status === 'given',
              ) ||
              !db.eventConsents.some(
                (c) => c.eventId === id && c.learnerId === l && c.status === 'given',
              ),
          );
        if (missing.length && !confirmConsent) {
          throw conflict(
            ERROR_MESSAGES.photoConsentMissing,
            'PHOTO_CONSENT_MISSING',
            missing.map((l) => ({
              learnerId: l,
              name: fullName(db.learners.find((x) => x.id === l)),
            })),
          );
        }
        const photoId = await checkFile(body, PHOTO_TYPES, ERROR_MESSAGES.photoTypeNotAllowed);
        Object.assign(event, { photoIds: [...event.photoIds, photoId] }, stampChange(actor));
        return [201, { data: eventDetail(actor, event) }];
      },
    ],
    [
      'GET',
      '/events/:id/photos/:photoId',
      ({ actor, params }) => {
        authorize(actor, 'event:read');
        const event = findEvent(actor, idParam(params.id));
        const photoId = idParam(params.photoId, 'photoId');
        const file = event.photoIds.includes(photoId) && files.get(photoId);
        if (!file) throw notFound(ERROR_MESSAGES.photoNotFound);
        return [200, file];
      },
    ],
    [
      'DELETE',
      '/events/:id/photos/:photoId',
      ({ actor, params }) => {
        const scope = authorize(actor, 'event:manage');
        const event = findManagedEvent(actor, scope, idParam(params.id));
        const photoId = idParam(params.photoId, 'photoId');
        if (!event.photoIds.includes(photoId)) throw notFound(ERROR_MESSAGES.photoNotFound);
        Object.assign(
          event,
          { photoIds: event.photoIds.filter((p) => p !== photoId) },
          stampChange(actor),
        );
        files.delete(photoId);
        return [204, null];
      },
    ],

    // Announcements
    [
      'GET',
      '/announcements',
      ({ actor, query }) => {
        authorize(actor, 'announcement:read');
        const q = validate(listAnnouncementsQuerySchema, query, 'query');
        const all = [...getDb().announcements].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        if (q.box === 'sent') {
          const rows = all
            .filter((a) => a.senderId === actor.id)
            .map(({ recipientIds, ...a }) => ({
              ...a,
              recipientCount: recipientIds.length,
              readCount: readCount(a.id),
            }));
          return [200, paginate(rows, q)];
        }
        const rows = all
          .filter((a) => a.recipientIds.includes(actor.id))
          .map(({ recipientIds: _r, ...a }) => ({ ...a, read: isRead(a.id, actor.id) }));
        return [200, { ...paginate(rows, q), unread: rows.filter((a) => !a.read).length }];
      },
    ],
    [
      'POST',
      '/announcements/preview',
      ({ actor, body }) => {
        const scope = authorize(actor, 'announcement:send');
        const input = validate(
          createAnnouncementSchema.pick({ audience: true, channels: true }),
          body,
          'body',
        );
        const users = audienceUsers(scopedAudience(actor, scope, input.audience), actor.id);
        return [
          200,
          {
            data: {
              recipients: users.length,
              messages: input.channels.length
                ? users.filter((u) => u.phone).length * input.channels.length
                : 0,
            },
          },
        ];
      },
    ],
    [
      'POST',
      '/announcements',
      ({ actor, body }) => {
        const scope = authorize(actor, 'announcement:send');
        const input = validate(createAnnouncementSchema, body, 'body');
        const audience = scopedAudience(actor, scope, input.audience);
        const users = audienceUsers(audience, actor.id);
        if (!users.length) throw badRequest(ERROR_MESSAGES.announcementNoRecipients);
        const announcement = {
          id: crypto.randomUUID(),
          title: input.title,
          body: input.body,
          audience,
          channels: input.channels,
          recipientIds: users.map((u) => u.id),
          senderId: actor.id,
          senderName: actor.fullName,
          ...stampNew(actor),
        };
        getDb().announcements.push(announcement);
        let messages = 0;
        for (const channel of input.channels) {
          for (const u of users.filter((x) => x.phone)) {
            recordMessage({
              channel,
              to: u.phone,
              userId: u.id,
              body: `${input.title}: ${input.body}`,
              announcementId: announcement.id,
            });
            messages += 1;
          }
        }
        const { recipientIds, ...rest } = announcement;
        return [
          201,
          { data: { ...rest, recipientCount: recipientIds.length, readCount: 0, messages } },
        ];
      },
    ],
    [
      'GET',
      '/announcements/:id',
      ({ actor, params }) => {
        authorize(actor, 'announcement:read');
        const { recipientIds, ...a } = findAnnouncement(actor, idParam(params.id));
        const read = isRead(a.id, actor.id);
        if (a.senderId !== actor.id) return [200, { data: { ...a, read } }];
        return [
          200,
          { data: { ...a, read, recipientCount: recipientIds.length, readCount: readCount(a.id) } },
        ];
      },
    ],
    [
      'POST',
      '/announcements/:id/read',
      ({ actor, params }) => {
        authorize(actor, 'announcement:read');
        return [200, { data: markRead(actor, idParam(params.id)) }];
      },
    ],
  ];

  /** What the sync pull adds for Sprint 4 (D4-8), same as server sync.service. */
  function pullChanges(actor, filter, fromDate) {
    const db = getDb();
    const strip = ({ createdBy: _c, updatedBy: _u, ...r }) => r;
    return {
      events: db.events.filter((e) => eventInFilter(e, filter) && e.endDate >= fromDate).map(strip),
      eventParticipants: db.eventParticipants
        .filter((p) => clubRecordInFilter(p, filter))
        .map(strip),
      eventConsents: db.eventConsents
        .filter((c) => clubRecordInFilter(c, filter))
        .map(({ fileId, ...c }) => ({
          ...strip(c),
          signedOn: c.signedOn ?? null,
          hasFile: Boolean(fileId),
        })),
      announcements: db.announcements
        .filter((a) => a.recipientIds.includes(actor.id))
        .map(({ recipientIds: _r, ...a }) => strip(a)),
      announcementReads: db.announcementReads
        .filter((r) => r.userId === actor.id)
        .map(({ announcementId, readAt, updatedAt }) => ({
          id: announcementId,
          announcementId,
          readAt,
          updatedAt,
        })),
    };
  }

  return { routes, pullChanges, markRead };
}
