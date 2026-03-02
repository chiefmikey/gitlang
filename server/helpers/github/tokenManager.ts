import { Octokit } from '@octokit/rest';

import auth from './auth';

interface TokenState {
  token: string;
  remaining: number;
  reset: number;
}

let tokens: TokenState[] = [];
let currentIndex = 0;
let initialized = false;

const initTokens = async (): Promise<void> => {
  if (initialized) {
    return;
  }

  const envTokens = process.env.GH_PAT;
  if (envTokens) {
    tokens = envTokens.split(',').map((t) => ({
      token: t.trim(),
      remaining: 5000,
      reset: 0,
    }));
  } else {
    const awsToken = await auth();
    if (awsToken) {
      tokens = [{ token: awsToken, remaining: 5000, reset: 0 }];
    }
  }

  initialized = true;
};

const updateTokenRateLimit = (
  token: string,
  remaining: number,
  reset: number,
): void => {
  const state = tokens.find((t) => t.token === token);
  if (state) {
    state.remaining = remaining;
    state.reset = reset;
  }
};

const getToken = async (): Promise<string> => {
  await initTokens();

  if (tokens.length === 0) {
    return '';
  }

  if (tokens.length === 1) {
    return tokens[0].token;
  }

  const now = Math.floor(Date.now() / 1000);

  // Reset tokens whose rate limit window has passed
  for (const state of tokens) {
    if (state.reset > 0 && now >= state.reset) {
      state.remaining = 5000;
      state.reset = 0;
    }
  }

  // Find a token with remaining capacity
  for (let i = 0; i < tokens.length; i++) {
    const idx = (currentIndex + i) % tokens.length;
    if (tokens[idx].remaining > 0) {
      currentIndex = (idx + 1) % tokens.length;
      return tokens[idx].token;
    }
  }

  // All tokens exhausted — return the one that resets soonest
  const sorted = [...tokens].sort((a, b) => a.reset - b.reset);
  return sorted[0].token;
};

const refreshTokenRateLimits = async (): Promise<void> => {
  await initTokens();
  for (const state of tokens) {
    try {
      const octokit = new Octokit({ auth: state.token });
      const response = await octokit.rest.rateLimit.get();
      state.remaining = response.data.rate.remaining;
      state.reset = response.data.rate.reset;
    } catch {
      // Token might be invalid, set remaining to 0
      state.remaining = 0;
    }
  }
};

const getTokenCount = async (): Promise<number> => {
  await initTokens();
  return tokens.length;
};

export {
  getToken,
  getTokenCount,
  refreshTokenRateLimits,
  updateTokenRateLimit,
};
