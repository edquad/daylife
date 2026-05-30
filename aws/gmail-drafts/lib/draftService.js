const { google } = require('googleapis');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const { isLikelyHumanMessage, extractBody, header } = require('./humanFilter');

const MODEL_IDS = (process.env.BEDROCK_MODEL_IDS || process.env.BEDROCK_MODEL_ID || 'apac.amazon.nova-lite-v1:0,apac.amazon.nova-micro-v1:0')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_DRAFTS_PER_RUN = Number(process.env.GMAIL_MAX_DRAFTS_PER_RUN || 5);
const MAX_PROCESSED_IDS = 400;

const SHORT_GREETING = /^(hi|hello|hey|hii|yo|namaste|good\s+(morning|afternoon|evening))[\s!.?]*$/i;

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

async function converse(prompt, maxTokens = 120, temperature = 0.1) {
  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
  let lastErr;
  for (const modelId of MODEL_IDS) {
    try {
      const res = await client.send(
        new ConverseCommand({
          modelId,
          messages: [{ role: 'user', content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens, temperature },
        }),
      );
      return res.output?.message?.content?.[0]?.text || '';
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Bedrock unavailable');
}

function looksLikePersonalReply(subject, body, from) {
  const text = `${subject} ${body}`.trim();
  if (SHORT_GREETING.test(body.trim())) return true;
  if (/\?/.test(text)) return true;
  if (body.trim().split(/\s+/).length <= 12) return true;
  return false;
}

async function needsReply(subject, body, from) {
  if (looksLikePersonalReply(subject, body, from)) return true;
  const text = `From: ${from}\nSubject: ${subject}\n\n${body}`.slice(0, 3000);
  try {
    const out = await converse(
      `You classify email for Rozka AI. Return ONLY JSON: {"human":true|false,"needsReply":true|false}

human=true only for a real person writing to the user (not marketing, bots, receipts, OTP, shipping, newsletters).
needsReply=true for personal messages, greetings, questions, or anything a friend/colleague expects a reply to.

Email:
${text}`,
      120,
      0.1,
    );
    const parsed = JSON.parse(out.replace(/```json|```/g, '').trim());
    return Boolean(parsed.human && parsed.needsReply);
  } catch {
    return looksLikePersonalReply(subject, body, from);
  }
}

function parseReplyTo(from) {
  return from.match(/<([^>]+)>/)?.[1] || from;
}

function replySubject(subject) {
  const s = subject || '(no subject)';
  return s.toLowerCase().startsWith('re:') ? s : `Re: ${s}`;
}

function buildRawReply(to, subject, replyText) {
  const raw = [
    `To: ${to}`,
    `Subject: ${replySubject(subject)}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    replyText,
  ].join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

async function getGmailClient(stored) {
  const auth = oauthClient(stored.tokens);
  stored = await refreshIfNeeded(auth, stored);
  const gmail = google.gmail({ version: 'v1', auth });
  return { stored, gmail };
}

async function findDraftForThread(gmail, threadId, stored, messageId) {
  const cached = stored.draftCache?.[messageId];
  if (cached?.draftId) {
    try {
      const full = await gmail.users.drafts.get({ userId: 'me', id: cached.draftId, format: 'full' });
      return {
        draftId: cached.draftId,
        replyText: extractBody(full.data.message) || cached.replyText || '',
        threadId,
      };
    } catch {
      /* draft removed in Gmail */
    }
  }

  const list = await gmail.users.drafts.list({ userId: 'me', maxResults: 30 });
  for (const item of list.data.drafts || []) {
    const meta = await gmail.users.drafts.get({
      userId: 'me',
      id: item.id,
      format: 'metadata',
    });
    if (meta.data.message?.threadId !== threadId) continue;
    const full = await gmail.users.drafts.get({ userId: 'me', id: item.id, format: 'full' });
    return {
      draftId: item.id,
      replyText: extractBody(full.data.message) || '',
      threadId,
    };
  }
  return null;
}

function cacheDraft(stored, messageId, draftId, replyText) {
  if (!stored.draftCache) stored.draftCache = {};
  stored.draftCache[messageId] = {
    draftId,
    replyText,
    updatedAt: new Date().toISOString(),
  };
}

async function getMessageDetail(stored, messageId) {
  const { stored: updated, gmail } = await getGmailClient(stored);
  const full = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const msg = full.data;
  const headers = msg.payload?.headers || [];
  const subject = header(headers, 'Subject') || '(no subject)';
  const from = header(headers, 'From');
  const body = extractBody(msg);
  const draft = await findDraftForThread(gmail, msg.threadId, updated, messageId);

  return {
    stored: updated,
    message: {
      id: msg.id,
      threadId: msg.threadId,
      from,
      subject,
      date: header(headers, 'Date'),
      body,
      snippet: msg.snippet || '',
      unread: (msg.labelIds || []).includes('UNREAD'),
      humanLikely: isLikelyHumanMessage(msg),
    },
    draft,
  };
}

async function generateDraftForMessage(stored, messageId) {
  const { stored: updated, gmail } = await getGmailClient(stored);
  const full = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const msg = full.data;
  const subject = header(msg.payload?.headers, 'Subject') || '(no subject)';
  const from = header(msg.payload?.headers, 'From');
  const body = extractBody(msg);
  const to = parseReplyTo(from);
  const threadId = msg.threadId;

  let draft = await findDraftForThread(gmail, threadId, updated, messageId);
  if (draft?.replyText) {
    return { stored: updated, draft, messageId, threadId, to, subject };
  }

  const replyText = await writeDraftReply(subject, body, from);
  if (!replyText) throw new Error('Could not generate reply');

  const created = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: buildRawReply(to, subject, replyText),
        threadId,
      },
    },
  });

  draft = { draftId: created.data.id, replyText, threadId };
  cacheDraft(updated, messageId, draft.draftId, replyText);
  return { stored: updated, draft, messageId, threadId, to, subject };
}

async function sendDraftReply(stored, { messageId, draftId, replyText }) {
  const text = String(replyText || '').trim();
  if (!text) throw new Error('Reply text is empty');
  if (!draftId) throw new Error('Missing draft — generate a draft first');

  const { stored: updated, gmail } = await getGmailClient(stored);
  const full = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['Subject', 'From'],
  });
  const msg = full.data;
  const subject = header(msg.payload?.headers, 'Subject') || '(no subject)';
  const from = header(msg.payload?.headers, 'From');
  const to = parseReplyTo(from);
  const threadId = msg.threadId;

  await gmail.users.drafts.update({
    userId: 'me',
    id: draftId,
    requestBody: {
      message: {
        raw: buildRawReply(to, subject, text),
        threadId,
      },
    },
  });

  await gmail.users.drafts.send({
    userId: 'me',
    requestBody: { id: draftId },
  });

  if (updated.draftCache?.[messageId]) {
    delete updated.draftCache[messageId];
  }
  return { stored: updated, sent: true };
}

async function createGmailDraft(gmail, { to, subject, replyText, threadId }) {
  const created = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: buildRawReply(to, subject, replyText),
        threadId,
      },
    },
  });
  return created.data.id;
}

async function writeDraftReply(subject, body, from) {
  const out = await converse(
    `Write a short, friendly email reply DRAFT (2-4 sentences). Do not include Subject line. Sign off with [Your name].

From: ${from}
Subject: ${subject}

${body.slice(0, 2500)}`,
    280,
    0.4,
  );
  return out.trim();
}

async function listInboxPreview(stored, maxResults = 15) {
  const auth = oauthClient(stored.tokens);
  stored = await refreshIfNeeded(auth, stored);
  const gmail = google.gmail({ version: 'v1', auth });
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'in:inbox newer_than:7d',
    maxResults,
  });
  const items = [];
  for (const item of list.data.messages || []) {
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: item.id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });
    const msg = full.data;
    const headers = msg.payload?.headers || [];
    items.push({
      id: msg.id,
      threadId: msg.threadId,
      from: header(headers, 'From'),
      subject: header(headers, 'Subject') || '(no subject)',
      date: header(headers, 'Date'),
      snippet: msg.snippet || '',
      unread: (msg.labelIds || []).includes('UNREAD'),
      humanLikely: isLikelyHumanMessage(msg),
    });
  }
  return { stored, items };
}

async function processAccount(stored, options = {}) {
  const force = Boolean(options.force);
  const auth = oauthClient(stored.tokens);
  stored = await refreshIfNeeded(auth, stored);
  const gmail = google.gmail({ version: 'v1', auth });

  const processed = new Set(stored.processedIds || []);
  const stats = { scanned: 0, skippedFilter: 0, skippedNoReply: 0, errors: 0 };
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: force ? 'in:inbox newer_than:7d' : 'in:inbox is:unread newer_than:7d',
    maxResults: 20,
  });

  const results = [];
  for (const item of list.data.messages || []) {
    if (results.length >= MAX_DRAFTS_PER_RUN) break;
    if (processed.has(item.id)) continue;
    stats.scanned += 1;

    try {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: item.id,
        format: 'full',
      });
      const msg = full.data;
      if (!isLikelyHumanMessage(msg)) {
        processed.add(item.id);
        stats.skippedFilter += 1;
        continue;
      }

      const subject = header(msg.payload?.headers, 'Subject') || '(no subject)';
      const from = header(msg.payload?.headers, 'From');
      const body = extractBody(msg);
      if (!body.trim()) {
        processed.add(item.id);
        stats.skippedFilter += 1;
        continue;
      }

      const ok = await needsReply(subject, body, from);
      if (!ok) {
        processed.add(item.id);
        stats.skippedNoReply += 1;
        continue;
      }

      const replyText = await writeDraftReply(subject, body, from);
      if (!replyText) continue;

      const threadId = msg.threadId;
      const to = parseReplyTo(from);
      const draftId = await createGmailDraft(gmail, { to, subject, replyText, threadId });
      cacheDraft(stored, item.id, draftId, replyText);

      processed.add(item.id);
      results.push({ messageId: item.id, subject, from, draftId, replyText });
    } catch (err) {
      stats.errors += 1;
      console.error('message process failed', item.id, err.message);
    }
  }

  stored.processedIds = [...processed].slice(-MAX_PROCESSED_IDS);
  stored.lastRunAt = new Date().toISOString();
  return { stored, results, stats };
}

module.exports = {
  oauthClient,
  refreshIfNeeded,
  processAccount,
  listInboxPreview,
  getMessageDetail,
  generateDraftForMessage,
  sendDraftReply,
};
