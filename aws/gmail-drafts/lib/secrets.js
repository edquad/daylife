const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const SECRET_NAME = process.env.ROZKA_SECRETS_NAME || 'rozka/gmail-drafts';
const SECRETS_S3_BUCKET = process.env.ROZKA_SECRETS_S3_BUCKET || '';
const SECRETS_S3_KEY = process.env.ROZKA_SECRETS_S3_KEY || 'config/gmail-drafts.json';
const REGION = process.env.AWS_REGION || 'ap-south-1';

let cached = null;

function applySecrets(parsed) {
  if (!parsed.googleClientId || !parsed.googleClientSecret || !parsed.gmailTokenSecret) {
    throw new Error('Rozka secrets missing googleClientId, googleClientSecret, or gmailTokenSecret');
  }
  process.env.GOOGLE_CLIENT_ID = parsed.googleClientId;
  process.env.GOOGLE_CLIENT_SECRET = parsed.googleClientSecret;
  process.env.GMAIL_TOKEN_SECRET = parsed.gmailTokenSecret;
  cached = parsed;
  return parsed;
}

async function loadFromSecretsManager() {
  const client = new SecretsManagerClient({ region: REGION });
  const res = await client.send(new GetSecretValueCommand({ SecretId: SECRET_NAME }));
  return applySecrets(JSON.parse(res.SecretString || '{}'));
}

async function loadFromS3() {
  if (!SECRETS_S3_BUCKET) throw new Error('ROZKA_SECRETS_S3_BUCKET not set');
  const client = new S3Client({ region: REGION });
  const res = await client.send(
    new GetObjectCommand({ Bucket: SECRETS_S3_BUCKET, Key: SECRETS_S3_KEY }),
  );
  const body = await res.Body.transformToString();
  return applySecrets(JSON.parse(body));
}

async function loadSecrets() {
  if (cached) return cached;
  try {
    return await loadFromSecretsManager();
  } catch (smErr) {
    console.warn('Secrets Manager unavailable, trying S3:', smErr.message);
    return loadFromS3();
  }
}

async function getGmailTokenSecret() {
  const s = await loadSecrets();
  return s.gmailTokenSecret;
}

module.exports = { loadSecrets, getGmailTokenSecret };
