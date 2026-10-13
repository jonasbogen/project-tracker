import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/engine';
import { Confetti } from '../components/Confetti';
import { Portal } from '../components/Portal';
import { placementsFromGroups } from '../game/scoring';
import type { DealCase, DealState, DealStage, DealTeam, Team, TeamId } from '../game/types';
import type { ScreenProps } from './common';
import './deal.css';

export const DEFAULT_VALUES = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 750, 900, 1000, 1250, 1500, 1750, 2000, 2500];
const HISTORY_MAX = 25;
/** The bank calls every round once this few cases (own ones included) are still closed. */
const BANK_EVERY_ROUND_AT = 5;
const BANKER = 'Esko';

/* ---------- rules ---------- */

interface Consequence {
  label: string;
  emoji: string;
  kind: 'out' | 'in' | 'none';
  sips: number;
  mood: 'great' | 'good' | 'ok' | 'neutral' | 'bad' | 'worse' | 'worst';
  flavor: string;
}

const FLAVOR_LOW = ['PERFEKT!', 'BANKEN HATER DETTE', 'FOR EN ÅPNING', 'DET DER SVIR FOR BANKEN'];
const FLAVOR_HIGH = ['AU.', 'DET DER VAR IKKE BRA', 'BANKEN ELSKER DET', 'KATASTROFE', 'DET GJORDE VONDT'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function consequence(value: number): Consequence {
  if (value <= 50) return { label: 'PERFEKT ÅPNING', emoji: '🔥', kind: 'out', sips: 3, mood: 'great', flavor: pickRandom(FLAVOR_LOW) };
  if (value <= 150) return { label: 'MEGET BRA', emoji: '🥂', kind: 'out', sips: 2, mood: 'good', flavor: pickRandom(FLAVOR_LOW) };
  if (value <= 400) return { label: 'BRA', emoji: '👍', kind: 'out', sips: 1, mood: 'ok', flavor: 'BANKEN SUKKER' };
  if (value <= 750) return { label: 'NØYTRAL', emoji: '😐', kind: 'none', sips: 0, mood: 'neutral', flavor: 'INGEN DRIKKER. KJEDELIG.' };
  if (value <= 1250) return { label: 'DÅRLIG ÅPNING', emoji: '😬', kind: 'in', sips: 1, mood: 'bad', flavor: pickRandom(FLAVOR_HIGH) };
  if (value <= 1750) return { label: 'KATASTROFE', emoji: '💀', kind: 'in', sips: 2, mood: 'worse', flavor: pickRandom(FLAVOR_HIGH) };
  return { label: 'TOTAL KATASTROFE', emoji: '☠️', kind: 'in', sips: 3, mood: 'worst', flavor: pickRandom(FLAVOR_HIGH) };
}

const BANK_COMMENTS = [
  'Banken mener dere har vært heldige. Altfor heldige.',
  'Banken forventer at dette går galt.',
  'Banken liker ikke selvtilliten deres.',
  'Banken tilbyr dere en vei ut.',
  'Banken tror {lag} kommer til å angre.',
  'Banken ønsker å kjøpe kofferten deres.',
  'Dette tilbudet gjelder kun én gang.',
  'Banken har sett på tallene. Banken smiler.',
  'Banken har regnet på det. Dere burde ikke ha regnet på det.',
  'Banken ringer ikke for å være snill.',
  'Banken synes {lag} ser tørste ut.',
  'Banken vet noe dere ikke vet.',
  'Banken har aldri tapt. Banken har ikke tenkt å begynne nå.',
  'Banken spør: hvor mye tror dere egentlig kofferten er verdt?',
  'Banken har et tilbud. Banken har også en latter.',
  'Banken sier: ta pengene mens dere fortsatt kan stå.',
  'Banken har fulgt med. Banken er ikke imponert.',
  'Banken liker ikke å gjenta seg selv.',
  'Banken har sett {lag} spille før. Det gikk ikke bra.',
  'Banken foreslår at dere tenker på morgendagen.',
  'Banken tror kofferten deres er tom. Nesten.',
  'Banken tilbyr dere verdighet. Mot betaling.',
  'Banken minner om at håp ikke er en strategi.',
  'Banken ser at {lag} nøler. Banken elsker nøling.',
  'Banken sier dette med et smil dere ikke kan se.',
  'Banken har dårlig tid. Dere har dårligere kort.',
  'Banken vil gjerne at dette skal gjøre vondt. Litt.',
  'Banken sier: ingen har noen gang angret på en DEAL. Det er løgn.',
];

/* ---------- state helpers ---------- */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function emptyTeam(): DealTeam {
  return { status: 'playing', offers: [], sipsOut: 0, sipsIn: 0, revealed: false };
}

export function initDeal(teams: Team[]): DealState {
  const t: Record<TeamId, DealTeam> = {};
  for (const team of teams) t[team.id] = emptyTeam();
  return { values: [...DEFAULT_VALUES], cases: [], teams: t, round: 0, stage: { name: 'setup' }, alcoholFree: false };
}

function dealCases(values: number[]): DealCase[] {
  return shuffle(values).map((value, i) => ({ n: i + 1, value, opened: false }));
}

function playingIndices(d: DealState, teams: Team[]): number[] {
  return teams.map((t, i) => (d.teams[t.id]?.status === 'playing' ? i : -1)).filter((i) => i >= 0);
}

function nextPlayingAfter(d: DealState, teams: Team[], i: number): number | undefined {
  return playingIndices(d, teams).find((j) => j > i);
}

function revealOrder(d: DealState, teams: Team[]): number[] {
  const dealt = teams.map((t, i) => (d.teams[t.id]?.status === 'dealt' ? i : -1)).filter((i) => i >= 0);
  return [...dealt, ...playingIndices(d, teams)];
}

function remainingValues(d: DealState): number[] {
  return d.cases.filter((c) => !c.opened).map((c) => c.value).sort((a, b) => a - b);
}

function unopenedLeft(d: DealState): number {
  return d.cases.filter((c) => !c.opened).length;
}

/** Closed cases nobody owns, i.e. what the teams can still open in a round. */
function nonOwnedLeft(d: DealState): number {
  return d.cases.filter((c) => !c.opened && !c.owner).length;
}

/** Every other round, but every round once few cases remain. */
function bankCallsAfter(d: DealState): boolean {
  return unopenedLeft(d) <= BANK_EVERY_ROUND_AT || d.round % 2 === 0;
}

export function suggestOffer(d: DealState, final: boolean): { points: number; sips: number } {
  const rem = remainingValues(d);
  const ev = rem.length ? rem.reduce((a, b) => a + b, 0) / rem.length : 0;
  const factor = final ? 0.9 : Math.min(0.8, 0.28 + 0.12 * (d.round - 1));
  const points = Math.max(10, Math.round((ev * factor) / 25) * 25);
  return { points, sips: final ? 6 : Math.min(6, d.round + 2) };
}

/** The bank's own version, with a little randomness so it never feels like a formula. */
function bankOffer(d: DealState, final: boolean): { points: number; sips: number } {
  const s = suggestOffer(d, final);
  const wobble = 1 + (Math.random() - 0.5) * 0.16;
  return { points: Math.max(10, Math.round((s.points * wobble) / 25) * 25), sips: s.sips };
}

/** A short, slightly mean justification for the offer, based on the actual state. */
function bankReason(d: DealState, team: Team, final: boolean, points: number): string {
  const rem = remainingValues(d);
  const ev = rem.length ? rem.reduce((a, b) => a + b, 0) / rem.length : 0;
  const high = rem.filter((v) => v >= 1000).length;
  const opened = d.cases.filter((c) => c.openedBy === team.id && c.openedRound === d.round).map((c) => c.value);
  const last = opened[opened.length - 1];
  const pct = Math.round((points / Math.max(1, ev)) * 100);
  const parts: string[] = [];
  if (final) {
    parts.push(`Det står mellom koffert ${d.teams[team.id].caseNo} og dette tilbudet.`);
    parts.push(high > 0 ? `${high} av de ${rem.length} koffertene som er igjen er over 1000. ${BANKER} tror ikke det er deres.` : `Ingen av koffertene som er igjen er over 1000. ${BANKER} er rolig.`);
    return parts.join(' ');
  }
  if (last !== undefined) {
    if (last >= 1500) parts.push(`Dere fjernet nettopp ${fmt(last)}. ${BANKER} er lettet, og lettelse er billig.`);
    else if (last <= 100) parts.push(`Dere fjernet ${fmt(last)}. De store verdiene lever fortsatt, og det koster ${BANKER} nattesøvn.`);
    else parts.push(`Dere fjernet ${fmt(last)}. Verken bra eller dårlig. ${BANKER} liker middelmådighet.`);
  }
  if (high >= 4) parts.push(`${high} kofferter over 1000 er fortsatt i spill. ${BANKER} betaler for å slippe den risikoen.`);
  else if (high >= 2) parts.push(`${high} kofferter over 1000 igjen. ${BANKER} tilbyr ${pct} % av snittet, og mener det er raust.`);
  else if (high === 1) parts.push(`Bare én koffert over 1000 igjen. ${BANKER} tviler på at den er deres.`);
  else parts.push(`Ingen store verdier igjen. ${BANKER} byr ${pct} % av snittet, mest for syns skyld.`);
  if (parts.length < 2) parts.push(`Snittet av det som er igjen er ${fmt(Math.round(ev))}. ${BANKER} byr ${pct} % av det. Fordi ${BANKER} kan.`);
  return parts.slice(0, 2).join(' ');
}

function finalPoints(d: DealState, team: Team): number {
  const t = d.teams[team.id];
  if (t.status === 'dealt') return t.dealPoints ?? 0;
  return d.cases.find((c) => c.n === t.caseNo)?.value ?? 0;
}

function stageSig(s: DealStage): string {
  switch (s.name) {
    case 'round':
      return `round:${s.sub}:${s.teamIndex}:${s.caseNo ?? ''}`;
    case 'bank':
      return `bank:${s.sub}:${s.teamIndex}:${s.final}`;
    case 'reveal':
      return `reveal:${s.sub}:${s.teamIndex}`;
    case 'pick':
      return `pick:${s.teamIndex}`;
    default:
      return s.name;
  }
}

function fmt(n: number): string {
  return n.toLocaleString('nb-NO');
}

/* ---------- small components ---------- */

function CountUp({ to, duration = 2400, onDone }: { to: number; duration?: number; onDone?: () => void }) {
  const [v, setV] = useState(0);
  const doneRef = useRef(false);
  useEffect(() => {
    doneRef.current = false;
    const start = performance.now();
    let lastTick = 0;
    let raf = 0;
    const loop = (now: number): void => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round((to * eased) / 5) * 5;
      setV(p >= 1 ? to : val);
      if (now - lastTick > 90 && p < 1) {
        audio.sfx('tick');
        lastTick = now;
      }
      if (p < 1) raf = requestAnimationFrame(loop);
      else if (!doneRef.current) {
        doneRef.current = true;
        audio.sfx('coin');
        onDone?.();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, duration]);
  return <span className="deal-countup">{fmt(v)}</span>;
}

function Suitcase({
  c,
  team,
  clickable,
  onClick,
  big = false,
  open = false,
  showValue = false,
}: {
  c: DealCase;
  team?: Team;
  clickable?: boolean;
  onClick?: () => void;
  big?: boolean;
  open?: boolean;
  showValue?: boolean;
}) {
  return (
    <button
      type="button"
      className={`case ${big ? 'case-big' : ''} ${c.opened && !big ? 'case-opened' : ''} ${team ? 'case-owned' : ''} ${clickable ? 'case-clickable' : ''} ${open ? 'case-open' : ''}`}
      style={team ? { ['--team' as string]: team.color } : undefined}
      disabled={!clickable}
      onClick={onClick}
    >
      <span className="case-handle" />
      <span className="case-body">
        <span className="case-lid" />
        <span className="case-plate">{c.opened && !big ? fmt(c.value) : showValue ? fmt(c.value) : c.n}</span>
      </span>
      {team && (
        <span className="case-owner">
          {team.emoji} {team.name}
        </span>
      )}
    </button>
  );
}

/* ---------- screen ---------- */

export function DealScreen({ state, update, go, index }: ScreenProps & { index: number }) {
  const teams = state.teams;
  const d = state.deal;
  const [panel, setPanel] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [draft, setDraft] = useState({ points: '', sips: '', bonus: '' });
  const [offerCounted, setOfferCounted] = useState(false);
  const [revealFlash, setRevealFlash] = useState<Consequence | null>(null);

  useEffect(() => {
    if (!d) update((s) => ({ ...s, deal: initDeal(s.teams) }));
  }, [d, update]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'h' || e.key === 'H') setPanel((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const act = (fn: (d: DealState) => DealState, history = true): void =>
    update((s) => {
      if (!s.deal) return s;
      const next = fn(s.deal);
      if (next === s.deal) return s;
      const dealHistory = history ? [...(s.dealHistory ?? []).slice(-(HISTORY_MAX - 1)), s.deal] : s.dealHistory;
      return { ...s, deal: next, dealHistory };
    });

  const undo = (): void => {
    audio.sfx('back');
    update((s) => {
      const h = s.dealHistory ?? [];
      if (!h.length) return s;
      return { ...s, deal: h[h.length - 1], dealHistory: h.slice(0, -1) };
    });
  };

  const stage = d?.stage;
  const sig = stage ? stageSig(stage) : '';

  /* music per stage */
  useEffect(() => {
    if (!stage) return;
    if (stage.name === 'setup' || stage.name === 'pick' || stage.name === 'round') {
      if (audio.currentMusic !== 'casino') audio.playMusic('casino');
    } else if (stage.name === 'results') {
      audio.playMusic('victory');
    }
  }, [stage?.name]);

  /* timed transitions */
  useEffect(() => {
    if (!d || !stage) return;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void): void => {
      timers.push(window.setTimeout(fn, ms));
    };
    const tick = (fn: (x: DealState) => DealState): void => act(fn, false);

    if (stage.name === 'round' && stage.sub === 'spotlight') {
      audio.sfx('whoosh');
      later(2300, () => tick((x) => (x.stage.name === 'round' && x.stage.sub === 'spotlight' ? { ...x, stage: { ...x.stage, sub: 'choose' } } : x)));
    }
    if (stage.name === 'round' && stage.sub === 'suspense') {
      audio.sfx('riser');
      later(2400, () => {
        audio.sfx('lock');
        tick((x) => {
          if (x.stage.name !== 'round' || x.stage.sub !== 'suspense' || !x.stage.caseNo) return x;
          const caseNo = x.stage.caseNo;
          const c = x.cases.find((k) => k.n === caseNo)!;
          const team = teams[x.stage.teamIndex];
          const q = consequence(c.value);
          const dt = x.teams[team.id];
          const teamsNext = {
            ...x.teams,
            [team.id]: { ...dt, sipsOut: dt.sipsOut + (q.kind === 'out' ? q.sips : 0), sipsIn: dt.sipsIn + (q.kind === 'in' ? q.sips : 0) },
          };
          return {
            ...x,
            cases: x.cases.map((k) => (k.n === caseNo ? { ...k, opened: true, openedBy: team.id, openedRound: x.round } : k)),
            teams: teamsNext,
            stage: { ...x.stage, sub: 'reveal' },
          };
        });
      });
    }
    if (stage.name === 'round' && stage.sub === 'reveal' && stage.caseNo) {
      const c = d.cases.find((k) => k.n === stage.caseNo)!;
      const q = consequence(c.value);
      setRevealFlash(q);
      if (q.kind === 'out') {
        audio.sfx('cheer');
        later(300, () => audio.sfx('fanfare'));
      } else if (q.kind === 'in') {
        audio.sfx('crash');
        if (q.mood === 'worst') later(400, () => audio.sfx('boo'));
      } else {
        audio.sfx('ding');
      }
    }
    if (stage.name === 'bank' && stage.sub === 'ringing') {
      audio.stopMusic(0.4);
      later(400, () => audio.sfx('ring'));
      later(2600, () => audio.sfx('ring'));
      later(4600, () => {
        audio.playMusic('tension');
        tick((x) => (x.stage.name === 'bank' && x.stage.sub === 'ringing' ? { ...x, stage: { ...x.stage, sub: 'thinking' } } : x));
      });
    }
    if (stage.name === 'bank' && stage.sub === 'thinking') {
      // The bank makes its own offer. The host can still open the panel and
      // override it before it goes out.
      const team = teams[stage.teamIndex];
      const o = bankOffer(d, stage.final);
      const reason = bankReason(d, team, stage.final, o.points);
      setDraft({ points: String(o.points), sips: String(o.sips), bonus: '' });
      later(3200, () => {
        const comment = pickRandom(BANK_COMMENTS).replace('{lag}', team.name);
        tick((x) => {
          if (x.stage.name !== 'bank' || x.stage.sub !== 'thinking') return x;
          const dt = x.teams[team.id];
          return {
            ...x,
            teams: { ...x.teams, [team.id]: { ...dt, offers: [...dt.offers, { round: x.round, points: o.points, sips: o.sips, reason }] } },
            stage: { name: 'bank', sub: 'comment', teamIndex: x.stage.teamIndex, final: x.stage.final, comment },
          };
        });
      });
    }
    if (stage.name === 'bank' && stage.sub === 'comment') {
      audio.sfx('sting');
      later(4200, () => tick((x) => (x.stage.name === 'bank' && x.stage.sub === 'comment' ? { ...x, stage: { ...x.stage, sub: 'offer' } } : x)));
    }
    if (stage.name === 'bank' && stage.sub === 'offer') {
      setOfferCounted(false);
      audio.sfx('whoosh');
    }
    if (stage.name === 'reveal' && stage.sub === 'intro') {
      if (audio.currentMusic !== 'heartbeat') audio.playMusic('heartbeat');
      audio.sfx('whoosh');
      later(3600, () => tick((x) => (x.stage.name === 'reveal' && x.stage.sub === 'intro' ? { ...x, stage: { ...x.stage, sub: 'open' } } : x)));
    }
    if (stage.name === 'reveal' && stage.sub === 'open') {
      audio.sfx('riser');
      later(3000, () => {
        audio.sfx('lock');
        tick((x) => {
          if (x.stage.name !== 'reveal' || x.stage.sub !== 'open') return x;
          const order = revealOrder(x, teams);
          const team = teams[order[x.stage.teamIndex]];
          const dt = x.teams[team.id];
          const c = x.cases.find((k) => k.n === dt.caseNo);
          return {
            ...x,
            teams: { ...x.teams, [team.id]: { ...dt, revealed: true } },
            cases: c ? x.cases.map((k) => (k.n === c.n ? { ...k, opened: true } : k)) : x.cases,
            stage: { ...x.stage, sub: 'shown' },
          };
        });
      });
    }
    if (stage.name === 'reveal' && stage.sub === 'shown') {
      const order = revealOrder(d, teams);
      const team = teams[order[stage.teamIndex]];
      const dt = d.teams[team.id];
      const value = d.cases.find((k) => k.n === dt.caseNo)?.value ?? 0;
      const good = dt.status === 'dealt' ? (dt.dealPoints ?? 0) >= value : value >= 900;
      audio.sfx(good ? 'cheer' : 'crash');
      if (good) later(400, () => audio.sfx('fanfare'));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  if (!d || !stage) return null;

  const sipWord = d.alcoholFree ? 'alkoholfrie slurker' : 'slurker';
  const caseOf = (n?: number): DealCase | undefined => d.cases.find((c) => c.n === n);
  const ownerOf = (c: DealCase): Team | undefined => teams.find((t) => t.id === c.owner);
  const paused = !!d.pauseUntil && now < d.pauseUntil;

  /* ----- host actions ----- */

  const startGame = (): void => {
    audio.sfx('click');
    act((x) => ({ ...x, cases: dealCases(x.values), round: 0, stage: { name: 'pick', teamIndex: 0 } }));
  };

  const pickOwnCase = (n: number): void => {
    if (stage.name !== 'pick') return;
    const team = teams[stage.teamIndex];
    audio.sfx('lock');
    act((x) => {
      const cases = x.cases.map((c) => (c.n === n ? { ...c, owner: team.id } : c));
      const tm = { ...x.teams, [team.id]: { ...x.teams[team.id], caseNo: n } };
      const nextIndex = stage.teamIndex + 1;
      if (nextIndex < teams.length) return { ...x, cases, teams: tm, stage: { name: 'pick', teamIndex: nextIndex } };
      return { ...x, cases, teams: tm, round: 1, stage: { name: 'round', sub: 'spotlight', teamIndex: 0 } };
    });
  };

  const chooseCase = (n: number): void => {
    if (stage.name !== 'round' || stage.sub !== 'choose') return;
    audio.sfx('click');
    act((x) => ({ ...x, stage: { name: 'round', sub: 'suspense', teamIndex: stage.teamIndex, caseNo: n } }));
  };

  const afterReveal = (): void => {
    if (stage.name !== 'round') return;
    audio.sfx('click');
    setRevealFlash(null);
    act((x) => {
      const next = nextPlayingAfter(x, teams, stage.teamIndex);
      if (next !== undefined && nonOwnedLeft(x) > 0) return { ...x, stage: { name: 'round', sub: 'spotlight', teamIndex: next } };
      const playing = playingIndices(x, teams);
      if (!playing.length) return { ...x, stage: { name: 'reveal', sub: 'intro', teamIndex: 0 } };
      if (nonOwnedLeft(x) === 0) return { ...x, stage: { name: 'bank', sub: 'ringing', teamIndex: playing[0], final: true } };
      if (bankCallsAfter(x)) return { ...x, stage: { name: 'bank', sub: 'ringing', teamIndex: playing[0], final: false } };
      return { ...x, round: x.round + 1, stage: { name: 'round', sub: 'spotlight', teamIndex: playing[0] } };
    });
  };

  const sendOffer = (): void => {
    if (stage.name !== 'bank') return;
    const points = Math.max(0, Math.round(Number(draft.points) || 0));
    const sips = Math.max(0, Math.round(Number(draft.sips) || 0));
    const bonus = draft.bonus.trim() || undefined;
    const team = teams[stage.teamIndex];
    const comment = pickRandom(BANK_COMMENTS).replace('{lag}', team.name);
    const reason = bankReason(d, team, stage.final, points);
    setPanel(false);
    act((x) => ({
      ...x,
      teams: { ...x.teams, [team.id]: { ...x.teams[team.id], offers: [...x.teams[team.id].offers, { round: x.round, points, sips, bonus, reason }] } },
      stage: { name: 'bank', sub: 'comment', teamIndex: stage.teamIndex, final: stage.final, comment },
    }));
  };

  const answer = (a: 'deal' | 'nodeal'): void => {
    if (stage.name !== 'bank') return;
    const team = teams[stage.teamIndex];
    audio.sfx('stamp');
    if (a === 'deal') {
      window.setTimeout(() => audio.sfx('cheer'), 250);
      window.setTimeout(() => audio.sfx('fanfare'), 500);
    } else {
      window.setTimeout(() => audio.sfx('crash'), 200);
    }
    act((x) => {
      const dt = x.teams[team.id];
      const offers = [...dt.offers];
      const last = offers[offers.length - 1];
      if (last) offers[offers.length - 1] = { ...last, answer: a };
      const nextTeam: DealTeam =
        a === 'deal'
          ? { ...dt, offers, status: 'dealt', dealPoints: last?.points ?? 0, dealSips: last?.sips ?? 0, dealRound: x.round, sipsOut: dt.sipsOut + (last?.sips ?? 0) }
          : { ...dt, offers };
      return { ...x, teams: { ...x.teams, [team.id]: nextTeam }, stage: { ...stage, sub: 'answered' } };
    });
  };

  const afterAnswer = (): void => {
    if (stage.name !== 'bank') return;
    audio.sfx('click');
    act((x) => {
      const next = nextPlayingAfter(x, teams, stage.teamIndex);
      if (next !== undefined) return { ...x, stage: { name: 'bank', sub: 'thinking', teamIndex: next, final: stage.final } };
      const playing = playingIndices(x, teams);
      if (stage.final || !playing.length || nonOwnedLeft(x) === 0) return { ...x, stage: { name: 'reveal', sub: 'intro', teamIndex: 0 } };
      return { ...x, round: x.round + 1, stage: { name: 'round', sub: 'spotlight', teamIndex: playing[0] } };
    });
  };

  const afterShown = (): void => {
    if (stage.name !== 'reveal') return;
    audio.sfx('click');
    act((x) => {
      const order = revealOrder(x, teams);
      const nextIndex = stage.teamIndex + 1;
      if (nextIndex < order.length) return { ...x, stage: { name: 'reveal', sub: 'intro', teamIndex: nextIndex } };
      return { ...x, stage: { name: 'results' } };
    });
  };

  const dramaticPause = (): void => {
    audio.sfx('riser');
    act((x) => ({ ...x, pauseUntil: Date.now() + 5000 }), false);
  };

  const addToTotals = (): void => {
    audio.sfx('sting');
    const sorted = [...teams].sort((a, b) => finalPoints(d, b) - finalPoints(d, a));
    const groups: TeamId[][] = [];
    let prev: number | null = null;
    for (const t of sorted) {
      const p = finalPoints(d, t);
      if (prev !== null && p === prev) groups[groups.length - 1].push(t.id);
      else groups.push([t.id]);
      prev = p;
    }
    update((s) => ({
      ...s,
      pending: {
        placements: placementsFromGroups(groups),
        note: `Deal or Drink: ${sorted.map((t) => `${t.emoji} ${t.name} ${fmt(finalPoints(d, t))}`).join(' · ')}. Juster om nødvendig.`,
      },
    }));
    go({ name: 'event-rank', index });
  };

  /* ----- derived for rendering ----- */

  const sortedValues = [...d.values].sort((a, b) => a - b);
  const openedValues = d.cases.filter((c) => c.opened).map((c) => c.value);
  const valueGone = (v: number, i: number): boolean => {
    // Count duplicates: the i-th occurrence of v is gone if at least that many opened.
    const nth = sortedValues.slice(0, i + 1).filter((x) => x === v).length;
    return openedValues.filter((x) => x === v).length >= nth;
  };
  const activeTeam =
    stage.name === 'round' || stage.name === 'bank' ? teams[stage.teamIndex] : stage.name === 'pick' ? teams[stage.teamIndex] : undefined;

  const boardClickable = (c: DealCase): boolean => {
    if (stage.name === 'pick') return !c.owner;
    if (stage.name === 'round' && stage.sub === 'choose') return !c.owner && !c.opened;
    return false;
  };
  const onBoardClick = (c: DealCase): void => {
    if (stage.name === 'pick') pickOwnCase(c.n);
    else chooseCase(c.n);
  };

  const headline = (): string => {
    switch (stage.name) {
      case 'pick':
        return `${activeTeam?.emoji ?? ''} ${activeTeam?.name ?? ''}: VELG DIN KOFFERT`;
      case 'round':
        return stage.sub === 'choose' ? `${activeTeam?.emoji ?? ''} ${activeTeam?.name ?? ''}: ÅPNE EN KOFFERT` : `RUNDE ${d.round}`;
      case 'bank':
        return stage.final ? 'FINALEN' : `${BANKER.toUpperCase()} RINGER · RUNDE ${d.round}`;
      case 'reveal':
        return 'AVSLØRINGEN';
      case 'results':
        return 'RESULTATER';
      default:
        return '';
    }
  };

  /* ----- setup ----- */

  if (stage.name === 'setup') {
    return (
      <div className="screen deal deal-setup">
        <div className="deal-spotlights" aria-hidden="true" />
        <div className="deal-logo">
          <span className="deal-logo-main">DEAL OR DRINK</span>
          <span className="deal-logo-sub">Ta pengene. Behold kofferten. Eller ta en slurk.</span>
        </div>
        <div className="deal-setup-grid">
          <section className="deal-setup-box">
            <h2>Lagnavn</h2>
            {teams.map((t) => (
              <label key={t.id} className="deal-setup-team" style={{ ['--team' as string]: t.color }}>
                <span>{t.emoji}</span>
                <input
                  value={t.name}
                  onChange={(e) => update((s) => ({ ...s, teams: s.teams.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)) }))}
                />
              </label>
            ))}
            <label className="deal-setup-toggle">
              <input type="checkbox" checked={d.alcoholFree} onChange={(e) => act((x) => ({ ...x, alcoholFree: e.target.checked }), false)} />
              Alkoholfritt alternativ (teksten sier «alkoholfrie slurker»)
            </label>
          </section>
          <section className="deal-setup-box">
            <h2>Koffertverdier (20)</h2>
            <div className="deal-values-edit">
              {d.values.map((v, i) => (
                <input
                  key={i}
                  type="number"
                  value={v}
                  onChange={(e) =>
                    act((x) => ({ ...x, values: x.values.map((y, j) => (j === i ? Math.max(0, Number(e.target.value) || 0) : y)) }), false)
                  }
                />
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => act((x) => ({ ...x, values: [...DEFAULT_VALUES] }), false)}>
              Tilbakestill verdier
            </button>
          </section>
        </div>
        <p className="play-sub">
          {BANKER} i Banken ringer selv og legger tilbudene på bordet. Host-panelet (tasten H, eller knappen nede til venstre) viser koffertverdiene og lar deg angre eller
          overstyre et tilbud.
        </p>
        <button className="btn btn-primary btn-xl btn-start" data-primary onClick={startGame}>
          START SPILLET
        </button>
      </div>
    );
  }

  /* ----- overlays ----- */

  let overlay: JSX.Element | null = null;

  if (stage.name === 'round' && stage.sub === 'spotlight' && activeTeam) {
    overlay = (
      <div className="deal-overlay deal-overlay-spot" style={{ ['--team' as string]: activeTeam.color }}>
        <div className="deal-spot-beam" />
        <div className="deal-spot-text">
          <span className="deal-kicker">NESTE</span>
          <span className="deal-huge">
            {activeTeam.emoji} {activeTeam.name}
          </span>
          <span className="deal-kicker">Runde {d.round} · koffert {caseOf(d.teams[activeTeam.id].caseNo)?.n ?? '?'}</span>
        </div>
      </div>
    );
  }

  if (stage.name === 'round' && (stage.sub === 'suspense' || stage.sub === 'reveal') && stage.caseNo && activeTeam) {
    const c = caseOf(stage.caseNo)!;
    const q = stage.sub === 'reveal' ? revealFlash ?? consequence(c.value) : null;
    const sipsText = q
      ? q.kind === 'out'
        ? `${activeTeam.name.toUpperCase()} FÅR DELE UT ${q.sips} ${sipWord.toUpperCase()}`
        : q.kind === 'in'
          ? `${activeTeam.name.toUpperCase()} TAR ${q.sips} ${q.sips === 1 ? (d.alcoholFree ? 'ALKOHOLFRI SLURK' : 'SLURK') : sipWord.toUpperCase()} HVER`
          : 'INGEN DRIKKER'
      : '';
    overlay = (
      <div className={`deal-overlay deal-overlay-case ${q ? `mood-${q.mood}` : 'deal-suspense'}`} style={{ ['--team' as string]: activeTeam.color }}>
        <Confetti active={!!q && q.kind === 'out'} burst colors={[activeTeam.color, '#ffd86b', '#fff']} />
        <div className="deal-case-stage">
          <span className="deal-kicker">KOFFERT</span>
          <span className="deal-case-number">{c.n}</span>
          <Suitcase c={c} big open={!!q} showValue={!!q} />
          {q ? (
            <div className="deal-consequence">
              <span className="deal-value-big">{fmt(c.value)}</span>
              <span className="deal-conseq-label">
                {q.emoji} {q.label}
              </span>
              <span className="deal-conseq-sips">{sipsText}</span>
              <span className="deal-conseq-flavor">{q.flavor}</span>
              <button className="btn btn-primary btn-xl" data-primary onClick={afterReveal}>
                Videre →
              </button>
            </div>
          ) : (
            <span className="deal-kicker deal-blink">LÅSEN KLIKKER …</span>
          )}
        </div>
      </div>
    );
  }

  if (stage.name === 'bank' && activeTeam) {
    const dt = d.teams[activeTeam.id];
    const offer = dt.offers[dt.offers.length - 1];
    const ownCase = caseOf(dt.caseNo);
    const esko = (ringing: boolean) => (
      <div className={`esko ${ringing ? 'esko-ringing' : ''}`}>
        <img className="esko-img" src="/esko.png" alt={`${BANKER}, bankmannen`} />
        {ringing && <span className="esko-phone">📞</span>}
        <span className="esko-plate">
          {BANKER.toUpperCase()} · BANKEN
        </span>
      </div>
    );
    if (stage.sub === 'ringing') {
      overlay = (
        <div className="deal-overlay deal-overlay-bank">
          <div className="deal-bank-lamp" />
          {esko(true)}
          <span className="deal-huge deal-bank-title">BANKEN RINGER …</span>
        </div>
      );
    } else if (stage.sub === 'thinking') {
      overlay = (
        <div className="deal-overlay deal-overlay-bank">
          <div className="deal-bank-lamp" />
          {esko(false)}
          <span className="deal-huge deal-bank-title">{stage.final ? `${BANKER.toUpperCase()} HAR ETT SISTE TILBUD` : `${BANKER.toUpperCase()} REGNER …`}</span>
          <span className="deal-kicker">
            {BANKER} ser på {activeTeam.emoji} {activeTeam.name} …
          </span>
          {stage.final && ownCase && (
            <div className="deal-finale-vs">
              <div className="deal-finale-side" style={{ ['--team' as string]: activeTeam.color }}>
                <span className="deal-kicker">{activeTeam.name}</span>
                <span className="deal-finale-case">KOFFERT {ownCase.n}</span>
                <span className="deal-finale-q">???</span>
              </div>
            </div>
          )}
        </div>
      );
    } else if (stage.sub === 'comment') {
      overlay = (
        <div className="deal-overlay deal-overlay-bank">
          <div className="deal-bank-lamp" />
          {esko(false)}
          <span className="deal-bank-comment">«{stage.comment}»</span>
          {offer?.reason && <span className="deal-bank-reason">{offer.reason}</span>}
          <span className="deal-kicker deal-blink">{BANKER.toUpperCase()} HAR KOMMET MED ET TILBUD TIL {activeTeam.name.toUpperCase()}</span>
        </div>
      );
    } else if (stage.sub === 'offer' && offer) {
      overlay = (
        <div className={`deal-overlay deal-overlay-bank ${stage.final ? 'deal-finale' : ''}`} style={{ ['--team' as string]: activeTeam.color }}>
          <div className="deal-bank-lamp" />
          <div className="deal-offer-head">
            <img className="esko-img esko-img-small" src="/esko.png" alt="" />
            <span className="deal-kicker">
              {stage.final ? 'FINALEN · ' : ''}
              {activeTeam.emoji} {activeTeam.name}
            </span>
          </div>
          {offer.reason && <span className="deal-bank-reason deal-bank-reason-small">{offer.reason}</span>}
          {stage.final && ownCase && (
            <div className="deal-finale-vs">
              <div className="deal-finale-side" style={{ ['--team' as string]: activeTeam.color }}>
                <span className="deal-kicker">EGEN KOFFERT</span>
                <span className="deal-finale-case">KOFFERT {ownCase.n}</span>
                <span className="deal-finale-q">???</span>
              </div>
              <span className="deal-finale-mot">MOT</span>
              <div className="deal-finale-side deal-finale-bank">
                <span className="deal-kicker">BANKENS SISTE TILBUD</span>
                <span className="deal-offer-points">
                  <CountUp to={offer.points} onDone={() => setOfferCounted(true)} /> POENG
                </span>
                {offer.sips > 0 && (
                  <span className="deal-offer-sips">
                    + DEL UT {offer.sips} {sipWord.toUpperCase()}
                  </span>
                )}
                {offer.bonus && <span className="deal-offer-bonus">+ {offer.bonus}</span>}
              </div>
            </div>
          )}
          {!stage.final && (
            <div className="deal-offer-box">
              <span className="deal-kicker">BANKENS TILBUD</span>
              <span className="deal-offer-points">
                <CountUp to={offer.points} onDone={() => setOfferCounted(true)} /> POENG
              </span>
              {offer.sips > 0 && (
                <>
                  <span className="deal-offer-plus">+</span>
                  <span className="deal-offer-sips">
                    DEL UT {offer.sips} {sipWord.toUpperCase()}
                  </span>
                </>
              )}
              {offer.bonus && <span className="deal-offer-bonus">+ {offer.bonus}</span>}
            </div>
          )}
          <div className={`deal-answer ${offerCounted ? 'deal-answer-ready' : ''}`}>
            <span className="deal-huge">DEAL OR NO DEAL?</span>
            <div className="deal-answer-buttons">
              <button className="btn deal-btn-deal" disabled={!offerCounted} onClick={() => answer('deal')}>
                DEAL
              </button>
              <button className="btn deal-btn-nodeal" disabled={!offerCounted} onClick={() => answer('nodeal')}>
                NO DEAL
              </button>
            </div>
          </div>
        </div>
      );
    } else if (stage.sub === 'answered' && offer) {
      const dealt = offer.answer === 'deal';
      overlay = (
        <div className={`deal-overlay ${dealt ? 'deal-overlay-deal' : 'deal-overlay-nodeal'}`} style={{ ['--team' as string]: activeTeam.color }}>
          <Confetti active={dealt} burst colors={['#ffd86b', '#3ddc84', '#fff', activeTeam.color]} />
          <span className="deal-stamp">{dealt ? 'DEAL!' : 'NO DEAL'}</span>
          {dealt ? (
            <div className="deal-answer-text">
              <span className="deal-huge">
                {activeTeam.emoji} {activeTeam.name.toUpperCase()} HAR SIKRET {fmt(offer.points)} POENG
              </span>
              {offer.sips > 0 && (
                <span className="deal-offer-sips">
                  + DEL UT {offer.sips} {sipWord.toUpperCase()}
                </span>
              )}
              {offer.bonus && <span className="deal-offer-bonus">+ {offer.bonus}</span>}
              <span className="deal-kicker">Kofferten deres åpnes helt til slutt.</span>
            </div>
          ) : (
            <div className="deal-answer-text">
              <span className="deal-huge">
                {activeTeam.emoji} {activeTeam.name.toUpperCase()} GAMBLER VIDERE
              </span>
              <span className="deal-kicker">Kofferten forblir låst.</span>
            </div>
          )}
          <button className="btn btn-primary btn-xl" data-primary onClick={afterAnswer}>
            Videre →
          </button>
        </div>
      );
    }
  }

  if (stage.name === 'reveal') {
    const order = revealOrder(d, teams);
    const team = teams[order[stage.teamIndex]];
    const dt = d.teams[team.id];
    const c = caseOf(dt.caseNo);
    const lastOffer = dt.offers[dt.offers.length - 1];
    const value = c?.value ?? 0;
    let verdict = '';
    let good = false;
    if (dt.status === 'dealt') {
      good = (dt.dealPoints ?? 0) >= value;
      verdict = good
        ? `GOD DEAL! Dere tok ${fmt(dt.dealPoints ?? 0)}, kofferten hadde bare ${fmt(value)}.`
        : `AU. Dere tok ${fmt(dt.dealPoints ?? 0)}, kofferten hadde ${fmt(value)}.`;
    } else if (lastOffer) {
      good = value >= lastOffer.points;
      verdict = good
        ? `RIKTIG Å GAMBLE! Banken bød ${fmt(lastOffer.points)}, kofferten hadde ${fmt(value)}.`
        : `AU. Banken bød ${fmt(lastOffer.points)}, kofferten hadde ${fmt(value)}.`;
    } else {
      good = value >= 900;
      verdict = `Kofferten hadde ${fmt(value)}.`;
    }
    overlay = (
      <div className={`deal-overlay deal-overlay-reveal ${stage.sub === 'shown' ? (good ? 'mood-great' : 'mood-worse') : ''}`} style={{ ['--team' as string]: team.color }}>
        <Confetti active={stage.sub === 'shown' && good} burst colors={[team.color, '#ffd86b', '#fff']} />
        <div className="deal-reveal-stage">
          <span className="deal-kicker">{stage.teamIndex === order.length - 1 ? 'KVELDENS SISTE KOFFERT' : 'AVSLØRINGEN'}</span>
          <span className="deal-huge">
            {team.emoji} {team.name}
          </span>
          <span className="deal-kicker">
            {dt.status === 'dealt' ? `TOK DEAL I RUNDE ${dt.dealRound}: ${fmt(dt.dealPoints ?? 0)} POENG` : 'BEHOLDT KOFFERTEN'} · KOFFERT {c?.n ?? '?'}
          </span>
          {c && (
            <div className={`deal-reveal-case ${stage.sub === 'open' ? 'deal-reveal-opening' : ''}`}>
              <Suitcase c={c} big open={stage.sub === 'shown'} showValue={stage.sub === 'shown'} />
            </div>
          )}
          {stage.sub === 'shown' ? (
            <div className="deal-consequence">
              <span className="deal-value-big">{fmt(value)}</span>
              <span className="deal-conseq-sips">{verdict}</span>
              <span className="deal-kicker">
                {dt.status === 'dealt' ? `${team.name} ender på ${fmt(dt.dealPoints ?? 0)} poeng` : `${team.name} ender på ${fmt(value)} poeng`}
              </span>
              <button className="btn btn-primary btn-xl" data-primary onClick={afterShown}>
                {stage.teamIndex + 1 < order.length ? 'Neste koffert →' : 'Vis resultatene →'}
              </button>
            </div>
          ) : (
            <span className="deal-kicker deal-blink">{stage.sub === 'open' ? 'KOFFERTEN ÅPNES …' : '…'}</span>
          )}
        </div>
      </div>
    );
  }

  if (stage.name === 'results') {
    const ranked = [...teams].sort((a, b) => finalPoints(d, b) - finalPoints(d, a));
    const dealtTeams = teams.filter((t) => d.teams[t.id].status === 'dealt');
    const diff = (t: Team): number => (d.teams[t.id].dealPoints ?? 0) - (caseOf(d.teams[t.id].caseNo)?.value ?? 0);
    const best = dealtTeams.filter((t) => diff(t) > 0).sort((a, b) => diff(b) - diff(a))[0];
    const worst = dealtTeams.filter((t) => diff(t) < 0).sort((a, b) => diff(a) - diff(b))[0];
    const noDeals = (t: Team): number => d.teams[t.id].offers.filter((o) => o.answer === 'nodeal').length;
    const gambler = [...teams].sort((a, b) => noDeals(b) - noDeals(a))[0];
    const topCase = [...d.cases].sort((a, b) => b.value - a.value)[0];
    const topOwner = topCase ? ownerOf(topCase) : undefined;
    overlay = (
      <div className="deal-overlay deal-overlay-results">
        <Confetti active colors={['#ffd86b', '#fff', ranked[0]?.color ?? '#fff']} />
        <span className="deal-logo-main deal-results-title">DEAL OR DRINK – RESULTATER</span>
        <ol className="deal-results-list">
          {ranked.map((t, i) => (
            <li key={t.id} className={`deal-results-row place-${i + 1}`} style={{ ['--team' as string]: t.color }}>
              <span className="deal-results-rank">{i + 1}.</span>
              <span className="deal-results-team">
                {t.emoji} {t.name}
              </span>
              <span className="deal-results-how">
                {d.teams[t.id].status === 'dealt' ? `DEAL i runde ${d.teams[t.id].dealRound}` : `Koffert ${d.teams[t.id].caseNo}`}
              </span>
              <span className="deal-results-points">{fmt(finalPoints(d, t))}</span>
            </li>
          ))}
        </ol>
        <div className="deal-stats">
          <div className="deal-stat">
            <span className="deal-kicker">BESTE DEAL</span>
            <strong>{best ? `${best.emoji} ${best.name}` : '–'}</strong>
            <small>{best ? `tok ${fmt(d.teams[best.id].dealPoints ?? 0)}, kofferten hadde ${fmt(caseOf(d.teams[best.id].caseNo)?.value ?? 0)}` : 'ingen gode deals'}</small>
          </div>
          <div className="deal-stat">
            <span className="deal-kicker">VERSTE DEAL</span>
            <strong>{worst ? `${worst.emoji} ${worst.name}` : '–'}</strong>
            <small>{worst ? `tok ${fmt(d.teams[worst.id].dealPoints ?? 0)}, kofferten hadde ${fmt(caseOf(d.teams[worst.id].caseNo)?.value ?? 0)}` : 'ingen dårlige deals'}</small>
          </div>
          <div className="deal-stat">
            <span className="deal-kicker">STØRSTE GAMBLER</span>
            <strong>{gambler && noDeals(gambler) > 0 ? `${gambler.emoji} ${gambler.name}` : '–'}</strong>
            <small>{gambler && noDeals(gambler) > 0 ? `${noDeals(gambler)} × NO DEAL` : 'ingen sa NO DEAL'}</small>
          </div>
          <div className="deal-stat">
            <span className="deal-kicker">KVELDENS KOFFERT</span>
            <strong>{topCase ? `Koffert ${topCase.n} – ${fmt(topCase.value)}` : '–'}</strong>
            <small>{topOwner ? `${topOwner.emoji} ${topOwner.name} sin koffert` : topCase?.opened ? 'åpnet underveis' : 'ble aldri åpnet'}</small>
          </div>
        </div>
        <button className="btn btn-primary btn-xl" data-primary onClick={addToTotals}>
          LEGG POENG TIL TOTALSTILLING →
        </button>
      </div>
    );
  }

  /* ----- host panel ----- */

  const hostPanel = (
    <aside className={`deal-host ${panel ? 'deal-host-open' : ''}`}>
      <div className="deal-host-head">
        <strong>🎛 Host</strong>
        <span className="muted">
          Runde {d.round} · {unopenedLeft(d)} igjen · {stage.name}
          {'sub' in stage ? `/${stage.sub}` : ''}
        </span>
        <button className="btn btn-icon" onClick={() => setPanel(false)} title="Lukk (H)">
          ✕
        </button>
      </div>

      {stage.name === 'bank' && activeTeam && (stage.sub === 'thinking' || stage.sub === 'comment' || stage.sub === 'offer') && (
        <div className="deal-host-offer" style={{ ['--team' as string]: activeTeam.color }}>
          <div className="deal-host-offer-title">
            Tilbud til {activeTeam.emoji} {activeTeam.name}
            {stage.final ? ' (siste)' : ''}
          </div>
          <div className="muted deal-host-ev">
            Igjen i spill: {remainingValues(d).map(fmt).join(' · ')}
            <br />
            {stage.sub === 'thinking'
              ? `${BANKER} sender dette selv om noen sekunder. Endre og trykk send for å overstyre.`
              : `Sendt: ${fmt(d.teams[activeTeam.id].offers.at(-1)?.points ?? 0)} poeng`}
          </div>
          <label>
            Poeng
            <input type="number" value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value })} />
          </label>
          <label>
            Slurker å dele ut
            <input type="number" value={draft.sips} onChange={(e) => setDraft({ ...draft, sips: e.target.value })} />
          </label>
          <label>
            Spesialbonus (valgfri)
            <input value={draft.bonus} placeholder="f.eks. én shot til motstanderne" onChange={(e) => setDraft({ ...draft, bonus: e.target.value })} />
          </label>
          <button className="btn btn-primary" onClick={sendOffer} disabled={stage.sub !== 'thinking'}>
            {stage.sub === 'thinking' ? 'SEND TILBUD TIL TV' : 'Tilbudet er sendt'}
          </button>
        </div>
      )}

      <div className="deal-host-cases">
        {d.cases.map((c) => {
          const owner = ownerOf(c);
          return (
            <div key={c.n} className={`deal-host-case ${c.opened ? 'gone' : ''}`} style={owner ? { ['--team' as string]: owner.color } : undefined}>
              <span className="deal-host-case-n">{c.n}</span>
              <span className="deal-host-case-v">{fmt(c.value)}</span>
              {owner && <span className="deal-host-case-o">{owner.emoji}</span>}
            </div>
          );
        })}
      </div>

      <div className="deal-host-teams">
        {teams.map((t) => {
          const dt = d.teams[t.id];
          return (
            <div key={t.id} className="deal-host-team" style={{ ['--team' as string]: t.color }}>
              <span>
                {t.emoji} {t.name}
              </span>
              <span className="muted">
                K{dt.caseNo ?? '?'} · {dt.status === 'dealt' ? `DEAL ${fmt(dt.dealPoints ?? 0)}` : 'spiller'} · ut {dt.sipsOut} · inn {dt.sipsIn}
              </span>
            </div>
          );
        })}
      </div>

      <div className="deal-host-actions">
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!(state.dealHistory?.length ?? 0)}>
          ↶ Angre siste handling
        </button>
        <button className="btn btn-ghost btn-sm" onClick={dramaticPause}>
          🎭 Dramatisk pause
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => act((x) => ({ ...x, alcoholFree: !x.alcoholFree }), false)}>
          {d.alcoholFree ? '🍺 Bytt til alkohol' : '🧃 Bytt til alkoholfritt'}
        </button>
        {stage.name === 'round' && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() =>
              act((x) => {
                const playing = playingIndices(x, teams);
                return playing.length ? { ...x, stage: { name: 'bank', sub: 'ringing', teamIndex: playing[0], final: nonOwnedLeft(x) === 0 } } : x;
              })
            }
          >
            📞 Banken ringer nå
          </button>
        )}
        {(stage.name === 'round' || stage.name === 'bank') && (
          <button className="btn btn-ghost btn-sm" onClick={() => act((x) => ({ ...x, stage: { name: 'reveal', sub: 'intro', teamIndex: 0 } }))}>
            🎬 Start finale-avsløringen
          </button>
        )}
        {stage.name !== 'results' && (
          <button className="btn btn-ghost btn-sm" onClick={() => act((x) => ({ ...x, stage: { name: 'results' } }))}>
            🏆 Vis resultater
          </button>
        )}
        <button
          className="btn btn-danger btn-sm"
          onClick={() => {
            if (window.confirm('Starte Deal or Drink på nytt?')) update((s) => ({ ...s, deal: initDeal(s.teams), dealHistory: [] }));
          }}
        >
          Start på nytt
        </button>
      </div>
    </aside>
  );

  /* ----- main TV layout ----- */

  return (
    <div className={`screen deal ${overlay ? 'deal-has-overlay' : ''}`}>
      <div className="deal-spotlights" aria-hidden="true" />

      <header className="deal-top">
        <div className="deal-top-logo">
          DEAL <span>OR</span> DRINK
        </div>
        <div className="deal-top-headline">{headline()}</div>
        <div className="deal-top-round">
          <span className="deal-top-left">{unopenedLeft(d)} kofferter igjen</span>
          <span className={`deal-round-dot ${bankCallsAfter(d) || nonOwnedLeft(d) === 0 ? 'now' : ''}`} title="Rød = Banken ringer etter denne runden" />
        </div>
      </header>

      <div className="deal-main">
        <div className="deal-values deal-values-low">
          {sortedValues.slice(0, 10).map((v, i) => (
            <span key={i} className={`deal-val ${valueGone(v, i) ? 'deal-val-gone' : ''}`}>
              {fmt(v)}
            </span>
          ))}
        </div>

        <div className="deal-board">
          {d.cases
            .filter((c) => !c.owner)
            .map((c) => (
              <Suitcase key={c.n} c={c} clickable={boardClickable(c)} onClick={() => onBoardClick(c)} />
            ))}
        </div>

        <div className="deal-values deal-values-high">
          {sortedValues.slice(10).map((v, i) => (
            <span key={i} className={`deal-val ${valueGone(v, i + 10) ? 'deal-val-gone' : ''}`}>
              {fmt(v)}
            </span>
          ))}
        </div>
      </div>

      <footer className="deal-teams">
        {teams.map((t) => {
          const dt = d.teams[t.id];
          const isActive = activeTeam?.id === t.id;
          const own = caseOf(dt.caseNo);
          return (
            <div key={t.id} className={`deal-team ${isActive ? 'deal-team-active' : ''} ${dt.status === 'dealt' ? 'deal-team-dealt' : ''}`} style={{ ['--team' as string]: t.color }}>
              <div className="deal-team-suitcase">
                {own ? (
                  <Suitcase c={{ ...own, opened: own.opened && dt.revealed }} team={t} />
                ) : (
                  <div className="deal-team-nocase">{isActive ? 'velger …' : '?'}</div>
                )}
              </div>
              <div className="deal-team-info">
                <div className="deal-team-name">
                  {t.emoji} {t.name}
                </div>
                <div className="deal-team-status">{dt.status === 'dealt' ? `DEAL · ${fmt(dt.dealPoints ?? 0)} p` : 'SPILLER'}</div>
                <div className="deal-team-sips">
                  <span title="Slurker laget kan dele ut">🍻 {dt.sipsOut}</span>
                  <span title="Slurker hver på laget har tatt">🥴 {dt.sipsIn}</span>
                </div>
              </div>
            </div>
          );
        })}
      </footer>

      <Portal>
        {overlay}
        {paused && (
          <div className="deal-overlay deal-overlay-pause">
            <div className="deal-spot-beam" />
            <span className="deal-huge deal-blink">…</span>
          </div>
        )}
        <button className="btn btn-icon deal-host-toggle" title="Host-panel (H)" onClick={() => setPanel((p) => !p)}>
          🎛
        </button>
        {hostPanel}
      </Portal>
    </div>
  );
}
