import * as service from './reports.service.js';

const meta = (req) => ({ requestId: req.id });

export async function termly(req, res) {
  res.json({ data: await service.termReport(req.user, req.scope, req.valid.query) });
}

export async function termlyPdf(req, res) {
  const { report, pdf } = await service.termReportPdf(req.user, req.scope, req.valid.query);
  res
    .set('Content-Type', 'application/pdf')
    .set('Content-Disposition', `attachment; filename="${service.reportFileName(report)}"`)
    .set('Cache-Control', 'no-store')
    .send(pdf);
}

export async function recipients(_req, res) {
  res.json({ data: await service.getRecipients() });
}

export async function setRecipients(req, res) {
  res.json({ data: await service.setRecipients(req.user, req.valid.body, meta(req)) });
}
