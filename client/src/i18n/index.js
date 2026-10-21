import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en/common.json';
import sw from './locales/sw/common.json';

/** English and Kiswahili from day one (D1-11). English is the fallback for missing keys. */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { common: en }, sw: { common: sw } },
    defaultNS: 'common',
    fallbackLng: 'en',
    supportedLngs: ['en', 'sw'],
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
