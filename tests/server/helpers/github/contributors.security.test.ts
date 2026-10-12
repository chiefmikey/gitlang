import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getContributorLanguages,
  listContributors,
} from '../../../../server/helpers/github/contributors';

// These tests drive the REAL Octokit against a stubbed global fetch so that
// URL construction, encoding and error redaction are exercised end to end.

const TOKEN = 'ghs_SUPERSECRETTOKEN123';

const jsonResponse = (
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
): Response =>
  Response.json(data, {
    headers: { 'content-type': 'application/json', ...headers },
    status,
  });

let fetchMock: ReturnType<typeof vi.fn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  errorSpy.mockRestore();
});

const requestedUrls = (): string[] =>
  fetchMock.mock.calls.map((call) =>
    typeof call[0] === 'string' ? call[0] : (call[0] as Request).url,
  );

describe('contributors: URL construction', () => {
  it('percent-encodes the author so URL metacharacters stay inside one parameter', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await getContributorLanguages('o', 'r', 'a+b%c@d.e', TOKEN);
    const [url] = requestedUrls();
    expect(url).toContain('author=a%2Bb%25c%40d.e');
    const params = new URL(url).searchParams;
    expect(params.get('author')).toBe('a+b%c@d.e');
    expect(params.get('per_page')).toBe('50');
  });

  it('never sends dot-segment owner/repo (path traversal into other API routes)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await listContributors('..', '..', TOKEN);
    await getContributorLanguages('o', '..', 'a', TOKEN);
    await listContributors('.', 'r', TOKEN);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('contributors: input guards', () => {
  it('returns empty without calling GitHub for invalid owner/repo/author', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await expect(listContributors('bad owner', 'r', TOKEN)).resolves.toEqual([]);
    await expect(listContributors('o', 'bad/repo', TOKEN)).resolves.toEqual([]);
    await expect(
      getContributorLanguages('o', 'r', 'a'.repeat(300), TOKEN),
    ).resolves.toEqual({});
    await expect(
      getContributorLanguages('o', 'r', 'ok\nnewline', TOKEN),
    ).resolves.toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts bot authors such as dependabot[bot]', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await getContributorLanguages('o', 'r', 'dependabot[bot]', TOKEN);

    expect(requestedUrls()[0]).toContain('author=dependabot%5Bbot%5D');
  });
});

describe('contributors: upstream failure handling', () => {
  const rateLimitedResponse = (): Response =>
    jsonResponse(
      403,
      { message: 'API rate limit exceeded for installation ID 1.' },
      { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '9999999999' },
    );

  it('rethrows an upstream rate-limit error from listContributors', async () => {
    fetchMock.mockResolvedValue(rateLimitedResponse());

    await expect(listContributors('o', 'r', TOKEN)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('rethrows an upstream rate-limit error from getContributorLanguages (list call)', async () => {
    fetchMock.mockResolvedValue(rateLimitedResponse());

    await expect(
      getContributorLanguages('o', 'r', 'a', TOKEN),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rethrows a rate limit hit while fetching a commit instead of returning partial data', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [{ sha: 'abc' }]))
      .mockResolvedValue(rateLimitedResponse());

    await expect(
      getContributorLanguages('o', 'r', 'a', TOKEN),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('still returns empty for a plain 404 (unknown repo)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { message: 'Not Found' }));

    await expect(listContributors('o', 'r', TOKEN)).resolves.toEqual([]);
    await expect(
      getContributorLanguages('o', 'r', 'a', TOKEN),
    ).resolves.toEqual({});
  });

  it('still returns empty for a plain 403 without a rate-limit signal', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { message: 'Repository access blocked' }),
    );

    await expect(listContributors('o', 'r', TOKEN)).resolves.toEqual([]);
  });

  it('does not write the access token to the logs when GitHub errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, { message: 'Server Error' }),
    );
    await listContributors('o', 'r', TOKEN);
    await getContributorLanguages('o', 'r', 'a', TOKEN);

    expect(errorSpy).toHaveBeenCalled();

    const utility = await import('node:util');
    const logged = errorSpy.mock.calls
      .map((call: unknown[]) =>
        call.map((part) => utility.inspect(part, { depth: 10 })).join(' '),
      )
      .join('\n');

    expect(logged).not.toContain(TOKEN);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(TOKEN);
  });
});
