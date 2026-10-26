import {
  AGE_BANDS,
  ALERT_RULES,
  ALERT_TYPES,
  CLUB_STATUSES,
  REGION_VALUES,
  REPORT_MIN_GROUP,
  TRACKS,
} from './enums.js';
import { termOn } from './schemas/term.js';

/**
 * The HQ dashboard, alerts and the termly report, computed from plain rows (Sprint 4).
 * The server fetches the rows in the user's scope from MongoDB and the demo mock API from its
 * store; both call these functions, so the numbers can never differ between the two (R1-19).
 *
 * Row shapes:
 *   clubs             { id, code, name, region, mainTrack, status, capacity }
 *   learners          { id, clubId, gender, birthYear, status }
 *   sessions          { id, clubId, date, status }
 *   sessionAttendance { sessionId, present, total }   (late counts as present)
 *   events            { id, name, type, startDate, endDate, venue, region, status, clubIds }
 *   participants      { eventId, learnerId, clubId, status }
 *   eventConsents     { eventId, learnerId, status }
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (date, days) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
const rate = (present, total) => (total ? Math.round((present / total) * 100) : null);
const countBy = (rows, key) =>
  rows.reduce((acc, row) => ({ ...acc, [row[key]]: (acc[row[key]] ?? 0) + 1 }), {});

/** Monday of the week a date falls in. */
export function weekStart(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7;
  return addDays(date, -shift);
}

const inTerm = (term) => (row) => row.date >= term.startDate && row.date <= term.endDate;
const attendanceBySession = (rows) => new Map(rows.map((r) => [r.sessionId, r]));

function attendanceTotals(sessions, bySession) {
  let present = 0;
  let total = 0;
  for (const s of sessions) {
    const a = bySession.get(s.id);
    if (a) {
      present += a.present;
      total += a.total;
    }
  }
  return { present, total, rate: rate(present, total) };
}

const genderGroup = (gender) => (gender === 'girl' || gender === 'boy' ? gender : 'other');

/**
 * HQ dashboard panels for a term (plan section 4.1). `today` is YYYY-MM-DD; weeks after today
 * are left out.
 */
export function buildHqDashboard({
  term,
  clubs,
  learners,
  sessions,
  sessionAttendance,
  events,
  today,
}) {
  const clubById = new Map(clubs.map((c) => [c.id, c]));
  const termSessions = term ? sessions.filter(inTerm(term)) : [];
  const held = termSessions.filter((s) => s.status === 'held');
  const bySession = attendanceBySession(sessionAttendance);

  const trend = [];
  if (term) {
    const last = term.endDate < today ? term.endDate : today;
    for (let week = weekStart(term.startDate); week <= last; week = addDays(week, 7)) {
      const end = addDays(week, 6);
      const totals = attendanceTotals(
        held.filter((s) => s.date >= week && s.date <= end),
        bySession,
      );
      trend.push({ weekStart: week, ...totals });
    }
  }

  // Only regions with clubs in scope, so a coordinator sees their own regions.
  const regions = REGION_VALUES.filter((r) => clubs.some((c) => c.region === r));
  const sessionsByRegion = Object.fromEntries(
    regions.map((region) => {
      const rows = termSessions.filter((s) => clubById.get(s.clubId)?.region === region);
      return [
        region,
        {
          held: rows.filter((s) => s.status === 'held').length,
          planned: rows.filter((s) => s.status === 'planned').length,
          cancelled: rows.filter((s) => s.status === 'cancelled').length,
        },
      ];
    }),
  );

  const active = learners.filter((l) => l.status === 'active');
  const learnersByTrack = Object.fromEntries(
    TRACKS.map((track) => {
      const rows = active.filter((l) => clubById.get(l.clubId)?.mainTrack === track);
      const g = countBy(
        rows.map((l) => ({ g: genderGroup(l.gender) })),
        'g',
      );
      return [
        track,
        { girl: g.girl ?? 0, boy: g.boy ?? 0, other: g.other ?? 0, total: rows.length },
      ];
    }),
  );

  const statusCounts = countBy(clubs, 'status');
  const clubsByStatus = Object.fromEntries(CLUB_STATUSES.map((s) => [s, statusCounts[s] ?? 0]));

  const upcomingEvents = events
    .filter((e) => e.endDate >= today && e.status !== 'cancelled')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 5)
    .map(({ id, name, type, startDate, endDate, venue, status }) => ({
      id,
      name,
      type,
      startDate,
      endDate,
      venue,
      status,
    }));

  return {
    term: term ?? null,
    totals: {
      sessionsHeld: held.length,
      attendanceRate: attendanceTotals(held, bySession).rate,
    },
    attendanceTrend: trend,
    sessionsByRegion,
    learnersByTrack,
    clubsByStatus,
    upcomingEvents,
  };
}

/**
 * Clubs that need attention (plan section 4.2, D4-2). Computed on every request, never stored.
 * `terms` decides whether "no recent session" applies: clubs only meet during a term.
 */
export function computeAlerts({
  clubs,
  learners,
  sessions,
  sessionAttendance,
  consentGivenLearnerIds,
  events,
  participants,
  eventConsents,
  terms,
  today,
}) {
  const alerts = [];
  const activeClubs = clubs.filter((c) => c.status === 'active');
  const bySession = attendanceBySession(sessionAttendance);
  const consentGiven = new Set(consentGivenLearnerIds);
  const term = termOn(terms, today);
  const sessionCutoff = addDays(today, -ALERT_RULES.noSessionDays);
  const checkSessions = term && term.startDate <= sessionCutoff;
  const push = (club, type, value, extra = {}) =>
    alerts.push({
      type,
      clubId: club.id,
      clubCode: club.code,
      clubName: club.name,
      region: club.region,
      value,
      ...extra,
    });

  for (const club of activeClubs) {
    const heldSessions = sessions
      .filter((s) => s.clubId === club.id && s.status === 'held' && s.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (checkSessions && !heldSessions.some((s) => s.date > sessionCutoff)) {
      push(club, 'noRecentSession', heldSessions[0]?.date ?? null);
    }
    // At least two sessions, so one bad day at a new club is not an alert.
    const recent = heldSessions
      .slice(0, ALERT_RULES.lowAttendanceSessions)
      .filter((s) => bySession.get(s.id)?.total);
    const recentRate = attendanceTotals(recent, bySession).rate;
    if (recent.length >= 2 && recentRate < ALERT_RULES.lowAttendancePercent) {
      push(club, 'lowAttendance', recentRate);
    }
    const members = learners.filter((l) => l.clubId === club.id && l.status === 'active');
    const missing = members.filter((l) => !consentGiven.has(l.id)).length;
    if (missing) push(club, 'missingConsent', missing);
    if (members.length >= ALERT_RULES.nearCapacityLearners)
      push(club, 'nearCapacity', members.length);
  }

  const soon = addDays(today, ALERT_RULES.eventConsentDays);
  const clubById = new Map(activeClubs.map((c) => [c.id, c]));
  for (const event of events) {
    if (event.status === 'cancelled' || event.startDate < today || event.startDate > soon) continue;
    const given = new Set(
      eventConsents
        .filter((c) => c.eventId === event.id && c.status === 'given')
        .map((c) => c.learnerId),
    );
    const missingByClub = countBy(
      participants.filter(
        (p) => p.eventId === event.id && p.status === 'registered' && !given.has(p.learnerId),
      ),
      'clubId',
    );
    for (const [clubId, n] of Object.entries(missingByClub)) {
      const club = clubById.get(clubId);
      if (club) {
        push(club, 'eventConsentMissing', n, { eventId: event.id, eventName: event.name });
      }
    }
  }

  const order = (type) => ALERT_TYPES.indexOf(type);
  return alerts.sort(
    (a, b) => order(a.type) - order(b.type) || a.clubCode.localeCompare(b.clubCode),
  );
}

/** A count small enough to point at one child is shown as "<5" (R4-1). */
export const suppressSmall = (n) => (n > 0 && n < REPORT_MIN_GROUP ? '<5' : n);

const ageBand = (age) =>
  AGE_BANDS.find((band) => {
    const [from, to] = band.split('-').map(Number);
    return age >= from && age <= to;
  });

/**
 * The termly report (plan section 5, D4-3): counts only, no names, contacts or photos.
 * `scope` is { region?, clubId? } and only labels the report; the rows are already filtered.
 */
export function buildTermReport({
  term,
  scope = {},
  clubs,
  learners,
  sessions,
  sessionAttendance,
  events,
  participants,
  generatedAt,
}) {
  const clubById = new Map(clubs.map((c) => [c.id, c]));
  const activeClubs = clubs.filter((c) => c.status === 'active');
  const active = learners.filter((l) => l.status === 'active');
  const held = sessions.filter(inTerm(term)).filter((s) => s.status === 'held');
  const bySession = attendanceBySession(sessionAttendance);
  const termYear = Number(term.endDate.slice(0, 4));
  const regionOf = (row) => clubById.get(row.clubId)?.region;

  const genders = countBy(
    active.map((l) => ({ g: genderGroup(l.gender) })),
    'g',
  );
  const termEvents = events.filter(
    (e) => e.status !== 'cancelled' && e.startDate <= term.endDate && e.endDate >= term.startDate,
  );
  const termEventIds = new Set(termEvents.map((e) => e.id));
  const counted = participants.filter(
    (p) => termEventIds.has(p.eventId) && p.status !== 'withdrawn',
  );

  const byRegion = REGION_VALUES.map((region) => {
    const regionSessions = held.filter((s) => regionOf(s) === region);
    return {
      region,
      clubs: activeClubs.filter((c) => c.region === region).length,
      learners: active.filter((l) => regionOf(l) === region).length,
      sessionsHeld: regionSessions.length,
      attendanceRate: attendanceTotals(regionSessions, bySession).rate,
    };
  })
    .filter((row) => row.clubs || row.learners || row.sessionsHeld)
    .map((row) => ({ ...row, learners: suppressSmall(row.learners) }));

  const byTrack = TRACKS.map((track) => ({
    track,
    clubs: activeClubs.filter((c) => c.mainTrack === track).length,
    learners: active.filter((l) => clubById.get(l.clubId)?.mainTrack === track).length,
  }))
    .filter((row) => row.clubs || row.learners)
    .map((row) => ({ ...row, learners: suppressSmall(row.learners) }));

  const byAge = AGE_BANDS.map((band) => {
    const rows = active.filter((l) => ageBand(termYear - l.birthYear) === band);
    const g = countBy(
      rows.map((l) => ({ g: genderGroup(l.gender) })),
      'g',
    );
    return {
      band,
      girl: suppressSmall(g.girl ?? 0),
      boy: suppressSmall(g.boy ?? 0),
      other: suppressSmall(g.other ?? 0),
      total: suppressSmall(rows.length),
    };
  });

  const clubRows = [...clubs]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((club) => {
      const clubSessions = held.filter((s) => s.clubId === club.id);
      return {
        code: club.code,
        name: club.name,
        region: club.region,
        status: club.status,
        activeLearners: active.filter((l) => l.clubId === club.id).length,
        sessionsHeld: clubSessions.length,
        attendanceRate: attendanceTotals(clubSessions, bySession).rate,
      };
    });

  const eventRows = termEvents
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((e) => ({
      name: e.name,
      type: e.type,
      startDate: e.startDate,
      endDate: e.endDate,
      status: e.status,
      clubs: new Set(counted.filter((p) => p.eventId === e.id).map((p) => p.clubId)).size,
      participants: counted.filter((p) => p.eventId === e.id).length,
    }));

  return {
    term,
    scope,
    generatedAt,
    summary: {
      activeClubs: activeClubs.length,
      activeLearners: active.length,
      girls: suppressSmall(genders.girl ?? 0),
      boys: suppressSmall(genders.boy ?? 0),
      sessionsHeld: held.length,
      attendanceRate: attendanceTotals(held, bySession).rate,
      events: termEvents.length,
      eventParticipants: counted.length,
    },
    byRegion,
    byTrack,
    byAge,
    clubs: clubRows,
    events: eventRows,
  };
}
