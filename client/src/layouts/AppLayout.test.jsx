import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { can } from '@code-clubs/shared/permissions';
import { AppLayout } from './AppLayout.jsx';

let currentUser;
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: currentUser,
    can: (permission) => can(currentUser, permission),
    logout: vi.fn(),
  }),
}));

function renderAs(role) {
  currentUser = { id: 'u1', fullName: 'Test User', role, status: 'active', regions: [] };
  render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  );
  const nav = screen.getByRole('navigation', { name: 'Main navigation' });
  return [...nav.querySelectorAll('a')].map((a) => a.textContent);
}

describe('navigation follows the permission policy', () => {
  it('shows a System Administrator every section', () => {
    expect(renderAs('system_admin')).toEqual([
      'Dashboard',
      'Clubs',
      'Learners',
      'Sessions',
      'Events',
      'Equipment',
      'Resources',
      'Announcements',
      'Reports',
      'Schools',
      'Users',
      'Settings',
      'Sync',
      'My profile',
    ]);
  });

  it('hides user management, reports, settings and schools from a Club Champion', () => {
    expect(renderAs('champion')).toEqual([
      'Dashboard',
      'Clubs',
      'Learners',
      'Sessions',
      'Events',
      'Equipment',
      'Resources',
      'Announcements',
      'Sync',
      'My profile',
    ]);
  });

  it('gives a Programme Manager the Users section to create coordinator accounts (D5-12)', () => {
    expect(renderAs('programme_manager')).toContain('Users');
  });

  it('keeps the Schools section for a Code Clubs Coordinator', () => {
    expect(renderAs('coordinator')).toContain('Schools');
  });
});
