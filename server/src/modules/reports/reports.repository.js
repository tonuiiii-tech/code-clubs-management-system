import { ReportRun, Setting } from '../../db/models.js';

const RECIPIENTS = 'reportRecipients';

export async function getRecipients() {
  const doc = await Setting.findById(RECIPIENTS).lean();
  return doc?.value ?? [];
}

export async function saveRecipients(recipients, userId) {
  const now = new Date();
  await Setting.updateOne(
    { _id: RECIPIENTS },
    {
      $set: { value: recipients, updatedAt: now, updatedBy: userId },
      $setOnInsert: { createdAt: now, createdBy: userId },
    },
    { upsert: true },
  );
}

/**
 * Takes the run for a term. The id is unique, so when two servers try at once only one insert
 * succeeds (R4-2). Resolves false when another server already has it.
 */
export async function claimRun(termId) {
  try {
    await ReportRun.create({ _id: `termly:${termId}`, termId, state: 'running' });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
}

export const finishRun = (termId, changes) =>
  ReportRun.updateOne({ _id: `termly:${termId}` }, { $set: changes });
