import { useTranslation } from 'react-i18next';
import { Badge } from 'steamlabsui';

const VARIANT = { active: 'secondary', paused: 'primary', inactive: 'neutral', closed: 'neutral' };

/** Record status (active, inactive, paused, closed) as a translated badge. */
export function StatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <Badge variant={VARIANT[status] ?? 'neutral'} dot>
      {t(`status.${status}`)}
    </Badge>
  );
}
