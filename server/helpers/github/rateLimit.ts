import { Octokit } from '@octokit/rest';

import { describeError } from './githubSafety';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

const rateLimit = async (token: string): Promise<RateLimitInfo | undefined> => {
  try {
    if (token === '') {
      console.error('No token');
      return undefined;
    }
    const octokit = new Octokit({ auth: token });
    const response = await octokit.rest.rateLimit.get();
    const { limit, remaining, reset, used } = response.data.rate;
    return { limit, remaining, reset, used };
  } catch (error) {
    // Log a compact description, never the raw Octokit error (it embeds
    // request/response headers and bodies).
    console.error(`Error fetching rate limit: ${describeError(error)}`);
    return undefined;
  }
};

export default rateLimit;
