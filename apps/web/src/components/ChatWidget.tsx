import { useEffect, useRef, useState, type FormEvent } from 'react';
import Button from '@intility/bifrost-react/Button';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import TextArea from '@intility/bifrost-react/TextArea';
import { faPaperPlane, faRobot, faXmark } from '@fortawesome/free-solid-svg-icons';
import { api, type ChatMessage } from '../api';

const SUGGESTIONS = [
  'Hvilke prosjekter er forsinket akkurat nå?',
  'Oppsummer status for Arbion-prosjektene',
  'Hvem har flest åpne issuer akkurat nå?',
  'Foreslå neste steg for et prosjekt uten nylig aktivitet',
  'Skriv et utkast til en statusoppdatering jeg kan sende til en kunde',
  'Forklar forskjellen på REST og GraphQL',
];

// Mounted once at the app root (outside <Routes>), so it survives page
// navigation: the conversation and open/closed state persist as you move
// between pages, exactly like a bottom-right chat bot that "follows" you.
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;

    setError(null);
    setInput('');
    const history = [...messages, { role: 'user', content: question } as ChatMessage];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setSending(true);

    try {
      await api.streamChat(history, (chunk) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'assistant',
            content: next[next.length - 1].content + chunk,
          };
          return next;
        });
      });
    } catch (err) {
      setError((err as Error).message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  if (!open) {
    return (
      <button
        className="chat-widget-fab"
        onClick={() => setOpen(true)}
        aria-label="Åpne Chat bot"
      >
        <Icon icon={faRobot} size="lg" />
        <span>Chat bot</span>
      </button>
    );
  }

  return (
    <div className="chat-widget-panel" role="dialog" aria-label="Chat bot">
      <div className="chat-widget-header">
        <span className="chat-widget-title">
          <Icon icon={faRobot} marginRight />
          Chat bot
        </span>
        <button
          className="chat-widget-close"
          onClick={() => setOpen(false)}
          aria-label="Lukk Chat bot"
        >
          <Icon icon={faXmark} />
        </button>
      </div>

      <div className="chat-widget-transcript">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p className="muted">
              Spør om hva som helst, ikke bare om verktøyet. Om spørsmålet handler om prosjektene
              eller issuene her, slår jeg opp i den samme dataen du ser ellers i appen, men
              skriver aldri noe tilbake selv.
            </p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="flat" small onClick={() => void send(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
            <div className="chat-bubble-role">{m.role === 'user' ? 'Deg' : 'AI'}</div>
            <div className="chat-bubble-content">
              {m.content || (sending && i === messages.length - 1 ? <Icon.Spinner aria-label="Tenker" /> : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <Message state="alert" header="Kunne ikke svare">
          {error}
        </Message>
      )}

      <form onSubmit={handleSubmit} className="chat-form chat-widget-form">
        <TextArea
          label="Spørsmål"
          hideLabel
          placeholder="Skriv et spørsmål…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={1}
        />
        <Button type="submit" variant="filled" state={sending ? 'inactive' : 'default'} aria-label="Send">
          <Icon icon={faPaperPlane} />
        </Button>
      </form>
    </div>
  );
}
