import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  TextLink,
  useToast,
} from 'steamlabsui';
import { DataState } from '../../components/DataState.jsx';
import { useApi } from '../../utils/useApi.js';
import { dismissAlert, getAlerts } from '../../services/reportsService.js';

/** What an alert says, from its type and value (plan section 4.2). */
export function alertText(t, alert) {
  switch (alert.type) {
    case 'noRecentSession':
      return alert.value
        ? t('alerts.noRecentSession', { date: alert.value })
        : t('alerts.noRecentSessionNever');
    case 'lowAttendance':
      return t('alerts.lowAttendance', { value: alert.value });
    case 'missingConsent':
      return t('alerts.missingConsent', { count: alert.value });
    case 'nearCapacity':
      return t('alerts.nearCapacity', { value: alert.value });
    case 'eventConsentMissing':
      return t('alerts.eventConsentMissing', { count: alert.value, event: alert.eventName });
    case 'equipmentOverdue':
      return t('alerts.equipmentOverdue', { count: alert.value });
    case 'equipmentReported':
      return t('alerts.equipmentReported', { count: alert.value });
    default:
      return alert.type;
  }
}

/** Clubs that need attention, computed when asked (US-20, D4-2). */
export function AlertsCard({ query }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { loading, error, data, reload } = useApi(getAlerts, query);
  const [hidden, setHidden] = useState([]);
  const alerts = (data?.data ?? []).filter((a) => !hidden.includes(a.key));

  /** Hides an alert from this person for 7 days (R4-4). */
  async function dismiss(key) {
    try {
      await dismissAlert(key);
      setHidden((h) => [...h, key]);
      toast({ title: t('alerts.dismissed'), tone: 'success' });
    } catch (err) {
      toast({ title: t('common.error'), description: err.message, tone: 'danger' });
    }
  }
  // One row per club, with every reason, so a club with several problems is listed once.
  const clubs = [];
  for (const a of alerts) {
    let club = clubs.find((c) => c.clubId === a.clubId);
    if (!club) clubs.push((club = { ...a, items: [] }));
    club.items.push(a);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('alerts.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataState loading={loading} error={error} onRetry={reload}>
          {alerts.length === 0 ? (
            <EmptyState title={t('alerts.none')} />
          ) : (
            <ul className="alert-list">
              {clubs.map((club) => (
                <li key={club.clubId}>
                  <span>
                    <TextLink asChild arrow={false}>
                      <Link to={`/clubs/${club.clubId}`}>
                        {club.clubCode} · {club.clubName}
                      </Link>
                    </TextLink>
                    {club.items.map((a) => (
                      <small key={a.key}>
                        {alertText(t, a)}
                        {a.eventId && (
                          <>
                            {' · '}
                            <Link to={`/events/${a.eventId}`}>{t('alerts.openEvent')}</Link>
                          </>
                        )}
                        {a.type.startsWith('equipment') && (
                          <>
                            {' · '}
                            <Link
                              to={
                                a.type === 'equipmentOverdue'
                                  ? '/equipment?overdue=true'
                                  : '/equipment'
                              }
                            >
                              {t('alerts.openEquipment')}
                            </Link>
                          </>
                        )}
                        {' · '}
                        <button
                          type="button"
                          className="link-button alert-dismiss"
                          onClick={() => dismiss(a.key)}
                          aria-label={t('alerts.dismissLabel', { text: alertText(t, a) })}
                        >
                          {t('alerts.dismiss')}
                        </button>
                      </small>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
