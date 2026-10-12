import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import auth from '../../server/helpers/github/auth';
import fetchMerged from '../../server/helpers/github/merged';
import rateLimit from '../../server/helpers/github/rateLimit';
import repositories from '../../server/helpers/github/repositories';
import { handler } from '../../server/lambda';

vi.mock('../../server/helpers/github/auth', () => ({
  default: vi.fn().mockResolvedValue('ghs_SECRET_TOKEN'),
}));
vi.mock('../../server/helpers/github/repositories', () => ({
  default: vi.fn().mockResolvedValue(['repo1']),
}));
vi.mock('../../server/helpers/github/languages', () => ({
  default: vi.fn().mockResolvedValue([{ TypeScript: 1 }]),
}));
vi.mock('../../server/helpers/github/merged', () => ({
  default: vi.fn().mockResolvedValue({ langs: [{ TypeScript: 1 }], repos: ['r'] }),
}));
vi.mock('../../server/helpers/github/rateLimit', () => ({
  default: vi
    .fn()
    .mockResolvedValue({ limit: 5000, remaining: 4999, reset: 1, used: 1 }),
}));
vi.mock('../../server/helpers/github/contributors', () => ({
  getContributorLanguages: vi.fn().mockResolvedValue({ TypeScript: 1 }),
  listContributors: vi.fn().mockResolvedValue([]),
}));

const asMock = (function_: unknown): ReturnType<typeof vi.fn> =>
  function_ as ReturnType<typeof vi.fn>;

const SECRET = 'origin-secret-7f3a9c1e5b2d4f68';
const WRONG = 'wrong-header-value-0123456789';

const makeEvent = (
  path: string,
  headers?: Record<string, string> | null,
  parameters: Record<string, string> = { username: 'torvalds' },
): any => ({
  headers: headers === null ? undefined : headers,
  queryStringParameters: parameters,
  rawPath: `/gitlang/github${path}`,
});

const originalSecret = process.env.ORIGIN_VERIFY_SECRET;

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  asMock(auth).mockResolvedValue('ghs_SECRET_TOKEN');
  asMock(repositories).mockResolvedValue(['repo1']);
  asMock(fetchMerged).mockResolvedValue({
    langs: [{ TypeScript: 1 }],
    repos: ['r'],
  });
  delete process.env.ORIGIN_VERIFY_SECRET;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  if (originalSecret === undefined) {
    delete process.env.ORIGIN_VERIFY_SECRET;
  } else {
    process.env.ORIGIN_VERIFY_SECRET = originalSecret;
  }
});

describe('origin lock disabled (secret unset or empty)', () => {
  it('passes requests with no headers at all', async () => {
    const response = await handler(makeEvent('/repos', null));

    expect(response.statusCode).toBe(200);
    expect(auth).toHaveBeenCalledTimes(1);
  });

  it('passes requests carrying an unrelated origin header', async () => {
    const response = await handler(
      makeEvent('/repos', { 'x-origin-verify': WRONG }),
    );

    expect(response.statusCode).toBe(200);
  });

  it('treats an empty-string secret as disabled', async () => {
    process.env.ORIGIN_VERIFY_SECRET = '';
    const response = await handler(makeEvent('/repos', {}));

    expect(response.statusCode).toBe(200);
  });
});

describe('origin lock enabled', () => {
  beforeEach(() => {
    process.env.ORIGIN_VERIFY_SECRET = SECRET;
  });

  it('returns 403 when the event has no headers object', async () => {
    const response = await handler(makeEvent('/repos', null));

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body as string)).toEqual({ error: 'Forbidden' });
  });

  it('returns 403 when the header is missing', async () => {
    const response = await handler(makeEvent('/repos', { accept: '*/*' }));

    expect(response.statusCode).toBe(403);
    expect(repositories).not.toHaveBeenCalled();
  });

  it('returns 403 for a wrong header value', async () => {
    const response = await handler(
      makeEvent('/repos', { 'x-origin-verify': WRONG }),
    );

    expect(response.statusCode).toBe(403);
    expect(repositories).not.toHaveBeenCalled();
  });

  it('returns 403 for empty, prefix, extended and different-length values', async () => {
    for (const supplied of [
      '',
      SECRET.slice(0, -1),
      `${SECRET}x`,
      ` ${SECRET}`,
      SECRET.toUpperCase(),
      'x'.repeat(10_000),
    ]) {
      const response = await handler(
        makeEvent('/repos', { 'x-origin-verify': supplied }),
      );

      expect(response.statusCode).toBe(403);
    }
  });

  it('returns 403 when the header value is not a string', async () => {
    const response = await handler({
      ...makeEvent('/repos'),
      headers: { 'x-origin-verify': undefined },
    });

    expect(response.statusCode).toBe(403);
  });

  it('serves the request normally with the correct header', async () => {
    const response: any = await handler(
      makeEvent('/repos', { 'x-origin-verify': SECRET }),
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(['repo1']);
    expect(repositories).toHaveBeenCalledWith(
      'torvalds',
      'ghs_SECRET_TOKEN',
      false,
    );
  });

  it('accepts a differently-cased header name', async () => {
    const response = await handler(
      makeEvent('/repos', { 'X-Origin-Verify': SECRET }),
    );

    expect(response.statusCode).toBe(200);
  });

  it('reads the secret at call time (rotation takes effect without reload)', async () => {
    const before = await handler(
      makeEvent('/repos', { 'x-origin-verify': SECRET }),
    );
    process.env.ORIGIN_VERIFY_SECRET = 'rotated-secret';
    const after = await handler(
      makeEvent('/repos', { 'x-origin-verify': SECRET }),
    );
    const rotated = await handler(
      makeEvent('/repos', { 'x-origin-verify': 'rotated-secret' }),
    );

    expect(before.statusCode).toBe(200);
    expect(after.statusCode).toBe(403);
    expect(rotated.statusCode).toBe(200);
  });

  it('rejects before any other validation (400/404/405 paths included)', async () => {
    const bad = await handler(makeEvent('/repos', {}, {}));
    const missing = await handler(makeEvent('/nope', {}));
    const post = await handler({
      ...makeEvent('/repos', {}),
      requestContext: { http: { method: 'POST' } },
    });

    expect(bad.statusCode).toBe(403);
    expect(missing.statusCode).toBe(403);
    expect(post.statusCode).toBe(403);
  });

  it('does not mint a GitHub token or call GitHub on a 403', async () => {
    await handler(makeEvent('/repos', {}));
    await handler(makeEvent('/merged', { 'x-origin-verify': WRONG }));
    await handler(makeEvent('/rate-limit', null));

    expect(auth).not.toHaveBeenCalled();
    expect(repositories).not.toHaveBeenCalled();
    expect(fetchMerged).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('never exposes the secret or the supplied value in the body, headers or logs', async () => {
    const response: any = await handler(
      makeEvent('/repos', { 'x-origin-verify': WRONG }),
    );
    const logged = JSON.stringify(errorSpy.mock.calls);

    expect(response.statusCode).toBe(403);

    for (const text of [JSON.stringify(response), logged]) {
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain(WRONG);
      expect(text).not.toContain('ghs_SECRET_TOKEN');
    }
  });

  it('logs a structured handler_error line on rejection', async () => {
    await handler(makeEvent('/repos', {}));

    expect(errorSpy).toHaveBeenCalledTimes(1);

    const line = JSON.parse(errorSpy.mock.calls[0]![0] as string);

    expect(line).toMatchObject({
      event: 'handler_error',
      operation: 'origin_verify',
      path: '/repos',
    });
  });

  it('does not log anything for a verified request', async () => {
    await handler(makeEvent('/repos', { 'x-origin-verify': SECRET }));

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('/rate-limit route removal', () => {
  it('returns 404 with the lock disabled', async () => {
    const response: any = await handler(makeEvent('/rate-limit', null));

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'Not found' });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('returns 404 (not 403) with the lock enabled and a valid header', async () => {
    process.env.ORIGIN_VERIFY_SECRET = SECRET;
    const response: any = await handler(
      makeEvent('/rate-limit', { 'x-origin-verify': SECRET }),
    );

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'Not found' });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it('returns 403 (not 404) with the lock enabled and no header', async () => {
    process.env.ORIGIN_VERIFY_SECRET = SECRET;
    const response = await handler(makeEvent('/rate-limit', {}));

    expect(response.statusCode).toBe(403);
  });
});
