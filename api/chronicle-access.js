const {createHash, createHmac, timingSafeEqual} = require('node:crypto');

const COOKIE_NAME = 'chronicle_master';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MAX_BODY_BYTES = 2048;
const MAX_PASSWORD_LENGTH = 512;

function sendJson(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(payload);
}

function parseBody(body) {
  if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return {};
}

function equalSecrets(left, right) {
  const leftHash = createHash('sha256').update(String(left)).digest();
  const rightHash = createHash('sha256').update(String(right)).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function signature(expiry, secret) {
  return createHmac('sha256', secret)
    .update('wraith-chronicle-template:' + expiry)
    .digest('base64url');
}

function cookieTokens(req) {
  const header = req.headers && req.headers.cookie;
  if (typeof header !== 'string') return [];
  const prefix = COOKIE_NAME + '=';
  return header.split(';').map(value => value.trim())
    .filter(value => value.startsWith(prefix))
    .map(value => value.slice(prefix.length));
}

function validSessionToken(token, secret) {
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const expiryText = token.slice(0, dot);
  const suppliedSignature = token.slice(dot + 1);
  if (!/^\d+$/.test(expiryText) || !/^[A-Za-z0-9_-]+$/.test(suppliedSignature)) return null;
  const expiry = Number(expiryText);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + SESSION_TTL_SECONDS + 60) return null;
  const expected = Buffer.from(signature(expiryText, secret));
  const supplied = Buffer.from(suppliedSignature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied)
    ? {token, expiry}
    : null;
}

function findValidSession(req, secret) {
  for (const token of cookieTokens(req)) {
    const session = validSessionToken(token, secret);
    if (session) return session;
  }
  return null;
}

function validSameOrigin(req) {
  const origin = req.headers && req.headers.origin;
  const host = req.headers && req.headers.host;
  if (typeof origin !== 'string' || typeof host !== 'string') return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

function cookieOptions(req) {
  return process.env.NODE_ENV === 'production'
    || (req.headers && req.headers['x-forwarded-proto'] === 'https')
    ? '; Secure'
    : '';
}

function clearLegacyCookie(secure) {
  return COOKIE_NAME + '=; HttpOnly; SameSite=Strict; Path=/api/chronicle-access; Max-Age=0'
    + (secure ? '; Secure' : '');
}

function sessionCookie(token, maxAge, secure) {
  return COOKIE_NAME + '=' + token + '; HttpOnly; SameSite=Strict; Path=/api; Max-Age=' + maxAge
    + (secure ? '; Secure' : '');
}

module.exports = async function chronicleAccess(req, res) {
  const secret = typeof process.env.CHRONICLE_TEMPLATE_PASSWORD === 'string'
    ? process.env.CHRONICLE_TEMPLATE_PASSWORD
    : '';
  if (!secret) {
    return sendJson(res, 503, {
      enabled:false,
      authorized:false,
      error:'Доступ мастера пока не настроен.'
    });
  }

  if (req.method === 'GET') {
    const session = findValidSession(req, secret);
    if (session) {
      const secure = Boolean(cookieOptions(req));
      res.setHeader('Set-Cookie', [
        sessionCookie(session.token, Math.max(1, session.expiry - Math.floor(Date.now() / 1000)), secure),
        clearLegacyCookie(secure)
      ]);
    }
    return sendJson(res, 200, {enabled:true, authorized:Boolean(session)});
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, {enabled:true, error:'Метод не поддерживается.'});
  }

  if (!validSameOrigin(req)) {
    return sendJson(res, 403, {enabled:true, error:'Запрос отклонён.'});
  }

  const contentLength = Number(req.headers && req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return sendJson(res, 413, {enabled:true, error:'Запрос слишком большой.'});
  }

  const payload = parseBody(req.body);
  const candidate = payload.password;
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > MAX_PASSWORD_LENGTH) {
    return sendJson(res, 400, {enabled:true, error:'Введите пароль мастера.'});
  }
  if (!equalSecrets(candidate, secret)) {
    return sendJson(res, 401, {enabled:true, authorized:false, error:'Пароль не подошёл.'});
  }

  const expiry = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS);
  const secure = Boolean(cookieOptions(req));
  const token = expiry + '.' + signature(expiry, secret);
  res.setHeader('Set-Cookie', [
    sessionCookie(token, SESSION_TTL_SECONDS, secure),
    clearLegacyCookie(secure)
  ]);
  return sendJson(res, 200, {enabled:true, authorized:true});
};
