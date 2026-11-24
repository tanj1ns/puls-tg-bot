'use strict';

const https = require('node:https');

const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
let pollingActive = false;
let offset = 0;

function tgApiCall(method, payload = {}) {
  if (!BOT_TOKEN) return Promise.resolve(null);
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${BOT_TOKEN}/${method}`,
        method: 'POST',
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            resolve(parsed);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN || !chatId) return false;
  const res = await tgApiCall('sendMessage', { chat_id: chatId, text });
  return Boolean(res?.ok);
}

function getBotStatus() {
  return {
    botConfigured: Boolean(BOT_TOKEN),
    botPollingActive: pollingActive
  };
}

function startBotPolling(onUpdate) {
  if (!BOT_TOKEN || pollingActive) return;
  pollingActive = true;

  async function loop() {
    while (pollingActive) {
      const res = await tgApiCall('getUpdates', { offset, timeout: 10 });
      if (res?.ok && Array.isArray(res.result)) {
        for (const upd of res.result) {
          offset = Math.max(offset, upd.update_id + 1);
          const msg = upd.message;
          if (msg && msg.text && typeof onUpdate === 'function') {
            try {
              onUpdate(msg);
            } catch {}
          }
        }
      }
      await new Promise((r) => setTimeout(r, 2500));
    }
  }

  loop().catch(() => {
    pollingActive = false;
  });
}

module.exports = {
  sendTelegramMessage,
  startBotPolling,
  getBotStatus
};
