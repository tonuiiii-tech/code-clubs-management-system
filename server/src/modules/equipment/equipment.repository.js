import {
  Club,
  Counter,
  EquipmentItem,
  EquipmentLoan,
  EquipmentRepair,
  EquipmentReport,
} from '../../db/models.js';
import { insertUnique, paginate, textSearch, toDocument, toRecord } from '../../db/records.js';
import { clubScopeQuery, equipmentScopeQuery } from '../../db/scopeQueries.js';
import { conflict } from '../../utils/httpError.js';

/** Equipment items, loans, repairs and reports (plan section 4). Plain records only (D1-16). */

/** Coordinators manage only their own regions' items. */
function manageScopeQuery(filter) {
  if (filter.all) return {};
  if (filter.regions) return { region: { $in: filter.regions } };
  return { _id: null };
}

export async function listItems(
  filter,
  { q, type, condition, region, clubId, location, overdue },
  page,
) {
  const overdueIds = overdue
    ? await EquipmentLoan.distinct('itemId', {
        open: true,
        dueDate: { $ne: null, $lt: new Date().toISOString().slice(0, 10) },
      })
    : null;
  const query = {
    $and: [
      await equipmentScopeQuery(filter),
      textSearch(q, ['name', 'assetTag', 'serialNumber']),
      type ? { type } : {},
      condition ? { condition } : {},
      region ? { region } : {},
      clubId ? { clubId } : {},
      location === 'store' ? { clubId: null } : {},
      location === 'club' ? { clubId: { $ne: null } } : {},
      overdueIds ? { _id: { $in: overdueIds } } : {},
    ],
  };
  return paginate(EquipmentItem, query, page, { assetTag: 1 });
}

export async function findItem(filter, id) {
  return toRecord(
    await EquipmentItem.findOne({ $and: [{ _id: id }, await equipmentScopeQuery(filter)] }).lean(),
  );
}

export async function findManagedItem(filter, id) {
  return toRecord(
    await EquipmentItem.findOne({ $and: [{ _id: id }, manageScopeQuery(filter)] }).lean(),
  );
}

/** Next asset tag, e.g. EQ-0042. `$inc` is atomic, so two items never share one. */
export async function nextAssetTag() {
  const counter = await Counter.findByIdAndUpdate(
    'equipment',
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true },
  ).lean();
  return `EQ-${String(counter.seq).padStart(4, '0')}`;
}

export const insertItem = (item, duplicateMessage) =>
  insertUnique(EquipmentItem, item, duplicateMessage);

export async function updateItem(id, changes, duplicateMessage) {
  try {
    return toRecord(
      await EquipmentItem.findByIdAndUpdate(
        id,
        { $set: changes },
        { returnDocument: 'after' },
      ).lean(),
    );
  } catch (err) {
    if (err?.code === 11000) throw conflict(duplicateMessage);
    throw err;
  }
}

export async function clubsByIds(ids) {
  const docs = await Club.find({ _id: { $in: ids } })
    .select('code name region status')
    .lean();
  return docs.map(toRecord);
}

export async function findClubInScope(filter, id) {
  return toRecord(
    await Club.findOne({ $and: [{ _id: id }, await clubScopeQuery(filter)] })
      .select('code name region status')
      .lean(),
  );
}

export async function openLoans(itemIds) {
  const docs = await EquipmentLoan.find({ itemId: { $in: itemIds }, open: true }).lean();
  return docs.map(toRecord);
}

export async function loansOf(itemId) {
  const docs = await EquipmentLoan.find({ itemId }).sort({ outDate: -1, createdAt: -1 }).lean();
  return docs.map(toRecord);
}

/** Opens a loan; a second open loan for the same item (two people at once) becomes a 409. */
export const insertLoan = (loan, message) => insertUnique(EquipmentLoan, loan, message);

export async function closeLoan(id, changes) {
  return toRecord(
    await EquipmentLoan.findOneAndUpdate(
      { _id: id, open: true },
      { $set: { ...changes, open: false } },
      { returnDocument: 'after' },
    ).lean(),
  );
}

export const insertRepair = (repair) => EquipmentRepair.create(toDocument(repair));

export async function repairsOf(itemId) {
  const docs = await EquipmentRepair.find({ itemId }).sort({ date: -1, createdAt: -1 }).lean();
  return docs.map(toRecord);
}

export const insertReport = (report) => EquipmentReport.create(toDocument(report));

export async function reportsOf(itemId) {
  const docs = await EquipmentReport.find({ itemId }).sort({ date: -1, createdAt: -1 }).lean();
  return docs.map(toRecord);
}
