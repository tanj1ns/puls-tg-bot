'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const { initDatabase } = require('./db');
const {
  verifyPassword,
  createSession,
  deleteSession,
  getSessionUser,
  buildCookie
} = require('./auth');
const {
  apiLimiter,
  loginLimiter,
  botMsgLimiter,
  applySecurityHeaders,
  verifySameOrigin,
  hardenHttpServer
} = require('./security');
const {
  sendTelegramMessage,
  startBotPolling,
  getBotStatus
} = require('./bot');

const PORT = Number(process.env.PORT) || 4005;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const db = initDatabase();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

const SEGMENTS = {
  'Все подписчики': 1240,
  'VIP-клиенты': 185,
  'Ожидают заказ': 64
};

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function readJson(req, maxBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Размер запроса превышает лимит'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Некорректный JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function mapTicket(r) {
  let messages = [];
  try {
    messages = JSON.parse(r.messages_json || '[]');
  } catch {
    messages = [];
  }
  return {
    id: r.id,
    code: r.code,
    userName: r.user_name,
    userHandle: r.user_handle,
    topic: r.topic,
    status: r.status,
    messages,
    updatedAt: r.updated_at
  };
}

function matchFaqReply(text) {
  const lower = String(text || '').toLowerCase();
  const rules = db.prepare('SELECT * FROM faq_rules').all();
  for (const rule of rules) {
    const trg = rule.trigger_text.toLowerCase();
    if (lower.includes(trg)) {
      db.prepare('UPDATE faq_rules SET hits = hits + 1 WHERE id = ?').run(rule.id);
      return rule.reply_text;
    }
  }
  return null;
}

// Start Telegram long-polling when TELEGRAM_BOT_TOKEN is configured
startBotPolling((msg) => {
  const chatId = String(msg.chat.id);
  const text = String(msg.text || '').trim().slice(0, 500);
  if (!text) return;

  const now = new Date().toISOString();
  const handle = msg.from?.username ? `@${msg.from.username}` : `tg:${chatId}`;
  const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || 'Клиент Telegram';

  let ticket = db.prepare("SELECT * FROM tickets WHERE chat_id = ? AND status != 'resolved' ORDER BY id DESC LIMIT 1").get(chatId);
  const autoReply = matchFaqReply(text);

  if (!ticket) {
    const code = `TK-${crypto.randomInt(820, 999)}`;
    const msgs = [{ id: Date.now(), sender: 'user', text, at: now }];
    if (autoReply) msgs.push({ id: Date.now() + 1, sender: 'bot', text: autoReply, at: now });
    db.prepare(
      'INSERT INTO tickets (code, user_name, user_handle, chat_id, topic, status, messages_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(code, name, handle, chatId, 'Telegram диалог', autoReply ? 'pending' : 'open', JSON.stringify(msgs), now);
  } else {
    const prev = JSON.parse(ticket.messages_json || '[]');
    prev.push({ id: Date.now(), sender: 'user', text, at: now });
    if (autoReply) prev.push({ id: Date.now() + 1, sender: 'bot', text: autoReply, at: now });
    db.prepare('UPDATE tickets SET messages_json = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(prev.slice(-40)), now, ticket.id);
  }

  if (autoReply) {
    sendTelegramMessage(chatId, autoReply);
  }
});

async function handleApi(req, res, parsed) {
  const method = req.method;
  const pathname = parsed.pathname;

  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'puls-tg-bot' });
  }

  const rate = apiLimiter(req);
  if (!rate.allowed) {
    return sendJson(res, 429, { ok: false, error: 'Слишком много запросов. Подождите минуту.' }, { 'Retry-After': String(rate.retryAfterSec) });
  }

  if (!verifySameOrigin(req)) {
    return sendJson(res, 403, { ok: false, error: 'Запрос отклонён политикой безопасности источника (CSRF)' });
  }

  const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  const user = getSessionUser(db, req);

  if (method === 'GET' && pathname === '/api/bootstrap') {
    const tickets = db.prepare('SELECT * FROM tickets ORDER BY id DESC LIMIT 40').all().map(mapTicket);
    const faqRules = db.prepare('SELECT id, trigger_text AS triggerText, reply_text AS replyText, hits FROM faq_rules ORDER BY id ASC').all();
    const campaigns = db.prepare('SELECT id, title, segment, recipients, body, sent_at AS sentAt FROM campaigns ORDER BY id DESC LIMIT 20').all();
    return sendJson(res, 200, {
      ok: true,
      tickets,
      faqRules,
      campaigns,
      botStatus: getBotStatus(),
      user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null
    });
  }

  if (method === 'POST' && pathname === '/api/bot/message') {
    const bRate = botMsgLimiter(req);
    if (!bRate.allowed) {
      return sendJson(res, 429, { ok: false, error: 'Слишком много сообщений в бот.' }, { 'Retry-After': String(bRate.retryAfterSec) });
    }

    const body = await readJson(req);
    const text = String(body.text || '').trim().slice(0, 500);
    if (!text) return sendJson(res, 400, { ok: false, error: 'Введите сообщение' });

    const now = new Date().toISOString();
    const autoReply = matchFaqReply(text);
    const ticketId = Number(body.ticketId || 0);

    let row = ticketId ? db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) : null;
    if (!row) {
      const code = `TK-${crypto.randomInt(820, 999)}`;
      const msgs = [{ id: Date.now(), sender: 'user', text, at: now }];
      if (autoReply) msgs.push({ id: Date.now() + 1, sender: 'bot', text: autoReply, at: now });
      const info = db
        .prepare(
          'INSERT INTO tickets (code, user_name, user_handle, chat_id, topic, status, messages_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          code,
          String(body.userName || 'Гость демо').trim().slice(0, 60),
          String(body.userHandle || '@demo_guest').trim().slice(0, 40),
          '',
          text.slice(0, 42),
          autoReply ? 'pending' : 'open',
          JSON.stringify(msgs),
          now
        );
      row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(info.lastInsertRowid);
    } else {
      const prev = JSON.parse(row.messages_json || '[]');
      prev.push({ id: Date.now(), sender: 'user', text, at: now });
      if (autoReply) prev.push({ id: Date.now() + 1, sender: 'bot', text: autoReply, at: now });
      db.prepare("UPDATE tickets SET messages_json = ?, status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(prev.slice(-40)), now, row.id);
      row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(row.id);
    }

    return sendJson(res, 200, { ok: true, ticket: mapTicket(row) });
  }

  if (method === 'POST' && pathname === '/api/tickets/callback') {
    const body = await readJson(req);
    if (String(body.website || '').trim() !== '') {
      return sendJson(res, 201, { ok: true, ticket: { id: 0, code: 'TK-999' } });
    }
    if (!body.consent) {
      return sendJson(res, 400, { ok: false, error: 'Подтвердите согласие на обработку персональных данных (152-ФЗ).' });
    }
    const name = String(body.name || '').trim().slice(0, 80);
    const phone = String(body.phone || '').trim().slice(0, 32);
    const question = String(body.question || 'Запрос звонка оператора').trim().slice(0, 300);

    if (name.length < 2 || phone.replace(/\D/g, '').length < 11) {
      return sendJson(res, 400, { ok: false, error: 'Укажите имя и телефон (+7)' });
    }

    const now = new Date().toISOString();
    const code = `TK-${crypto.randomInt(820, 999)}`;
    const msgs = [
      { id: Date.now(), sender: 'user', text: `Обратный звонок: ${phone}. Вопрос: ${question}`, at: now },
      { id: Date.now() + 1, sender: 'bot', text: `Тикет ${code} создан! Оператор свяжется с вами по номеру ${phone}.`, at: now }
    ];
    const info = db
      .prepare('INSERT INTO tickets (code, user_name, user_handle, chat_id, topic, status, messages_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(code, name, phone, '', 'Обратный звонок', 'open', JSON.stringify(msgs), now);
    const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(info.lastInsertRowid);
    return sendJson(res, 201, { ok: true, ticket: mapTicket(row) });
  }

  const replyMatch = pathname.match(/^\/api\/tickets\/(\d+)\/reply$/);
  if (replyMatch && method === 'POST') {
    const id = Number(replyMatch[1]);
    const body = await readJson(req);
    const text = String(body.text || '').trim().slice(0, 500);
    if (!text) return sendJson(res, 400, { ok: false, error: 'Введите ответ оператора' });

    const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!row) return sendJson(res, 404, { ok: false, error: 'Тикет не найден' });

    const now = new Date().toISOString();
    const prev = JSON.parse(row.messages_json || '[]');
    prev.push({ id: Date.now(), sender: 'operator', text, at: now });
    db.prepare('UPDATE tickets SET messages_json = ?, status = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(prev.slice(-40)),
      'pending',
      now,
      id
    );

    if (row.chat_id) {
      sendTelegramMessage(row.chat_id, text);
    }

    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    return sendJson(res, 200, { ok: true, ticket: mapTicket(updated) });
  }

  const statusMatch = pathname.match(/^\/api\/tickets\/(\d+)\/status$/);
  if (statusMatch && method === 'PATCH') {
    const id = Number(statusMatch[1]);
    const body = await readJson(req);
    if (!['open', 'pending', 'resolved'].includes(body.status)) {
      return sendJson(res, 400, { ok: false, error: 'Некорректный статус тикета' });
    }
    db.prepare('UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?').run(
      body.status,
      new Date().toISOString(),
      id
    );
    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    return sendJson(res, 200, { ok: true, ticket: mapTicket(updated) });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const lRate = loginLimiter(req);
    if (!lRate.allowed) {
      return sendJson(res, 429, { ok: false, error: 'Слишком много попыток входа.' }, { 'Retry-After': String(lRate.retryAfterSec) });
    }

    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    const account = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email);
    if (!account || !verifyPassword(password, account.password_hash)) {
      return sendJson(res, 401, { ok: false, error: 'Неверный email или пароль' });
    }

    const token = createSession(db, account.id);
    return sendJson(
      res,
      200,
      { ok: true, user: { id: account.id, name: account.name, email: account.email, role: account.role } },
      { 'Set-Cookie': buildCookie(token, false, isSecure) }
    );
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    if (user?.token) deleteSession(db, user.token);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': buildCookie('', true, isSecure) });
  }

  if (pathname.startsWith('/api/admin/')) {
    if (!user || user.role !== 'admin') {
      return sendJson(res, 401, { ok: false, error: 'Требуется авторизация администратора' });
    }

    if (method === 'POST' && pathname === '/api/admin/faq') {
      const body = await readJson(req);
      const triggerText = String(body.triggerText || '').trim().slice(0, 80);
      const replyText = String(body.replyText || '').trim().slice(0, 500);
      if (triggerText.length < 2 || replyText.length < 4) {
        return sendJson(res, 400, { ok: false, error: 'Укажите ключевую фразу и текст автоответа' });
      }
      const info = db.prepare('INSERT INTO faq_rules (trigger_text, reply_text, hits) VALUES (?, ?, 0)').run(triggerText, replyText);
      const row = db.prepare('SELECT id, trigger_text AS triggerText, reply_text AS replyText, hits FROM faq_rules WHERE id = ?').get(info.lastInsertRowid);
      return sendJson(res, 201, { ok: true, rule: row });
    }

    const faqDelMatch = pathname.match(/^\/api\/admin\/faq\/(\d+)$/);
    if (faqDelMatch && method === 'DELETE') {
      db.prepare('DELETE FROM faq_rules WHERE id = ?').run(Number(faqDelMatch[1]));
      return sendJson(res, 200, { ok: true });
    }

    if (method === 'POST' && pathname === '/api/admin/campaigns') {
      const body = await readJson(req);
      const title = String(body.title || '').trim().slice(0, 120);
      const segment = SEGMENTS[body.segment] ? body.segment : 'Все подписчики';
      const msgBody = String(body.body || '').trim().slice(0, 800);
      if (title.length < 2 || msgBody.length < 4) {
        return sendJson(res, 400, { ok: false, error: 'Укажите заголовок и текст рассылки' });
      }
      const sentAt = new Date().toISOString();
      const recipients = SEGMENTS[segment];
      const info = db
        .prepare('INSERT INTO campaigns (title, segment, recipients, body, sent_at) VALUES (?, ?, ?, ?, ?)')
        .run(title, segment, recipients, msgBody, sentAt);
      const row = db.prepare('SELECT id, title, segment, recipients, body, sent_at AS sentAt FROM campaigns WHERE id = ?').get(info.lastInsertRowid);
      return sendJson(res, 201, { ok: true, campaign: row });
    }

    const delTicketMatch = pathname.match(/^\/api\/admin\/tickets\/(\d+)$/);
    if (delTicketMatch && method === 'DELETE') {
      db.prepare('DELETE FROM tickets WHERE id = ?').run(Number(delTicketMatch[1]));
      return sendJson(res, 200, { ok: true });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'Маршрут не найден' });
}

const server = http.createServer(async (req, res) => {
  applySecurityHeaders(res);

  try {
    const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (parsed.pathname.startsWith('/api/')) {
      return await handleApi(req, res, parsed);
    }

    const reqPath = decodeURIComponent(parsed.pathname);
    if (reqPath === '/robots.txt') {
      return serveFile(res, path.join(ROOT_DIR, 'public', 'robots.txt'));
    }

    const cleanDistPath = path.resolve(DIST_DIR, reqPath === '/' ? 'index.html' : `.${reqPath}`);
    if (!cleanDistPath.startsWith(path.resolve(DIST_DIR))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(cleanDistPath) && fs.statSync(cleanDistPath).isFile()) {
      return serveFile(res, cleanDistPath);
    }

    return serveFile(res, path.join(DIST_DIR, 'index.html'));
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || 'Внутренняя ошибка сервера' });
  }
});

hardenHttpServer(server);
server.listen(PORT, HOST, () => {
  console.log(`puls-tg-bot server running at http://${HOST}:${PORT}`);
});
