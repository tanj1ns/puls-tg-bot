const SECRET_ROUTE_SALT = 'puls-route-v1:';
const SECRET_ROUTE_HASH = 'ede154caff990414e59644390935663317270dbb4cb4b77742aa3b9a8b4dedc2';

const ADMIN_EMAIL = 'admin@puls-bot.ru';
const ADMIN_PASS_SALT = 'puls-adm-v1:';
const ADMIN_PASS_HASH = 'b9d18ddd77079434bddfbd06b590fafc0f09711ef1d4c3ad68b016010bf160a9';

const STATIC_DB_KEY = 'puls_static_db_v1';
const STATIC_SESSION_KEY = 'puls_static_admin_v1';
const LOGIN_GUARD_KEY = 'puls_login_guard_v1';

let staticModeFlag = null;

export const TICKET_STATUS = {
  open: { label: 'Новый', cls: 'status--wip' },
  pending: { label: 'В работе', cls: 'status--accent' },
  resolved: { label: 'Решён', cls: 'status--live' }
};

export const BOT_QUICK_ACTIONS = [
  'Где мой заказ',
  'Возврат средств',
  'Тарифы подключения',
  'Связаться с оператором'
];

export const CANNED_REPLIES = [
  'Уточняем трек у СДЭК, вернёмся через 5 минут.',
  'Оформили возврат, электронный чек придёт на почту.',
  'Отправили приглашение для подключения бота на ваш email.'
];

export const AUDIENCE_SEGMENTS = [
  { label: 'Все подписчики', count: 1240 },
  { label: 'VIP-клиенты', count: 185 },
  { label: 'Ожидают заказ', count: 64 }
];

export function isStaticHost() {
  if (staticModeFlag !== null) return staticModeFlag;
  return window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
}

export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str || '')));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isSecretAdminHash(hashStr) {
  const clean = String(hashStr || '')
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '')
    .trim();
  if (!clean) return false;
  return (await sha256Hex(SECRET_ROUTE_SALT + clean)) === SECRET_ROUTE_HASH;
}

export function formatPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits[0] === '8' || digits[0] === '7') digits = '7' + digits.slice(1);
  else digits = '7' + digits;
  digits = digits.slice(0, 11);

  let out = '+7';
  if (digits.length > 1) out += ' (' + digits.slice(1, 4);
  if (digits.length > 4) out += ') ' + digits.slice(4, 7);
  if (digits.length > 7) out += '-' + digits.slice(7, 9);
  if (digits.length > 9) out += '-' + digits.slice(9, 11);
  return out;
}

function getInitialStaticDb() {
  const now = new Date().toISOString();
  return {
    nextId: 10,
    faqRules: [
      { id: 1, triggerText: '/start', replyText: 'Привет! Я бот поддержки ПУЛЬС. Выберите быстрый вопрос кнопкой ниже или напишите менеджеру.', hits: 428 },
      { id: 2, triggerText: 'Где мой заказ', replyText: 'Чтобы проверить статус доставки, введите номер заказа (например, SVR-2041) или нажмите «Связаться с оператором».', hits: 194 },
      { id: 3, triggerText: 'Возврат', replyText: 'Возврат средств оформляется в течение 24 часов после обращения на ту же карту, с которой прошла оплата.', hits: 87 },
      { id: 4, triggerText: 'Тарифы', replyText: 'Подписка ПУЛЬС PRO: 2 900 ₽/мес для 1 бота и до 5 операторов, без комиссии с тикетов.', hits: 152 }
    ],
    tickets: [
      {
        id: 1,
        code: 'TK-812',
        userName: 'Артём Морозов',
        userHandle: '@artem_m',
        topic: 'Доставка заказа',
        status: 'open',
        messages: [
          { id: 1, sender: 'user', text: 'Здравствуйте! Подскажите, когда курьер привезёт заказ SVR-2041?', at: now },
          { id: 2, sender: 'bot', text: 'Проверяем отправление №SVR-2041 в СДЭК. Оператор уже подключился к диалогу.', at: now }
        ],
        updatedAt: now
      },
      {
        id: 2,
        code: 'TK-813',
        userName: 'Елена Соколова',
        userHandle: '@elena_design',
        topic: 'Возврат размера',
        status: 'pending',
        messages: [
          { id: 3, sender: 'user', text: 'Хочу обменять худи с размера M на L.', at: now },
          { id: 4, sender: 'operator', text: 'Принято! Оформили бесплатный обмен через ПВЗ. Придёт трек-код в течение часа.', at: now }
        ],
        updatedAt: now
      },
      {
        id: 3,
        code: 'TK-814',
        userName: 'Дмитрий К.',
        userHandle: '@dmitriy_k',
        topic: 'Подключение бота',
        status: 'resolved',
        messages: [
          { id: 5, sender: 'user', text: 'Какие тарифы для подключения к нашему магазину?', at: now },
          { id: 6, sender: 'bot', text: 'Подписка ПУЛЬС PRO: 2 900 ₽/мес для 1 бота и до 5 операторов, без комиссии с тикетов.', at: now }
        ],
        updatedAt: now
      }
    ],
    campaigns: [
      { id: 1, title: 'Скидка 15% к новой коллекции', segment: 'VIP-клиенты', recipients: 185, body: 'Закрытый ранний доступ к весеннему дропу по промокоду VIP15 уже открыт в боте.', sentAt: now },
      { id: 2, title: 'Ускоренная доставка по Москве', segment: 'Все подписчики', recipients: 1240, body: 'Теперь доставляем заказы, оформленные до 15:00, в этот же вечер.', sentAt: now }
    ]
  };
}

function readStaticDb() {
  try {
    const raw = localStorage.getItem(STATIC_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tickets) && Array.isArray(parsed.faqRules)) return parsed;
    }
  } catch {}
  const init = getInitialStaticDb();
  localStorage.setItem(STATIC_DB_KEY, JSON.stringify(init));
  return init;
}

function writeStaticDb(db) {
  localStorage.setItem(STATIC_DB_KEY, JSON.stringify(db));
}

function getStaticUser() {
  try {
    const raw = sessionStorage.getItem(STATIC_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function reqJson(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Сервер вернул некорректный ответ');
  }
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `Ошибка ${res.status}`);
  }
  return data;
}

export const pulsApi = {
  async bootstrap() {
    if (isStaticHost()) {
      const db = readStaticDb();
      return {
        ok: true,
        tickets: db.tickets,
        faqRules: db.faqRules,
        campaigns: db.campaigns,
        botStatus: { botConfigured: false, botPollingActive: false },
        user: getStaticUser()
      };
    }
    try {
      const res = await reqJson('./api/bootstrap');
      staticModeFlag = false;
      return res;
    } catch {
      staticModeFlag = true;
      const db = readStaticDb();
      return {
        ok: true,
        tickets: db.tickets,
        faqRules: db.faqRules,
        campaigns: db.campaigns,
        botStatus: { botConfigured: false, botPollingActive: false },
        user: getStaticUser()
      };
    }
  },

  async sendBotMessage(payload) {
    if (isStaticHost()) {
      const text = String(payload.text || '').trim();
      if (!text) throw new Error('Введите сообщение');
      const db = readStaticDb();
      const now = new Date().toISOString();
      const lower = text.toLowerCase();
      let autoReply = null;
      for (const r of db.faqRules) {
        if (lower.includes(r.triggerText.toLowerCase())) {
          r.hits = Number(r.hits || 0) + 1;
          autoReply = r.replyText;
          break;
        }
      }

      let ticket = payload.ticketId ? db.tickets.find((t) => t.id === Number(payload.ticketId)) : null;
      if (!ticket) {
        const id = db.nextId++;
        ticket = {
          id,
          code: `TK-${810 + id}`,
          userName: String(payload.userName || 'Гость демо').trim(),
          userHandle: String(payload.userHandle || '@demo_guest').trim(),
          topic: text.slice(0, 42),
          status: autoReply ? 'pending' : 'open',
          messages: [{ id: Date.now(), sender: 'user', text, at: now }],
          updatedAt: now
        };
        if (autoReply) ticket.messages.push({ id: Date.now() + 1, sender: 'bot', text: autoReply, at: now });
        db.tickets.unshift(ticket);
      } else {
        ticket.messages.push({ id: Date.now(), sender: 'user', text, at: now });
        if (autoReply) ticket.messages.push({ id: Date.now() + 1, sender: 'bot', text: autoReply, at: now });
        if (ticket.status === 'resolved') ticket.status = 'open';
        ticket.updatedAt = now;
      }
      writeStaticDb(db);
      return { ok: true, ticket };
    }
    return reqJson('./api/bot/message', { method: 'POST', body: JSON.stringify(payload) });
  },

  async requestCallback(payload) {
    if (String(payload.website || '').trim() !== '') {
      return { ok: true, ticket: { id: 0, code: 'TK-999' } };
    }
    if (!payload.consent) {
      throw new Error('Подтвердите согласие на обработку персональных данных (152-ФЗ).');
    }
    if (isStaticHost()) {
      const name = String(payload.name || '').trim();
      const phone = String(payload.phone || '').trim();
      if (name.length < 2 || phone.replace(/\D/g, '').length < 11) {
        throw new Error('Укажите имя и телефон (+7)');
      }
      const db = readStaticDb();
      const now = new Date().toISOString();
      const id = db.nextId++;
      const code = `TK-${810 + id}`;
      const ticket = {
        id,
        code,
        userName: name,
        userHandle: phone,
        topic: 'Обратный звонок',
        status: 'open',
        messages: [
          { id: Date.now(), sender: 'user', text: `Обратный звонок: ${phone}. Вопрос: ${payload.question || 'Нужна помощь'}`, at: now },
          { id: Date.now() + 1, sender: 'bot', text: `Тикет ${code} создан! Оператор свяжется с вами по номеру ${phone}.`, at: now }
        ],
        updatedAt: now
      };
      db.tickets.unshift(ticket);
      writeStaticDb(db);
      return { ok: true, ticket };
    }
    return reqJson('./api/tickets/callback', { method: 'POST', body: JSON.stringify(payload) });
  },

  async replyTicket(id, text) {
    if (isStaticHost()) {
      const clean = String(text || '').trim();
      if (!clean) throw new Error('Введите ответ');
      const db = readStaticDb();
      const target = db.tickets.find((t) => t.id === Number(id));
      if (!target) throw new Error('Тикет не найден');
      const now = new Date().toISOString();
      target.messages.push({ id: Date.now(), sender: 'operator', text: clean, at: now });
      target.status = 'pending';
      target.updatedAt = now;
      writeStaticDb(db);
      return { ok: true, ticket: target };
    }
    return reqJson(`./api/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ text }) });
  },

  async setTicketStatus(id, status) {
    if (isStaticHost()) {
      const db = readStaticDb();
      const target = db.tickets.find((t) => t.id === Number(id));
      if (!target) throw new Error('Тикет не найден');
      target.status = status;
      target.updatedAt = new Date().toISOString();
      writeStaticDb(db);
      return { ok: true, ticket: target };
    }
    return reqJson(`./api/tickets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },

  async login(email, password) {
    if (isStaticHost()) {
      let guard = { count: 0, lockedUntil: 0 };
      try {
        guard = JSON.parse(localStorage.getItem(LOGIN_GUARD_KEY) || '{}');
      } catch {}
      if (guard.lockedUntil && guard.lockedUntil > Date.now()) {
        const sec = Math.ceil((guard.lockedUntil - Date.now()) / 1000);
        throw new Error(`Слишком много попыток входа. Повторите через ${sec} сек.`);
      }
      await new Promise((r) => setTimeout(r, 450));
      const cleanEmail = String(email || '').trim().toLowerCase();
      const passHash = await sha256Hex(ADMIN_PASS_SALT + String(password || ''));
      if (cleanEmail !== ADMIN_EMAIL || passHash !== ADMIN_PASS_HASH) {
        const count = Number(guard.count || 0) + 1;
        const next = count >= 5 ? { count: 0, lockedUntil: Date.now() + 5 * 60_000 } : { count, lockedUntil: 0 };
        localStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(next));
        throw new Error('Неверный email или пароль');
      }
      localStorage.removeItem(LOGIN_GUARD_KEY);
      const user = { id: 1, name: 'Оператор ПУЛЬС', email: ADMIN_EMAIL, role: 'admin' };
      sessionStorage.setItem(STATIC_SESSION_KEY, JSON.stringify(user));
      return { ok: true, user };
    }
    return reqJson('./api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  async logout() {
    if (isStaticHost()) {
      sessionStorage.removeItem(STATIC_SESSION_KEY);
      return { ok: true };
    }
    return reqJson('./api/auth/logout', { method: 'POST' });
  },

  async addFaqRule(payload) {
    if (isStaticHost()) {
      const db = readStaticDb();
      const rule = {
        id: db.nextId++,
        triggerText: String(payload.triggerText || '').trim(),
        replyText: String(payload.replyText || '').trim(),
        hits: 0
      };
      db.faqRules.push(rule);
      writeStaticDb(db);
      return { ok: true, rule };
    }
    return reqJson('./api/admin/faq', { method: 'POST', body: JSON.stringify(payload) });
  },

  async deleteFaqRule(id) {
    if (isStaticHost()) {
      const db = readStaticDb();
      db.faqRules = db.faqRules.filter((r) => r.id !== Number(id));
      writeStaticDb(db);
      return { ok: true };
    }
    return reqJson(`./api/admin/faq/${id}`, { method: 'DELETE' });
  },

  async sendCampaign(payload) {
    if (isStaticHost()) {
      const db = readStaticDb();
      const seg = AUDIENCE_SEGMENTS.find((s) => s.label === payload.segment) || AUDIENCE_SEGMENTS[0];
      const campaign = {
        id: db.nextId++,
        title: String(payload.title || '').trim(),
        segment: seg.label,
        recipients: seg.count,
        body: String(payload.body || '').trim(),
        sentAt: new Date().toISOString()
      };
      db.campaigns.unshift(campaign);
      writeStaticDb(db);
      return { ok: true, campaign };
    }
    return reqJson('./api/admin/campaigns', { method: 'POST', body: JSON.stringify(payload) });
  },

  async deleteTicket(id) {
    if (isStaticHost()) {
      const db = readStaticDb();
      db.tickets = db.tickets.filter((t) => t.id !== Number(id));
      writeStaticDb(db);
      return { ok: true };
    }
    return reqJson(`./api/admin/tickets/${id}`, { method: 'DELETE' });
  }
};
