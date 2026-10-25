import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Select,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from 'steamlabsui';
import { REGION_VALUES } from '@code-clubs/shared/enums';
import { useAuth } from '../../context/AuthContext.jsx';
import { DataState } from '../../components/DataState.jsx';
import { useApi } from '../../utils/useApi.js';
import { useClubOptions } from '../../utils/useClubOptions.js';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import { saveBlob } from '../../utils/files.js';
import { USE_MOCKS } from '../../services/http.js';
import { downloadTermReportPdf, getTermReport } from '../../services/reportsService.js';
import { listTerms } from '../../services/termsService.js';
import { termLabel } from '../Dashboard/HqPanels.jsx';

const noReport = async () => null;
const percent = (rate) => (rate === null ? '–' : `${rate}%`);

/** The termly report on screen, and as a PDF made on the server (US-21, D4-3, D4-4). */
export function ReportsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { filters, setFilter } = useUrlFilters(['termId', 'region', 'clubId']);
  const terms = useApi(listTerms);
  const { clubs } = useClubOptions();
  const termList = [...(terms.data?.data ?? [])].reverse();
  const termId = filters.termId || termList[0]?.id;
  const query = termId
    ? { termId, region: filters.region || undefined, clubId: filters.clubId || undefined }
    : null;
  const report = useApi(query ? getTermReport : noReport, query);
  const regions = user.role === 'coordinator' ? (user.regions ?? []) : REGION_VALUES;

  async function download() {
    try {
      const blob = await downloadTermReportPdf(query);
      const r = report.data.data;
      saveBlob(blob, `code-clubs-${r.term.year}-term-${r.term.number}.pdf`);
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    }
  }

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        description={t('reports.description')}
        actions={
          report.data?.data && (
            <span className="no-print">
              {USE_MOCKS ? (
                <Button onClick={() => window.print()}>{t('reports.print')}</Button>
              ) : (
                <Button onClick={download}>{t('reports.download')}</Button>
              )}
            </span>
          )
        }
      />
      <DataState loading={terms.loading} error={terms.error} onRetry={terms.reload}>
        {termList.length === 0 ? (
          <Alert tone="info">{t('reports.noTerms')}</Alert>
        ) : (
          <>
            <div className="filter-bar no-print" role="search">
              <Select
                aria-label={t('hq.term')}
                value={termId}
                onChange={(e) => setFilter('termId', e.target.value)}
              >
                {termList.map((term) => (
                  <option key={term.id} value={term.id}>
                    {termLabel(t, term)}
                  </option>
                ))}
              </Select>
              {regions.length > 1 && (
                <Select
                  aria-label={t('hq.region')}
                  value={filters.region}
                  onChange={(e) => setFilter('region', e.target.value)}
                >
                  <option value="">{t('reports.allRegions')}</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {t(`regions.${r}`)}
                    </option>
                  ))}
                </Select>
              )}
              <Select
                aria-label={t('reports.club')}
                value={filters.clubId}
                onChange={(e) => setFilter('clubId', e.target.value)}
              >
                <option value="">{t('reports.anyClub')}</option>
                {clubs
                  .filter((c) => !filters.region || c.region === filters.region)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
              </Select>
            </div>
            {USE_MOCKS && <p className="muted no-print">{t('reports.demoPdf')}</p>}
            <DataState loading={report.loading} error={report.error} onRetry={report.reload}>
              {report.data?.data && <ReportSheet report={report.data.data} />}
            </DataState>
          </>
        )}
      </DataState>
    </>
  );
}

function scopeName(t, scope) {
  if (scope.club) return `${scope.club.code} ${scope.club.name}`;
  if (scope.region) return t(`regions.${scope.region}`);
  if (scope.regions?.length) return scope.regions.map((r) => t(`regions.${r}`)).join(', ');
  return t('reports.allRegions');
}

function Section({ title, columns, rows }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="muted">{t('reports.noRows')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c}>{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  {r.map((cell, j) => (
                    <TableCell key={j}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ReportSheet({ report }) {
  const { t } = useTranslation();
  const s = report.summary;
  return (
    <div className="page-grid report-sheet">
      <div>
        <h2>
          {termLabel(t, report.term)}: {scopeName(t, report.scope)}
        </h2>
        <p className="muted">
          {report.term.startDate} – {report.term.endDate} ·{' '}
          {t('reports.generated', { date: new Date(report.generatedAt).toLocaleString() })}
        </p>
        <Alert tone="info">{t('reports.countsOnly')}</Alert>
      </div>
      <div className="stat-grid">
        <Stat variant="tile" value={s.activeClubs} label={t('reports.activeClubs')} />
        <Stat variant="tile" value={s.activeLearners} label={t('reports.activeLearners')} />
        <Stat variant="tile" value={s.girls} label={t('reports.girls')} />
        <Stat variant="tile" value={s.boys} label={t('reports.boys')} />
        <Stat variant="tile" value={s.sessionsHeld} label={t('reports.sessionsHeld')} />
        <Stat variant="tile" value={percent(s.attendanceRate)} label={t('reports.attendance')} />
        <Stat variant="tile" value={s.events} label={t('reports.events')} />
        <Stat variant="tile" value={s.eventParticipants} label={t('reports.eventParticipants')} />
      </div>
      <Section
        title={t('reports.byRegion')}
        columns={[
          t('hq.region'),
          t('reports.clubs'),
          t('reports.learners'),
          t('reports.sessions'),
          t('reports.attendance'),
        ]}
        rows={report.byRegion.map((r) => [
          t(`regions.${r.region}`),
          r.clubs,
          r.learners,
          r.sessionsHeld,
          percent(r.attendanceRate),
        ])}
      />
      <Section
        title={t('reports.byTrack')}
        columns={[t('clubs.track'), t('reports.clubs'), t('reports.learners')]}
        rows={report.byTrack.map((r) => [t(`tracks.${r.track}`), r.clubs, r.learners])}
      />
      <Section
        title={t('reports.byAge')}
        columns={[
          t('reports.age'),
          t('reports.girls'),
          t('reports.boys'),
          t('reports.other'),
          t('reports.total'),
        ]}
        rows={report.byAge.map((r) => [r.band, r.girl, r.boy, r.other, r.total])}
      />
      <Section
        title={t('reports.events')}
        columns={[
          t('events.name'),
          t('reports.dates'),
          t('reports.clubs'),
          t('reports.participants'),
        ]}
        rows={report.events.map((e) => [
          e.name,
          e.startDate === e.endDate ? e.startDate : `${e.startDate} – ${e.endDate}`,
          e.clubs,
          e.participants,
        ])}
      />
      <Section
        title={t('reports.clubs')}
        columns={[
          t('reports.code'),
          t('reports.club'),
          t('reports.learners'),
          t('reports.sessions'),
          t('reports.attendance'),
        ]}
        rows={report.clubs.map((c) => [
          c.code,
          c.name,
          c.activeLearners,
          c.sessionsHeld,
          percent(c.attendanceRate),
        ])}
      />
    </div>
  );
}
