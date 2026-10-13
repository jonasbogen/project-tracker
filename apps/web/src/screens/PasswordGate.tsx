import { useEffect, useRef, useState, type FormEvent } from 'react';

const PASSWORD = '2019';

/**
 * The first thing a visitor sees: nothing of the night is shown until the
 * password is typed. Once unlocked, the tab stays unlocked (sessionStorage),
 * so a reload during the evening does not ask again.
 */
export function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (value.trim() === PASSWORD) {
      onUnlock();
      return;
    }
    setWrong((n) => n + 1);
    setValue('');
    input.current?.focus();
  };

  return (
    <div className="gate">
      <div className="gate-glow" aria-hidden="true" />
      <form className={`gate-card ${wrong ? 'gate-card-shake' : ''}`} key={wrong} onSubmit={submit}>
        <div className="gate-brand">Sosial Grunnmur</div>
        <h1 className="gate-title">Lukket visning</h1>
        <p className="gate-lead">Skriv inn passordet for å se innholdet.</p>
        <label className="gate-field">
          <span className="gate-label">Passord</span>
          <input
            ref={input}
            className="gate-input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={wrong > 0}
          />
        </label>
        {wrong > 0 && <div className="gate-error">Feil passord. Prøv igjen.</div>}
        <button type="submit" className="btn btn-primary btn-xl gate-btn" disabled={!value}>
          Lås opp
        </button>
      </form>
    </div>
  );
}
