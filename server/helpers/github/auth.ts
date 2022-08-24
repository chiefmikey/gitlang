import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const region = 'us-east-2';
const secretName = 'gitlang-auth';

const auth: () => Promise<string> = async () => {
  try {
    let secret = '';

    const client = new SecretsManagerClient({
      region,
    });

    const data = await client.send(
      new GetSecretValueCommand({ SecretId: secretName }),
    );

    if (data && data.SecretString) {
      secret = data.SecretString;
    }

    const parser: { parse: (argument: string) => { [secretName]: string } } =
      JSON;

    const parseSecret = parser.parse(secret);
    return parseSecret[secretName];
  } catch (error) {
    console.error(error);
    return '';
  }
};

export default auth;
