const {createHash, createHmac, randomUUID, timingSafeEqual} = require('node:crypto');

const STORAGE_PATH = 'chronicle/entries.json';
const MAX_BODY_BYTES = 24000;
const MAX_PASSWORD_LENGTH = 512;
const MAX_ENTRY_FIELD_LENGTH = 3000;

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

function equalSecrets(left, right) {
  const leftHash = createHash('sha256').update(String(left)).digest();
  const rightHash = createHash('sha256').update(String(right)).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function hasValidMasterSession(req, secret) {
  const header = req.headers && req.headers.cookie;
  if (typeof header !== 'string') return false;
  const tokens = header.split(';').map(value => value.trim())
    .filter(value => value.startsWith('chronicle_master='))
    .map(value => value.slice('chronicle_master='.length));
  const now = Math.floor(Date.now() / 1000);
  for (const token of tokens) {
    const dot = token.indexOf('.');
    if (dot < 1) continue;
    const expiryText = token.slice(0, dot);
    const suppliedSignature = token.slice(dot + 1);
    if (!/^\d+$/.test(expiryText) || !/^[A-Za-z0-9_-]+$/.test(suppliedSignature)) continue;
    const expiry = Number(expiryText);
    if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + 12 * 60 * 60 + 60) continue;
    const expected = createHmac('sha256', secret)
      .update('wraith-chronicle-template:' + expiryText)
      .digest('base64url');
    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(suppliedSignature);
    if (expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer)) {
      return true;
    }
  }
  return false;
}

function cleanSingleLine(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function cleanMultiline(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .trim()
      .slice(0, maxLength)
    : '';
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : '';
}

async function blobSdk() {
  return import('@vercel/blob');
}

async function readEntries() {
  const {get} = await blobSdk();
  const blob = await get(STORAGE_PATH, {access:'private', useCache:false});
  if (!blob) return [];
  const saved = await new Response(blob.stream).json();
  if (!saved || !Array.isArray(saved.entries)) throw new Error('Invalid Chronicle data');
  return saved.entries;
}

async function writeEntries(entries) {
  const {put} = await blobSdk();
  await put(STORAGE_PATH, JSON.stringify({version:1, entries}), {
    access:'private',
    addRandomSuffix:false,
    allowOverwrite:true,
    contentType:'application/json'
  });
}

function validatedEntry(payload) {
  const entry = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const chapter = Number(entry.chapter);
  const title = cleanSingleLine(entry.title, 100);
  const summary = cleanMultiline(entry.summary, MAX_ENTRY_FIELD_LENGTH);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 9999) {
    return {error:'Укажи номер главы.'};
  }
  if (!title) return {error:'Укажи короткое название сессии.'};
  if (!summary) return {error:'Добавь краткий итог сессии.'};
  const suppliedSession = Number(entry.sessionNumber);
  if (!Number.isInteger(suppliedSession) || suppliedSession < 1 || suppliedSession > 10000) {
    return {error:'Не удалось определить номер сессии.'};
  }
  return {
    value:{
      id:randomUUID(),
      sessionNumber:suppliedSession,
      chapter,
      title,
      date:validDate(entry.date),
      summary,
      known:cleanMultiline(entry.known, MAX_ENTRY_FIELD_LENGTH),
      newDetails:cleanMultiline(entry.newDetails, MAX_ENTRY_FIELD_LENGTH),
      questions:cleanMultiline(entry.questions, MAX_ENTRY_FIELD_LENGTH),
      ending:cleanMultiline(entry.ending, MAX_ENTRY_FIELD_LENGTH),
      createdAt:new Date().toISOString()
    }
  };
}

module.exports = async function chronicle(req, res) {
  if (req.method === 'GET') {
    try {
      return sendJson(res, 200, {entries:await readEntries()});
    } catch {
      return sendJson(res, 503, {error:'Не удалось загрузить Хронику. Попробуйте позже.'});
    }
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return sendJson(res, 405, {error:'Метод не поддерживается.'});
  }

  if (!validSameOrigin(req)) return sendJson(res, 403, {error:'Запрос отклонён.'});
  const contentLength = Number(req.headers && req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return sendJson(res, 413, {error:'Запрос слишком большой.'});
  }
  const payload = parseBody(req.body);

  if (req.method === 'POST') {
    const secret = typeof process.env.CHRONICLE_TEMPLATE_PASSWORD === 'string'
      ? process.env.CHRONICLE_TEMPLATE_PASSWORD
      : '';
    if (!secret) return sendJson(res, 503, {error:'Доступ мастера пока не настроен.'});
    if (!hasValidMasterSession(req, secret)) {
      return sendJson(res, 401, {error:'Сессия мастера завершилась. Открой шаблон повторно.'});
    }
    const validated = validatedEntry(payload.entry);
    if (validated.error) return sendJson(res, 400, {error:validated.error});
    try {
      const entries = await readEntries();
      const nextEntries = [...entries, validated.value];
      await writeEntries(nextEntries);
      return sendJson(res, 201, {entry:validated.value, entries:nextEntries});
    } catch {
      return sendJson(res, 503, {error:'Не удалось сохранить запись. Проверьте подключение и повторите попытку.'});
    }
  }

  const secret = typeof process.env.CHRONICLE_TEMPLATE_PASSWORD === 'string'
    ? process.env.CHRONICLE_TEMPLATE_PASSWORD
    : '';
  if (!secret) return sendJson(res, 503, {error:'Доступ мастера пока не настроен.'});
  if (typeof payload.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(payload.id)) {
    return sendJson(res, 400, {error:'Не удалось определить запись.'});
  }
  if (typeof payload.password !== 'string' || payload.password.length === 0 || payload.password.length > MAX_PASSWORD_LENGTH) {
    return sendJson(res, 400, {error:'Введите пароль мастера.'});
  }
  if (!equalSecrets(payload.password, secret)) {
    return sendJson(res, 401, {error:'Пароль не подошёл.'});
  }

  try {
    const entries = await readEntries();
    const nextEntries = entries.filter(entry => entry && entry.id !== payload.id);
    if (nextEntries.length === entries.length) return sendJson(res, 404, {error:'Запись уже удалена или не найдена.'});
    await writeEntries(nextEntries);
    return sendJson(res, 200, {entries:nextEntries});
  } catch {
    return sendJson(res, 503, {error:'Не удалось удалить запись. Проверьте подключение и повторите попытку.'});
  }
};
