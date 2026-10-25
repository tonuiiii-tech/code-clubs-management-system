import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eyebrow } from 'steamlabsui';
import { Logo } from 'steamlabsui/logo';
import { DemoBanner } from '../components/DemoBanner.jsx';

/** Sign-in pages: a brand panel in the style of steamlabsafrica.com beside the form. */
export function AuthLayout() {
  const { t } = useTranslation();
  return (
    <>
      <DemoBanner />
      <div className="auth-page">
        <section className="auth-hero" aria-label={t('app.name')}>
          <Logo variant="white" width={150} />
          <div className="auth-hero__text">
            <Eyebrow on="ink">{t('login.eyebrow')}</Eyebrow>
            <p className="auth-hero__title">{t('login.heroTitle')}</p>
            <p className="auth-hero__lead">{t('login.heroText')}</p>
          </div>
          <p className="auth-hero__motto">{t('login.motto')}</p>
        </section>
        <div className="auth-form">
          <div className="auth-card">
            <Outlet />
          </div>
        </div>
      </div>
    </>
  );
}
