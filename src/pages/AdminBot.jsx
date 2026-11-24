import React, { useState } from 'react';
import { ArrowLeft, Bot, LogOut, Plus, Send, Shield, Trash2 } from 'lucide-react';
import { AUDIENCE_SEGMENTS, TICKET_STATUS, pulsApi } from '../api';

export default function AdminBot({
  user,
  tickets,
  faqRules,
  campaigns,
  botStatus,
  onUserChange,
  onRefresh,
  onExit
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const [triggerText, setTriggerText] = useState('');
  const [replyText, setReplyText] = useState('');

  const [campTitle, setCampTitle] = useState('');
  const [campSegment, setCampSegment] = useState(AUDIENCE_SEGMENTS[0].label);
  const [campBody, setCampBody] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await pulsApi.login(email, password);
      onUserChange(res.user);
      setPassword('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await pulsApi.logout();
    onUserChange(null);
  }

  async function handleAddFaq(e) {
    e.preventDefault();
    await pulsApi.addFaqRule({ triggerText, replyText });
    setTriggerText('');
    setReplyText('');
    setMsg('Правило автоответа добавлено');
    await onRefresh();
  }

  async function handleDeleteFaq(id) {
    await pulsApi.deleteFaqRule(id);
    setMsg('Правило удалено');
    await onRefresh();
  }

  async function handleSendCampaign(e) {
    e.preventDefault();
    await pulsApi.sendCampaign({ title: campTitle, segment: campSegment, body: campBody });
    setCampTitle('');
    setCampBody('');
    setMsg('Рассылка поставлена в очередь и зафиксирована в журнале');
    await onRefresh();
  }

  async function handleDeleteTicket(id) {
    await pulsApi.deleteTicket(id);
    setMsg('Тикет удалён');
    await onRefresh();
  }

  if (!user) {
    return (
      <section className="container admin-wrap">
        <div className="admin-login">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="eyebrow" style={{ marginBottom: 0 }}>
              <Shield size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
              Закрытые настройки бота
            </span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onExit}>
              <ArrowLeft size={14} /> В пульт
            </button>
          </div>
          <h2 style={{ fontSize: '1.28rem' }}>Панель администратора ПУЛЬС</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Редактирование правил FAQ, запуск массовых рассылок и управление базой тикетов.
          </p>
          <form onSubmit={handleLogin} className="form">
            <div className="field">
              <label>Email</label>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {authError && <div className="status-msg status-msg--err">{authError}</div>}
            <button type="submit" className="btn btn--primary" disabled={authLoading}>
              {authLoading ? 'Вход...' : 'Войти'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="container admin-wrap">
      <div className="admin-header">
        <div>
          <span className="eyebrow">Конфигурация бота</span>
          <h2 style={{ fontSize: '1.45rem' }}>Настройки ПУЛЬС</h2>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`status-pill ${botStatus?.botConfigured ? 'status--live' : 'status--wip'}`}>
            <Bot size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {botStatus?.botConfigured
              ? botStatus.botPollingActive
                ? 'Telegram Bot API: Active Polling'
                : 'Telegram Bot API: Token Configured'
              : 'Режим интерактивного эмулятора'}
          </span>
          <button type="button" className="btn btn--outline btn--sm" onClick={onExit}>
            <ArrowLeft size={14} /> Вернуться в консоль
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
            <LogOut size={14} /> Выйти
          </button>
        </div>
      </div>

      {msg && <div className="status-msg status-msg--ok" style={{ marginBottom: 14 }}>{msg}</div>}

      <div className="admin-grid">
        <div className="panel form">
          <h3 style={{ fontSize: '1rem' }}>Новое правило FAQ-бота</h3>
          <form onSubmit={handleAddFaq} className="form">
            <div className="field">
              <label>Ключевое слово или команда</label>
              <input
                className="input"
                value={triggerText}
                onChange={(e) => setTriggerText(e.target.value)}
                placeholder="Например: Гарантия или /help"
                required
              />
            </div>
            <div className="field">
              <label>Текст автоответа</label>
              <textarea
                className="input"
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Ответ, который бот отправит пользователю автоматически..."
                required
              />
            </div>
            <button type="submit" className="btn btn--primary btn--sm">
              <Plus size={14} /> Добавить правило
            </button>
          </form>

          <div className="admin-list" style={{ marginTop: 10 }}>
            {faqRules.map((r) => (
              <div key={r.id} className="admin-row">
                <div>
                  <strong className="mono">{r.triggerText}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.replyText}</div>
                </div>
                <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDeleteFaq(r.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel form">
          <h3 style={{ fontSize: '1rem' }}>Запустить рассылку</h3>
          <form onSubmit={handleSendCampaign} className="form">
            <div className="field">
              <label>Заголовок кампании</label>
              <input
                className="input"
                value={campTitle}
                onChange={(e) => setCampTitle(e.target.value)}
                placeholder="Весенний промокод для постоянных"
                required
              />
            </div>
            <div className="field">
              <label>Сегмент аудитории</label>
              <select className="input" value={campSegment} onChange={(e) => setCampSegment(e.target.value)}>
                {AUDIENCE_SEGMENTS.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label} ({s.count})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Текст сообщения в Telegram</label>
              <textarea
                className="input"
                rows={3}
                value={campBody}
                onChange={(e) => setCampBody(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn--primary btn--sm">
              <Send size={14} /> Отправить рассылку
            </button>
          </form>

          <h3 style={{ fontSize: '1rem', marginTop: 14 }}>Архив тикетов ({tickets.length})</h3>
          <div className="admin-list">
            {tickets.map((t) => {
              const st = TICKET_STATUS[t.status] || TICKET_STATUS.open;
              return (
                <div key={t.id} className="admin-row">
                  <div>
                    <strong className="mono">{t.code}</strong>{' '}
                    <span className={`status-pill ${st.cls}`}>{st.label}</span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {t.userName} ({t.userHandle}) &bull; {t.topic}
                    </div>
                  </div>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDeleteTicket(t.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          {campaigns.length > 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Выполнено рассылок: <strong className="mono">{campaigns.length}</strong>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
