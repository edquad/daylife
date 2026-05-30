const { google } = require('googleapis');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const { isLikelyHumanMessage, extractBody, header } = require('./humanFilter');

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0';
const MAX_DRAFTS_PER_RUN = Number(process.env.GMAIL_MAX_DRAFTS_PER_RUN || 5);
const MAX_PROCESSED_IDS = 400;

function oauthClient(tokens) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  client.setCredentials(tokens);
  return client;
}

async function refreshIfNeeded(auth, stored) {
  const creds = auth.credentials;
  if (creds.expiry_date && creds.expiry_date > Date.now() + 60_000) return stored;
  const { credentials } = await auth.refreshAccessToken();
  return {
    ...stored,
    tokens: credentials,
    updatedAt: new Date().toISOString(),
  };
}

async function needsReply(subject, body, from) {
  const text = `From: ${from}\nSubject: ${subject}\n\n${body}`.slice(0, 3000);
  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
  const res = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      messages: [
        {
          role: 'user',
          content: [
            {
              text: `You classify email for Rozka AI. Return ONLY JSON: {"human":true|false,"needsReply":true|false}

human=true only for a real person writing to the user (not marketing, bots, receipts, OTP, shipping, newsletters).
needsReply=true only if a thoughtful human reply is expected (question, request, scheduling, personal message).

Email:
${text}`,
            },
          ],
        },
      ],
      inferenceConfig: { maxTokens: 120, temperature: 0.1 },
    }),
  );
  const out = res.output?.message?.content?.[0]?.text || '{}';
  try {
    const parsed = JSON.parse(out.replace(/```json|```/g, '').trim());
    return Boolean(parsed.human && parsed.needsReply);
  } catch {
    return false;
  }
}

async function writeDraftReply(subject, body, from) {
  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
  const res = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      messages: [
        {
          role: 'user',
          content: [
            {
              text: `Write a short, friendly email reply DRAFT (2-4 sentences). Do not include Subject line. Sign off with the user's first name placeholder [Your name].

From: ${from}
Subject: ${subject}

${body.slice(0, 2500)}`,
            },
          ],
        },
      ],
      inferenceConfig: { maxTokens: 280, temperature: 0.4 },
    }),
  );
  return (res.output?.message?.content?.[0]?.text || '').trim();
}

async function processAccount(stored) {
  const auth = oauthClient(stored.tokens);
  stored = await refreshIfNeeded(auth, stored);
  const gmail = google.gmail({ version: 'v1', auth });

  const processed = new Set(stored.processedIds || []);
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'in:inbox is:unread newer_than:3d',
    maxResults: 20,
  });

  const results = [];
  for (const item of list.data.messages || []) {
    if (results.length >= MAX_DRAFTS_PER_RUN) break;
    if (processed.has(item.id)) continue;

    const full = await gmail.users.messages.get({
      userId: 'me',
      id: item.id,
      format: 'full',
    });
    const msg = full.data;
    if (!isLikelyHumanMessage(msg)) {
      processed.add(item.id);
      continue;
    }

    const subject = header(msg.payload?.headers, 'Subject') || '(no subject)';
    const from = header(msg.payload?.headers, 'From');
    const body = extractBody(msg);
    if (body.length < 8) {
      processed.add(item.id);
      continue;
    }

    const ok = await needsReply(subject, body, from);
    if (!ok) {
      processed.add(item.id);
      continue;
    }

    const replyText = await writeDraftReply(subject, body, from);
    if (!replyText) continue;

    const threadId = msg.threadId;
    const to = from.match(/<([^>]+)>/)?.[1] || from;
    const draftSubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;
    const raw = [
      `To: ${to}`,
      `Subject: ${draftSubject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      replyText,
    ].join('\r\n');

    await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: Buffer.from(raw).toString('base64url'),
          threadId,
        },
      },
    });

    processed.add(item.id);
    results.push({ messageId: item.id, subject, from });
  }

  stored.processedIds = [...processed].slice(-MAX_PROCESSED_IDS);
  stored.lastRunAt = new Date().toISOString();
  return { stored, results };
}

module.exports = { oauthClient, refreshIfNeeded, processAccount };
