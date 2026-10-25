import PDFDocument from 'pdfkit';

/**
 * Draws the termly report (plan section 5) as a PDF with pdfkit (D4-4). It only receives the
 * counts from buildTermReport, so it cannot print a learner's name or contact (D4-3, R4-1).
 * Flat brand colours, no gradients.
 */

const GREEN = '#1f6f3f';
const ORANGE = '#f28c28';
const INK = '#1d2a22';
const MUTED = '#5b6b61';
const RULE = '#d9e2dc';

const REGION_LABELS = {
  nairobi_central: 'Nairobi & Central',
  western_nyanza: 'Western & Nyanza',
  coast: 'Coast',
  rift_valley: 'Rift Valley',
};
const TRACK_LABELS = {
  unplugged: 'Unplugged',
  scratch: 'Scratch',
  robotics: 'Robotics',
  game_design: 'Game design',
  ai_basics: 'AI basics',
};
const label = (labels, value) => labels[value] ?? value;
const percent = (rate) => (rate === null || rate === undefined ? '–' : `${rate}%`);

export function scopeTitle(report) {
  if (report.scope.club) return `${report.scope.club.code} ${report.scope.club.name}`;
  if (report.scope.region) return label(REGION_LABELS, report.scope.region);
  if (report.scope.regions?.length) {
    return report.scope.regions.map((r) => label(REGION_LABELS, r)).join(', ');
  }
  return 'All regions';
}

export const termTitle = (term) => `Term ${term.number} ${term.year}`;

/** Resolves to the PDF bytes. */
export function renderTermReportPdf(report) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: {
      Title: `STEAMLabs Code Clubs: ${termTitle(report.term)} report`,
      Author: 'STEAMLabs Africa',
    },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  // Cover band, flat green with the wordmark.
  doc.rect(0, 0, doc.page.width, 140).fill(GREEN);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text('STEAMLabs', left, 40);
  doc.font('Helvetica').fontSize(12).text('Code Clubs termly report', left, 72);
  doc.rect(left, 98, 48, 4).fill(ORANGE);

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(18);
  doc.text(`${termTitle(report.term)}: ${scopeTitle(report)}`, left, 170);
  doc.font('Helvetica').fontSize(10).fillColor(MUTED);
  doc.text(
    `${report.term.startDate} to ${report.term.endDate}. Made ${report.generatedAt.slice(0, 10)}. ` +
      'Counts only: no names or contacts. Groups of fewer than 5 learners show as "<5".',
  );
  doc.moveDown(1.2);

  const s = report.summary;
  const tiles = [
    ['Active clubs', s.activeClubs],
    ['Active learners', s.activeLearners],
    ['Girls', s.girls],
    ['Boys', s.boys],
    ['Sessions held', s.sessionsHeld],
    ['Attendance', percent(s.attendanceRate)],
    ['Events', s.events],
    ['Event participants', s.eventParticipants],
  ];
  const tileW = width / 4;
  const top = doc.y;
  tiles.forEach(([name, value], i) => {
    const x = left + (i % 4) * tileW;
    const y = top + Math.floor(i / 4) * 56;
    doc.rect(x + 2, y, tileW - 4, 50).fill('#eef4f0');
    doc
      .fillColor(GREEN)
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(String(value), x + 10, y + 8);
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(9)
      .text(name, x + 10, y + 30);
  });
  doc.y = top + 2 * 56 + 12;
  doc.x = left;

  function table(title, columns, rows) {
    if (doc.y > doc.page.height - 160) doc.addPage();
    doc.x = left;
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(title, left, doc.y + 8);
    doc.moveDown(0.4);
    if (!rows.length) {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('None this term.', left);
      return;
    }
    const total = columns.reduce((n, c) => n + c.width, 0);
    const widths = columns.map((c) => (c.width / total) * width);
    const row = (cells, bold) => {
      if (doc.y > doc.page.height - 70) doc.addPage();
      const y = doc.y;
      let x = left;
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .fillColor(bold ? MUTED : INK);
      cells.forEach((cell, i) => {
        doc.text(String(cell), x + 2, y + 4, {
          width: widths[i] - 4,
          align: columns[i].align ?? 'left',
          lineBreak: false,
          ellipsis: true,
        });
        x += widths[i];
      });
      doc
        .moveTo(left, y + 18)
        .lineTo(left + width, y + 18)
        .strokeColor(RULE)
        .lineWidth(0.5)
        .stroke();
      doc.y = y + 19;
    };
    row(
      columns.map((c) => c.title),
      true,
    );
    rows.forEach((r) => row(r));
  }

  const num = (title) => ({ title, width: 1, align: 'right' });
  table(
    'By region',
    [
      { title: 'Region', width: 2 },
      num('Clubs'),
      num('Learners'),
      num('Sessions'),
      num('Attendance'),
    ],
    report.byRegion.map((r) => [
      label(REGION_LABELS, r.region),
      r.clubs,
      r.learners,
      r.sessionsHeld,
      percent(r.attendanceRate),
    ]),
  );
  table(
    'By track',
    [{ title: 'Track', width: 2 }, num('Clubs'), num('Learners')],
    report.byTrack.map((r) => [label(TRACK_LABELS, r.track), r.clubs, r.learners]),
  );
  table(
    'Learners by age and gender',
    [{ title: 'Age', width: 2 }, num('Girls'), num('Boys'), num('Other'), num('Total')],
    report.byAge.map((r) => [r.band, r.girl, r.boy, r.other, r.total]),
  );
  table(
    'Events',
    [{ title: 'Event', width: 3 }, { title: 'Dates', width: 2 }, num('Clubs'), num('Participants')],
    report.events.map((e) => [
      e.name,
      e.startDate === e.endDate ? e.startDate : `${e.startDate} to ${e.endDate}`,
      e.clubs,
      e.participants,
    ]),
  );
  table(
    'Clubs',
    [
      { title: 'Code', width: 1 },
      { title: 'Club', width: 3 },
      num('Learners'),
      num('Sessions'),
      num('Attendance'),
    ],
    report.clubs.map((c) => [
      c.code,
      c.name,
      c.activeLearners,
      c.sessionsHeld,
      percent(c.attendanceRate),
    ]),
  );

  doc.end();
  return done;
}
