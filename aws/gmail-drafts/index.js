const { google } = require('googleapis');
const { loadSecrets } = require('./lib/secrets');
const tokenStore = require('./lib/tokenStore');
const { oauthClient, refreshIfNeeded, processAccount } = require('./lib/draftService');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
];
const APP_ORIGIN = (process.env.APP_ORIGIN || 'https://edquad.github.io').replace(/\/$/, '');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(status, body) {
  return {
    statusCode: status,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function redirect(url) {
  return { statusCode: 302, headers: { Location: url }, body: '' };
}

function parsePath(event) {
  const raw = event.rawPath || event.path || '/';
  return raw.replace(/\/+$/, '') || '/';
}

function parseQuery(event) {
  return event.queryStringParameters || {};
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function encodeState(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeState(state) {
  return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
}

function settingsReturnUrl(returnUrl) {
  if (!returnUrl) return `${APP_ORIGIN}/daylife/settings?gmail=connected`;
  if (returnUrl.startsWith('http://') || returnUrl.startsWith('https://')) return returnUrl;
  return `${APP_ORIGIN}${returnUrl.startsWith('/') ? '' : '/'}${returnUrl}`;
}

function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI,
  );
}

exports.handler = async (event) => {
  try {
    await loadSecrets();
  } catch (err) {
    console.error('secrets load failed', err.message);
    if (event?.action === 'processAll') {
      return { ok: false, error: 'Secrets not configured' };
    }
    if (event.requestContext?.http?.method || event.httpMethod) {
      return json(503, { ok: false, error: 'Server secrets not configured' });
    }
    throw err;
  }

  if (event?.action === 'processAll') {
    const ids = await tokenStore.listAccountIds();
    let total = 0;
    for (const id of ids) {
      try {
        const stored = await tokenStore.loadAccount(id);
        if (!stored) continue;
        const { stored: updated, results } = await processAccount(stored);
        await tokenStore.saveAccount(id, updated);
        total += results.length;
      } catch (err) {
        console.error('scheduled process failed', id, err.message);
      }
    }
    return { ok: true, accounts: ids.length, draftsCreated: total };
  }

  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = parsePath(event);

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if (path.endsWith('/gmail/auth/start') && method === 'GET') {
    if (!googleConfigured()) {
      return json(503, { ok: false, error: 'Google OAuth not configured on server yet' });
    }
    const q = parseQuery(event);
    const accountId = String(q.accountId || '').trim();
    const returnUrl = String(q.returnUrl || '/settings?gmail=connected').trim();
    if (!accountId || accountId.length < 8) {
      return json(400, { ok: false, error: 'Missing accountId' });
    }
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    const state = encodeState({ accountId, returnUrl, ts: Date.now() });
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state,
    });
    return redirect(url);
  }

  if (path.endsWith('/gmail/auth/callback') && method === 'GET') {
    if (!googleConfigured()) {
      return redirect(`${APP_ORIGIN}/daylife/settings?gmail=error&reason=not_configured`);
    }
    const q = parseQuery(event);
    if (q.error) {
      return redirect(`${APP_ORIGIN}/daylife/settings?gmail=error&reason=${encodeURIComponent(q.error)}`);
    }
    let state;
    try {
      state = decodeState(q.state || '');
    } catch {
      return redirect(`${APP_ORIGIN}/daylife/settings?gmail=error&reason=bad_state`);
    }
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    const { tokens } = await oauth2.getToken(String(q.code || ''));
    oauth2.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    await tokenStore.saveAccount(state.accountId, {
      accountId: state.accountId,
      email: profile.data.emailAddress,
      tokens,
      processedIds: [],
      connectedAt: new Date().toISOString(),
    });

    return redirect(settingsReturnUrl(state.returnUrl));
  }

  if (path.endsWith('/gmail/status') && method === 'GET') {
    const accountId = String(parseQuery(event).accountId || '').trim();
    if (!accountId) return json(400, { ok: false, error: 'Missing accountId' });
    const stored = await tokenStore.loadAccount(accountId);
    if (!stored) {
      return json(200, { ok: true, connected: false });
    }
    return json(200, {
      ok: true,
      connected: true,
      email: stored.email,
      lastRunAt: stored.lastRunAt || null,
      draftsOnly: true,
      humanOnly: true,
    });
  }

  if (path.endsWith('/gmail/disconnect') && method === 'POST') {
    const { accountId } = parseBody(event);
    if (!accountId) return json(400, { ok: false, error: 'Missing accountId' });
    await tokenStore.deleteAccount(String(accountId));
    return json(200, { ok: true, connected: false });
  }

  if (path.endsWith('/gmail/process') && method === 'POST') {
    const body = parseBody(event);
    const accountId = String(body.accountId || '').trim();
    if (accountId) {
      const stored = await tokenStore.loadAccount(accountId);
      if (!stored) return json(404, { ok: false, error: 'Gmail not connected' });
      const { stored: updated, results } = await processAccount(stored);
      await tokenStore.saveAccount(accountId, updated);
      return json(200, { ok: true, draftsCreated: results.length, results });
    }
    const ids = await tokenStore.listAccountIds();
    let total = 0;
    for (const id of ids) {
      try {
        const stored = await tokenStore.loadAccount(id);
        if (!stored) continue;
        const { stored: updated, results } = await processAccount(stored);
        await tokenStore.saveAccount(id, updated);
        total += results.length;
      } catch (err) {
        console.error('process failed', id, err.message);
      }
    }
    return json(200, { ok: true, accounts: ids.length, draftsCreated: total });
  }

  if (bodyAction(event) === 'processAll') {
    const ids = await tokenStore.listAccountIds();
    let total = 0;
    for (const id of ids) {
      try {
        const stored = await tokenStore.loadAccount(id);
        if (!stored) continue;
        const { stored: updated, results } = await processAccount(stored);
        await tokenStore.saveAccount(id, updated);
        total += results.length;
      } catch (err) {
        console.error('scheduled process failed', id, err.message);
      }
    }
    return { ok: true, accounts: ids.length, draftsCreated: total };
  }

  return json(404, { ok: false, error: 'Not found' });
};
