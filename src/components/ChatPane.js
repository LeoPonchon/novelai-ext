import { useEffect, useMemo, useRef, useState } from 'react';
import './ChatPane.css';

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function ChatPane({ messages, busy, canSend, onSend, onGenerateImage, onDeleteMessage, onClear }) {
  const [text, setText] = useState('');
  const scrollerRef = useRef(null);

  const hasAssistant = useMemo(
    () => (messages || []).some((m) => m && m.role === 'assistant' && String(m.content || '').trim()),
    [messages]
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  return (
    <div className="Chat">
      <div className="Chat-toolbar">
        <div className="Chat-title">Chat</div>
        <div className="Chat-toolbarActions">
          <button className="Btn" onClick={onGenerateImage} disabled={!hasAssistant || busy}>
            Générer image (dernier)
          </button>
          <button className="Btn Btn-danger" onClick={onClear} disabled={busy || (messages || []).length === 0}>
            Vider
          </button>
        </div>
      </div>

      <div className="Chat-scroller" ref={scrollerRef}>
        {(messages || []).length === 0 ? (
          <div className="Chat-empty">
            Écris un message pour démarrer. L’image à droite se mettra à jour à chaque réponse IA.
          </div>
        ) : null}
        {(messages || []).map((m) => (
          <div key={m.id} className={m.role === 'assistant' ? 'Msg Msg-assistant' : 'Msg Msg-user'}>
            <div className="Msg-meta">
              <span className="Msg-role">{m.role === 'assistant' ? 'IA' : 'Toi'}</span>
              <span className="Msg-metaRight">
                <span className="Msg-time">{m.createdAt ? formatTime(m.createdAt) : ''}</span>
                <button
                  type="button"
                  className="Msg-del"
                  onClick={() => onDeleteMessage?.(m.id)}
                  disabled={busy}
                  title="Supprimer ce message"
                >
                  Supprimer
                </button>
              </span>
            </div>
            <div className="Msg-body">{m.content}</div>
          </div>
        ))}
      </div>

      <form
        className="Composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSend) return;
          const value = text;
          setText('');
          onSend(value);
        }}
      >
        <textarea
          className="Composer-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canSend ? 'Ton message…' : 'Ajoute ton token NovelAI dans Paramètres…'}
          rows={3}
        />
        <button className="Btn Composer-send" type="submit" disabled={!canSend || !String(text).trim()}>
          {busy ? '…' : 'Envoyer'}
        </button>
      </form>
    </div>
  );
}
