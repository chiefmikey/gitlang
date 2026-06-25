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

const parseSecretString = (
  secretString: string,
): AppCredentials | undefined => {
  const parsed: unknown = JSON.parse(secretString);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('APP_ID' in parsed) ||
    !('INSTALLATION_ID' in parsed) ||
    !('PRIVATE_KEY' in parsed)
  ) {
    return undefined;
  }
  const object = parsed as {
    APP_ID: unknown;
    INSTALLATION_ID: unknown;
    PRIVATE_KEY: unknown;
  };
  if (
    typeof object.APP_ID !== 'string' ||
    typeof object.INSTALLATION_ID !== 'string' ||
    typeof object.PRIVATE_KEY !== 'string'
  ) {
    return undefined;
  }
  return {
    appId: object.APP_ID,
    installationId: object.INSTALLATION_ID,
    privateKey: object.PRIVATE_KEY,
  };
};

const getCredentialsFromAws = async (): Promise<AppCredentials | undefined> => {
  try {
    const data = await smClient.send(
      new GetSecretValueCommand({ SecretId: secretName }),
    );
    if (data.SecretString !== undefined && data.SecretString !== '') {
      return parseSecretString(data.SecretString);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: 'auth_failure',
        reason: 'aws_fetch_error',
      }),
    );
  }
  return undefined;
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
  const appId = process.env.GH_APP_ID;
  const installationId = process.env.GH_INSTALLATION_ID;
  const privateKey = process.env.GH_PRIVATE_KEY;

  if (
    appId !== undefined &&
    installationId !== undefined &&
    privateKey !== undefined
  ) {
    cachedCredentials = { appId, installationId, privateKey };
    return cachedCredentials;
  }

  // Fall back to AWS Secrets Manager, with in-flight dedup.
  inFlightCredentials = (async () => {
    try {
      const awsCredentials = await getCredentialsFromAws();
      if (awsCredentials === undefined) {
        console.error(
          JSON.stringify({
            detail:
              'No credentials in env vars and AWS Secrets Manager returned nothing usable',
            event: 'auth_failure',
            reason: 'credentials_missing',
          }),
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

const generateToken = async (): Promise<string> => {
  const creds = await getCredentials();
  if (creds === undefined) {
    // credentials_missing is already logged inside getCredentials / getCredentialsFromAws
    return '';
  }

  try {
    if (cachedAppAuth === undefined) {
      cachedAppAuth = createAppAuth({
        appId: creds.appId,
        installationId: creds.installationId,
        privateKey: creds.privateKey,
      });
    }

    const { expiresAt, token } = await cachedAppAuth({
      type: 'installation',
    });

    cachedToken = token;

    // Guard against missing/unparseable expiresAt.
    // If NaN, log a structured error and use a conservative short TTL so the
    // service keeps working but the problem is visible in CloudWatch.
    const expiryMs = new Date(expiresAt).getTime() - 5 * 60 * 1000;
    if (Number.isNaN(expiryMs)) {
      console.error(
        JSON.stringify({
          detail: `expiresAt '${expiresAt ?? '(undefined)'}' is missing or unparseable; falling back to ${FALLBACK_TOKEN_TTL_MS / 1000}s TTL`,
          event: 'auth_failure',
          reason: 'bad_expiry',
        }),
      );
      tokenExpiry = Date.now() + FALLBACK_TOKEN_TTL_MS;
    } else {
      tokenExpiry = expiryMs;
    }

    return token;
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
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
