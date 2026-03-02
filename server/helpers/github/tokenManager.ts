import { Octokit } from '@octokit/rest';

import auth from './auth';

interface TokenState {
  token: string;
  remaining: number;
  reset: number;
}

let tokens: TokenState[] = [];
let currentIndex = 0;
let lastInitTime = 0;

// Re-check AWS token every 5 minutes (matches auth.ts cache TTL)
// so rotated tokens are picked up automatically
const REINIT_INTERVAL_MS = 5 * 60 * 1000;

const initTokens = async (): Promise<void> => {
  const now = Date.now();
  const envTokens = process.env.GH_PAT;

  // For env tokens, only initialize once (they don't change at runtime)
  if (envTokens && lastInitTime > 0) {
    return;
  }

  // For AWS tokens, reinitialize periodically to pick up rotations
  if (!envTokens && lastInitTime > 0 && now - lastInitTime < REINIT_INTERVAL_MS) {
    return;
  }

  if (envTokens) {
    tokens = envTokens.split(',').map((t) => ({
      token: t.trim(),
      remaining: 5000,
      reset: 0,
    }));
  } else {
    const awsToken = await auth();
    if (awsToken) {
      // Check if the token changed (rotation happened)
      const existingToken = tokens.length > 0 ? tokens[0].token : '';
      if (awsToken !== existingToken) {
        tokens = [{ token: awsToken, remaining: 5000, reset: 0 }];
      }
    }
  }

  lastInitTime = now;
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
