import { OutboundMessage } from '../../db/models.js';
import { paginate } from '../../db/records.js';

/** Newest first. */
export const listOutbox = (pagination) =>
  paginate(OutboundMessage, {}, pagination, { createdAt: -1, _id: 1 });
