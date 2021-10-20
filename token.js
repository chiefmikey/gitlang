import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const region = 'us-east-2';
const secretName = 'profile-languages';
let secret;

const client = new SecretsManagerClient({
  region,
});

const data = await client.send(
  new GetSecretValueCommand({ SecretId: secretName }),
);
if (data && data.SecretString) {
  secret = data.SecretString;
}

const token = () => JSON.parse(secret).TOKEN;
export default token;
