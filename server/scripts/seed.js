/**
 * Development seed: the same fictional Kenyan schools, clubs and people as demo mode (D1-22).
 *
 * Rules (R1-12): fictional names only, phone numbers in the fake +254700000xxx range,
 * and never run against production. Safe to run again: records are upserted by their ID,
 * so it resets the demo records without touching anything else.
 */
import bcrypt from 'bcrypt';
import { REGION_CODE_PREFIX } from '@code-clubs/shared/enums';
import {
  createSeedData,
  DEMO_PASSWORD,
  DEMO_RESOURCE_FILES,
  demoPdf,
} from '@code-clubs/shared/demo';
import { env } from '../src/config/env.js';
import { BUCKETS, deleteFile, saveFile } from '../src/db/files.js';
import { connectDatabase, disconnectDatabase } from '../src/db/index.js';
import {
  Announcement,
  AnnouncementRead,
  Assessment,
  AssessmentScore,
  Attendance,
  Club,
  ClubChampion,
  Consent,
  Counter,
  EquipmentItem,
  EquipmentLoan,
  EquipmentRepair,
  EquipmentReport,
  Event,
  EventConsent,
  EventParticipant,
  EventProject,
  Learner,
  LearnerContact,
  LearnerProject,
  Resource,
  School,
  Session,
  Term,
  User,
} from '../src/db/models.js';
import { toDocument } from '../src/db/records.js';
import { BCRYPT_COST } from '../src/modules/users/users.service.js';

export async function seed({ password = env.SEED_DEFAULT_PASSWORD || DEMO_PASSWORD } = {}) {
  const {
    users,
    schools,
    clubs,
    assignments,
    terms,
    events,
    eventParticipants,
    eventConsents,
    eventProjects,
    announcements,
    announcementReads,
    equipmentItems,
    equipmentLoans,
    equipmentRepairs,
    equipmentReports,
    resources,
    learnerProjects,
    assessments,
    assessmentScores,
    ...sprint2
  } = createSeedData();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const upsertAll = (model, records) =>
    model.bulkWrite(
      records.map((record) => {
        const doc = toDocument(record);
        return { replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } };
      }),
    );

  await upsertAll(
    User,
    users.map((u) => ({ ...u, passwordHash, tokenVersion: 0, failedLogins: 0 })),
  );
  await upsertAll(School, schools);
  await upsertAll(Club, clubs);
  await ClubChampion.deleteMany({ clubId: { $in: clubs.map((c) => c.id) } });
  await ClubChampion.insertMany(assignments.map((a) => ({ ...a })));

  // Sprint 2: fictional learners only (R2-1).
  await upsertAll(Learner, sprint2.learners);
  await upsertAll(LearnerContact, sprint2.learnerContacts);
  await upsertAll(Consent, sprint2.consents);
  // Session dates follow today's date, so replace the demo sessions rather than upsert them.
  await Session.deleteMany({ _id: { $in: sprint2.sessions.map((s) => s.id) } });
  await Attendance.deleteMany({ sessionId: { $in: sprint2.sessions.map((s) => s.id) } });
  await upsertAll(Session, sprint2.sessions);
  await upsertAll(Attendance, sprint2.attendance);
  for (const club of clubs) {
    const numbers = sprint2.learners
      .filter((l) => l.clubId === club.id)
      .map((l) => Number(l.learnerNumber.slice(-3)));
    if (numbers.length) {
      await Counter.updateOne(
        { _id: `learner:${club.code}` },
        { $max: { seq: Math.max(...numbers) } },
        { upsert: true },
      );
    }
  }

  // Sprint 4: dates follow today's date, so replace the demo records (fictional learners only).
  const replaceAll = async (model, records) => {
    await model.deleteMany({ _id: { $in: records.map((r) => r.id) } });
    await upsertAll(model, records);
  };
  await Term.deleteMany({ year: { $in: [...new Set(terms.map((t) => t.year))] } });
  await upsertAll(Term, terms);
  await replaceAll(Event, events);
  await replaceAll(EventParticipant, eventParticipants);
  await replaceAll(EventConsent, eventConsents);
  await replaceAll(EventProject, eventProjects);
  await replaceAll(Announcement, announcements);
  await replaceAll(AnnouncementRead, announcementReads);

  // Sprint 5: equipment, resources, projects and assessments (dates follow today's date too).
  await replaceAll(EquipmentItem, equipmentItems);
  await EquipmentLoan.deleteMany({ itemId: { $in: equipmentItems.map((i) => i.id) } });
  await upsertAll(EquipmentLoan, equipmentLoans);
  await replaceAll(EquipmentRepair, equipmentRepairs);
  await replaceAll(EquipmentReport, equipmentReports);
  await replaceAll(Resource, resources);
  for (const { fileId, lines } of Object.values(DEMO_RESOURCE_FILES)) {
    await deleteFile(BUCKETS.resourceFiles, fileId);
    await saveFile(BUCKETS.resourceFiles, Buffer.from(demoPdf(lines)), {
      id: fileId,
      contentType: 'application/pdf',
      metadata: { demo: true },
    });
  }
  await replaceAll(LearnerProject, learnerProjects);
  await replaceAll(Assessment, assessments);
  await AssessmentScore.deleteMany({ assessmentId: { $in: assessments.map((a) => a.id) } });
  await upsertAll(AssessmentScore, assessmentScores);
  const highestTag = Math.max(...equipmentItems.map((i) => Number(i.assetTag.slice(3))));
  await Counter.updateOne({ _id: 'equipment' }, { $max: { seq: highestTag } }, { upsert: true });

  // Keep club codes moving forward from the seeded ones (NAC-003 → next is NAC-004).
  for (const prefix of Object.values(REGION_CODE_PREFIX)) {
    const highest = clubs
      .filter((c) => c.code.startsWith(`${prefix}-`))
      .reduce((max, c) => Math.max(max, Number(c.code.slice(4))), 0);
    await Counter.updateOne({ _id: prefix }, { $max: { seq: highest } }, { upsert: true });
  }
  return {
    users: users.length,
    schools: schools.length,
    clubs: clubs.length,
    learners: sprint2.learners.length,
  };
}

if (process.argv[1]?.endsWith('seed.js')) {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is production.');
    process.exit(1);
  }
  await connectDatabase(env.MONGODB_URI);
  const counts = await seed();
  console.log(
    `Seeded ${counts.users} users, ${counts.schools} schools, ${counts.clubs} clubs`,
    `and ${counts.learners} fictional learners.`,
    'Sign in with any demo account, e.g. wanjiru.kamau@demo.steamlabs.test.',
  );
  await disconnectDatabase();
}
