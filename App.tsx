import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@appdeploy/client';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Sparkles,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
};

const STORAGE_KEY = 'mindora-conversations-v1';
const starterPrompts = [
  { title: 'Help me think', prompt: 'Help me think through an idea I have.' },
  {
    title: 'Explain something',
    prompt: 'Explain a difficult topic in a simple, friendly way.',
  },
  { title: 'Make a plan', prompt: 'Help me make a simple plan for this week.' },
  {
    title: 'Get creative',
    prompt: 'Give me a few original ideas for a small creative project.',
  },
];

function readConversations(): Conversation[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Conversation[]) : [];
  } catch {
    return [];
  }
}

function makeConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'New conversation',
    updatedAt: Date.now(),
    messages: [],
  };
}

function App() {
  const [conversations, setConversations] =
    useState<Conversation[]>(readConversations);
  const [activeId, setActiveId] = useState<string>(
    () => readConversations()[0]?.id ?? ''
  );
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = useMemo(
    () => conversations.find(item => item.id === activeId) ?? null,
    [conversations, activeId]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeConversation?.messages, loading]);

  const updateConversation = (
    id: string,
    updater: (conversation: Conversation) => Conversation
  ) => {
    setConversations(current =>
      current.map(item => (item.id === id ? updater(item) : item))
    );
  };

  const startNewChat = () => {
    const next = makeConversation();
    setConversations(current => [next, ...current]);
    setActiveId(next.id);
    setDraft('');
    setErrorText('');
    setSidebarOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 80);
  };

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;

    let conversation = activeConversation;
    if (!conversation) {
      conversation = makeConversation();
      setConversations(current => [conversation!, ...current]);
      setActiveId(conversation.id);
    }

    const conversationId = conversation.id;
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };
    const nextMessages = [...conversation.messages, userMessage];
    const title =
      conversation.messages.length === 0
        ? content.length > 34
          ? content.slice(0, 34).trimEnd() + '…'
          : content
        : conversation.title;

    updateConversation(conversationId, item => ({
      ...item,
      title,
      updatedAt: Date.now(),
      messages: nextMessages,
    }));
    setDraft('');
    setLoading(true);
    setErrorText('');

    try {
      const response = await api.post('/api/chat', {
        messages: nextMessages.map(({ role, content: messageContent }) => ({
          role,
          content: messageContent,
        })),
      });
      const reply = String(response.data?.reply ?? '').trim();
      if (!reply)
        throw new Error(
          'The assistant returned an empty reply. Please try again.'
        );
      updateConversation(conversationId, item => ({
        ...item,
        updatedAt: Date.now(),
        messages: [
          ...item.messages,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: reply,
          },
        ],
      }));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.';
      setErrorText(
        message.includes('500') || message.includes('simulated_failure')
          ? 'I couldn’t reach the assistant just now. Please try again.'
          : message
      );
    } finally {
      setLoading(false);
    }
  };

  const retryLastMessage = () => {
    if (!activeConversation || loading) return;
    const lastUserMessage = [...activeConversation.messages]
      .reverse()
      .find(message => message.role === 'user');
    if (lastUserMessage) {
      updateConversation(activeConversation.id, item => ({
        ...item,
        messages: item.messages.filter(
          message =>
            message.role !== 'user' || message.id !== lastUserMessage.id
        ),
      }));
      void sendMessage(lastUserMessage.content);
    }
  };

  const deleteConversation = (id: string) => {
    const remaining = conversations.filter(item => item.id !== id);
    setConversations(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id ?? '');
  };

  const copyMessage = async (message: Message) => {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    window.setTimeout(() => setCopiedId(''), 1400);
  };

  const onComposerKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  };

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <Sparkles size={17} strokeWidth={2.1} />
          </div>
          <span className="brand-name">Bullh AI</span>
          <button
            className="icon-button close-sidebar"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <button className="new-chat-button" onClick={startNewChat}>
          <SquarePen size={17} /> <span>New conversation</span>{' '}
          <span className="new-shortcut">⌘ K</span>
        </button>
        <div className="history-label">YOUR SPACE</div>
        <div className="history-list">
          {conversations.length === 0 && (
            <p className="history-empty">
              Your conversations will appear here.
            </p>
          )}
          {conversations.map(conversation => (
            <div
              className={`history-item ${activeId === conversation.id ? 'history-active' : ''}`}
              key={conversation.id}
            >
              <button
                className="history-select"
                onClick={() => {
                  setActiveId(conversation.id);
                  setSidebarOpen(false);
                }}
              >
                <MessageCircle size={15} />
                <span>{conversation.title}</span>
              </button>
              <button
                className="history-delete"
                aria-label="Delete conversation"
                onClick={() => deleteConversation(conversation.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="profile-orb">M</div>
          <div className="profile-copy">
            <strong>Your thinking space</strong>
            <span>Private on this device</span>
          </div>
          <MoreHorizontal size={18} className="muted-icon" />
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={19} />
            </button>
            <span className="topbar-context">Your space</span>
            <ChevronDown size={14} className="muted-icon" />
          </div>
          <div className="topbar-right">
            <span className="online-dot" />{' '}
            <span className="status-label">Here with you</span>
          </div>
        </header>

        <section
          className={`conversation-area ${activeConversation?.messages.length ? 'has-messages' : 'is-empty'}`}
        >
          {!activeConversation?.messages.length ? (
            <div className="welcome-wrap">
              <div className="welcome-sparkle">
                <Sparkles size={19} />
              </div>
              <p className="eyebrow">A LITTLE SPACE TO THINK</p>
              <h1>
                Good ideas start
                <br />
                <span>with a conversation.</span>
              </h1>
              <p className="welcome-subtitle">
                A friendly place to untangle thoughts, explore ideas,
                <br className="desktop-break" /> and figure things out — one
                message at a time.
              </p>
              <div className="prompt-grid">
                {starterPrompts.map(item => (
                  <button
                    className="prompt-card"
                    key={item.title}
                    onClick={() => {
                      setDraft(item.prompt);
                      inputRef.current?.focus();
                    }}
                  >
                    <span>{item.title}</span>
                    <ArrowUp size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {activeConversation.messages.map(message => (
                <article
                  className={`message-row message-${message.role}`}
                  key={message.id}
                >
                  {message.role === 'assistant' && (
                    <div className="assistant-avatar">
                      <Sparkles size={14} />
                    </div>
                  )}
                  <div className="message-content">
                    <div className="message-author">
                      {message.role === 'user' ? 'You' : 'Bullh AI'}
                    </div>
                    <div className="message-text">{message.content}</div>
                    {message.role === 'assistant' && (
                      <button
                        className="copy-button"
                        onClick={() => void copyMessage(message)}
                      >
                        {copiedId === message.id ? (
                          <Check size={13} />
                        ) : (
                          <Copy size={13} />
                        )}
                        {copiedId === message.id ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {loading && (
                <div className="message-row message-assistant">
                  <div className="assistant-avatar">
                    <Sparkles size={14} />
                  </div>
                  <div className="message-content">
                    <div className="message-author">Bullh AI</div>
                    <div className="typing-indicator">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </div>
              )}
              {errorText && (
                <div className="error-note">
                  <span>{errorText}</span>
                  <button onClick={retryLastMessage}>Try again</button>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <footer className="composer-wrap">
          <div className="composer">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder="What's on your mind?"
              rows={1}
              aria-label="Message Bullh AI"
              disabled={loading}
            />
            <button
              className="send-button"
              aria-label="Send message"
              disabled={!draft.trim() || loading}
              onClick={() => void sendMessage(draft)}
            >
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          </div>
          <p className="composer-hint">
            Bullh AI can make mistakes. Think of it as a helpful starting point.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
