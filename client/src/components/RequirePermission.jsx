import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Spinner } from 'steamlabsui';
import { useAuth } from '../context/AuthContext.jsx';

/** Route guard for the UI only; the API enforces the same rules (D1-3). */
export function RequirePermission({ permission, children }) {
  const { user, ready, can } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (!ready) return <Spinner label={t('common.loading')} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (permission && !can(permission)) return <Alert tone="warning">{t('errors.forbidden')}</Alert>;
  return children;
}
