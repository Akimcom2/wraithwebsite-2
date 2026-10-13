const {createHash, createHmac, randomUUID, timingSafeEqual} = require('node:crypto');

const STORAGE_PATH = 'chronicle/entries.json';
const MAX_BODY_BYTES = 24000;
const MAX_UPLOAD_BODY_BYTES = 4400000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_PASSWORD_LENGTH = 512;
const MAX_ENTRY_FIELD_LENGTH = 3000;
const INITIAL_SESSION_MEMORIES = [
  {title:'Последний приказ в туманных джунглях', url:'/assets/chronicle/session-01/01-last-order-jungle.webp'},
  {title:'Аплодисменты после выступления', url:'/assets/chronicle/session-01/02-audience-applause.webp'},
  {title:'Акакий и папка у двери', url:'/assets/chronicle/session-01/03-akakiy-folder.webp'},
  {title:'Бриг у туманного острова', url:'/assets/chronicle/session-01/04-brig-fog-island.webp'},
  {title:'Высадка в туманной островной бухте', url:'/assets/chronicle/session-01/05-landing-cove.webp'},
  {title:'Майя и Илья на комедийном шоу', url:'/assets/chronicle/session-01/06-maya-ilya-comedy-show.webp'},
  {title:'Мгновение невесомости над городскими огнями', url:'/assets/chronicle/session-01/07-moment-over-city-lights.webp'},
  {title:'Ночной кабинет, телефон и пустой коридор', url:'/assets/chronicle/session-01/08-night-office.webp'},
  {title:'После последнего поклона', url:'/assets/chronicle/session-01/09-after-final-bow.webp'},
  {title:'Последний приказ капитана на островной тропе', url:'/assets/chronicle/session-01/10-captain-order-island-trail.webp'},
  {title:'Тихая прогулка под огнями аттракционов', url:'/assets/chronicle/session-01/11-walk-under-ride-lights.webp'}
];

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

function uploadedMemoryPath(value) {
  if (typeof value !== 'string') return null;
  try {
    if (value.startsWith('/api/chronicle-memory?')) {
      const url = new URL(value, 'https://chronicle.invalid');
      if (url.origin === 'https://chronicle.invalid' &&
          url.pathname === '/api/chronicle-memory' &&
          !url.hash &&
          url.searchParams.size === 1 &&
          /^[a-f0-9-]{36}$/i.test(url.searchParams.get('id') || '')) {
        return 'chronicle/memories/' + url.searchParams.get('id') + '.webp';
      }
    }
    const validBlobHost = url.hostname.endsWith('.public.blob.vercel-storage.com') ||
      url.hostname.endsWith('.private.blob.vercel-storage.com');
    if (url.protocol === 'https:' && validBlobHost && !url.username && !url.password &&
        /^\/chronicle\/memories\/[a-f0-9-]+\.webp$/i.test(url.pathname)) {
      return url.pathname.slice(1);
    }
  } catch {}
  return null;
}

function validatedMemories(value) {
  if (value === undefined) return {value:[]};
  if (!Array.isArray(value) || value.length > 20) return {error:'Добавь не больше 20 изображений воспоминаний.'};
  const memories = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return {error:'Не удалось прочитать список воспоминаний.'};
    const title = cleanSingleLine(item.title, 120);
    const imageUrl = typeof item.url === 'string' ? item.url.trim() : '';
    if (!title || imageUrl.length > 1000) return {error:'Проверь названия и адреса изображений.'};
    const isSiteAsset = /^\/assets\/chronicle\/[A-Za-z0-9/_-]+\.(?:webp|png|jpe?g)$/i.test(imageUrl);
    if (!isSiteAsset && !uploadedMemoryPath(imageUrl)) return {error:'Адрес изображения не поддерживается.'};
    memories.push({title, url:imageUrl});
  }
  return {value:memories};
}

async function uploadMemory(payload, res) {
  if (payload.contentType !== 'image/webp' || typeof payload.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.data)) {
    return sendJson(res, 400, {error:'Не удалось прочитать изображение.'});
  }
  const image = Buffer.from(payload.data, 'base64');
  if (!image.length || image.length > MAX_IMAGE_BYTES || image.toString('base64') !== payload.data) {
    return sendJson(res, 413, {error:'Изображение слишком большое. Попробуйте файл меньшего размера.'});
  }
  try {
    const {put} = await blobSdk();
    const id = randomUUID();
    const pathname = 'chronicle/memories/' + id + '.webp';
    await put(pathname, image, {
      access:'private',
      addRandomSuffix:false,
      contentType:'image/webp',
      cacheControlMaxAge:31536000
    });
    return sendJson(res, 201, {memory:{url:'/api/chronicle-memory?id=' + id, pathname}});
  } catch {
    return sendJson(res, 503, {error:'Не удалось загрузить изображение. Проверьте соединение и повторите попытку.'});
  }
}

function isUploadedMemoryUrl(value) {
  return uploadedMemoryPath(value) !== null;
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
  let initialSessionAttached = false;
  return saved.entries.map(entry => {
    if (!initialSessionAttached && Number(entry && entry.sessionNumber) === 1 && entry && !Object.prototype.hasOwnProperty.call(entry, 'memories')) {
      initialSessionAttached = true;
      return {...entry, memories:INITIAL_SESSION_MEMORIES};
    }
    return entry;
  });
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
  const memories = validatedMemories(entry.memories);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 9999) {
    return {error:'Укажи номер главы.'};
  }
  if (!title) return {error:'Укажи короткое название сессии.'};
  if (!summary) return {error:'Добавь краткий итог сессии.'};
  if (memories.error) return {error:memories.error};
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
      memories:memories.value,
      createdAt:new Date().toISOString()
    }
  };
}

async function updateChronicleEntry(payload, res) {
  if (typeof payload.entryId !== 'string' || !/^[a-f0-9-]{36}$/i.test(payload.entryId)) {
    return sendJson(res, 400, {error:'Не удалось определить запись.'});
  }
  const validated = validatedEntry(payload.entry);
  if (validated.error) return sendJson(res, 400, {error:validated.error});

  try {
    const entries = await readEntries();
    const entryIndex = entries.findIndex(entry => entry && entry.id === payload.entryId);
    if (entryIndex < 0) return sendJson(res, 404, {error:'Запись уже удалена или не найдена.'});
    const current = entries[entryIndex];
    const updated = {
      ...current,
      ...validated.value,
      id:current.id,
      sessionNumber:Number(current.sessionNumber) || validated.value.sessionNumber,
      createdAt:current.createdAt || validated.value.createdAt,
      updatedAt:new Date().toISOString()
    };
    const nextEntries = entries.map((entry,index) => index === entryIndex ? updated : entry);
    await writeEntries(nextEntries);

    const referencedUrls = new Set();
    for (const entry of nextEntries) {
      if (Array.isArray(entry && entry.memories)) {
        for (const memory of entry.memories) {
          if (memory && typeof memory.url === 'string') referencedUrls.add(memory.url);
        }
      }
    }
    const cleanupPaths = new Set();
    for (const memory of Array.isArray(current.memories) ? current.memories : []) {
      if (memory && typeof memory.url === 'string' &&
          !referencedUrls.has(memory.url) && isUploadedMemoryUrl(memory.url)) {
        cleanupPaths.add(uploadedMemoryPath(memory.url));
      }
    }

    let storageCleanupFailed = false;
    if (cleanupPaths.size) {
      try {
        const {del} = await blobSdk();
        for (const path of cleanupPaths) {
          try { await del(path); }
          catch { storageCleanupFailed = true; }
        }
      } catch {
        storageCleanupFailed = true;
      }
    }
    return sendJson(res, 200, {entry:updated, entries:nextEntries, storageCleanupFailed});
  } catch {
    return sendJson(res, 503, {error:'Не удалось сохранить изменения. Проверьте подключение и повторите попытку.'});
  }
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
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BODY_BYTES) return sendJson(res, 413, {error:'Запрос слишком большой.'});
  const payload = parseBody(req.body);

  if (req.method === 'POST') {
    const secret = typeof process.env.CHRONICLE_TEMPLATE_PASSWORD === 'string'
      ? process.env.CHRONICLE_TEMPLATE_PASSWORD
      : '';
    if (!secret) return sendJson(res, 503, {error:'Доступ мастера пока не настроен.'});
    if (!hasValidMasterSession(req, secret)) {
      return sendJson(res, 401, {error:'Сессия мастера завершилась. Открой шаблон повторно.'});
    }
    if (payload.action === 'upload-memory') return uploadMemory(payload, res);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return sendJson(res, 413, {error:'Запись слишком большая.'});
    if (payload.action === 'update-entry') return updateChronicleEntry(payload, res);
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

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return sendJson(res, 413, {error:'Запрос слишком большой.'});
  const secret = typeof process.env.CHRONICLE_TEMPLATE_PASSWORD === 'string'
    ? process.env.CHRONICLE_TEMPLATE_PASSWORD
    : '';
  if (!secret) return sendJson(res, 503, {error:'Доступ мастера пока не настроен.'});

  if (payload.action === 'delete-memory') {
    if (typeof payload.entryId !== 'string' || !/^[a-f0-9-]{36}$/i.test(payload.entryId)) {
      return sendJson(res, 400, {error:'Не удалось определить запись.'});
    }
    const memoryUrl = typeof payload.url === 'string' ? payload.url.trim() : '';
    if (!memoryUrl || memoryUrl.length > 1000) {
      return sendJson(res, 400, {error:'Не удалось определить журнал.'});
    }
    if (typeof payload.password !== 'string' || payload.password.length === 0 || payload.password.length > MAX_PASSWORD_LENGTH) {
      return sendJson(res, 400, {error:'Введите пароль мастера.'});
    }
    if (!equalSecrets(payload.password, secret)) {
      return sendJson(res, 401, {error:'Пароль не подошёл.'});
    }

    try {
      const entries = await readEntries();
      const entryIndex = entries.findIndex(entry => entry && entry.id === payload.entryId);
      if (entryIndex < 0) return sendJson(res, 404, {error:'Запись уже удалена или не найдена.'});
      const entry = entries[entryIndex];
      const memories = Array.isArray(entry.memories) ? entry.memories : [];
      const memoryIndex = memories.findIndex(memory => memory && memory.url === memoryUrl);
      if (memoryIndex < 0) return sendJson(res, 404, {error:'Журнал уже удалён или не найден.'});

      const removedMemory = memories[memoryIndex];
      const nextEntries = entries.map((current, index) => index === entryIndex
        ? {...current, memories:memories.filter((_, itemIndex) => itemIndex !== memoryIndex)}
        : current);
      await writeEntries(nextEntries);

      let storageCleanupFailed = false;
      const stillReferenced = nextEntries.some(current =>
        Array.isArray(current && current.memories) &&
        current.memories.some(memory => memory && memory.url === removedMemory.url)
      );
      if (!stillReferenced && isUploadedMemoryUrl(removedMemory.url)) {
        try {
          const {del} = await blobSdk();
          await del(uploadedMemoryPath(removedMemory.url));
        } catch {
          storageCleanupFailed = true;
        }
      }
      return sendJson(res, 200, {entries:nextEntries, storageCleanupFailed});
    } catch {
      return sendJson(res, 503, {error:'Не удалось удалить журнал. Проверьте подключение и повторите попытку.'});
    }
  }

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

module.exports.config = {api:{bodyParser:{sizeLimit:'4.5mb'}}};
