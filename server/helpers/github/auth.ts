import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { createAppAuth } from '@octokit/auth-app';

const region = 'us-east-2';
const secretName = 'AUTH_GITLANG';

// Conservative TTL used when expiresAt is missing or unparseable.
// We fail visibly (structured log) and fall back to a short TTL so the
// service keeps running while making the bad-expiry case obvious in CloudWatch.
const FALLBACK_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Upper bounds on the two network calls. The in-flight guards below share one
// promise between all concurrent callers, so a call that never settles would
// wedge every request in the container until it is recycled.
const AWS_FETCH_TIMEOUT_MS = 8000;
const TOKEN_MINT_TIMEOUT_MS = 15_000;

const MAX_LOGGED_ERROR_LENGTH = 500;

interface AppCredentials {
  appId: string;
  installationId: string;
  privateKey: string;
}

let cachedCredentials: AppCredentials | undefined;
let cachedAppAuth: ReturnType<typeof createAppAuth> | undefined;
let cachedToken = '';
let tokenExpiry = 0;

// In-flight guards: only one token generation and one AWS fetch run at a time.
// Concurrent callers await the same promise rather than each spawning their own.
let inFlightToken: Promise<string> | undefined;
let inFlightCredentials: Promise<AppCredentials | undefined> | undefined;

const smClient = new SecretsManagerClient({ region });

const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

// Error messages from the AWS SDK / octokit are logged to CloudWatch. Strip
// anything that looks like key material or a credential before logging, plus
// the exact private key we hold, so a verbose upstream error cannot leak it.
const redactSecrets = (message: string): string => {
  let redacted = message
    .replaceAll(
      /-{5}BEGIN [ A-Z]*PRIVATE KEY-{5}[\S\s]*?(?:-{5}END [ A-Z]*PRIVATE KEY-{5}|$)/gu,
      '[REDACTED_PRIVATE_KEY]',
    )
    .replaceAll(
      /\b(?:gh[oprsu]_|github_pat_)\w{10,}/gu,
      '[REDACTED_GITHUB_TOKEN]',
    )
    .replaceAll(/\beyJ[\w.-]{20,}/gu, '[REDACTED_JWT]')
    .replaceAll(/\b(bearer)\s+[\w+./=~-]{8,}/giu, '$1 [REDACTED]');
  for (const secret of [cachedCredentials?.privateKey, cachedToken]) {
    if (secret !== undefined && secret.length >= 8) {
      redacted = redacted.replaceAll(secret, '[REDACTED]');
    }
  }
  return redacted.slice(0, MAX_LOGGED_ERROR_LENGTH);
};

const describeError = (error: unknown): string =>
  redactSecrets(error instanceof Error ? error.message : String(error));

const nonEmpty = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const parseSecretString = (
  secretString: string,
): AppCredentials | undefined => {
  const parsed: unknown = JSON.parse(secretString);
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }
  const object = parsed as {
    APP_ID?: unknown;
    INSTALLATION_ID?: unknown;
    PRIVATE_KEY?: unknown;
  };
  const appId = nonEmpty(object.APP_ID);
  const installationId = nonEmpty(object.INSTALLATION_ID);
  const privateKey = nonEmpty(object.PRIVATE_KEY);
  if (
    appId === undefined ||
    installationId === undefined ||
    privateKey === undefined
  ) {
    return undefined;
  }
  return { appId, installationId, privateKey };
};

const logAuthFailure = (reason: string, detail: string): void => {
  console.error(JSON.stringify({ detail, event: 'auth_failure', reason }));
};

const getCredentialsFromAws = async (): Promise<AppCredentials | undefined> => {
  let secretString: string | undefined;
  try {
    const data = await withTimeout(
      smClient.send(new GetSecretValueCommand({ SecretId: secretName })),
      AWS_FETCH_TIMEOUT_MS,
      'Secrets Manager fetch',
    );
    secretString = data.SecretString;
  } catch (error) {
    console.error(
      JSON.stringify({
        error: describeError(error),
        event: 'auth_failure',
        reason: 'aws_fetch_error',
      }),
    );
    return undefined;
  }
  if (secretString === undefined || secretString === '') {
    return undefined;
  }
  try {
    return parseSecretString(secretString);
  } catch {
    // Deliberately drop the SyntaxError: V8 echoes a snippet of the input
    // ("Unexpected token 'x', "<secret>" is not valid JSON") into its message.
    logAuthFailure('secret_parse_error', 'SecretString is not valid JSON');
    return undefined;
  }
};

const getEnvironmentCredentials = (): AppCredentials | undefined => {
  // Empty/whitespace values count as unset so a blank variable cannot pin a
  // useless credential set and block the Secrets Manager fallback.
  const appId = nonEmpty(process.env.GH_APP_ID);
  const installationId = nonEmpty(process.env.GH_INSTALLATION_ID);
  const privateKey = nonEmpty(process.env.GH_PRIVATE_KEY);
  if (
    appId === undefined ||
    installationId === undefined ||
    privateKey === undefined
  ) {
    return undefined;
  }
  return { appId, installationId, privateKey };
};

const getCredentials = async (): Promise<AppCredentials | undefined> => {
  if (cachedCredentials !== undefined) {
    return cachedCredentials;
  }

  // Deduplicate concurrent AWS fetches: if one is already in flight, await it.
  if (inFlightCredentials !== undefined) {
    return inFlightCredentials;
  }

  // Check environment variables first
  const environmentCredentials = getEnvironmentCredentials();
  if (environmentCredentials !== undefined) {
    cachedCredentials = environmentCredentials;
    return cachedCredentials;
  }

  // Fall back to AWS Secrets Manager, with in-flight dedup.
  inFlightCredentials = (async () => {
    try {
      const awsCredentials = await getCredentialsFromAws();
      if (awsCredentials === undefined) {
        logAuthFailure(
          'credentials_missing',
          'No credentials in env vars and AWS Secrets Manager returned nothing usable',
        );
      } else {
        cachedCredentials = awsCredentials;
      }
      return cachedCredentials;
    } finally {
      inFlightCredentials = undefined;
    }
  })();

  return inFlightCredentials;
};

// Drop everything derived from the credentials so the next attempt re-reads
// them (env, or a freshly rotated Secrets Manager secret) instead of retrying
// a stale key until the container is recycled.
const invalidateCredentials = (): void => {
  cachedCredentials = undefined;
  cachedAppAuth = undefined;
};

const generateToken = async (): Promise<string> => {
  const creds = await getCredentials();
  if (creds === undefined) {
    // credentials_missing is already logged inside getCredentials / getCredentialsFromAws
    return '';
  }

  try {
    cachedAppAuth ??= createAppAuth({
      appId: creds.appId,
      installationId: creds.installationId,
      privateKey: creds.privateKey,
    });

    // refresh: octokit keeps its own installation-token cache for 59 minutes,
    // which would hand back the same token with only ~1-4 minutes of life left
    // after our 5-minute early-expiry margin has elapsed. We only get here
    // when our own cache is stale, so always ask for a fresh token.
    const { expiresAt, token } = await withTimeout(
      cachedAppAuth({ refresh: true, type: 'installation' }),
      TOKEN_MINT_TIMEOUT_MS,
      'GitHub installation token request',
    );

    if (typeof token !== 'string' || token === '') {
      throw new TypeError('GitHub returned an empty installation token');
    }

    cachedToken = token;

    // Guard against missing/unparseable expiresAt.
    // If NaN, log a structured error and use a conservative short TTL so the
    // service keeps working but the problem is visible in CloudWatch.
    const expiryMs =
      typeof expiresAt === 'string'
        ? new Date(expiresAt).getTime() - 5 * 60 * 1000
        : Number.NaN;
    if (Number.isNaN(expiryMs)) {
      logAuthFailure(
        'bad_expiry',
        `expiresAt '${expiresAt ?? '(undefined)'}' is missing or unparseable; falling back to ${FALLBACK_TOKEN_TTL_MS / 1000}s TTL`,
      );
      tokenExpiry = Date.now() + FALLBACK_TOKEN_TTL_MS;
    } else {
      tokenExpiry = expiryMs;
    }

    return token;
  } catch (error) {
    invalidateCredentials();
    console.error(
      JSON.stringify({
        error: describeError(error),
        event: 'auth_failure',
        reason: 'token_generation_error',
      }),
    );
    return '';
  }
};

const auth = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken !== '' && now < tokenExpiry) {
    return cachedToken;
  }

  // In-flight guard: if a token generation is already running, await it
  // instead of spawning another one (thundering-herd prevention).
  if (inFlightToken !== undefined) {
    return inFlightToken;
  }

  inFlightToken = (async () => {
    try {
      return await generateToken();
    } finally {
      inFlightToken = undefined;
    }
  })();

  return inFlightToken;
};

export default auth;
