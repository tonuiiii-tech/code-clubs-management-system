import { currentDb, refreshCounts, requestSync } from './engine.js';
import { targetOf } from './operations.js';
import { setMeta } from './db.js';

/**
 * Changes the server refused, and those waiting behind them ("Needs attention", US-16).
 * Nothing refused is dropped without the user choosing to.
 */
export async function listAttention() {
  const db = currentDb();
  if (!db) return [];
  const ops = await db.outbox.orderBy('seq').toArray();
  const refused = ops.filter((op) => op.state === 'rejected');
  return refused.map((op) => ({
    ...op,
    waiting: ops.filter(
      (other) =>
        other.state === 'pending' && other.seq > op.seq && targetOf(other) === targetOf(op),
    ).length,
  }));
}

/**
 * Sends a refused change again as a new change (the server keeps its answer to the old one),
 * e.g. confirming a possible duplicate or that children without photo consent are not shown.
 */
export async function retryChange(seq, { confirmDuplicate = false, confirmConsent = false } = {}) {
  const db = currentDb();
  const op = await db.outbox.get(seq);
  if (!op) return;
  const data = {
    ...op.data,
    ...(confirmDuplicate && { confirmDuplicate: true }),
    ...(confirmConsent && { confirmConsent: true }),
  };
  const opId = crypto.randomUUID();
  await db.transaction('rw', db.outbox, db.pendingFiles, async () => {
    const file = await db.pendingFiles.get(op.opId);
    if (file) {
      await db.pendingFiles.delete(op.opId);
      await db.pendingFiles.put({ ...file, opId });
    }
    await db.outbox.update(seq, { opId, data, state: 'pending', error: null });
  });
  await refreshCounts();
  requestSync({ now: true });
}

/**
 * Drops a refused change and the changes waiting behind it. A new record is removed from the
 * device at once; anything else is reloaded from the server at the next sync.
 */
export async function discardChange(seq) {
  const db = currentDb();
  const op = await db.outbox.get(seq);
  if (!op) return;
  const target = targetOf(op);
  await db.transaction('rw', db.tables, async () => {
    const dropped = await db.outbox
      .filter((other) => other.seq >= seq && targetOf(other) === target)
      .toArray();
    await db.outbox.bulkDelete(dropped.map((d) => d.seq));
    await db.pendingFiles.bulkDelete(dropped.map((d) => d.opId));
    if (op.type === 'learner.create') {
      await db.learners.delete(target);
      await db.consents.where('learnerId').equals(target).delete();
    } else if (op.type === 'session.create') {
      await db.sessions.delete(target);
      await db.attendance.where('sessionId').equals(target).delete();
    } else {
      await setMeta(db, 'resync', true);
    }
  });
  await refreshCounts();
  requestSync({ now: true });
}
