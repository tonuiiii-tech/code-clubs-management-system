import { jest } from '@jest/globals';
import request from 'supertest';

/**
 * Resource-scope tests (D1-4). The database is still pending (D1-8), so the
 * repositories are replaced with test doubles. The rules under test live in
 * middleware and services, which do not change when the database is chosen.
 */
const users = new Map();
const findClubInScope = jest.fn();

jest.unstable_mockModule('../src/modules/users/users.repository.js', () => ({
  findUserById: async (id) => users.get(id) ?? null,
  findUserByEmail: async () => null,
  listUsers: async () => ({ data: [], page: 1, pageSize: 20, total: 0 }),
  insertUser: async () => {},
  updateUserById: async () => {},
}));
jest.unstable_mockModule('../src/modules/clubs/clubs.repository.js', () => ({
  findClubInScope,
  listClubs: async () => ({ data: [], page: 1, pageSize: 20, total: 0 }),
  nextClubCode: async () => 'NAC-001',
  insertClub: async () => {},
  updateClubById: async () => {},
  upsertChampionAssignment: async () => {},
  endChampionAssignment: async () => {},
}));
jest.unstable_mockModule('../src/modules/audit/audit.repository.js', () => ({
  insertAuditEntry: async () => {},
  listAuditEntries: async () => ({ data: [] }),
}));

const { createApp } = await import('../src/app.js');
const { signAccessToken } = await import('../src/modules/auth/auth.service.js');
const app = createApp();

const champion = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'champion',
  status: 'active',
  tokenVersion: 0,
};
const otherClubId = '22222222-2222-4222-8222-222222222222';
users.set(champion.id, champion);
const bearer = (u) => `Bearer ${signAccessToken(u)}`;

describe('Resource scope', () => {
  beforeEach(() => findClubInScope.mockReset());

  it('returns 404 when a champion changes the club ID in the URL', async () => {
    findClubInScope.mockResolvedValue(null); // the club exists, but not in this champion's scope
    const res = await request(app)
      .get(`/api/v1/clubs/${otherClubId}`)
      .set('Authorization', bearer(champion));
    expect(res.status).toBe(404);
    expect(findClubInScope).toHaveBeenCalledWith(otherClubId, { championUserId: champion.id });
  });

  it('returns 403 when a champion tries to edit a club', async () => {
    const res = await request(app)
      .patch(`/api/v1/clubs/${otherClubId}`)
      .set('Authorization', bearer(champion))
      .send({ name: 'Renamed' });
    expect(res.status).toBe(403);
    expect(findClubInScope).not.toHaveBeenCalled();
  });

  it('returns 403 when a champion tries to create a user', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', bearer(champion))
      .send({ fullName: 'New Admin', email: 'x@example.org', role: 'system_admin' });
    expect(res.status).toBe(403);
  });

  it('rejects a deactivated user even with an unexpired token', async () => {
    const token = bearer(champion);
    users.set(champion.id, { ...champion, status: 'inactive', tokenVersion: 1 });
    const res = await request(app).get('/api/v1/clubs').set('Authorization', token);
    expect(res.status).toBe(401);
    users.set(champion.id, champion);
  });
});
