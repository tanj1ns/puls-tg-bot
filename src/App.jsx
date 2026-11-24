import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCheck,
  Headphones,
  Megaphone,
  MessageCircle,
  Moon,
  PhoneCall,
  Send,
  Sun,
  User,
  X
} from 'lucide-react';
import {
  AUDIENCE_SEGMENTS,
  BOT_QUICK_ACTIONS,
  CANNED_REPLIES,
  TICKET_STATUS,
  formatPhone,
  isSecretAdminHash,
  pulsApi
} from './api';
import { createClientAuth } from './clientAuth';
import PrivacyModal from './components/PrivacyModal';
import AdminBot from './pages/AdminBot';
import ClientCabinet from './components/ClientCabinet';
import CookieBanner, { setCookie } from './components/CookieBanner';

const pulsClientAuth = createClientAuth({
  prefix: 'puls',
  demoSeed: {
    name: 'Артём Морозов',
    email: 'client@puls-bot.ru',
    phone: '+7 (916) 442-19-80',
    password: 'client12345',
    meta: {
      handle: '@artem_m',
      notifyTg: true,
      ticketCodes: ['TK-812']
    }
  }
});

export default function App() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  const [tickets, setTickets] = useState([]);
  const [faqRules, setFaqRules] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [botStatus, setBotStatus] = useState({ botConfigured: false, botPollingActive: false });
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  const [selectedTicketId, setSelectedTicketId] = useState(1);
  const [deskTab, setDeskTab] = useState('tickets');

  const [botInput, setBotInput] = useState('');
  const [operatorInput, setOperatorInput] = useState('');

  const [callbackOpen, setCallbackOpen] = useState(false);
  const [cbName, setCbName] = useState('');
  const [cbPhone, setCbPhone] = useState('');
  const [cbQuestion, setCbQuestion] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [consent, setConsent] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [cookieForceOpen, setCookieForceOpen] = useState(false);
  const [cbError, setCbError] = useState('');
  const [cbBusy, setCbBusy] = useState(false);
  const cbOpenedAt = useRef(Date.now());

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    setCookie('puls_theme', next);
    try {
      localStorage.setItem('puls_theme', next);
    } catch {}
  }

  async function refresh() {
    try {
      const res = await pulsApi.bootstrap();
      const nextTickets = res.tickets || [];
      setTickets(nextTickets);
      setFaqRules(res.faqRules || []);
      setCampaigns(res.campaigns || []);
      setBotStatus(res.botStatus || { botConfigured: false, botPollingActive: false });
      setUser(res.user || null);
      if (nextTickets.length && !nextTickets.some((t) => t.id === selectedTicketId)) {
        setSelectedTicketId(nextTickets[0].id);
      }
    } catch {}
  }

  useEffect(() => {
    refresh();
    pulsClientAuth
      .me()
      .then((res) => setClient(res.client || null))
      .catch(() => {});
    async function syncHash() {
      const ok = await isSecretAdminHash(window.location.hash);
      setIsAdminRoute(ok);
    }
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (!client) return;
    setCbName(client.name || '');
    setCbPhone(client.phone || '');
  }, [client]);

  useEffect(() => {
    if (callbackOpen) cbOpenedAt.current = Date.now();
  }, [callbackOpen]);

  const activeTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) || tickets[0] || null,
    [tickets, selectedTicketId]
  );

  async function handleBotSend(textOverride, startNewTicket = false) {
    const text = String(textOverride !== undefined ? textOverride : botInput).trim();
    if (!text) return;
    if (text === 'Связаться с оператором') {
      setCallbackOpen(true);
    }
    try {
      const res = await pulsApi.sendBotMessage({
        ticketId: startNewTicket ? null : activeTicket?.id,
        text,
        userName: client?.name,
        userHandle: client?.meta?.handle
      });
      setBotInput('');
      setTickets((prev) => {
        const exists = prev.some((t) => t.id === res.ticket.id);
        return exists ? prev.map((t) => (t.id === res.ticket.id ? res.ticket : t)) : [res.ticket, ...prev];
      });
      setSelectedTicketId(res.ticket.id);
      if (client && res.ticket?.code && !(client.meta?.ticketCodes || []).includes(res.ticket.code)) {
        const updated = await pulsClientAuth.appendCode('ticketCodes', res.ticket.code).catch(() => null);
        if (updated) setClient(updated);
      }
    } catch {}
  }

  async function handleOperatorReply(e) {
    e.preventDefault();
    if (!activeTicket || !operatorInput.trim()) return;
    try {
      const res = await pulsApi.replyTicket(activeTicket.id, operatorInput);
      setOperatorInput('');
      setTickets((prev) => prev.map((t) => (t.id === res.ticket.id ? res.ticket : t)));
    } catch {}
  }

  async function handleStatusChange(status) {
    if (!activeTicket) return;
    try {
      const res = await pulsApi.setTicketStatus(activeTicket.id, status);
      setTickets((prev) => prev.map((t) => (t.id === res.ticket.id ? res.ticket : t)));
    } catch {}
  }

  async function handleCallbackSubmit(e) {
    e.preventDefault();
    setCbError('');
    if (Date.now() - cbOpenedAt.current < 1200) {
      setCbError('Слишком быстрая отправка. Проверьте номер и повторите.');
      return;
    }
    setCbBusy(true);
    try {
      const res = await pulsApi.requestCallback({
        name: cbName,
        phone: cbPhone,
        question: cbQuestion,
        consent,
        website: honeypot
      });
      setTickets((prev) => [res.ticket, ...prev]);
      setSelectedTicketId(res.ticket.id);
      if (client && res.ticket?.code) {
        const updated = await pulsClientAuth.appendCode('ticketCodes', res.ticket.code).catch(() => null);
        if (updated) setClient(updated);
      }
      setCallbackOpen(false);
      setCbName('');
      setCbPhone('');
      setCbQuestion('');
      setConsent(false);
    } catch (err) {
      setCbError(err.message);
    } finally {
      setCbBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="header">
        <div className="container header__inner">
          <a
            href="#workspace"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              if (isAdminRoute) {
                window.location.hash = '';
                setIsAdminRoute(false);
              }
            }}
          >
            <span className="brand__icon">
              <Activity size={16} />
            </span>
            <span className="mono">ПУЛЬС // BOT DESK</span>
            <span className="online-dot" title="Сервер активен" />
          </a>

          {!isAdminRoute && (
            <nav className="console-tabs" aria-label="Разделы пульта">
              <button
                type="button"
                className={`console-tab ${deskTab === 'tickets' ? 'is-active' : ''}`}
                onClick={() => setDeskTab('tickets')}
              >
                <MessageCircle size={14} /> Диалоги ({tickets.length})
              </button>
              <button
                type="button"
                className={`console-tab ${deskTab === 'faq' ? 'is-active' : ''}`}
                onClick={() => setDeskTab('faq')}
              >
                <Bot size={14} /> Автоответы ({faqRules.length})
              </button>
              <button
                type="button"
                className={`console-tab ${deskTab === 'campaigns' ? 'is-active' : ''}`}
                onClick={() => setDeskTab('campaigns')}
              >
                <Megaphone size={14} /> Рассылки
              </button>
              <button
                type="button"
                className={`console-tab ${deskTab === 'account' ? 'is-active' : ''}`}
                onClick={() => setDeskTab('account')}
              >
                <User size={14} /> Кабинет
              </button>
            </nav>
          )}

          <div className="header__right">
            {!isAdminRoute && (
              <>
                <span className="sla-chip mono">1 240 подп. &bull; SLA 2 мин</span>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setCallbackOpen(true)}>
                  <PhoneCall size={14} /> Звонок
                </button>
              </>
            )}
            <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="Переключить тему">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      {isAdminRoute ? (
        <AdminBot
          user={user}
          tickets={tickets}
          faqRules={faqRules}
          campaigns={campaigns}
          botStatus={botStatus}
          onUserChange={setUser}
          onRefresh={refresh}
          onExit={() => {
            window.location.hash = '';
            setIsAdminRoute(false);
          }}
        />
      ) : (
        <main id="workspace" className="container workspace">
          {deskTab === 'account' ? (
            <ClientCabinet
              client={client}
              clientAuth={pulsClientAuth}
              tickets={tickets}
              onClientChange={setClient}
              onOpenTicket={(tid) => {
                setSelectedTicketId(tid);
                setDeskTab('tickets');
              }}
              onOpenCallback={() => setCallbackOpen(true)}
              onBackToDesk={() => setDeskTab('tickets')}
              onOpenPrivacy={() => setPrivacyOpen(true)}
            />
          ) : (
            <div className="split-grid">
            {/* LEFT: Live Telegram Bot Emulator */}
            <section className="tg-phone" aria-label="Эмулятор Telegram-бота">
              <div className="tg-phone__head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="tg-avatar">
                    <Bot size={17} />
                  </span>
                  <div>
                    <strong style={{ fontSize: '0.94rem', display: 'block', lineHeight: 1.15 }}>
                      @puls_support_bot
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
                      бот • мгновенный отклик
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => handleBotSend('/start', true)}
                >
                  /start
                </button>
              </div>

              <div className="tg-chat">
                {activeTicket ? (
                  <>
                    <div className="tg-date mono">
                      Тикет {activeTicket.code} &bull; {activeTicket.userHandle}
                    </div>
                    {activeTicket.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`bubble ${m.sender === 'user' ? 'bubble--user' : 'bubble--bot'}`}
                      >
                        {m.sender !== 'user' && (
                          <span className="bubble-role">
                            {m.sender === 'operator' ? 'Оператор' : 'Автобот'}
                          </span>
                        )}
                        <p>{m.text}</p>
                        <span className="bubble-time mono">
                          {new Date(m.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          {m.sender === 'user' && <CheckCheck size={12} style={{ marginLeft: 4 }} />}
                        </span>
                      </div>
                    ))}
                  </>
                ) : null}
              </div>

              <div className="tg-inline-keys">
                {BOT_QUICK_ACTIONS.map((act) => (
                  <button
                    key={act}
                    type="button"
                    className="inline-key"
                    onClick={() => handleBotSend(act)}
                  >
                    {act}
                  </button>
                ))}
              </div>

              <form
                className="tg-input-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleBotSend();
                }}
              >
                <input
                  className="input"
                  value={botInput}
                  onChange={(e) => setBotInput(e.target.value)}
                  placeholder="Написать боту как клиент..."
                />
                <button type="submit" className="btn btn--primary btn--sm" aria-label="Отправить в бот">
                  <Send size={15} />
                </button>
              </form>
            </section>

            {/* RIGHT: Operator Web Console */}
            <section className="panel operator-desk" aria-label="Пульт оператора">
              {deskTab === 'tickets' && (
                <div className="desk-tickets-layout">
                  <div className="tickets-sidebar">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong style={{ fontSize: '0.88rem' }}>Входящие тикеты</strong>
                      <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {tickets.length}
                      </span>
                    </div>
                    <div className="ticket-items">
                      {tickets.map((t) => {
                        const st = TICKET_STATUS[t.status] || TICKET_STATUS.open;
                        const active = activeTicket?.id === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className={`ticket-card ${active ? 'is-active' : ''}`}
                            onClick={() => setSelectedTicketId(t.id)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                              <strong className="mono">{t.code}</strong>
                              <span className={`status-pill ${st.cls}`}>{st.label}</span>
                            </div>
                            <div className="ticket-topic">{t.topic}</div>
                            <small>{t.userName} ({t.userHandle})</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {activeTicket && (
                    <div className="ticket-thread">
                      <div className="thread-head">
                        <div>
                          <span className="eyebrow" style={{ marginBottom: 2 }}>
                            <Headphones size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            Диалог {activeTicket.code}
                          </span>
                          <h2 style={{ fontSize: '1.12rem' }}>{activeTicket.userName}</h2>
                        </div>
                        <select
                          className="input select-sm"
                          value={activeTicket.status}
                          onChange={(e) => handleStatusChange(e.target.value)}
                          aria-label="Статус тикета"
                        >
                          <option value="open">Новый</option>
                          <option value="pending">В работе</option>
                          <option value="resolved">Решён</option>
                        </select>
                      </div>

                      <div className="thread-messages">
                        {activeTicket.messages.map((m) => (
                          <div key={m.id} className="thread-line">
                            <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--accent)' }}>
                              {m.sender === 'user' ? activeTicket.userHandle : m.sender === 'operator' ? 'Оператор' : 'Бот'}
                            </span>
                            <p style={{ fontSize: '0.88rem', marginTop: 2 }}>{m.text}</p>
                          </div>
                        ))}
                      </div>

                      <div className="canned-list">
                        {CANNED_REPLIES.map((tpl) => (
                          <button
                            key={tpl}
                            type="button"
                            className="canned-chip"
                            onClick={() => setOperatorInput(tpl)}
                          >
                            {tpl}
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleOperatorReply} style={{ display: 'flex', gap: 8 }}>
                        <input
                          className="input"
                          value={operatorInput}
                          onChange={(e) => setOperatorInput(e.target.value)}
                          placeholder="Ответить клиенту в Telegram от лица оператора..."
                        />
                        <button type="submit" className="btn btn--primary">
                          Ответить
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {deskTab === 'faq' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h2 style={{ fontSize: '1.18rem' }}>Активные триггеры автоответа</h2>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    При совпадении фразы в сообщении бот отвечает автоматически, снижая нагрузку на операторов.
                  </p>
                  {faqRules.map((r) => (
                    <div key={r.id} className="rule-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong className="mono">{r.triggerText}</strong>
                        <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Срабатываний: {r.hits}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: 4 }}>{r.replyText}</p>
                    </div>
                  ))}
                </div>
              )}

              {deskTab === 'campaigns' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h2 style={{ fontSize: '1.18rem' }}>Сегменты подписчиков и рассылки</h2>
                  <div className="segments-grid">
                    {AUDIENCE_SEGMENTS.map((s) => (
                      <div key={s.label} className="segment-card">
                        <span>{s.label}</span>
                        <strong className="mono">{s.count}</strong>
                      </div>
                    ))}
                  </div>
                  <h3 style={{ fontSize: '0.96rem', marginTop: 4 }}>Журнал отправленных кампаний</h3>
                  {campaigns.map((c) => (
                    <div key={c.id} className="rule-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <strong>{c.title}</strong>
                        <span className="status-pill status--live mono">{c.segment} &bull; {c.recipients} чел.</span>
                      </div>
                      <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: 6 }}>{c.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          )}
        </main>
      )}

      {callbackOpen && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCallbackOpen(false)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-label="Обратный звонок оператора">
            <div className="modal-head">
              <h3 style={{ fontSize: '1.08rem' }}>Запрос связи с оператором</h3>
              <button type="button" className="icon-btn" onClick={() => setCallbackOpen(false)} aria-label="Закрыть">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCallbackSubmit} className="form">
              <div className="field">
                <label>Ваше имя</label>
                <input
                  className="input"
                  value={cbName}
                  onChange={(e) => setCbName(e.target.value)}
                  placeholder="Кирилл Орлов"
                  required
                />
              </div>
              <div className="field">
                <label>Телефон</label>
                <input
                  className="input mono"
                  value={cbPhone}
                  onChange={(e) => setCbPhone(formatPhone(e.target.value))}
                  placeholder="+7 (999) 000-00-00"
                  required
                />
              </div>
              <div className="field">
                <label>Вопрос</label>
                <input
                  className="input"
                  value={cbQuestion}
                  onChange={(e) => setCbQuestion(e.target.value)}
                  placeholder="Статус заказа или подключение тарифа"
                />
              </div>

              <div className="hp-trap" aria-hidden="true">
                <label htmlFor="hp-puls">Ваш сайт</label>
                <input
                  id="hp-puls"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              <label className="consent-check">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  Согласен с{' '}
                  <button type="button" className="link-inline" onClick={() => setPrivacyOpen(true)}>
                    обработкой персональных данных (152-ФЗ)
                  </button>
                </span>
              </label>

              {cbError && <div className="status-msg status-msg--err">{cbError}</div>}

              <button type="submit" className="btn btn--primary" disabled={cbBusy}>
                {cbBusy ? 'Создаём тикет...' : 'Создать тикет и заказать звонок'}
              </button>
            </form>
          </div>
        </div>
      )}

      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}

      <CookieBanner
        prefix="puls"
        forceOpen={cookieForceOpen}
        onCloseForce={() => setCookieForceOpen(false)}
        onOpenPrivacy={() => setPrivacyOpen(true)}
      />

      <footer className="footer">
        <div className="container footer__inner">
          <span>&copy; 2026 ПУЛЬС — Автоматизация клиентского сервиса в Telegram</span>
          <span className="footer__meta">
            <span>Node.js + Telegram Bot API + React</span>
            <span aria-hidden="true">·</span>
            <button type="button" className="link-inline" onClick={() => setPrivacyOpen(true)}>Политика cookie</button>
            <span aria-hidden="true">·</span>
            <button type="button" className="link-inline" onClick={() => setCookieForceOpen(true)}>Настройки cookie</button>
          </span>
        </div>
      </footer>
    </div>
  );
}
