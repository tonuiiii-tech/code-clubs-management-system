import * as service from './announcements.service.js';

export async function list(req, res) {
  res.json(await service.listAnnouncements(req.user, req.valid.query));
}

export async function preview(req, res) {
  res.json({ data: await service.previewAnnouncement(req.user, req.scope, req.valid.body) });
}

export async function send(req, res) {
  const data = await service.sendAnnouncement(req.user, req.scope, req.valid.body, {
    requestId: req.id,
  });
  res.status(201).json({ data });
}

export async function get(req, res) {
  res.json({ data: await service.getAnnouncement(req.user, req.valid.params.id) });
}

export async function read(req, res) {
  res.json({ data: await service.markRead(req.user, req.valid.params.id) });
}
