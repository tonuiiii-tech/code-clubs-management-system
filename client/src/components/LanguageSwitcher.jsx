import { useTranslation } from 'react-i18next';
import { SegmentedControl } from 'steamlabsui';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage === 'sw' ? 'sw' : 'en';
  return (
    <SegmentedControl
      aria-label={t('language.label')}
      options={[
        { value: 'en', label: t('language.en') },
        { value: 'sw', label: t('language.sw') },
      ]}
      value={current}
      onValueChange={(lng) => i18n.changeLanguage(lng)}
    />
  );
}
