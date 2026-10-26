import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Select,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextLink,
} from 'steamlabsui';
import { CLUB_STATUSES, REGION_VALUES, TRACKS } from '@code-clubs/shared/enums';
import { useAuth } from '../../context/AuthContext.jsx';
import { ColumnChart, StackedBars } from '../../components/Charts.jsx';
import { DataState } from '../../components/DataState.jsx';
import { useApi } from '../../utils/useApi.js';
import { useUrlFilters } from '../../utils/useUrlFilters.js';
import { getHqDashboard } from '../../services/reportsService.js';
import { listTerms } from '../../services/termsService.js';
import { AlertsCard } from './AlertsCard.jsx';

export const termLabel = (t, term) => t('hq.termLabel', { number: term.number, year: term.year });
const shortDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** The same numbers as a chart, in a table for screen readers and for reading exact values. */
function NumbersTable({ columns, rows }) {
  const { t } = useTranslation();
  return (
    <details className="numbers-table">
      <summary>{t('hq.table')}</summary>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r[0]}>
              {r.map((cell, i) => (
                <TableCell key={i}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </details>
  );
}

/** Trends for HQ (national) and coordinators (their regions), filtered by term and region (US-19). */
export function HqPanels() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { filters, setFilter } = useUrlFilters(['termId', 'region']);
  const terms = useApi(listTerms);
  const query = { termId: filters.termId || undefined, region: filters.region || undefined };
  const { loading, error, data, reload } = useApi(getHqDashboard, query);
  const hq = data?.data;
  const regions = user.role === 'coordinator' ? (user.regions ?? []) : REGION_VALUES;

  return (
    <section className="page-grid" aria-labelledby="hq-title">
      <div className="row-between">
        <h2 id="hq-title">{t('hq.title')}</h2>
        <div className="filter-bar" role="search">
          <Select
            aria-label={t('hq.term')}
            value={filters.termId || hq?.term?.id || ''}
            onChange={(e) => setFilter('termId', e.target.value)}
          >
            {!hq?.term && <option value="">{t('hq.term')}</option>}
            {[...(terms.data?.data ?? [])].reverse().map((term) => (
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
              <option value="">{t('hq.allRegions')}</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {t(`regions.${r}`)}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>
      <AlertsCard query={{ region: query.region }} />
      <DataState loading={loading} error={error} onRetry={reload}>
        {hq && <Panels hq={hq} savedAt={data.savedAt} />}
      </DataState>
    </section>
  );
}

function Panels({ hq, savedAt }) {
  const { t } = useTranslation();
  if (!hq.term) return <Alert tone="info">{t('hq.noTerm')}</Alert>;
  const regionRows = Object.entries(hq.sessionsByRegion);
  const trackRows = TRACKS.filter((k) => hq.learnersByTrack[k]?.total);
  return (
    <>
      {savedAt && (
        <Alert tone="info">{t('hq.savedAt', { date: new Date(savedAt).toLocaleString() })}</Alert>
      )}
      <p className="muted">
        {termLabel(t, hq.term)}: {hq.term.startDate} – {hq.term.endDate}
      </p>
      <div className="stat-grid">
        <Stat variant="tile" value={hq.totals.sessionsHeld} label={t('hq.sessionsHeld')} />
        <Stat
          variant="tile"
          value={
            hq.totals.attendanceRate === null
              ? t('dashboard.noRate')
              : `${hq.totals.attendanceRate}%`
          }
          label={t('hq.attendanceRate')}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('hq.attendanceTrend')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="muted">{t('hq.trendHint')}</p>
          <ColumnChart
            label={t('hq.attendanceTrend')}
            unit="%"
            data={hq.attendanceTrend.map((w) => ({
              label: shortDate(w.weekStart),
              title: `${t('hq.week')} ${w.weekStart}`,
              value: w.rate,
            }))}
          />
          <NumbersTable
            columns={[t('hq.week'), t('hq.rate'), t('hq.marks')]}
            rows={hq.attendanceTrend.map((w) => [
              w.weekStart,
              w.rate === null ? '–' : `${w.rate}%`,
              `${w.present} / ${w.total}`,
            ])}
          />
        </CardContent>
      </Card>
      <div className="chart-grid">
        <Card>
          <CardHeader>
            <CardTitle>{t('hq.sessionsByRegion')}</CardTitle>
          </CardHeader>
          <CardContent>
            <StackedBars
              label={t('hq.sessionsByRegion')}
              parts={[
                { key: 'held', label: t('hq.held'), tone: 'secondary' },
                { key: 'planned', label: t('hq.planned'), tone: 'primary' },
                { key: 'cancelled', label: t('hq.cancelled'), tone: 'muted' },
              ]}
              rows={regionRows.map(([region, values]) => ({
                label: t(`regions.${region}`),
                values,
              }))}
            />
            <NumbersTable
              columns={[t('hq.region'), t('hq.held'), t('hq.planned'), t('hq.cancelled')]}
              rows={regionRows.map(([region, v]) => [
                t(`regions.${region}`),
                v.held,
                v.planned,
                v.cancelled,
              ])}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('hq.learnersByTrack')}</CardTitle>
          </CardHeader>
          <CardContent>
            {trackRows.length === 0 ? (
              <EmptyState title={t('dashboard.none')} />
            ) : (
              <>
                <StackedBars
                  label={t('hq.learnersByTrack')}
                  parts={[
                    { key: 'girl', label: t('hq.girls'), tone: 'secondary' },
                    { key: 'boy', label: t('hq.boys'), tone: 'primary' },
                    { key: 'other', label: t('hq.other'), tone: 'muted' },
                  ]}
                  rows={trackRows.map((k) => ({
                    label: t(`tracks.${k}`),
                    values: hq.learnersByTrack[k],
                  }))}
                />
                <NumbersTable
                  columns={[
                    t('clubs.track'),
                    t('hq.girls'),
                    t('hq.boys'),
                    t('hq.other'),
                    t('hq.total'),
                  ]}
                  rows={trackRows.map((k) => {
                    const v = hq.learnersByTrack[k];
                    return [t(`tracks.${k}`), v.girl, v.boy, v.other, v.total];
                  })}
                />
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('hq.clubsByStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="detail-list">
              {CLUB_STATUSES.map((s) => (
                <div key={s}>
                  <dt>{t(`status.${s}`)}</dt>
                  <dd>{hq.clubsByStatus[s]}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <UpcomingEvents events={hq.upcomingEvents} />
      </div>
    </>
  );
}

export function UpcomingEvents({ events }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hq.upcomingEvents')}</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState title={t('hq.noEvents')} />
        ) : (
          <ul className="alert-list">
            {events.map((e) => (
              <li key={e.id}>
                <span>
                  <TextLink asChild arrow={false}>
                    <Link to={`/events/${e.id}`}>{e.name}</Link>
                  </TextLink>
                  <small>
                    {e.startDate === e.endDate ? e.startDate : `${e.startDate} – ${e.endDate}`} ·{' '}
                    {e.venue}
                  </small>
                </span>
                <small>{t(`eventTypes.${e.type}`)}</small>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
