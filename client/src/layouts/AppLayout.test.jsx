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
      'Schools',
      'Users',
      'My profile',
    ]);
  });

  it('hides user management from a Club Champion', () => {
    expect(renderAs('champion')).toEqual(['Dashboard', 'Clubs', 'Schools', 'My profile']);
  });
});
