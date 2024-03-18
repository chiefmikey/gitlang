import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const region = 'us-east-2';
const secretName = 'AUTH_GITLANG';

const auth: () => Promise<string> = async () => {
  try {
    const client = new SecretsManagerClient({
      region,
    });

    const data = await client.send(
      new GetSecretValueCommand({ SecretId: secretName }),
    );

    if (data.SecretString) {
      const secret = JSON.parse(data.SecretString) as { [key: string]: string };
      return secret[secretName];
    }

    return '';
  } catch (error) {
    console.error(error);
    return '';
  }
};

export default auth;
