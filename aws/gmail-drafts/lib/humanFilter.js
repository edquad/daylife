const AUTO_FROM = [
  /noreply@/i,
  /no-reply@/i,
  /donotreply@/i,
  /do-not-reply@/i,
  /notifications@/i,
  /notification@/i,
  /mailer-daemon@/i,
  /postmaster@/i,
  /bounce@/i,
  /newsletter@/i,
  /marketing@/i,
  /promo@/i,
  /updates@/i,
  /alert@/i,
  /alerts@/i,
];

const AUTO_SUBJECT = [
  /unsubscribe/i,
  /verification code/i,
  /otp/i,
  /one-time password/i,
  /password reset/i,
  /receipt for your/i,
  /order confirmation/i,
  /shipping confirmation/i,
  /your .* statement/i,
  /security alert/i,
];

function header(headers, name) {
  const h = (headers || []).find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function fromAddress(from) {
  const m = String(from || '').match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

function isLikelyHumanMessage(message) {
  const labelIds = message.labelIds || [];
  if (labelIds.includes('SPAM') || labelIds.includes('TRASH')) return false;
  if (labelIds.includes('CATEGORY_PROMOTIONS') || labelIds.includes('CATEGORY_SOCIAL')) return false;

  const headers = message.payload?.headers || [];
  const from = fromAddress(header(headers, 'From'));
  const subject = header(headers, 'Subject');

  if (AUTO_FROM.some((re) => re.test(from))) return false;
  if (AUTO_SUBJECT.some((re) => re.test(subject))) return false;

  if (header(headers, 'List-Unsubscribe')) return false;
  if (header(headers, 'Precedence').match(/bulk|list|junk|auto_reply/i)) return false;
  if (header(headers, 'Auto-Submitted').match(/auto-/i)) return false;
  if (header(headers, 'X-Auto-Response-Suppress')) return false;

  return true;
}

function extractBody(message) {
  function walk(part) {
    if (!part) return '';
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf8');
    }
    for (const p of part.parts || []) {
      const t = walk(p);
      if (t) return t;
    }
    if (part.body?.data && part.mimeType?.includes('text')) {
      return Buffer.from(part.body.data, 'base64').toString('utf8');
    }
    return '';
  }
  return walk(message.payload).trim().slice(0, 4000);
}

module.exports = { isLikelyHumanMessage, extractBody, fromAddress, header };
