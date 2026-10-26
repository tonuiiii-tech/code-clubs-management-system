import { REGION_VALUES } from '@code-clubs/shared/enums';
import { SCOPES } from '@code-clubs/shared/permissions';
import { recordAudit } from '../audit/audit.service.js';
import { getTermReport } from '../insights/insights.service.js';
import { emailProvider } from '../notifications/providers.js';
import { listTerms } from '../terms/terms.service.js';
import { renderTermReportPdf, scopeTitle, termTitle } from './reports.pdf.js';
import * as repo from './reports.repository.js';

/** Termly report as JSON or PDF, its recipients, and the end-of-term email (plan section 5). */

export const termReport = (actor, scope, query) => getTermReport(actor, scope, query);

export async function termReportPdf(actor, scope, query) {
  const report = await getTermReport(actor, scope, query);
  return { report, pdf: await renderTermReportPdf(report) };
}

export const reportFileName = (report) =>
  `code-clubs-${report.term.year}-term-${report.term.number}-${
    report.scope.club?.code ?? report.scope.region ?? 'all'
  }.pdf`.toLowerCase();

export const getRecipients = () => repo.getRecipients();

export async function setRecipients(actor, { recipients }, { requestId }) {
  const before = await repo.getRecipients();
  await repo.saveRecipients(recipients, actor.id);
  // Only the number is logged; the addresses stay in settings.
  await recordAudit({
    actor,
    action: 'report.recipients',
    entityType: 'setting',
    entityId: 'reportRecipients',
    before: { recipients: before.length },
    after: { recipients: recipients.length },
    requestId,
  });
  return recipients;
}

// The scheduler acts for HQ: the national report and one per region.
const SYSTEM = { id: 'system', role: 'system_admin', regions: [] };

/**
 * Sends the termly reports for a term that ended yesterday or up to `catchUpDays` before (in case
 * the server was down). Each term is sent once, even with several servers (R4-2).
 */
export async function runTermlyReports({ today = new Date(), catchUpDays = 7 } = {}) {
  const day = today.toISOString().slice(0, 10);
  const earliest = new Date(today.getTime() - catchUpDays * 86_400_000).toISOString().slice(0, 10);
  const ended = (await listTerms()).filter((t) => t.endDate < day && t.endDate >= earliest);
  const results = [];
  for (const term of ended) {
    if (!(await repo.claimRun(term.id))) continue;
    try {
      const recipients = await repo.getRecipients();
      let messages = 0;
      if (recipients.length) {
        const scopes = [{}, ...REGION_VALUES.map((region) => ({ region }))];
        const attachments = [];
        for (const filter of scopes) {
          const report = await getTermReport(SYSTEM, SCOPES.ALL, { termId: term.id, ...filter });
          if (filter.region && !report.summary.activeClubs) continue;
          attachments.push({
            name: reportFileName(report),
            title: scopeTitle(report),
            content: await renderTermReportPdf(report),
          });
        }
        for (const r of recipients) {
          await emailProvider().send({
            to: r.email,
            subject: `STEAMLabs Code Clubs: ${termTitle(term)} report`,
            body:
              `Hello ${r.name},\n\nThe Code Clubs reports for ${termTitle(term)} are attached: ` +
              `${attachments.map((a) => a.title).join(', ')}.\n\nSTEAMLabs Africa`,
            attachments,
            termId: term.id,
          });
          messages += 1;
        }
      }
      await repo.finishRun(term.id, { state: 'sent', messages });
      results.push({ termId: term.id, messages });
    } catch (err) {
      await repo.finishRun(term.id, { state: 'failed', error: err.message });
      results.push({ termId: term.id, error: err.message });
    }
  }
  return results;
}
