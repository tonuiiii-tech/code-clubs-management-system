import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar, Menu, SkipLink } from 'steamlabsui';
import { useAuth } from '../context/AuthContext.jsx';
import { LanguageSwitcher } from '../components/LanguageSwitcher.jsx';
import { DemoBanner } from '../components/DemoBanner.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { SyncStatus } from '../components/SyncStatus.jsx';
import { AnnouncementsBell } from '../components/AnnouncementsBell.jsx';
import { useSyncState } from '../offline/index.js';
import codeClubLogo from '../assets/code-club-logo.png';

/** Menu items are filtered by the shared policy; the server still checks every request (D1-3). */
export const NAV = [
  { to: '/', key: 'nav.dashboard', end: true },
  { to: '/clubs', key: 'nav.clubs', permission: 'club:read' },
  { to: '/learners', key: 'nav.learners', permission: 'learner:read' },
  { to: '/sessions', key: 'nav.sessions', permission: 'session:read' },
  { to: '/events', key: 'nav.events', permission: 'event:read' },
  { to: '/equipment', key: 'nav.equipment', permission: 'equipment:read' },
  { to: '/resources', key: 'nav.resources', permission: 'resource:read' },
  { to: '/announcements', key: 'nav.announcements', permission: 'announcement:read' },
  { to: '/reports', key: 'nav.reports', permission: 'report:read' },
  // Champions work inside their own clubs, so they get no Schools section; they still reach
  // their club's school from the club page (Enock, 2026-10-26).
  { to: '/schools', key: 'nav.schools', permission: 'school:write' },
  { to: '/users', key: 'nav.users', permission: 'user:create' },
  { to: '/settings', key: 'nav.settings', permission: ['term:manage', 'report:schedule'] },
  { to: '/sync', key: 'nav.sync', permission: ['sync:use', 'syncConflict:read'] },
  { to: '/profile', key: 'nav.profile' },
];

export function AppLayout() {
  const { t } = useTranslation();
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();
  const sync = useSyncState();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const allowed = (permission) => !permission || [permission].flat().some((p) => can(p));
  const unsent = sync.pending + sync.attention;

  // Signing out deletes this device's copy, so warn about changes not yet sent (D3-2).
  const signOut = () => (unsent > 0 ? setConfirmingSignOut(true) : logout());

  return (
    <>
      <SkipLink href="#main">{t('nav.skip')}</SkipLink>
      <DemoBanner />
      <div className="app-shell">
        <nav className="app-nav" aria-label={t('nav.main')}>
          <div className="app-nav__brand">
            <img src={codeClubLogo} alt="Code Club" width={120} />
            <strong>{t('app.name')}</strong>
          </div>
          {NAV.filter((item) => allowed(item.permission)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
        <main className="app-main" id="main" tabIndex={-1}>
          <div className="app-topbar">
            <SyncStatus />
            {can('announcement:read') && <AnnouncementsBell />}
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
                  { label: t('nav.signOut'), onSelect: signOut },
                ]}
              />
            )}
          </div>
          <Outlet />
        </main>
      </div>
      <ConfirmDialog
        open={confirmingSignOut}
        title={t('sync.signOutTitle')}
        confirmLabel={t('sync.signOutAnyway')}
        onConfirm={() => {
          setConfirmingSignOut(false);
          logout();
        }}
        onClose={() => setConfirmingSignOut(false)}
      >
        {t('sync.signOutBody', { count: unsent })}
      </ConfirmDialog>
    </>
  );
}
