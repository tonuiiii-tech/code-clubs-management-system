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
import { useAuth } from '../../context/AuthContext.jsx';

/** Counts inside the user's own scope (US-06, US-12). Charts and reports come in Sprint 4. */
export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
    </>
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
