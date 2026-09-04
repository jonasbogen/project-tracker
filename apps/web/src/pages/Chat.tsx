import { useEffect, useRef, useState, type FormEvent } from 'react';
import Button from '@intility/bifrost-react/Button';
import Card from '@intility/bifrost-react/Card';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import TextArea from '@intility/bifrost-react/TextArea';
import { faPaperPlane, faRobot } from '@fortawesome/free-solid-svg-icons';
import { api, type ChatMessage } from '../api';

const SUGGESTIONS = [
  'Hvilke prosjekter er forsinket akkurat nå?',
  'Oppsummer status for Arbion-prosjektene',
  'Foreslå neste steg for et prosjekt uten nylig aktivitet',
];

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  return (
    <div className="stack chat-page">
      <h1 className="bf-h1">Spør AI</h1>
      <p className="muted">
        Still spørsmål om prosjektene og sakene i verktøyet. Assistenten søker i den samme
        dataen du ser ellers i appen, og kan foreslå neste steg eller et utkast til en kommentar
        - men skriver aldri noe tilbake selv.
      </p>

      <Card padding="medium" className="chat-transcript">
        {messages.length === 0 && (
          <div className="chat-empty">
            <Icon icon={faRobot} size="2x" className="muted" />
            <p className="muted">Prøv for eksempel:</p>
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
      </Card>

      {error && (
        <Message state="alert" header="Kunne ikke svare">
          {error}
        </Message>
      )}

      <form onSubmit={handleSubmit} className="chat-form">
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
          rows={2}
        />
        <Button type="submit" variant="filled" state={sending ? 'inactive' : 'default'}>
          <Icon icon={faPaperPlane} marginRight />
          Send
        </Button>
      </form>
    </div>
  );
}
