import { ROLES } from '@code-clubs/shared/enums';
import { Announcement, AnnouncementRead, Club, ClubChampion, User } from '../../db/models.js';
import { toDocument, toRecord } from '../../db/records.js';

/**
 * Active users an audience reaches (D4-7): the roles chosen (all when none), limited to the
 * regions and clubs chosen. A region reaches its coordinators and the champions of its clubs; a
 * club reaches its current champions. HQ users have no region, so only a national audience
 * reaches them.
 */
export async function audienceUsers({ roles, regions, clubIds }, excludeUserId) {
  const query = { status: 'active', _id: { $ne: excludeUserId } };
  if (roles.length) query.role = { $in: roles };
  if (regions.length || clubIds.length) {
    const regionClubIds = regions.length
      ? await Club.distinct('_id', { region: { $in: regions } })
      : [];
    const championIds = await ClubChampion.distinct('userId', {
      clubId: { $in: [...regionClubIds, ...clubIds] },
      endDate: null,
    });
    query.$or = [
      ...(regions.length ? [{ role: ROLES.COORDINATOR, regions: { $in: regions } }] : []),
      { role: ROLES.CHAMPION, _id: { $in: championIds } },
    ];
  }
  const docs = await User.find(query).select('fullName role phone').lean();
  return docs.map(toRecord);
}

export async function clubRegions(clubIds) {
  const docs = await Club.find({ _id: { $in: clubIds } })
    .select('region')
    .lean();
  return docs.map((c) => c.region);
}

export const insertAnnouncement = (record) => Announcement.create(toDocument(record));

export async function findAnnouncement(id) {
  return toRecord(await Announcement.findById(id).lean());
}

const listFields = '-recipientIds';

/** The user's inbox, newest first, with read marks and the unread count for the bell. */
export async function inbox(userId, { page = 1, pageSize = 20 }) {
  const filter = { recipientIds: userId };
  const [docs, total, readIds] = await Promise.all([
    Announcement.find(filter)
      .select(listFields)
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Announcement.countDocuments(filter),
    AnnouncementRead.distinct('announcementId', { userId }),
  ]);
  const read = new Set(readIds);
  const unread = await Announcement.countDocuments({ ...filter, _id: { $nin: readIds } });
  return {
    data: docs.map((d) => ({ ...toRecord(d), read: read.has(d._id) })),
    page,
    pageSize,
    total,
    unread,
  };
}

/** What the user sent, with how many received and read each one. */
export async function sent(userId, { page = 1, pageSize = 20 }) {
  const filter = { senderId: userId };
  const [docs, total] = await Promise.all([
    Announcement.find(filter)
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Announcement.countDocuments(filter),
  ]);
  const counts = await readCounts(docs.map((d) => d._id));
  return {
    data: docs.map(({ recipientIds, ...d }) => ({
      ...toRecord(d),
      recipientCount: recipientIds.length,
      readCount: counts[d._id] ?? 0,
    })),
    page,
    pageSize,
    total,
  };
}

export async function readCounts(ids) {
  const rows = await AnnouncementRead.aggregate([
    { $match: { announcementId: { $in: ids } } },
    { $group: { _id: '$announcementId', n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

export async function findRead(announcementId, userId) {
  return toRecord(await AnnouncementRead.findOne({ announcementId, userId }).lean());
}

/** Idempotent: reading twice, or from two devices, keeps the first time. */
export async function markRead(id, announcementId, userId, readAt) {
  await AnnouncementRead.updateOne(
    { announcementId, userId },
    { $setOnInsert: { _id: id, readAt } },
    { upsert: true },
  );
}
