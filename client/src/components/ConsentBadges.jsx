import { useTranslation } from 'react-i18next';
import { Badge } from 'steamlabsui';

const VARIANT = {
  given: 'secondary',
  pending: 'primary',
  refused: 'destructive',
  withdrawn: 'destructive',
};

/** One badge per consent type: "Participation: Given", "Photos: Pending" (US-09). */
export function ConsentBadges({ consents }) {
  const { t } = useTranslation();
  return (
    <span className="badge-row">
      {Object.entries(consents ?? {}).map(([type, { status }]) => (
        <Badge key={type} variant={VARIANT[status] ?? 'neutral'}>
          {t(`consent.${type}`)}: {t(`consentStatuses.${status}`)}
        </Badge>
      ))}
    </span>
  );
}
