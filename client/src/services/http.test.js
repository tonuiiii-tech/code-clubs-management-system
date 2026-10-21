import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './http.js';

const json = (status, body) => ({
  ok: status < 400,
  status,
  statusText: '',
  json: async () => body,
});

describe('http request', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the JSON payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { data: { status: 'ok' } })));
    await expect(request('/health')).resolves.toEqual({ data: { status: 'ok' } });
  });

  it('turns API errors into ApiError with the server code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json(403, { error: { code: 'FORBIDDEN', message: 'No' } })),
    );
    await expect(request('/users')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('reports a network failure clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await request('/health').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NETWORK_ERROR');
  });
});
