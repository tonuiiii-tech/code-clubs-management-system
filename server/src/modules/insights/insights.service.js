import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { buildHqDashboard, buildTermReport, computeAlerts } from '@code-clubs/shared/insights';
import { termForDate } from '@code-clubs/shared/schemas';
import { notFound } from '../../utils/httpError.js';
import { scopeFilter } from '../scope.js';
import { getTerm, listTerms } from '../terms/terms.service.js';
import * as repo from './insights.repository.js';

/** HQ dashboard, alerts and termly report data in the user's scope (Sprint 4, D4-2, D4-3). */

// Alerts look back far enough to find the last four held sessions of a weekly club.
const ALERT_LOOKBACK_DAYS = 90;

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Rows for the clubs in scope: learners, sessions in a date range and their attendance. */
async function clubData(filter, { region, clubId, from, to }) {
  const clubs = await repo.clubRows(filter, { region, clubId });
  const clubIds = clubs.map((c) => c.id);
  const [learners, sessions] = await Promise.all([
    repo.learnerRows(clubIds),
    repo.sessionRows(clubIds, { from, to }),
  ]);
  const sessionAttendance = await repo.sessionAttendanceRows(sessions.map((s) => s.id));
  return { clubs, clubIds, learners, sessions, sessionAttendance };
}

/** Events a report or dashboard limited to a region or club should show. */
const eventsFor = (events, clubIds, { region, clubId }) =>
  events.filter((e) => {
    if (clubId) return e.clubIds.includes(clubId);
    if (region) return e.region === region || e.clubIds.some((id) => clubIds.includes(id));
    return true;
  });

/** The HQ dashboard for a term (plan section 4.1). Without a term id: the current or last one. */
export async function getHqDashboard(actor, scope, { termId, region }) {
  const filter = scopeFilter(actor, scope);
  const day = today();
  const term = termId ? await getTerm(termId) : termForDate(await listTerms(), day);
  const data = await clubData(filter, {
    region,
    from: term?.startDate ?? day,
    to: term?.endDate ?? day,
  });
  const events = eventsFor(await repo.eventRows(filter, { endingFrom: day }), data.clubIds, {
    region,
  });
  return buildHqDashboard({ term, ...data, events, today: day });
}

/** Clubs that need attention (plan section 4.2), for the clubs the user can read. */
export async function getAlerts(actor, scope, { region, clubId }) {
  const filter = scopeFilter(actor, scope);
  const day = today();
  const data = await clubData(filter, {
    region,
    clubId,
    from: daysAgo(ALERT_LOOKBACK_DAYS),
    to: day,
  });
  const events = await repo.eventRows(filter, { endingFrom: day });
  const eventIds = events.map((e) => e.id);
  const [consentGivenLearnerIds, participants, eventConsents, terms] = await Promise.all([
    repo.participationConsentGiven(data.clubIds),
    repo.participantRows(data.clubIds, eventIds),
    repo.eventConsentRows(eventIds),
    listTerms(),
  ]);
  return computeAlerts({
    ...data,
    consentGivenLearnerIds,
    events,
    participants,
    eventConsents,
    terms,
    today: day,
  });
}

/** The termly report's numbers (plan section 5): counts only (D4-3). */
export async function getTermReport(actor, scope, { termId, region, clubId }) {
  const filter = scopeFilter(actor, scope);
  const term = await getTerm(termId);
  const data = await clubData(filter, { region, clubId, from: term.startDate, to: term.endDate });
  if (clubId && !data.clubs.length) throw notFound(ERROR_MESSAGES.clubNotFound);
  const events = eventsFor(
    await repo.eventRows(filter, { endingFrom: term.startDate, startingTo: term.endDate }),
    data.clubIds,
    { region, clubId },
  );
  const participants = await repo.participantRows(
    data.clubIds,
    events.map((e) => e.id),
  );
  return buildTermReport({
    term,
    scope: { region: region ?? null, club: clubId ? data.clubs[0] : null },
    ...data,
    events,
    participants,
    generatedAt: new Date().toISOString(),
  });
}
