import { useTranslation } from 'react-i18next';
import { Alert, Button, EmptyState, Spinner } from 'steamlabsui';

/** Loading, error and empty states for data-driven pages (coding principle 3). */
export function DataState({ loading, error, isEmpty, emptyTitle, onRetry, children }) {
  const { t } = useTranslation();

  if (loading) return <Spinner label={t('common.loading')} />;

  if (error?.code === 'NOT_IMPLEMENTED') {
    return (
      <Alert tone="info" title={t('common.notAvailable')}>
        {t('common.databasePending')}
      </Alert>
    );
  }
  if (error) {
    return (
      <Alert
        tone="danger"
        title={t('common.error')}
        action={
          onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {t('common.retry')}
            </Button>
          )
        }
      >
        {error.message}
      </Alert>
    );
  }
  if (isEmpty) return <EmptyState title={emptyTitle} />;
  return children;
}
