import './App.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import { buildChatMessages, buildImagePromptMessages, buildScenePrompt } from './lib/prompting';
import { novelaiChat, novelaiGenerateImage } from './lib/novelai';
import { ChatPane } from './components/ChatPane';
import { CharacterTab } from './components/CharacterTab';
import { SettingsTab } from './components/SettingsTab';
import { ImagePane } from './components/ImagePane';
import { ConversationsTab } from './components/ConversationsTab';

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function App() {
  const [leftTab, setLeftTab] = useState('conversations');

  const [character, setCharacter] = useLocalStorageState('nai.character.v1', {
    name: '',
    description: '',
    appearance: '',
    personality: '',
    rules: '',
  });

  const [settings, setSettings] = useLocalStorageState('nai.settings.v1', {
    token: '',
    textBaseUrl: 'https://text.novelai.net/oa/v1',
    textModel: 'glm-4-6',
    temperature: 0.8,
    maxTokens: 400,

    imageBaseUrl: 'https://image.novelai.net',
    imageModel: 'nai-diffusion-4-5-curated',
    width: 832,
    height: 1216,
    steps: 28,
    scale: 5.5,
    sampler: 'k_euler',
    qualityToggle: true,

    autoImage: true,
  });

  const [conversations, setConversations] = useLocalStorageState('nai.conversations.v1', {
    activeId: '',
    items: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [imageState, setImageState] = useState({ url: '', loading: false, error: '', meta: null });
  const lastObjectUrlRef = useRef('');

  useEffect(() => {
    return () => {
      if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
    };
  }, []);

  // One-time migration from the old single-conversation key.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('nai.chat.v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      setConversations((prev) => {
        if (prev?.items?.length) return prev;
        const id = makeId();
        return {
          activeId: id,
          items: [
            {
              id,
              title: 'Conversation 1',
              createdAt: nowIso(),
              updatedAt: nowIso(),
              messages: parsed,
            },
          ],
        };
      });

      localStorage.removeItem('nai.chat.v1');
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeConversation = useMemo(() => {
    const items = Array.isArray(conversations?.items) ? conversations.items : [];
    if (!items.length) return null;
    const found = items.find((c) => c.id === conversations.activeId) || items[0];
    return found || null;
  }, [conversations]);

  const messages = activeConversation?.messages || [];

  useEffect(() => {
    // Ensure we always have an active conversation.
    if (activeConversation) return;
    setConversations((prev) => {
      const items = Array.isArray(prev?.items) ? prev.items : [];
      if (items.length) {
        return { ...prev, activeId: items[0].id };
      }
      const id = makeId();
      return {
        activeId: id,
        items: [{ id, title: 'Nouvelle conversation', createdAt: nowIso(), updatedAt: nowIso(), messages: [] }],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation]);

  const canSend = useMemo(() => {
    return Boolean(settings.token?.trim()) && !busy;
  }, [settings.token, busy]);

  async function handleSend(userText) {
    setError('');
    const trimmed = String(userText || '').trim();
    if (!trimmed) return;
    if (!settings.token?.trim()) {
      setLeftTab('settings');
      setError("Ajoute d'abord ton token NovelAI dans l'onglet Paramètres.");
      return;
    }
    if (!activeConversation) return;

    const userMsg = { id: makeId(), role: 'user', content: trimmed, createdAt: nowIso() };
    const nextMessages = [...messages, userMsg];

    setConversations((prev) => {
      const items = Array.isArray(prev?.items) ? prev.items : [];
      return {
        ...prev,
        items: items.map((c) =>
          c.id === activeConversation.id ? { ...c, updatedAt: nowIso(), messages: nextMessages } : c
        ),
      };
    });

    setBusy(true);
    try {
      const apiMessages = buildChatMessages({ character, messages: nextMessages });
      const reply = await novelaiChat({
        token: settings.token,
        baseUrl: settings.textBaseUrl,
        model: settings.textModel,
        messages: apiMessages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
      });

      const assistantText = String(reply?.content || '').trim();
      if (!assistantText) {
        setError(
          "Réponse IA vide. Vérifie que ton modèle texte est bien `glm-4-6` ou `xialong-v1`, et regarde `raw` dans la console."
        );
        // eslint-disable-next-line no-console
        console.warn('[novelai] empty assistant content', reply?.raw);
        return;
      }

      const assistantMsg = { id: makeId(), role: 'assistant', content: assistantText, createdAt: nowIso() };
      const withAssistant = [...nextMessages, assistantMsg];

      setConversations((prev) => {
        const items = Array.isArray(prev?.items) ? prev.items : [];
        return {
          ...prev,
          items: items.map((c) =>
            c.id === activeConversation.id ? { ...c, updatedAt: nowIso(), messages: withAssistant } : c
          ),
        };
      });

      if (settings.autoImage && assistantText) {
        void handleGenerateImage({
          lastUser: trimmed,
          lastAssistant: assistantText,
          character,
          settings,
        });
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateImage({ lastUser, lastAssistant, character, settings }) {
    setImageState((s) => ({ ...s, loading: true, error: '' }));
    try {
      let prompt = '';
      try {
        const promptMessages = buildImagePromptMessages({ character, lastUser, lastAssistant });
        const promptReply = await novelaiChat({
          token: settings.token,
          baseUrl: settings.textBaseUrl,
          model: settings.textModel,
          messages: promptMessages,
          temperature: 0.4,
          max_tokens: 160,
        });
        prompt = String(promptReply?.content || '').trim();
      } catch {
        // ignore prompt generation errors; fallback below
      }
      if (!prompt) {
        prompt = buildScenePrompt({ character, lastUser, lastAssistant });
      }
      const { blob, meta } = await novelaiGenerateImage({
        token: settings.token,
        baseUrl: settings.imageBaseUrl,
        model: settings.imageModel,
        prompt,
        width: settings.width,
        height: settings.height,
        steps: settings.steps,
        scale: settings.scale,
        sampler: settings.sampler,
        qualityToggle: settings.qualityToggle,
      });

      const objectUrl = URL.createObjectURL(blob);
      if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = objectUrl;

      setImageState({ url: objectUrl, loading: false, error: '', meta: { ...meta, prompt } });
    } catch (e) {
      setImageState((s) => ({ ...s, loading: false, error: String(e?.message || e) }));
    }
  }

  function handleClear() {
    if (!activeConversation) return;
    setConversations((prev) => {
      const items = Array.isArray(prev?.items) ? prev.items : [];
      return {
        ...prev,
        items: items.map((c) => (c.id === activeConversation.id ? { ...c, updatedAt: nowIso(), messages: [] } : c)),
      };
    });
    setError('');
    setImageState({ url: '', loading: false, error: '', meta: null });
  }

  function handleDeleteMessage(messageId) {
    if (!activeConversation) return;
    setConversations((prev) => {
      const items = Array.isArray(prev?.items) ? prev.items : [];
      return {
        ...prev,
        items: items.map((c) => {
          if (c.id !== activeConversation.id) return c;
          const next = (c.messages || []).filter((m) => m.id !== messageId);
          return { ...c, updatedAt: nowIso(), messages: next };
        }),
      };
    });
  }

  return (
    <div className="Shell">
      <header className="Topbar">
        <div className="Topbar-left">
          <div className="Brand">NovelAI Chat + Image</div>
          <div className="Muted">
            Texte: <span className="Mono">{settings.textModel}</span> · Image:{' '}
            <span className="Mono">{settings.imageModel}</span>
          </div>
        </div>
        <div className="Topbar-right">
          <button className="Btn" onClick={() => setLeftTab('conversations')}>
            Conversations
          </button>
          <button className="Btn" onClick={() => setLeftTab('character')}>
            Personnage
          </button>
          <button className="Btn" onClick={() => setLeftTab('settings')}>
            Paramètres
          </button>
          <button className="Btn Btn-danger" onClick={handleClear} disabled={busy}>
            Effacer
          </button>
        </div>
      </header>

      <aside className="Left">
        <div className="Tabs">
          <button
            className={leftTab === 'conversations' ? 'Tab Tab-active' : 'Tab'}
            onClick={() => setLeftTab('conversations')}
          >
            Conversations
          </button>
          <button
            className={leftTab === 'character' ? 'Tab Tab-active' : 'Tab'}
            onClick={() => setLeftTab('character')}
          >
            Personnage
          </button>
          <button
            className={leftTab === 'settings' ? 'Tab Tab-active' : 'Tab'}
            onClick={() => setLeftTab('settings')}
          >
            Paramètres
          </button>
        </div>
        <div className="LeftBody">
          {leftTab === 'conversations' ? (
            <ConversationsTab
              value={conversations}
              onChange={(next) => {
                setConversations(next);
                setError('');
                setImageState({ url: '', loading: false, error: '', meta: null });
              }}
            />
          ) : leftTab === 'character' ? (
            <CharacterTab value={character} onChange={setCharacter} />
          ) : (
            <SettingsTab value={settings} onChange={setSettings} />
          )}
        </div>
      </aside>

      <main className="Main">
        {error ? <div className="Banner Banner-error">{error}</div> : null}
        {!settings.token?.trim() ? (
          <div className="Banner">
            Colle ton token NovelAI dans <b>Paramètres</b> pour activer le chat et les images.
          </div>
        ) : null}
        <ChatPane
          messages={messages}
          busy={busy}
          canSend={canSend}
          onSend={handleSend}
          onDeleteMessage={handleDeleteMessage}
          onClear={handleClear}
          onGenerateImage={() => {
            const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
            const lastAssistant =
              [...messages].reverse().find((m) => m.role === 'assistant')?.content || '';
            if (!lastAssistant) return;
            void handleGenerateImage({ lastUser, lastAssistant, character, settings });
          }}
        />
      </main>

      <aside className="Right">
        <ImagePane
          url={imageState.url}
          loading={imageState.loading}
          error={imageState.error}
          meta={imageState.meta}
        />
      </aside>
    </div>
  );
}

export default App;
