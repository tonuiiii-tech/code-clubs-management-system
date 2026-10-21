import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar, Menu, SkipLink } from 'steamlabsui';
import { useAuth } from '../context/AuthContext.jsx';
import { LanguageSwitcher } from '../components/LanguageSwitcher.jsx';
import { DemoBanner } from '../components/DemoBanner.jsx';

/** Menu items are filtered by the shared policy; the server still checks every request (D1-3). */
export const NAV = [
  { to: '/', key: 'nav.dashboard', end: true },
  { to: '/clubs', key: 'nav.clubs', permission: 'club:read' },
  { to: '/schools', key: 'nav.schools', permission: 'school:read' },
  { to: '/users', key: 'nav.users', permission: 'user:manage' },
  { to: '/profile', key: 'nav.profile' },
];

export function AppLayout() {
  const { t } = useTranslation();
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <SkipLink href="#main">{t('nav.skip')}</SkipLink>
      <DemoBanner />
      <div className="app-shell">
        <nav className="app-nav" aria-label={t('nav.main')}>
          <strong className="app-nav__brand">{t('app.name')}</strong>
          {NAV.filter((item) => !item.permission || can(item.permission)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
        <main className="app-main" id="main" tabIndex={-1}>
          <div className="app-topbar">
            <LanguageSwitcher />
            {user && (
              <Menu
                label={user.fullName}
                trigger={
                  <span className="app-user">
                    <Avatar name={user.fullName} size={30} aria-hidden />
                    <span className="app-user__text">
                      <span>{user.fullName}</span>
                      <small>{t(`roles.${user.role}`)}</small>
                    </span>
                  </span>
                }
                items={[
                  { label: t('nav.profile'), onSelect: () => navigate('/profile') },
                  'separator',
                  { label: t('nav.signOut'), onSelect: logout },
                ]}
              />
            )}
          </div>
          <Outlet />
        </main>
      </div>
    </>
  );
}
