/**
 * AWS Lambda function for rotating the GitHub PAT stored in Secrets Manager.
 *
 * GitHub PATs cannot be created programmatically, so this Lambda:
 * 1. Validates the current token is still working
 * 2. Tests any pending (AWSPENDING) token staged manually
 * 3. Promotes tested tokens to current
 * 4. Sends SNS notifications when manual token creation is needed
 *
 * Rotation workflow:
 * - Secrets Manager triggers this Lambda with rotation steps
 * - If no AWSPENDING version exists, it notifies via SNS to create a new PAT
 * - Once a new PAT is manually staged, the next rotation cycle tests and promotes it
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  UpdateSecretVersionStageCommand,
  DescribeSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const secretsClient = new SecretsManagerClient({ region: 'us-east-2' });
const snsClient = new SNSClient({ region: 'us-east-2' });

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || '';
const SECRET_NAME = 'AUTH_GITLANG';

interface RotationEvent {
  SecretId: string;
  ClientRequestToken: string;
  Step: 'createSecret' | 'setSecret' | 'testSecret' | 'finishSecret';
}

const validateToken = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    return response.status === 200;
  } catch {
    return false;
  }
};

const getTokenExpiry = async (
  token: string,
): Promise<string | null> => {
  try {
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    // Fine-grained PATs return expiration info in headers
    return response.headers.get('github-authentication-token-expiration');
  } catch {
    return null;
  }
};

const sendNotification = async (subject: string, message: string) => {
  if (!SNS_TOPIC_ARN) {
    console.error('No SNS_TOPIC_ARN configured, cannot send notification');
    return;
  }
  await snsClient.send(
    new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: subject,
      Message: message,
    }),
  );
};

const getSecret = async (
  secretId: string,
  versionStage: string,
): Promise<string | null> => {
  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: secretId,
        VersionStage: versionStage,
      }),
    );
    if (response.SecretString) {
      const parsed = JSON.parse(response.SecretString) as Record<
        string,
        string
      >;
      return parsed[SECRET_NAME] || null;
    }
    return null;
  } catch {
    return null;
  }
};

const createSecret = async (event: RotationEvent) => {
  // Check if AWSPENDING already exists
  const pending = await getSecret(event.SecretId, 'AWSPENDING');
  if (pending) {
    console.log('AWSPENDING version already exists, skipping create');
    return;
  }

  // No pending version — notify that a new PAT needs to be created manually
  // and staged via: aws secretsmanager put-secret-value --secret-id AUTH_GITLANG
  //   --secret-string '{"AUTH_GITLANG":"ghp_newtoken"}' --version-stages AWSPENDING
  await sendNotification(
    'GitLang: GitHub PAT rotation required',
    [
      'The GitLang GitHub PAT needs to be rotated.',
      '',
      'Steps:',
      '1. Go to https://github.com/settings/tokens and create a new fine-grained PAT',
      '   - Scopes: public_repo (read), read:org',
      '   - Expiration: 90 days recommended',
      '2. Stage the new token:',
      `   aws secretsmanager put-secret-value \\`,
      `     --secret-id ${event.SecretId} \\`,
      `     --secret-string '{"${SECRET_NAME}":"YOUR_NEW_TOKEN"}' \\`,
      `     --version-stages AWSPENDING \\`,
      `     --client-request-token ${event.ClientRequestToken}`,
      '',
      'The next rotation cycle will automatically test and promote the token.',
    ].join('\n'),
  );

  // Create a placeholder pending version with the current token
  // This allows the rotation to complete even without manual intervention
  const current = await getSecret(event.SecretId, 'AWSCURRENT');
  if (current) {
    await secretsClient.send(
      new PutSecretValueCommand({
        SecretId: event.SecretId,
        ClientRequestToken: event.ClientRequestToken,
        SecretString: JSON.stringify({ [SECRET_NAME]: current }),
        VersionStages: ['AWSPENDING'],
      }),
    );
  }
};

const setSecret = async (_event: RotationEvent) => {
  // GitHub PATs are set manually — nothing to do here
  // For services where the credential can be programmatically set
  // on the target (e.g., database passwords), this step would apply it
  console.log('setSecret: no-op for GitHub PATs (set manually)');
};

const testSecret = async (event: RotationEvent) => {
  const pending = await getSecret(event.SecretId, 'AWSPENDING');
  if (!pending) {
    throw new Error('No AWSPENDING secret found to test');
  }

  const isValid = await validateToken(pending);
  if (!isValid) {
    await sendNotification(
      'GitLang: Staged PAT is invalid',
      [
        'The staged AWSPENDING GitHub PAT failed validation.',
        'Please create a new valid PAT and re-stage it.',
        '',
        'The current production token is still active.',
      ].join('\n'),
    );
    throw new Error('Pending token validation failed');
  }

  // Check expiry
  const expiry = await getTokenExpiry(pending);
  if (expiry) {
    console.log(`Token expires: ${expiry}`);
    const expiryDate = new Date(expiry);
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilExpiry <= 14) {
      await sendNotification(
        'GitLang: PAT expiring soon',
        `The GitHub PAT expires in ${daysUntilExpiry} days (${expiry}). Consider creating a new one.`,
      );
    }
  }

  console.log('testSecret: token validated successfully');
};

const finishSecret = async (event: RotationEvent) => {
  // Get the current version
  const describeResponse = await secretsClient.send(
    new DescribeSecretCommand({ SecretId: event.SecretId }),
  );

  let currentVersion: string | undefined;
  if (describeResponse.VersionIdsToStages) {
    for (const [versionId, stages] of Object.entries(
      describeResponse.VersionIdsToStages,
    )) {
      if (stages.includes('AWSCURRENT') && versionId !== event.ClientRequestToken) {
        currentVersion = versionId;
        break;
      }
    }
  }

  // Promote AWSPENDING to AWSCURRENT
  await secretsClient.send(
    new UpdateSecretVersionStageCommand({
      SecretId: event.SecretId,
      VersionStage: 'AWSCURRENT',
      MoveToVersionId: event.ClientRequestToken,
      RemoveFromVersionId: currentVersion,
    }),
  );

  console.log('finishSecret: rotation complete');
};

export const handler = async (event: RotationEvent) => {
  console.log(`Rotation step: ${event.Step} for ${event.SecretId}`);

  switch (event.Step) {
    case 'createSecret':
      await createSecret(event);
      break;
    case 'setSecret':
      await setSecret(event);
      break;
    case 'testSecret':
      await testSecret(event);
      break;
    case 'finishSecret':
      await finishSecret(event);
      break;
    default:
      throw new Error(`Unknown rotation step: ${event.Step}`);
  }
};
