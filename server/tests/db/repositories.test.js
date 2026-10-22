import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { createSeedData, uid } from '@code-clubs/shared/demo';
import { clearDatabase, useTestDatabase } from '../support/database.js';
import { seed } from '../../scripts/seed.js';
import * as clubs from '../../src/modules/clubs/clubs.repository.js';
import * as schools from '../../src/modules/schools/schools.repository.js';
import * as users from '../../src/modules/users/users.repository.js';
import * as audit from '../../src/modules/audit/audit.repository.js';
import { summaryCounts } from '../../src/modules/dashboard/dashboard.repository.js';

useTestDatabase();

const FAITH = uid(11); // champion leading NAC-001 and NAC-002
const page = { page: 1, pageSize: 50 };

describe('MongoDB repositories', () => {
  beforeAll(async () => {
    await clearDatabase();
    await seed({ password: 'test-password-123' });
  });

  it('stores UUID strings as _id and returns plain records with id (D1-21)', async () => {
    const raw = await mongoose.connection.db.collection('schools').findOne({});
    expect(typeof raw._id).toBe('string');
    const school = await schools.findSchoolInScope(raw._id, { all: true });
    expect(school.id).toBe(raw._id);
    expect(school).not.toHaveProperty('_id');
  });

  it('applies coordinator and champion scope to clubs', async () => {
    const nairobi = await clubs.listClubs({ regions: ['nairobi_central'] }, page);
    expect(nairobi.data.map((c) => c.code)).toEqual(['NAC-001', 'NAC-002', 'NAC-003']);

    const faith = await clubs.listClubs({ championUserId: FAITH }, page);
    expect(faith.data.map((c) => c.code)).toEqual(['NAC-001', 'NAC-002']);
    expect(await clubs.findClubInScope(uid(204), { championUserId: FAITH })).toBeNull();
  });

  it('shows a champion only the schools of their clubs', async () => {
    const result = await schools.listSchools({ championUserId: FAITH }, page);
    expect(result.data.map((s) => s.id).sort()).toEqual([uid(101), uid(102)]);
  });

  it('lets a coordinator see their region, its champions and unassigned champions', async () => {
    const { data } = await users.listUsers({ regions: ['nairobi_central'] }, page);
    const names = data.map((u) => u.fullName);
    expect(names).toEqual(expect.arrayContaining(['Mwende Mutua', 'Faith Njeri', 'Brian Kiptoo']));
    expect(names).not.toContain('Hassan Mwinyi'); // coast coordinator
    expect(names).not.toContain('Amina Salim'); // champion of western and coast clubs only
  });

  it('never matches anything for an unknown scope', async () => {
    expect((await clubs.listClubs({ none: true }, page)).total).toBe(0);
  });

  it('finds duplicate schools regardless of letter case (R1-11)', async () => {
    const dup = await schools.findDuplicateSchool('MWANGAZA primary school', 'Nairobi', 'Kibra');
    expect(dup?.id).toBe(uid(101));
  });

  it('rejects a duplicate school even if two saves race past the check', async () => {
    const [school] = createSeedData().schools;
    await expect(
      schools.insertSchool({ ...school, id: randomUUID(), name: school.name.toUpperCase() }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('never hands out the same club code twice, even in parallel', async () => {
    const codes = await Promise.all(Array.from({ length: 10 }, () => clubs.nextClubCode('CST')));
    expect(new Set(codes).size).toBe(10);
    expect(codes).toContain('CST-004'); // seeded clubs go up to CST-003
  });

  it('keeps one current assignment per champion and club, and keeps history', async () => {
    const club = uid(209);
    await clubs.upsertChampionAssignment({
      clubId: club,
      userId: FAITH,
      role: 'assistant',
      startDate: '2026-10-01',
    });
    await clubs.upsertChampionAssignment({
      clubId: club,
      userId: FAITH,
      role: 'lead',
      startDate: '2026-10-02',
    });
    let current = await clubs.listClubChampions(club);
    expect(current).toEqual([
      expect.objectContaining({
        userId: FAITH,
        role: 'lead',
        fullName: 'Faith Njeri',
        startDate: '2026-10-01',
      }),
    ]);

    await clubs.endChampionAssignment(club, FAITH, '2026-10-22');
    current = await clubs.listClubChampions(club);
    expect(current).toEqual([]);
    const history = await mongoose.connection.db
      .collection('clubChampions')
      .find({ clubId: club })
      .toArray();
    expect(history).toHaveLength(1);
    expect(history[0].endDate).toBe('2026-10-22');
  });

  it('counts the dashboard inside the scope', async () => {
    const all = await summaryCounts({ all: true });
    expect(all).toMatchObject({ activeClubs: 10, schools: 10 });
    expect(all.clubsByRegion.nairobi_central).toBe(3);
    const faith = await summaryCounts({ championUserId: FAITH });
    expect(faith).toMatchObject({ activeClubs: 2, schools: 2, champions: 2 });
  });

  it('keeps the audit log append-only and region-scoped', async () => {
    await audit.insertAuditEntry({
      at: new Date(),
      action: 'school.update',
      entityType: 'school',
      entityId: uid(101),
      region: 'nairobi_central',
      changedFields: [],
    });
    await audit.insertAuditEntry({
      at: new Date(),
      action: 'school.update',
      entityType: 'school',
      entityId: uid(106),
      region: 'coast',
      changedFields: [],
    });
    const nairobi = await audit.listAuditEntries({ regions: ['nairobi_central'] }, page);
    expect(nairobi.data.map((e) => e.entityId)).toEqual([uid(101)]);
    expect(Object.keys(audit)).toEqual(['insertAuditEntry', 'listAuditEntries']);
  });
});
