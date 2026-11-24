# ПУЛЬС — Telegram-бот поддержки и пульт оператора

Двухсторонняя система автоматизации поддержки в Telegram: встроенный эмулятор бота для теста сценариев, тикет-система с быстрыми ответами оператора, база FAQ-правил, сегментные рассылки и нативный long-polling клиент Telegram Bot API на Node.js (`node:https`).

- **Стек:** React 19, Vite 6, Lucide Icons, Node.js (`http`, `https`, `node:sqlite`).
- **Переменные окружения на сервере:** `TELEGRAM_BOT_TOKEN` (опционально для живого Telegram-поллинга), `PORT=4005`, `HOST=0.0.0.0`, `DATA_DIR=/data`.
- **Безопасность:** `HttpOnly`-сессии, `scrypt` + `timingSafeEqual`, rate limiting, CSRF проверка `Origin/Host`, строгий CSP (`script-src 'self'`), honeypot `.hp-trap`, согласие 152-ФЗ, `robots.txt`.
