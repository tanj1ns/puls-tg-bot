'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./auth');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'puls.db');

const DEFAULT_ADMIN_SCRYPT =
  'b0eb81b9314c5f62618adf66b8588ccc:53233e49e233d440f43800bf6b3fba2f9b8a130fa361f7e6f07709500b9e091418320ac54f395a16475dad8684249478ab567d02bd4ecbf848f71f8495576b73';

function initDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      user_name TEXT NOT NULL,
      user_handle TEXT NOT NULL,
      chat_id TEXT DEFAULT '',
      topic TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      messages_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS faq_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_text TEXT NOT NULL,
      reply_text TEXT NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      segment TEXT NOT NULL,
      recipients INTEGER NOT NULL,
      body TEXT NOT NULL,
      sent_at TEXT NOT NULL
    );
  `);

  seed(db);
  return db;
}

function seed(db) {
  const now = new Date().toISOString();
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@puls-bot.ru').trim().toLowerCase();
  const adminHash = process.env.ADMIN_PASSWORD ? hashPassword(process.env.ADMIN_PASSWORD) : DEFAULT_ADMIN_SCRYPT;

  if (!db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)) {
    db.prepare('INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'Оператор ПУЛЬС',
      adminEmail,
      adminHash,
      'admin',
      now
    );
  }

  if (db.prepare('SELECT COUNT(*) AS cnt FROM faq_rules').get().cnt === 0) {
    const stmt = db.prepare('INSERT INTO faq_rules (trigger_text, reply_text, hits) VALUES (?, ?, ?)');
    stmt.run('/start', 'Привет! Я бот поддержки ПУЛЬС. Выберите быстрый вопрос кнопкой ниже или напишите менеджеру.', 428);
    stmt.run('Где мой заказ', 'Чтобы проверить статус доставки, введите номер заказа (например, SVR-2041) или нажмите «Связаться с оператором».', 194);
    stmt.run('Возврат', 'Возврат средств оформляется в течение 24 часов после обращения на ту же карту, с которой прошла оплата.', 87);
    stmt.run('Тарифы', 'Подписка ПУЛЬС PRO: 2 900 ₽/мес для 1 бота и до 5 операторов, без комиссии с тикетов.', 152);
  }

  if (db.prepare('SELECT COUNT(*) AS cnt FROM tickets').get().cnt === 0) {
    const stmt = db.prepare(
      'INSERT INTO tickets (code, user_name, user_handle, chat_id, topic, status, messages_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(
      'TK-812',
      'Артём Морозов',
      '@artem_m',
      '',
      'Доставка заказа',
      'open',
      JSON.stringify([
        { id: 1, sender: 'user', text: 'Здравствуйте! Подскажите, когда курьер привезёт заказ SVR-2041?', at: now },
        { id: 2, sender: 'bot', text: 'Проверяем отправление №SVR-2041 в СДЭК. Оператор уже подключился к диалогу.', at: now }
      ]),
      now
    );
    stmt.run(
      'TK-813',
      'Елена Соколова',
      '@elena_design',
      '',
      'Возврат размера',
      'pending',
      JSON.stringify([
        { id: 3, sender: 'user', text: 'Хочу обменять худи с размера M на L.', at: now },
        { id: 4, sender: 'operator', text: 'Принято! Оформили бесплатный обмен через ПВЗ. Придёт трек-код в течение часа.', at: now }
      ]),
      now
    );
    stmt.run(
      'TK-814',
      'Дмитрий К.',
      '@dmitriy_k',
      '',
      'Подключение бота',
      'resolved',
      JSON.stringify([
        { id: 5, sender: 'user', text: 'Какие тарифы для подключения к нашему магазину?', at: now },
        { id: 6, sender: 'bot', text: 'Подписка ПУЛЬС PRO: 2 900 ₽/мес для 1 бота и до 5 операторов, без комиссии с тикетов.', at: now }
      ]),
      now
    );
  }

  if (db.prepare('SELECT COUNT(*) AS cnt FROM campaigns').get().cnt === 0) {
    const stmt = db.prepare(
      'INSERT INTO campaigns (title, segment, recipients, body, sent_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run('Скидка 15% к новой коллекции', 'VIP-клиенты', 185, 'Закрытый ранний доступ к весеннему дропу по промокоду VIP15 уже открыт в боте.', now);
    stmt.run('Ускоренная доставка по Москве', 'Все подписчики', 1240, 'Теперь доставляем заказы, оформленные до 15:00, в этот же вечер.', now);
  }
}

module.exports = { initDatabase };
