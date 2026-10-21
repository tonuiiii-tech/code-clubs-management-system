import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button } from 'steamlabsui';
import { useAuth } from '../context/AuthContext.jsx';
import { LanguageSwitcher } from '../components/LanguageSwitcher.jsx';

const NAV = [
  { to: '/', key: 'nav.dashboard', end: true },
  { to: '/clubs', key: 'nav.clubs', permission: 'club:read' },
  { to: '/schools', key: 'nav.schools', permission: 'school:read' },
  { to: '/users', key: 'nav.users', permission: 'user:manage' },
];

export function AppLayout() {
  const { t } = useTranslation();
  const { user, can, logout } = useAuth();

  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label={t('app.name')}>
        <strong style={{ padding: '0 0.75rem 1rem' }}>{t('app.name')}</strong>
        {NAV.filter((item) => !item.permission || can(item.permission)).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {t(item.key)}
          </NavLink>
        ))}
      </nav>
      <main className="app-main">
        <div className="app-topbar">
          <LanguageSwitcher />
          {user && (
            <Badge variant="neutral">
              {user.fullName} · {t(`roles.${user.role}`)}
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={logout}>
            {t('nav.signOut')}
          </Button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
