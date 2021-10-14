import AWS from 'aws-sdk';

const region = 'us-east-2';
const secretName = 'profile-languages';
let secret;

const client = new AWS.SecretsManager({
  region,
});

client.getSecretValue({ SecretId: secretName }, (err, data) => {
  if (
    err &&
    (err.code === 'DecryptionFailureException' ||
      err.code === 'InternalServiceErrorException' ||
      err.code === 'InvalidParameterException' ||
      err.code === 'InvalidRequestException' ||
      err.code === 'ResourceNotFoundException')
  ) {
    throw err;
  }
  secret = data.SecretString;
});

const token = () => JSON.parse(secret).TOKEN;

export default token;
