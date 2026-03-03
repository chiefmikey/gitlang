import { Octokit } from '@octokit/rest';

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
    console.error('Error fetching rate limit:', error);
    return undefined;
  }
};

export default rateLimit;
