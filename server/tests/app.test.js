import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('API basics', () => {
  it('reports health', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed JSON without leaking a stack trace', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('Validation', () => {
  it('rejects an invalid login body with field-level errors', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['body.email', 'body.password']));
  });
});

describe('Authentication is required', () => {
  it.each([
    ['get', '/api/v1/auth/me'],
    ['get', '/api/v1/users'],
    ['post', '/api/v1/users'],
    ['get', '/api/v1/schools'],
    ['post', '/api/v1/schools'],
    ['get', '/api/v1/clubs'],
    ['patch', '/api/v1/clubs/0f8fad5b-d9cb-469f-a165-70867728950e'],
    ['get', '/api/v1/audit'],
  ])('%s %s without a token returns 401', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a forged token', async () => {
    const res = await request(app).get('/api/v1/clubs').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });
});
