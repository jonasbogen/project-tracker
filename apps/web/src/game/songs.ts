/**
 * The 6 minutter song quiz. Each clip is 20 seconds of audio lifted from the
 * host's Teams screen recordings (Spotify on a phone); the pictures are never
 * shown, only the sound. Files live in public/six/NN.m4a, numbered after the
 * recording they came from ("MicrosoftTeams-video (NN).mp4").
 *
 * Every song has a little emoji scene that plays when the title is revealed,
 * something the room can connect with the song.
 */
export type Motion = 'bounce' | 'sway' | 'spin' | 'float' | 'shake' | 'drive' | 'rise' | 'pulse' | 'wave';

export interface Song {
  file: string;
  title: string;
  artist: string;
  /** Emoji scene shown with the title, and how it moves. */
  scene: string[];
  motion: Motion;
  /** This one always opens the round; the rest are shuffled behind it. */
  first?: boolean;
}

export const SONG_SEC = 20;
/** Silence between two songs, with the answers still on screen. */
export const GAP_SEC = 3;
/** Sips a team hands out for a correct title or artist. */
export const SIPS = 5;

export const SONGS: Song[] = [
  { file: '/six/07.m4a', title: 'Kygo Jo', artist: 'Kygo, Flow Kingz, JMK, Lyng', scene: ['🏃', '🌴', '🎧', '☀️'], motion: 'drive', first: true },
  { file: '/six/05.m4a', title: 'Viva La Vida', artist: 'Soppgirobygget', scene: ['👑', '🇳🇴', '🔔', '⚔️'], motion: 'sway' },
  { file: '/six/06.m4a', title: 'Alt for Norge', artist: 'Drillos, Jørn Lande', scene: ['⚽', '🇳🇴', '🏆', '🥅'], motion: 'bounce' },
  { file: '/six/08.m4a', title: 'Bender 2018', artist: 'Soppgirobygget', scene: ['🍻', '🎉', '🕺', '🍺'], motion: 'shake' },
  { file: '/six/09.m4a', title: 'Mmm Yeah', artist: 'Austin Mahone, Pitbull', scene: ['😏', '💃', '🔥', '🎤'], motion: 'pulse' },
  { file: '/six/10.m4a', title: 'Tilbake i City', artist: 'Kamelen', scene: ['🚔', '🏙️', '🛵', '💨'], motion: 'drive' },
  { file: '/six/11.m4a', title: 'Moves Like Jagger', artist: 'Maroon 5, Christina Aguilera', scene: ['🕺', '👄', '🎤', '✨'], motion: 'shake' },
  { file: '/six/12.m4a', title: 'YMCA', artist: 'Village People', scene: ['🙆', '👷', '👮', '🤠'], motion: 'wave' },
  { file: '/six/13.m4a', title: 'Mamma Mia', artist: 'ABBA', scene: ['💃', '🇸🇪', '💔', '🎹'], motion: 'sway' },
  { file: '/six/14.m4a', title: 'Gimme! Gimme! Gimme! (A Man After Midnight)', artist: 'ABBA', scene: ['🌙', '🕛', '💃', '🪩'], motion: 'spin' },
  { file: '/six/15.m4a', title: 'Runaway', artist: 'Bon Jovi', scene: ['🏃‍♀️', '🚕', '🌃', '💨'], motion: 'drive' },
  { file: '/six/16.m4a', title: 'Bohemian Rhapsody', artist: 'Queen', scene: ['🎹', '⚡', '🎸', '👑'], motion: 'shake' },
  { file: '/six/17.m4a', title: 'I Gotta Feeling', artist: 'Black Eyed Peas', scene: ['🎉', '🌃', '🥂', '🕺'], motion: 'bounce' },
  { file: '/six/18.m4a', title: 'Womanizer', artist: 'Britney Spears', scene: ['💋', '👠', '😈', '💄'], motion: 'pulse' },
  { file: '/six/19.m4a', title: 'Nights Like These', artist: 'Benson Boone', scene: ['🌙', '✨', '🌃', '💫'], motion: 'float' },
  { file: '/six/20.m4a', title: "Don't Stop the Music", artist: 'Rihanna', scene: ['🎧', '🪩', '💃', '🔊'], motion: 'spin' },
  { file: '/six/21.m4a', title: 'Eye of the Tiger', artist: 'Survivor', scene: ['🐯', '🥊', '🔥', '💪'], motion: 'shake' },
  { file: '/six/22.m4a', title: 'On Top of the World', artist: 'Imagine Dragons', scene: ['🌍', '🎈', '🏔️', '☀️'], motion: 'float' },
  { file: '/six/23.m4a', title: 'Afterski', artist: 'Broiler', scene: ['⛷️', '🍻', '🏔️', '🎿'], motion: 'sway' },
  { file: '/six/24.m4a', title: 'Beat It', artist: 'Michael Jackson', scene: ['🧥', '🕺', '🔪', '🚶'], motion: 'drive' },
  { file: '/six/25.m4a', title: 'Hotel California', artist: 'Eagles', scene: ['🌴', '🏨', '🌅', '🎸'], motion: 'sway' },
  { file: '/six/26.m4a', title: 'You Make My Dreams (Come True)', artist: 'Daryl Hall & John Oates', scene: ['💭', '❤️', '🎹', '✨'], motion: 'bounce' },
  { file: '/six/27.m4a', title: 'Miracle', artist: 'Calvin Harris, Ellie Goulding', scene: ['✨', '🌈', '💫', '🙏'], motion: 'float' },
  { file: '/six/28.m4a', title: 'Sommer og skolefri', artist: 'Malin', scene: ['☀️', '🏖️', '🍦', '🎒'], motion: 'bounce' },
  { file: '/six/29.m4a', title: 'E-Ore', artist: 'DJ Løv, Ravi', scene: ['🪙', '🧑‍🎤', '🍺', '💸'], motion: 'spin' },
  { file: '/six/30.m4a', title: 'P.I.M.P.', artist: '50 Cent', scene: ['🎩', '💰', '💎', '😎'], motion: 'pulse' },
  { file: '/six/31.m4a', title: 'Oops!... I Did It Again', artist: 'Britney Spears', scene: ['👩‍🚀', '🚀', '🔴', '💋'], motion: 'float' },
  { file: '/six/32.m4a', title: "I'm Still Standing", artist: 'Elton John', scene: ['🕶️', '🎩', '🎹', '🌊'], motion: 'bounce' },
  { file: '/six/33.m4a', title: 'Party in the U.S.A.', artist: 'Miley Cyrus', scene: ['🇺🇸', '✈️', '🎉', '🌴'], motion: 'wave' },
  { file: '/six/34.m4a', title: 'Kids', artist: 'MGMT', scene: ['👶', '🎈', '🎹', '🌈'], motion: 'bounce' },
  { file: '/six/35.m4a', title: 'Viva La Vida', artist: 'Coldplay', scene: ['👑', '🔔', '⛪', '🏰'], motion: 'sway' },
  { file: '/six/36.m4a', title: 'Just Dance', artist: "Lady Gaga, Colby O'Donis", scene: ['🪩', '💃', '🎉', '🕶️'], motion: 'spin' },
  { file: '/six/37.m4a', title: 'Shut Up', artist: 'Stormzy', scene: ['🤫', '🎤', '🇬🇧', '🔥'], motion: 'shake' },
  { file: '/six/38.m4a', title: 'Starboy', artist: 'The Weeknd, Daft Punk', scene: ['⭐', '🚗', '💎', '🌃'], motion: 'drive' },
  { file: '/six/39.m4a', title: 'Wake Me Up', artist: 'Avicii', scene: ['⏰', '🌅', '🚶‍♂️', '🎻'], motion: 'rise' },
  { file: '/six/40.m4a', title: 'Sexy Bitch', artist: 'David Guetta, Akon', scene: ['🏊', '🕶️', '🍹', '☀️'], motion: 'pulse' },
  { file: '/six/41.m4a', title: 'Firework', artist: 'Katy Perry', scene: ['🎆', '🎇', '✨', '💥'], motion: 'rise' },
  { file: '/six/42.m4a', title: 'Grenade', artist: 'Bruno Mars', scene: ['💣', '❤️', '💥', '🔥'], motion: 'shake' },
  { file: '/six/43.m4a', title: 'Adore You', artist: 'Harry Styles', scene: ['🐟', '💙', '🌊', '💕'], motion: 'float' },
  { file: '/six/44.m4a', title: "Ridin' Solo", artist: 'Jason Derulo', scene: ['🚗', '😎', '🎉', '🕺'], motion: 'drive' },
];

/** A fresh playing order: the opener first, everything else shuffled. */
export function shuffledOrder(): number[] {
  const first = SONGS.findIndex((s) => s.first);
  const rest = SONGS.map((_, i) => i).filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first >= 0 ? [first, ...rest] : rest;
}
