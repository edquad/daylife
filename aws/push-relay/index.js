const webpush = require('web-push');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (method !== 'POST') {
    return response(404, { ok: false, error: 'Not found' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { ok: false, error: 'Invalid JSON' });
  }

  const { subscription, title, body: text, url } = payload;
  if (!subscription?.endpoint) {
    return response(400, { ok: false, error: 'Missing subscription' });
  }

  webpush.setVapidDetails(
    'mailto:rozka-app@users.noreply.github.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: title || 'Rozka',
        body: text || '',
        url: url || '/',
        tag: 'rozka-shared',
      }),
    );
    return response(200, { ok: true });
  } catch (err) {
    return response(500, { ok: false, error: err?.message || 'Push failed' });
  }
};
