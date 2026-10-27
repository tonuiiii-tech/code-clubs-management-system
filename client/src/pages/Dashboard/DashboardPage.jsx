import { useTranslation } from 'react-i18next';
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Progress,
  Stat,
} from 'steamlabsui';
import { REGION_VALUES, TRACKS } from '@code-clubs/shared/enums';
import { DataState } from '../../components/DataState.jsx';
import { useApi } from '../../utils/useApi.js';
import { getDashboardSummary } from '../../services/dashboardService.js';
import { listEvents } from '../../services/eventsService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { AlertsCard } from './AlertsCard.jsx';
import { HqPanels, UpcomingEvents } from './HqPanels.jsx';

const upcoming = () => listEvents({ from: new Date().toISOString().slice(0, 10), pageSize: 5 });

/** Counts inside the user's own scope (US-06, US-12), then trends and alerts (US-19, US-20). */
export function DashboardPage() {
  const { t } = useTranslation();
  const { user, can } = useAuth();
  const { loading, error, data, reload } = useApi(getDashboardSummary);
  const summary = data?.data;

  return (
    <>
      <PageHeader
        eyebrow={
          user ? t('dashboard.welcome', { name: user.fullName.split(' ')[0] }) : t('app.name')
        }
        title={t('dashboard.title')}
        description={t('dashboard.description')}
      />
      <DataState loading={loading} error={error} onRetry={reload}>
        {summary && (
          <div className="page-grid">
            {data.savedAt && (
              <Alert tone="info">
                {t('dashboard.savedAt', { date: new Date(data.savedAt).toLocaleString() })}
              </Alert>
            )}
            <div className="stat-grid">
              <Stat variant="tile" value={summary.activeClubs} label={t('dashboard.activeClubs')} />
              <Stat variant="tile" value={summary.schools} label={t('dashboard.schools')} />
              <Stat variant="tile" value={summary.champions} label={t('dashboard.champions')} />
            </div>
            {summary.learners !== undefined && (
              <div className="stat-grid">
                <Stat
                  variant="tile"
                  value={summary.learners}
                  label={t('dashboard.learners')}
                  delta={`${t('dashboard.girls')} ${summary.learnersByGender.girl ?? 0} · ${t('dashboard.boys')} ${summary.learnersByGender.boy ?? 0}`}
                />
                <Stat
                  variant="tile"
                  value={summary.sessionsThisMonth}
                  label={t('dashboard.sessionsThisMonth')}
                />
                <Stat
                  variant="tile"
                  value={
                    summary.attendanceRate === null
                      ? t('dashboard.noRate')
                      : `${summary.attendanceRate}%`
                  }
                  label={t('dashboard.attendanceRate')}
                />
                <Stat
                  variant="tile"
                  value={summary.learnersMissingConsent}
                  label={t('dashboard.missingConsent')}
                />
              </div>
            )}
            <div className="form-grid">
              <Breakdown
                title={t('dashboard.byRegion')}
                counts={summary.clubsByRegion}
                keys={REGION_VALUES}
                labelKey="regions"
                total={summary.activeClubs}
              />
              <Breakdown
                title={t('dashboard.byTrack')}
                counts={summary.clubsByTrack}
                keys={TRACKS}
                labelKey="tracks"
                total={summary.activeClubs}
              />
            </div>
          </div>
        )}
      </DataState>
      <div className="page-grid" style={{ marginTop: '1.5rem' }}>
        {can('dashboard:hq') ? <HqPanels /> : <ChampionPanels />}
      </div>
    </>
  );
}

/** Champions: alerts for their clubs and the events their clubs are invited to. */
function ChampionPanels() {
  const events = useApi(upcoming);
  return (
    <div className="form-grid">
      <AlertsCard />
      {events.data?.data && <UpcomingEvents events={events.data.data} />}
    </div>
  );
}

function Breakdown({ title, counts, keys, labelKey, total }) {
  const { t } = useTranslation();
  const rows = keys.filter((k) => counts[k]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState title={t('dashboard.none')} />
        ) : (
          <div className="bar-list">
            {rows.map((k) => (
              <div key={k}>
                <div className="row-between">
                  <span>{t(`${labelKey}.${k}`)}</span>
                  <strong>{counts[k]}</strong>
                </div>
                <Progress value={(counts[k] / total) * 100} label={t(`${labelKey}.${k}`)} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
