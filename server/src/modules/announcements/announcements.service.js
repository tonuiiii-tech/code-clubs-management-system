import { randomUUID } from 'node:crypto';
import { ERROR_MESSAGES } from '@code-clubs/shared/errors';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { recordAudit } from '../audit/audit.service.js';
import { messageProvider } from '../notifications/providers.js';
import { scopeFilter } from '../scope.js';
import * as repo from './announcements.repository.js';

/**
 * Announcements (plan section 7) replace many WhatsApp messages with one. They go to app users
 * only, never guardians (D4-7); SMS and WhatsApp copies go through the stub provider (D4-5).
 */

/** Coordinators write to their own regions: an audience without places means all of them. */
async function scopedAudience(actor, scope, audience) {
  const filter = scopeFilter(actor, scope);
  if (!filter.regions) return audience;
  const outside = (region) => !filter.regions.includes(region);
  if (audience.regions.some(outside)) throw forbidden(ERROR_MESSAGES.announcementOwnRegion);
  const clubRegions = await repo.clubRegions(audience.clubIds);
  if (clubRegions.length !== new Set(audience.clubIds).size) {
    throw badRequest(ERROR_MESSAGES.clubNotFound);
  }
  if (clubRegions.some(outside)) throw forbidden(ERROR_MESSAGES.announcementOwnRegion);
  return audience.regions.length || audience.clubIds.length
    ? audience
    : { ...audience, regions: filter.regions };
}

/** How many people it would reach, shown before sending (R4-3). */
export async function previewAnnouncement(actor, scope, { audience, channels }) {
  const users = await repo.audienceUsers(await scopedAudience(actor, scope, audience), actor.id);
  return {
    recipients: users.length,
    messages: channels.length ? users.filter((u) => u.phone).length * channels.length : 0,
  };
}

export async function sendAnnouncement(actor, scope, input, { requestId }) {
  const audience = await scopedAudience(actor, scope, input.audience);
  const users = await repo.audienceUsers(audience, actor.id);
  if (!users.length) throw badRequest(ERROR_MESSAGES.announcementNoRecipients);
  const now = new Date();
  const announcement = {
    id: randomUUID(),
    title: input.title,
    body: input.body,
    audience,
    channels: input.channels,
    recipientIds: users.map((u) => u.id),
    senderId: actor.id,
    senderName: actor.fullName,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  };
  await repo.insertAnnouncement(announcement);
  let messages = 0;
  for (const channel of input.channels) {
    for (const user of users.filter((u) => u.phone)) {
      await messageProvider().send({
        channel,
        to: user.phone,
        userId: user.id,
        body: `${input.title}: ${input.body}`,
        announcementId: announcement.id,
      });
      messages += 1;
    }
  }
  await recordAudit({
    actor,
    action: 'announcement.send',
    entityType: 'announcement',
    entityId: announcement.id,
    after: { title: input.title, recipients: users.length, channels: input.channels, messages },
    region: audience.regions.length === 1 ? audience.regions[0] : undefined,
    requestId,
  });
  const { recipientIds, ...rest } = announcement;
  return { ...rest, recipientCount: recipientIds.length, readCount: 0, messages };
}

export function listAnnouncements(actor, { box, page, pageSize }) {
  return box === 'sent'
    ? repo.sent(actor.id, { page, pageSize })
    : repo.inbox(actor.id, { page, pageSize });
}

/** Recipients see it with their read mark; the sender also sees the counts. */
export async function getAnnouncement(actor, id) {
  const announcement = await repo.findAnnouncement(id);
  const isSender = announcement?.senderId === actor.id;
  if (!announcement || (!isSender && !announcement.recipientIds.includes(actor.id))) {
    throw notFound(ERROR_MESSAGES.announcementNotFound);
  }
  const { recipientIds, ...rest } = announcement;
  const read = Boolean(await repo.findRead(id, actor.id));
  if (!isSender) return { ...rest, read };
  const counts = await repo.readCounts([id]);
  return { ...rest, read, recipientCount: recipientIds.length, readCount: counts[id] ?? 0 };
}

/** `readAt` is when the user opened it, which can be earlier when sent from a device. */
export async function markRead(actor, id, { readAt = new Date(), opId } = {}) {
  const announcement = await repo.findAnnouncement(id);
  if (!announcement || !announcement.recipientIds.includes(actor.id)) {
    throw notFound(ERROR_MESSAGES.announcementNotFound);
  }
  await repo.markRead(opId ?? randomUUID(), id, actor.id, readAt);
  return { announcementId: id, read: true };
}
