import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Headphones, LogOut, MessageCircle, PhoneCall, UserCheck } from 'lucide-react';
import { TICKET_STATUS } from '../api';
import { formatClientPhone } from '../clientAuth';

export default function ClientCabinet({
  client,
  clientAuth,
  tickets,
  onClientChange,
  onOpenTicket,
  onOpenCallback,
  onBackToDesk,
  onOpenPrivacy
}) {
  const [authTab, setAuthTab] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authMsg, setAuthMsg] = useState({ type: '', text: '' });
  const [authBusy, setAuthBusy] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regHandle, setRegHandle] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regWebsite, setRegWebsite] = useState('');
  const [regConsent, setRegConsent] = useState(false);
  const regOpenedAt = useRef(Date.now());

  const [profName, setProfName] = useState('');
  const [profHandle, setProfHandle] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profNotifyTg, setProfNotifyTg] = useState(true);
  const [profMsg, setProfMsg] = useState({ type: '', text: '' });
  const [profBusy, setProfBusy] = useState(false);

  useEffect(() => {
    if (authTab === 'register') regOpenedAt.current = Date.now();
  }, [authTab]);

  useEffect(() => {
    if (!client) return;
    setProfName(client.name || '');
    setProfHandle(client.meta?.handle || '');
    setProfPhone(client.phone || '');
    setProfNotifyTg(client.meta?.notifyTg !== false);
  }, [client]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthMsg({ type: '', text: '' });
    setAuthBusy(true);
    try {
      const res = await clientAuth.login(loginEmail, loginPassword);
      onClientChange(res.client);
      setLoginPassword('');
    } catch (err) {
      setAuthMsg({ type: 'err', text: err.message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setAuthMsg({ type: '', text: '' });
    setAuthBusy(true);
    try {
      const normalizedHandle = regHandle.trim()
        ? regHandle.trim().startsWith('@') ? regHandle.trim() : `@${regHandle.trim()}`
        : '@telegram_user';
      const res = await clientAuth.register({
        name: regName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        meta: { handle: normalizedHandle, notifyTg: true, ticketCodes: [] },
        consent: regConsent,
        website: regWebsite,
        elapsedMs: Date.now() - regOpenedAt.current
      });
      if (res.client) onClientChange(res.client);
      setRegPassword('');
    } catch (err) {
      setAuthMsg({ type: 'err', text: err.message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfMsg({ type: '', text: '' });
    setProfBusy(true);
    try {
      const cleanHandle = profHandle.trim()
        ? profHandle.trim().startsWith('@') ? profHandle.trim() : `@${profHandle.trim()}`
        : '';
      const res = await clientAuth.updateProfile({
        name: profName,
        phone: profPhone,
        meta: { handle: cleanHandle, notifyTg: profNotifyTg }
      });
      onClientChange(res.client);
      setProfMsg({ type: 'ok', text: 'Профиль абонента обновлён.' });
    } catch (err) {
      setProfMsg({ type: 'err', text: err.message });
    } finally {
      setProfBusy(false);
    }
  }

  async function handleLogout() {
    await clientAuth.logout().catch(() => {});
    onClientChange(null);
  }

  function fillDemoClient() {
    setAuthTab('login');
    setLoginEmail('client@puls-bot.ru');
    setLoginPassword('client12345');
    setAuthMsg({ type: 'ok', text: 'Подставлены данные демо-абонента' });
  }

  const savedCodes = Array.isArray(client?.meta?.ticketCodes) ? client.meta.ticketCodes : [];
  const clientTickets = client
    ? tickets.filter(
        (t) =>
          savedCodes.includes(t.code) ||
          (client.meta?.handle && t.userHandle === client.meta.handle) ||
          t.userName === client.name
      )
    : [];

  return (
    <div>
      <div className="cab-head">
        <div>
          <span className="eyebrow">Портал абонента ПУЛЬС</span>
          <h1 style={{ fontSize: '1.35rem' }}>
            {client ? `Личный кабинет · ${client.name}` : 'Личный кабинет абонента'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--outline btn--sm" onClick={onBackToDesk}>
            <ArrowLeft size={14} /> В пульт диалогов
          </button>
          {client && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
              <LogOut size={14} /> Выйти
            </button>
          )}
        </div>
      </div>

      {!client ? (
        <div className="auth-layout">
          <div className="panel">
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              <button
                type="button"
                className={`console-tab ${authTab === 'login' ? 'is-active' : ''}`}
                style={{ border: '1px solid var(--border)' }}
                onClick={() => {
                  setAuthTab('login');
                  setAuthMsg({ type: '', text: '' });
                }}
              >
                Вход
              </button>
              <button
                type="button"
                className={`console-tab ${authTab === 'register' ? 'is-active' : ''}`}
                style={{ border: '1px solid var(--border)' }}
                onClick={() => {
                  setAuthTab('register');
                  setAuthMsg({ type: '', text: '' });
                }}
              >
                Регистрация абонента
              </button>
            </div>

            {authTab === 'login' ? (
              <form className="form" onSubmit={handleLogin}>
                <div className="field">
                  <label htmlFor="plsLoginEmail">Email</label>
                  <input
                    id="plsLoginEmail"
                    type="email"
                    className="input mono"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="client@puls-bot.ru"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="field">
                  <label htmlFor="plsLoginPass">Пароль</label>
                  <input
                    id="plsLoginPass"
                    type="password"
                    className="input"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Введите пароль"
                    required
                    autoComplete="current-password"
                  />
                </div>
                {authMsg.text && (
                  <div className={`status-msg ${authMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                    {authMsg.text}
                  </div>
                )}
                <button type="submit" className="btn btn--primary" disabled={authBusy}>
                  {authBusy ? 'Входим...' : 'Войти'}
                </button>
              </form>
            ) : (
              <form className="form" onSubmit={handleRegister}>
                <div className="field">
                  <label htmlFor="plsRegName">Имя *</label>
                  <input
                    id="plsRegName"
                    className="input"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Артём Морозов"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="plsRegHandle">Telegram @username</label>
                  <input
                    id="plsRegHandle"
                    className="input mono"
                    value={regHandle}
                    onChange={(e) => setRegHandle(e.target.value)}
                    placeholder="@artem_m"
                  />
                </div>
                <div className="field">
                  <label htmlFor="plsRegEmail">Email *</label>
                  <input
                    id="plsRegEmail"
                    type="email"
                    className="input mono"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="plsRegPhone">Телефон</label>
                  <input
                    id="plsRegPhone"
                    type="tel"
                    className="input mono"
                    value={regPhone}
                    onChange={(e) => setRegPhone(formatClientPhone(e.target.value))}
                    placeholder="+7 (999) 000-00-00"
                  />
                </div>
                <div className="field">
                  <label htmlFor="plsRegPass">Пароль (от 6 символов) *</label>
                  <input
                    id="plsRegPass"
                    type="password"
                    className="input"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <div className="hp-trap" aria-hidden="true">
                  <label htmlFor="plsRegTrap">Ваш сайт</label>
                  <input
                    id="plsRegTrap"
                    tabIndex={-1}
                    autoComplete="off"
                    value={regWebsite}
                    onChange={(e) => setRegWebsite(e.target.value)}
                  />
                </div>
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={regConsent}
                    onChange={(e) => setRegConsent(e.target.checked)}
                    required
                  />
                  <span>
                    Согласен с{' '}
                    <button type="button" className="link-inline" onClick={onOpenPrivacy}>152-ФЗ</button>
                  </span>
                </label>
                {authMsg.text && (
                  <div className={`status-msg ${authMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                    {authMsg.text}
                  </div>
                )}
                <button type="submit" className="btn btn--primary" disabled={authBusy}>
                  {authBusy ? 'Регистрируем...' : 'Зарегистрироваться'}
                </button>
              </form>
            )}
          </div>

          <aside className="panel demo-creds">
            <div>
              <span className="eyebrow">Демо-доступ</span>
              <h2 style={{ fontSize: '1.08rem', marginBottom: 6 }}>История обращений абонента</h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Просматривайте ответы операторов по вашим тикетам, настраивайте уведомления и переходите прямо к диалогу в боте.
              </p>
            </div>
            <div className="demo-creds__box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong>Тестовый абонент</strong>
                <span className="status-pill status--live">КЛИЕНТ</span>
              </div>
              <div className="mono" style={{ fontSize: '0.8rem' }}>Email: client@puls-bot.ru</div>
              <div className="mono" style={{ fontSize: '0.8rem', marginBottom: 10 }}>Пароль: client12345</div>
              <button type="button" className="btn btn--outline btn--sm" onClick={fillDemoClient}>
                Подставить данные клиента
              </button>
            </div>
          </aside>
        </div>
      ) : (
        <div className="cab-grid">
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.06rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={16} color="var(--accent)" /> Профиль абонента
              </h2>
              <span className="status-pill status--live">КЛИЕНТ</span>
            </div>
            <form className="form" onSubmit={handleProfileSave}>
              <div className="field">
                <label>Email</label>
                <input className="input mono" value={client.email} disabled />
              </div>
              <div className="field">
                <label htmlFor="plsProfName">Имя</label>
                <input
                  id="plsProfName"
                  className="input"
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="plsProfHandle">Telegram @handle</label>
                <input
                  id="plsProfHandle"
                  className="input mono"
                  value={profHandle}
                  onChange={(e) => setProfHandle(e.target.value)}
                  placeholder="@artem_m"
                />
              </div>
              <div className="field">
                <label htmlFor="plsProfPhone">Телефон</label>
                <input
                  id="plsProfPhone"
                  type="tel"
                  className="input mono"
                  value={profPhone}
                  onChange={(e) => setProfPhone(formatClientPhone(e.target.value))}
                />
              </div>
              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={profNotifyTg}
                  onChange={(e) => setProfNotifyTg(e.target.checked)}
                />
                <span>Получать уведомления о статусе тикетов в Telegram</span>
              </label>
              {profMsg.text && (
                <div className={`status-msg ${profMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                  {profMsg.text}
                </div>
              )}
              <button type="submit" className="btn btn--primary" disabled={profBusy}>
                {profBusy ? 'Сохраняем...' : 'Сохранить профиль'}
              </button>
            </form>
          </div>

          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.06rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Headphones size={16} color="var(--accent)" /> Мои обращения ({clientTickets.length})
              </h2>
              <button type="button" className="btn btn--outline btn--sm" onClick={onOpenCallback}>
                <PhoneCall size={13} /> Заказать звонок
              </button>
            </div>

            {clientTickets.length === 0 ? (
              <div className="cab-item">
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  У вас пока нет обращений. Откройте эмулятор бота или закажите обратный звонок.
                </p>
              </div>
            ) : (
              <div className="cab-list">
                {clientTickets.map((t) => {
                  const st = TICKET_STATUS[t.status] || TICKET_STATUS.open;
                  const lastMsg = (t.messages || [])[t.messages.length - 1];
                  return (
                    <article key={t.id} className="cab-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong className="mono">{t.code}</strong>
                        <span className={`status-pill ${st.cls}`}>{st.label}</span>
                      </div>
                      <h3 style={{ fontSize: '0.94rem' }}>{t.topic}</h3>
                      {lastMsg && (
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          <strong>{lastMsg.sender === 'operator' ? 'Оператор' : lastMsg.sender === 'bot' ? 'Бот' : 'Вы'}:</strong>{' '}
                          {lastMsg.text}
                        </p>
                      )}
                      <div>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={() => onOpenTicket(t.id)}
                        >
                          <MessageCircle size={13} /> Открыть в пульте
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
