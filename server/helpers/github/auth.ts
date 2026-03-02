import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { createAppAuth } from '@octokit/auth-app';

const region = 'us-east-2';
const secretName = 'AUTH_GITLANG';

interface AppCredentials {
  appId: string;
  installationId: string;
  privateKey: string;
}

let cachedCredentials: AppCredentials | null = null;
let cachedAppAuth: ReturnType<typeof createAppAuth> | null = null;
let cachedToken = '';
let tokenExpiry = 0;

const smClient = new SecretsManagerClient({ region });

const getCredentials = async (): Promise<AppCredentials | null> => {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  // Check environment variables first
  const appId = process.env.GH_APP_ID;
  const installationId = process.env.GH_INSTALLATION_ID;
  const privateKey = process.env.GH_PRIVATE_KEY;

  if (appId && installationId && privateKey) {
    cachedCredentials = { appId, installationId, privateKey };
    return cachedCredentials;
  }

  // Fall back to AWS Secrets Manager
  try {
    const data = await smClient.send(
      new GetSecretValueCommand({ SecretId: secretName }),
    );
    if (data.SecretString) {
      const secret = JSON.parse(data.SecretString) as Record<string, string>;
      cachedCredentials = {
        appId: secret.APP_ID,
        installationId: secret.INSTALLATION_ID,
        privateKey: secret.PRIVATE_KEY,
      };
      return cachedCredentials;
    }
  } catch (error) {
    console.error('Error fetching secret from AWS:', error);
  }

  return null;
};

const auth = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const creds = await getCredentials();
  if (!creds) {
    return '';
  }

  try {
    if (!cachedAppAuth) {
      cachedAppAuth = createAppAuth({
        appId: creds.appId,
        privateKey: creds.privateKey,
        installationId: creds.installationId,
      });
    }

    const { token, expiresAt } = await cachedAppAuth({
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
