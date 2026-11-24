import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function PrivacyModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 500 }} role="dialog" aria-modal="true" aria-label="Политика конфиденциальности">
        <div className="modal-head">
          <h3 style={{ fontSize: '1.06rem' }}>Согласие на обработку данных (152-ФЗ)</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Заказывая обратный звонок через бота поддержки «ПУЛЬС», вы даёте согласие на обработку имени, номера телефона и текста обращения для связи с оператором и решения вопроса по заказу.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Сайт также использует cookie (<span className="mono">SameSite=Lax</span>): техническую <span className="mono">HttpOnly</span>-сессию <span className="mono">puls_sid</span>, выбранную тему <span className="mono">puls_theme</span>, согласие <span className="mono">puls_cookie_consent</span> и необязательный cookie <span className="mono">puls_prefs</span> (удаляется при выборе «Только необходимые»).
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Персональные данные не передаются сторонним сервисам и могут быть удалены по вашему запросу.
        </p>
      </div>
    </div>
  );
}
