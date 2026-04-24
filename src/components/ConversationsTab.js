import './ConversationsTab.css';

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeItems(value) {
  return Array.isArray(value?.items) ? value.items : [];
}

export function ConversationsTab({ value, onChange }) {
  const items = safeItems(value);
  const activeId = value?.activeId || (items[0] ? items[0].id : '');

  function setActive(id) {
    onChange({ ...value, activeId: id });
  }

  function createConversation() {
    const id = makeId();
    const next = {
      id,
      title: `Conversation ${items.length + 1}`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      messages: [],
    };
    onChange({ activeId: id, items: [next, ...items] });
  }

  function renameConversation(id, title) {
    onChange({
      ...value,
      items: items.map((c) => (c.id === id ? { ...c, title } : c)),
    });
  }

  function deleteConversation(id) {
    const remaining = items.filter((c) => c.id !== id);
    const nextActive = remaining[0]?.id || '';
    onChange({ activeId: id === activeId ? nextActive : activeId, items: remaining });
  }

  return (
    <div className="Convos">
      <div className="Convos-toolbar">
        <div className="Convos-title">Conversations</div>
        <button className="Btn" onClick={createConversation}>
          + Nouveau
        </button>
      </div>

      {items.length === 0 ? <div className="Convos-empty">Aucune conversation.</div> : null}

      <div className="Convos-list">
        {items.map((c) => {
          const isActive = c.id === activeId;
          const count = Array.isArray(c.messages) ? c.messages.length : 0;
          return (
            <div key={c.id} className={isActive ? 'Convo Convo-active' : 'Convo'}>
              <button className="Convo-open" onClick={() => setActive(c.id)}>
                <div className="Convo-titleRow">
                  <span className="Convo-dot" />
                  <span className="Convo-titleText">{c.title || 'Sans titre'}</span>
                </div>
                <div className="Convo-sub">{count} msg</div>
              </button>

              <div className="Convo-actions">
                <input
                  className="Convo-rename"
                  value={c.title || ''}
                  onChange={(e) => renameConversation(c.id, e.target.value)}
                  aria-label="Renommer"
                />
                <button
                  className="Btn Btn-danger Convo-delete"
                  onClick={() => deleteConversation(c.id)}
                  disabled={items.length <= 1}
                  title={items.length <= 1 ? 'Garde au moins une conversation' : 'Supprimer'}
                >
                  Supprimer
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

