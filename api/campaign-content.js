const {createHash, createHmac, randomUUID, timingSafeEqual} = require('node:crypto');

const CONTENT_PATH = 'campaign/site-content.json';
const MAX_CONTENT_BYTES = 900000;
const MAX_UPLOAD_BODY_BYTES = 4400000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
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

function validSameOrigin(req) {
  const origin = req.headers && req.headers.origin;
  const host = req.headers && req.headers.host;
  if (typeof origin !== 'string' || typeof host !== 'string') return false;
  try { return new URL(origin).host.toLowerCase() === host.toLowerCase(); }
  catch { return false; }
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
    if (expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer)) return true;
  }
  return false;
}

function text(value, max, multiline = false) {
  if (typeof value !== 'string') return '';
  return multiline
    ? value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max)
    : value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

function id(value, prefix) {
  const candidate = text(value, 100);
  return /^[\p{L}\p{N}_-]{1,100}$/u.test(candidate) ? candidate : (prefix + '-' + randomUUID());
}

function media(value) {
  const candidate = text(value, 1000);
  if (!candidate) return '';
  try {
    const url = new URL(candidate, 'https://campaign.invalid');
    if (url.origin === 'https://campaign.invalid' &&
        url.pathname === '/api/campaign-media' && url.searchParams.size === 1 &&
        /^[a-f0-9-]{36}$/i.test(url.searchParams.get('id') || '') && !url.hash) {
      return '/api/campaign-media?id=' + url.searchParams.get('id');
    }
  } catch {}
  if (candidate.startsWith('/assets/') && !candidate.includes('..') &&
      /^\/assets\/[\p{L}\p{N}_./ -]+\.(?:webp|png|jpe?g|svg)$/iu.test(candidate)) return candidate;
  if (/^[\p{L}\p{N}_ ().-]{1,220}$/u.test(candidate) && !candidate.includes('..')) return candidate;
  return '';
}

function requiredLine(value, max, label) {
  const out = text(value, max);
  if (!out) throw new Error('Заполни поле «' + label + '».');
  return out;
}

function rows(value, key, maxCount, make) {
  if (!Array.isArray(value) || value.length > maxCount) throw new Error('Проверь список «' + key + '».');
  return value.map((entry, index) => make(entry, index));
}

function normalizeContent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Не удалось прочитать данные кампании.');
  const party = input.party && typeof input.party === 'object' ? input.party : {};
  const campaign = input.campaignInfo && typeof input.campaignInfo === 'object' ? input.campaignInfo : {};
  const characters = rows(input.characters, 'игровые персонажи', 100, (item, i) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Проверь карточку персонажа.');
    return {
      id:id(item.id, 'character'),
      name:requiredLine(item.name, 120, 'имя персонажа'),
      shortName:text(item.shortName, 80),
      role:text(item.role, 100),
      portrait:media(item.portrait),
      text:text(item.text, 1500, true),
      background:text(item.background, 4000, true),
      prompt:text(item.prompt, 2000, true),
      note:text(item.note, 2000, true),
      hidden:item.hidden === true
    };
  });
  const npcs = rows(input.npcs, 'другие лица', 200, (item, i) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Проверь карточку неигрового персонажа.');
    return {
      id:id(item.id, 'npc'),
      name:requiredLine(item.name, 120, 'имя неигрового персонажа'),
      shortName:text(item.shortName, 80),
      role:text(item.role, 100),
      portrait:media(item.portrait),
      text:text(item.text, 1500, true),
      background:text(item.background, 4000, true),
      prompt:text(item.prompt, 2000, true),
      note:text(item.note, 2000, true),
      hidden:item.hidden === true
    };
  });
  const places = rows(input.places, 'места', 300, item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Проверь карточку места.');
    const x = Number(item.x), y = Number(item.y);
    return {
      id:id(item.id, 'place'),
      name:requiredLine(item.name, 120, 'название места'),
      x:Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 50,
      y:Number.isFinite(y) ? Math.max(0, Math.min(100, y)) : 50,
      onMap:item.onMap !== false,
      icon:media(item.icon),
      image:media(item.image),
      text:text(item.text, 3000, true),
      category:text(item.category, 80) || 'Другое',
      aliases:Array.isArray(item.aliases) ? item.aliases.slice(0, 30).map(value => text(value, 100)).filter(Boolean) : [],
      hidden:item.hidden === true
    };
  });
  const mapGallery = rows(input.mapGallery, 'иллюстрации атласа', 200, item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Проверь иллюстрацию атласа.');
    return {
      id:id(item.id, 'gallery'),
      name:requiredLine(item.name, 120, 'название иллюстрации'),
      image:media(item.image),
      text:text(item.text, 2000, true),
      category:text(item.category, 80) || 'Другое',
      hidden:item.hidden === true
    };
  });
  const guide = rows(input.guide, 'правила', 200, item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Проверь правило.');
    const paragraphs = Array.isArray(item.paragraphs) ? item.paragraphs.slice(0, 12).map(value => text(value, 2000, true)).filter(Boolean) : [];
    return {
      id:id(item.id, 'guide'),
      category:text(item.category, 80) || 'Общее',
      title:requiredLine(item.title, 140, 'название правила'),
      paragraphs,
      example:text(item.example, 2000, true),
      hidden:item.hidden === true
    };
  });
  const preparation = rows(input.preparation, 'подготовка', 100, item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Проверь пункт подготовки.');
    return {id:id(item.id, 'prep'), text:requiredLine(item.text, 500, 'пункт подготовки'), hidden:item.hidden === true};
  });
  const specializations = rows(input.specializations, 'специализации', 200, item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Проверь специализацию.');
    return {
      id:id(item.id, 'spec'),
      name:requiredLine(item.name, 120, 'название специализации'),
      examples:Array.isArray(item.examples) ? item.examples.slice(0, 40).map(value => text(value, 100)).filter(Boolean) : [],
      hidden:item.hidden === true
    };
  });
  return {
    party:{
      id:id(party.id, 'campaign'),
      label:requiredLine(party.label, 100, 'название кампании'),
      edition:text(party.edition, 12) || '01'
    },
    campaignInfo:{
      brand:text(campaign.brand, 100) || 'Игровая хроника',
      system:text(campaign.system, 100),
      location:text(campaign.location, 160),
      coordinates:text(campaign.coordinates, 100),
      sidebarNote:text(campaign.sidebarNote, 300, true),
      heroEyebrow:text(campaign.heroEyebrow, 160),
      heroLocation:text(campaign.heroLocation, 180),
      heroPhase:text(campaign.heroPhase, 120),
      charactersLabel:text(campaign.charactersLabel, 100),
      prepLabel:text(campaign.prepLabel, 100),
      heroTitle:text(campaign.heroTitle, 240, true),
      heroIntro:text(campaign.heroIntro, 600, true),
      atlasTitle:text(campaign.atlasTitle, 120) || 'Атлас мест',
      atlasIntro:text(campaign.atlasIntro, 500, true),
      mapLabel:text(campaign.mapLabel, 120),
      moodTitle:text(campaign.moodTitle, 200, true),
      moodText:text(campaign.moodText, 1000, true),
      mapImage:media(campaign.mapImage)
    },
    characters, npcs, places, mapGallery, preparation, guide, specializations
  };
}

function publicCampaignContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  const result = {...content};
  for (const key of ['characters','npcs','places','mapGallery','preparation','guide','specializations']) {
    if (Array.isArray(result[key])) result[key] = result[key].filter(item => item && item.hidden !== true);
  }
  return result;
}

async function blobSdk() { return import('@vercel/blob'); }

async function readContent() {
  const {get} = await blobSdk();
  const blob = await get(CONTENT_PATH, {access:'private', useCache:false});
  if (!blob) return null;
  const saved = await new Response(blob.stream).json();
  if (!saved || !saved.content || typeof saved.content !== 'object') throw new Error('Invalid campaign content');
  return saved.content;
}

async function writeContent(content) {
  const {put} = await blobSdk();
  await put(CONTENT_PATH, JSON.stringify({version:1, content}), {
    access:'private', addRandomSuffix:false, allowOverwrite:true, contentType:'application/json'
  });
}

async function uploadImage(payload, res) {
  if (payload.contentType !== 'image/webp' || typeof payload.data !== 'string' ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.data)) {
    return sendJson(res, 400, {error:'Не удалось прочитать изображение.'});
  }
  const image = Buffer.from(payload.data, 'base64');
  if (!image.length || image.length > MAX_IMAGE_BYTES || image.toString('base64') !== payload.data) {
    return sendJson(res, 413, {error:'Изображение слишком большое. Попробуйте файл меньшего размера.'});
  }
  try {
    const {put} = await blobSdk();
    const imageId = randomUUID();
    await put('campaign/media/' + imageId + '.webp', image, {
      access:'private', addRandomSuffix:false, contentType:'image/webp', cacheControlMaxAge:31536000
    });
    return sendJson(res, 201, {image:{url:'/api/campaign-media?id=' + imageId}});
  } catch {
    return sendJson(res, 503, {error:'Не удалось загрузить изображение. Проверь подключение и повтори попытку.'});
  }
}

module.exports = async function campaignContent(req, res) {
  if (req.method === 'GET') {
    try {
      let content = await readContent();
      const secret = typeof process.env.CHRONICLE_TEMPLATE_PASSWORD === 'string' ? process.env.CHRONICLE_TEMPLATE_PASSWORD : '';
      if (content && !hasValidMasterSession(req, secret)) content = publicCampaignContent(content);
      return sendJson(res, 200, {content});
    } catch { return sendJson(res, 503, {error:'Не удалось загрузить содержимое кампании.'}); }
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, {error:'Метод не поддерживается.'});
  }
  if (!validSameOrigin(req)) return sendJson(res, 403, {error:'Запрос отклонён.'});
  const length = Number(req.headers && req.headers['content-length']);
  if (Number.isFinite(length) && length > MAX_UPLOAD_BODY_BYTES) return sendJson(res, 413, {error:'Запрос слишком большой.'});
  const secret = typeof process.env.CHRONICLE_TEMPLATE_PASSWORD === 'string' ? process.env.CHRONICLE_TEMPLATE_PASSWORD : '';
  if (!secret) return sendJson(res, 503, {error:'Доступ мастера пока не настроен.'});
  if (!hasValidMasterSession(req, secret)) return sendJson(res, 401, {error:'Сессия мастера завершилась. Открой редактор повторно.'});
  const payload = parseBody(req.body);
  if (payload.action === 'upload-image') return uploadImage(payload, res);
  if (Number.isFinite(length) && length > MAX_CONTENT_BYTES) return sendJson(res, 413, {error:'Данные кампании слишком велики.'});
  let content;
  try { content = normalizeContent(payload.content); }
  catch (error) { return sendJson(res, 400, {error:error.message || 'Проверь данные кампании.'}); }
  try {
    await writeContent(content);
    return sendJson(res, 200, {content});
  } catch {
    return sendJson(res, 503, {error:'Не удалось сохранить содержимое кампании. Проверь хранилище и повтори попытку.'});
  }
};

module.exports.config = {api:{bodyParser:{sizeLimit:'4.5mb'}}};
