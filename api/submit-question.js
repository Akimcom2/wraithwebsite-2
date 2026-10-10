const MAX_QUESTION_LENGTH = 3000;
const MAX_FIELD_LENGTH = 100;

function sendJson(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(payload);
}

function cleanSingleLine(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, maxLength)
    : '';
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

module.exports = async function submitQuestion(req, res) {
  const token = typeof process.env.TELEGRAM_BOT_TOKEN === 'string'
    ? process.env.TELEGRAM_BOT_TOKEN.trim()
    : '';
  const chatId = typeof process.env.TELEGRAM_CHAT_ID === 'string'
    ? process.env.TELEGRAM_CHAT_ID.trim()
    : '';

  if (req.method === 'GET') {
    return sendJson(res, 200, {enabled: Boolean(token && chatId)});
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, {ok:false, error:'Метод не поддерживается.'});
  }

  const origin = req.headers && req.headers.origin;
  const host = req.headers && req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return sendJson(res, 403, {ok:false, error:'Запрос отклонён.'});
      }
    } catch {
      return sendJson(res, 403, {ok:false, error:'Запрос отклонён.'});
    }
  }

  const contentLength = Number(req.headers && req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > 16000) {
    return sendJson(res, 413, {ok:false, error:'Сообщение слишком большое.'});
  }

  const payload = parseBody(req.body);
  if (typeof payload.website === 'string' && payload.website.trim()) {
    return sendJson(res, 200, {ok:true});
  }
  if (!token || !chatId) {
    return sendJson(res, 503, {ok:false, error:'Отправка пока не подключена.'});
  }

  const party = cleanSingleLine(payload.party, MAX_FIELD_LENGTH);
  const player = cleanSingleLine(payload.player, MAX_FIELD_LENGTH);
  const character = cleanSingleLine(payload.character, MAX_FIELD_LENGTH);
  const question = typeof payload.question === 'string'
    ? payload.question.replace(/\r/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim()
    : '';
  if (!party || !player || !character || !question) {
    return sendJson(res, 400, {ok:false, error:'Заполните имя, персонажа и вопрос.'});
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return sendJson(res, 400, {ok:false, error:'Вопрос слишком длинный. Ограничение: 3000 символов.'});
  }

  const message = [
    'Новый вопрос мастеру',
    'Пачка: ' + party,
    'Игрок: ' + player,
    'Персонаж: ' + character,
    '',
    question
  ].join('\n');

  try {
    const telegramResponse = await fetch(
      'https://api.telegram.org/bot' + token + '/sendMessage',
      {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          chat_id:chatId,
          text:message,
          disable_web_page_preview:true
        })
      }
    );
    const telegramResult = await telegramResponse.json().catch(()=>({}));
    if (!telegramResponse.ok || !telegramResult.ok) {
      return sendJson(res, 502, {ok:false, error:'Не удалось отправить вопрос. Попробуйте позже.'});
    }
    return sendJson(res, 200, {ok:true});
  } catch {
    return sendJson(res, 502, {ok:false, error:'Не удалось связаться с Telegram. Попробуйте позже.'});
  }
};
