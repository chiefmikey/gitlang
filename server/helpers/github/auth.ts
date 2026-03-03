import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { createAppAuth } from '@octokit/auth-app';

const region = 'us-east-2';
const secretName = 'AUTH_GITLANG';

interface AppCredentials {
  appId: string;
  installationId: string;
  privateKey: string;
}

let cachedCredentials: AppCredentials | undefined;
let cachedAppAuth: ReturnType<typeof createAppAuth> | undefined;
let cachedToken = '';
let tokenExpiry = 0;

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
    console.error('Error fetching secret from AWS:', error);
  }
  return undefined;
};

const getCredentials = async (): Promise<AppCredentials | undefined> => {
  if (cachedCredentials !== undefined) {
    return cachedCredentials;
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

  // Fall back to AWS Secrets Manager
  const awsCredentials = await getCredentialsFromAws();
  if (awsCredentials !== undefined) {
    cachedCredentials = awsCredentials;
  }
  return cachedCredentials;
};

const auth = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken !== '' && now < tokenExpiry) {
    return cachedToken;
  }

  const creds = await getCredentials();
  if (creds === undefined) {
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
    // Refresh 5 minutes before expiry
    tokenExpiry = new Date(expiresAt).getTime() - 5 * 60 * 1000;
    return token;
  } catch (error) {
    console.error('Error generating installation token:', error);
    return '';
  }
};

export default auth;
