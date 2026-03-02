import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const region = 'us-east-2';
const secretName = 'AUTH_GITLANG';

// Cache token for 5 minutes to avoid excessive Secrets Manager calls
// while still picking up rotated tokens reasonably quickly
let cachedToken = '';
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

const client = new SecretsManagerClient({ region });

const auth = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken && now < cacheExpiry) {
    return cachedToken;
  }

  try {
    const data = await client.send(
      new GetSecretValueCommand({ SecretId: secretName }),
    );

    if (data.SecretString) {
      const secret = JSON.parse(data.SecretString) as Record<string, string>;
      cachedToken = secret[secretName] || '';
      cacheExpiry = now + CACHE_TTL_MS;
      return cachedToken;
    }

    return '';
  } catch (error) {
    console.error('Error fetching secret from AWS:', error);
    // Return cached token if available, even if expired
    if (cachedToken) {
      return cachedToken;
    }
    return '';
  }
};

export default auth;
