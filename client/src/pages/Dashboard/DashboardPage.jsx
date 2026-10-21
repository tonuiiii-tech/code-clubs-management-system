import { useTranslation } from 'react-i18next';
import { PageHeader, Stat } from 'steamlabsui';

/** Sprint 1: basic counts. Figures come from the API once the database is connected (D1-8). */
export function DashboardPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('dashboard.title')} description={t('dashboard.description')} />
      <div className="stat-grid">
        <Stat variant="tile" value="—" label={t('dashboard.activeClubs')} />
        <Stat variant="tile" value="—" label={t('dashboard.schools')} />
        <Stat variant="tile" value="—" label={t('dashboard.champions')} />
      </div>
    </>
  );
}
