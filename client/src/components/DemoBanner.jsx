import { useTranslation } from 'react-i18next';
import { USE_MOCKS } from '../services/http.js';

/** Makes it obvious that the demo uses fictional data (R1-12). Only rendered in mock mode. */
export function DemoBanner() {
  const { t } = useTranslation();
  if (!USE_MOCKS) return null;
  return (
    <p className="demo-banner" role="note">
      {t('demo.banner')}
    </p>
  );
}
