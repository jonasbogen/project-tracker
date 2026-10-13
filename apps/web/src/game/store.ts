import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent, GameState, Team } from './types';

const STORAGE_KEY = 'spillkveld-state-v1';

export const TEAM_PALETTE = [
  { color: '#ff4d6d', emoji: '🦁' },
  { color: '#4da3ff', emoji: '🐬' },
  { color: '#3ddc84', emoji: '🐸' },
  { color: '#ffc53d', emoji: '🐯' },
];

let idCounter = 0;
export function uid(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function defaultTeams(): Team[] {
  return TEAM_PALETTE.map((p, i) => ({
    id: uid('team'),
    name: `Lag ${i + 1}`,
    color: p.color,
    emoji: p.emoji,
    players: [],
  }));
}

export const EVENT_TEMPLATES: Record<GameEvent['kind'], Omit<GameEvent, 'id'>> = {
  six: {
    kind: 'six',
    title: '6 minutter',
    rules:
      'Klokken går i skjul. Ingen får se hvor lenge det er igjen. Når alarmen går er det slutt, og laget som tapte får minuspoeng.',
    points: [0, 0, 0, 0],
    penalty: 5,
    durationSec: 6 * 60,
  },
  horse: {
    kind: 'horse',
    title: 'Hesteveddeløpet',
    rules:
      'Hvert lag velger sin hest (én hest per lag). Kort fra bunken bestemmer hvem som rykker fram. Passerer alle hestene et sidekort, snus det, og den hesten må rygge. Første hest i mål vinner.',
    points: [6, 4, 2, 1],
    penalty: 0,
    durationSec: 0,
  },
  mafia: {
    kind: 'mafia',
    title: 'Mafia og politi',
    rules:
      'Alle får et kort: ess er mafia, konge er politi, resten er sivile. Om natten dreper mafiaen, politiet etterforsker. Om dagen diskuterer byen og stemmer ut en mistenkt. Mafiaen vinner når de er like mange som resten, byen vinner når all mafia er tatt.',
    points: [10, 7, 5, 3],
    penalty: 0,
    durationSec: 0,
  },
  emoji: {
    kind: 'emoji',
    title: 'Emoji Movie',
    rules:
      'Filmer forklart kun med emojis. Hvert lag får to filmer og 10 sekunder på hver. Bare riktig eller feil teller. Flest riktige vinner.',
    points: [10, 7, 5, 3],
    penalty: 0,
    durationSec: 10,
  },
  wheel: {
    kind: 'wheel',
    title: 'Wheel of Fortune',
    rules:
      'Hjulet har 25 felt. Hvert lag velger sitt felt (ett lag per felt). Hjulet snurres én gang. Treffer hjulet feltet ditt, får laget 5 poeng.',
    points: [5, 0, 0, 0],
    penalty: 0,
    durationSec: 0,
  },
  deal: {
    kind: 'deal',
    title: 'Deal or Drink',
    rules:
      'Ta pengene. Behold kofferten. Eller ta en slurk. 20 kofferter, fire lag, og en bank som ringer etter hver runde. Lagene rangeres etter hvor mye de sitter igjen med.',
    points: [10, 7, 5, 3],
    penalty: 0,
    durationSec: 0,
  },
  custom: {
    kind: 'custom',
    title: 'Egen øvelse',
    rules: 'Gjør øvelsen, så registrerer spill-lederen rekkefølgen etterpå.',
    points: [10, 7, 5, 3],
    penalty: 0,
    durationSec: 0,
  },
};

export function newEvent(kind: GameEvent['kind']): GameEvent {
  return { id: uid('ev'), ...EVENT_TEMPLATES[kind] };
}

export function initialState(): GameState {
  return {
    version: 1,
    teams: defaultTeams(),
    events: [newEvent('six'), newEvent('horse'), newEvent('mafia'), newEvent('emoji'), newEvent('wheel'), newEvent('deal')],
    results: [],
    phase: { name: 'setup' },
    settings: { muted: false, volume: 0.7, discussSec: 180 },
    updatedAt: Date.now(),
  };
}

/**
 * Older saved games only know the first four events. As long as nothing has
 * been played yet, add the newer events so the night has the full programme.
 */
function migrate(s: GameState): GameState {
  if (s.results.length > 0) return s;
  const events = [...s.events];
  for (const kind of ['wheel', 'deal'] as const) {
    if (!events.some((e) => e.kind === kind)) events.push(newEvent(kind));
  }
  const emoji = events.find((e) => e.kind === 'emoji');
  if (emoji && emoji.durationSec === 15) {
    Object.assign(emoji, { durationSec: 10, rules: EVENT_TEMPLATES.emoji.rules });
  }
  return events.length === s.events.length ? s : { ...s, events };
}

function loadLocal(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    return parsed.version === 1 ? migrate(parsed) : null;
  } catch {
    return null;
  }
}

async function loadRemote(): Promise<GameState | null> {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return null;
    const body = (await res.json()) as { data: GameState | null };
    return body.data && body.data.version === 1 ? migrate(body.data) : null;
  } catch {
    return null;
  }
}

export function useGameStore() {
  const [state, setState] = useState<GameState>(() => loadLocal() ?? initialState());
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRemote().then((remote) => {
      if (cancelled) return;
      setState((local) => (remote && remote.updatedAt > local.updatedAt ? remote : local));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable; the server copy still exists */
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: state }),
      }).catch(() => undefined);
    }, 400);
  }, [state, ready]);

  const update = useCallback((fn: (s: GameState) => GameState) => {
    setState((s) => ({ ...fn(s), updatedAt: Date.now() }));
  }, []);

  const reset = useCallback((keepTeams: boolean) => {
    setState((s) => {
      const fresh = initialState();
      return keepTeams ? { ...fresh, teams: s.teams, events: s.events, settings: s.settings } : fresh;
    });
  }, []);

  return { state, update, reset, ready };
}
