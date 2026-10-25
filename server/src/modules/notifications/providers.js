import { randomUUID } from 'node:crypto';
import { OutboundMessage } from '../../db/models.js';

/**
 * Email, SMS and WhatsApp go through these provider interfaces (D4-5). Until STEAMLabs chooses
 * providers and a budget (Q51), the stubs record each message in `outboundMessages` and send
 * nothing, so every message can be checked. A real provider implements the same `send`.
 */

async function record(channel, message) {
  const doc = {
    _id: randomUUID(),
    channel,
    provider: 'stub',
    status: 'recorded',
    ...message,
  };
  await OutboundMessage.create(doc);
  return { id: doc._id, status: doc.status };
}

/** @type {{ send(message: { to, subject, body, attachments?, termId? }): Promise<object> }} */
export const stubEmailProvider = {
  send: ({ to, subject, body, attachments = [], termId }) =>
    record('email', {
      to,
      subject,
      body,
      // Only the name and size are kept; the stub never stores the PDF itself.
      attachments: attachments.map((a) => ({ name: a.name, size: a.content.length })),
      termId,
    }),
};

/** @type {{ send(message: { channel, to, userId, body, announcementId }): Promise<object> }} */
export const stubMessageProvider = {
  send: ({ channel, to, userId, body, announcementId }) =>
    record(channel, { to, userId, body, announcementId }),
};

let providers = { email: stubEmailProvider, message: stubMessageProvider };

export const emailProvider = () => providers.email;
export const messageProvider = () => providers.message;

/** Tests swap a provider, e.g. one that fails, to check what happens. */
export function setProviders(next) {
  const previous = providers;
  providers = { ...providers, ...next };
  return () => {
    providers = previous;
  };
}
