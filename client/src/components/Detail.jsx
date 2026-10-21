import { useTranslation } from 'react-i18next';

/** One label and value inside a <dl className="detail-list">. */
export function Detail({ label, value }) {
  const { t } = useTranslation();
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || t('common.none')}</dd>
    </div>
  );
}
