const crypto = require('crypto');
const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getGmailTokenSecret } = require('./secrets');

const BUCKET = process.env.GMAIL_TOKEN_BUCKET || '';
const PREFIX = process.env.GMAIL_TOKEN_PREFIX || 'gmail-tokens/';

async function requireConfig() {
  if (!BUCKET) throw new Error('GMAIL_TOKEN_BUCKET not configured');
  await getGmailTokenSecret();
}

function keyForAccount(accountId) {
  return `${PREFIX}${accountId}.json`;
}

async function encrypt(text) {
  const secret = await getGmailTokenSecret();
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(secret, 'rozka-gmail', 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

async function decrypt(b64) {
  const secret = await getGmailTokenSecret();
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = crypto.scryptSync(secret, 'rozka-gmail', 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function getClient() {
  return new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
}

async function loadAccount(accountId) {
  await requireConfig();
  const client = getClient();
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: keyForAccount(accountId) }),
    );
    const body = await res.Body.transformToString();
    return JSON.parse(await decrypt(body));
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

async function saveAccount(accountId, data) {
  await requireConfig();
  const client = getClient();
  const payload = await encrypt(JSON.stringify(data));
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: keyForAccount(accountId),
      Body: payload,
      ContentType: 'application/octet-stream',
    }),
  );
}

async function deleteAccount(accountId) {
  await requireConfig();
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: keyForAccount(accountId) }));
}

async function listAccountIds() {
  await requireConfig();
  const client = getClient();
  const ids = [];
  let token;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX, ContinuationToken: token }),
    );
    for (const obj of res.Contents || []) {
      const name = obj.Key?.slice(PREFIX.length).replace(/\.json$/, '');
      if (name) ids.push(name);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return ids;
}

module.exports = { loadAccount, saveAccount, deleteAccount, listAccountIds };
