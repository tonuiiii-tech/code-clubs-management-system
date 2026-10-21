import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, EmptyState, Spinner } from 'steamlabsui';

/** Loading, error and empty states for data-driven pages (coding principle 3). */
export function DataState({ loading, error, isEmpty, emptyTitle, emptyAction, onRetry, children }) {
  const { t } = useTranslation();

  if (loading) return <Spinner label={t('common.loading')} />;

  if (error?.code === 'NOT_IMPLEMENTED') {
    return (
      <Alert tone="info" title={t('common.notAvailable')}>
        {t('common.databasePending')}
      </Alert>
    );
  }
  // Records outside the user's scope also come back as 404 (D1-4), so this reads the same for both.
  if (error?.status === 404) return <NotFoundState />;
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
  if (isEmpty) return <EmptyState title={emptyTitle} action={emptyAction} />;
  return children;
}

export function NotFoundState() {
  const { t } = useTranslation();
  return (
    <EmptyState
      title={t('errors.notFoundTitle')}
      description={t('errors.notFound')}
      action={
        <Button asChild variant="outline">
          <Link to="/">{t('errors.home')}</Link>
        </Button>
      }
    />
  );
}
