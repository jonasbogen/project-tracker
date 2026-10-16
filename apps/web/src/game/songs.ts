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
  /** Portrait of the (main) artist, shown in the Artist box when it opens. */
  image: string;
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
export const GAP_SEC = 2;
/** Sips a team hands out for a correct title or artist. */
export const SIPS = 5;
/** Extra points for the team with the most titles and artists when the alarm goes. */
export const MOST_BONUS = 2;
/** The hidden clock stops for the Ice round at the first song change after this many seconds. */
export const ICE_AT_SEC = 3 * 60 + 40;
/** The Smirnoff Ice song (audio only), looped while the team decides. */
export const ICE_SONG = '/six/ice.m4a';

export const SONGS: Song[] = [
  { file: '/six/07.m4a', image: '/six/artists/07.jpg', title: 'Kygo Jo', artist: 'Kygo, Flow Kingz, JMK, Lyng', scene: ['🏃', '🌴', '🎧', '☀️'], motion: 'drive', first: true },
  { file: '/six/05.m4a', image: '/six/artists/05.jpg', title: 'Viva La Vida', artist: 'Soppgirobygget', scene: ['👑', '🇳🇴', '🔔', '⚔️'], motion: 'sway' },
  { file: '/six/06.m4a', image: '/six/artists/06.jpg', title: 'Alt for Norge', artist: 'Drillos, Jørn Lande', scene: ['⚽', '🇳🇴', '🏆', '🥅'], motion: 'bounce' },
  { file: '/six/08.m4a', image: '/six/artists/08.jpg', title: 'Bender 2018', artist: 'Soppgirobygget', scene: ['🍻', '🎉', '🕺', '🍺'], motion: 'shake' },
  { file: '/six/09.m4a', image: '/six/artists/09.jpg', title: 'Mmm Yeah', artist: 'Austin Mahone, Pitbull', scene: ['😏', '💃', '🔥', '🎤'], motion: 'pulse' },
  { file: '/six/10.m4a', image: '/six/artists/10.jpg', title: 'Tilbake i City', artist: 'Kamelen', scene: ['🚔', '🏙️', '🛵', '💨'], motion: 'drive' },
  { file: '/six/11.m4a', image: '/six/artists/11.jpg', title: 'Moves Like Jagger', artist: 'Maroon 5, Christina Aguilera', scene: ['🕺', '👄', '🎤', '✨'], motion: 'shake' },
  { file: '/six/12.m4a', image: '/six/artists/12.jpg', title: 'YMCA', artist: 'Village People', scene: ['🙆', '👷', '👮', '🤠'], motion: 'wave' },
  { file: '/six/13.m4a', image: '/six/artists/13.jpg', title: 'Mamma Mia', artist: 'ABBA', scene: ['💃', '🇸🇪', '💔', '🎹'], motion: 'sway' },
  { file: '/six/14.m4a', image: '/six/artists/14.jpg', title: 'Gimme! Gimme! Gimme! (A Man After Midnight)', artist: 'ABBA', scene: ['🌙', '🕛', '💃', '🪩'], motion: 'spin' },
  { file: '/six/15.m4a', image: '/six/artists/15.jpg', title: 'Runaway', artist: 'Bon Jovi', scene: ['🏃‍♀️', '🚕', '🌃', '💨'], motion: 'drive' },
  { file: '/six/16.m4a', image: '/six/artists/16.jpg', title: 'Bohemian Rhapsody', artist: 'Queen', scene: ['🎹', '⚡', '🎸', '👑'], motion: 'shake' },
  { file: '/six/17.m4a', image: '/six/artists/17.jpg', title: 'I Gotta Feeling', artist: 'Black Eyed Peas', scene: ['🎉', '🌃', '🥂', '🕺'], motion: 'bounce' },
  { file: '/six/18.m4a', image: '/six/artists/18.jpg', title: 'Womanizer', artist: 'Britney Spears', scene: ['💋', '👠', '😈', '💄'], motion: 'pulse' },
  { file: '/six/19.m4a', image: '/six/artists/19.jpg', title: 'Nights Like These', artist: 'Benson Boone', scene: ['🌙', '✨', '🌃', '💫'], motion: 'float' },
  { file: '/six/20.m4a', image: '/six/artists/20.jpg', title: "Don't Stop the Music", artist: 'Rihanna', scene: ['🎧', '🪩', '💃', '🔊'], motion: 'spin' },
  { file: '/six/21.m4a', image: '/six/artists/21.jpg', title: 'Eye of the Tiger', artist: 'Survivor', scene: ['🐯', '🥊', '🔥', '💪'], motion: 'shake' },
  { file: '/six/22.m4a', image: '/six/artists/22.jpg', title: 'On Top of the World', artist: 'Imagine Dragons', scene: ['🌍', '🎈', '🏔️', '☀️'], motion: 'float' },
  { file: '/six/23.m4a', image: '/six/artists/23.jpg', title: 'Afterski', artist: 'Broiler', scene: ['⛷️', '🍻', '🏔️', '🎿'], motion: 'sway' },
  { file: '/six/24.m4a', image: '/six/artists/24.jpg', title: 'Beat It', artist: 'Michael Jackson', scene: ['🧥', '🕺', '🔪', '🚶'], motion: 'drive' },
  { file: '/six/25.m4a', image: '/six/artists/25.jpg', title: 'Hotel California', artist: 'Eagles', scene: ['🌴', '🏨', '🌅', '🎸'], motion: 'sway' },
  { file: '/six/26.m4a', image: '/six/artists/26.jpg', title: 'You Make My Dreams (Come True)', artist: 'Daryl Hall & John Oates', scene: ['💭', '❤️', '🎹', '✨'], motion: 'bounce' },
  { file: '/six/27.m4a', image: '/six/artists/27.jpg', title: 'Miracle', artist: 'Calvin Harris, Ellie Goulding', scene: ['✨', '🌈', '💫', '🙏'], motion: 'float' },
  { file: '/six/28.m4a', image: '/six/artists/28.jpg', title: 'Sommer og skolefri', artist: 'Malin', scene: ['☀️', '🏖️', '🍦', '🎒'], motion: 'bounce' },
  { file: '/six/29.m4a', image: '/six/artists/29.jpg', title: 'E-Ore', artist: 'DJ Løv, Ravi', scene: ['🪙', '🧑‍🎤', '🍺', '💸'], motion: 'spin' },
  { file: '/six/30.m4a', image: '/six/artists/30.jpg', title: 'P.I.M.P.', artist: '50 Cent', scene: ['🎩', '💰', '💎', '😎'], motion: 'pulse' },
  { file: '/six/31.m4a', image: '/six/artists/31.jpg', title: 'Oops!... I Did It Again', artist: 'Britney Spears', scene: ['👩‍🚀', '🚀', '🔴', '💋'], motion: 'float' },
  { file: '/six/32.m4a', image: '/six/artists/32.jpg', title: "I'm Still Standing", artist: 'Elton John', scene: ['🕶️', '🎩', '🎹', '🌊'], motion: 'bounce' },
  { file: '/six/33.m4a', image: '/six/artists/33.jpg', title: 'Party in the U.S.A.', artist: 'Miley Cyrus', scene: ['🇺🇸', '✈️', '🎉', '🌴'], motion: 'wave' },
  { file: '/six/34.m4a', image: '/six/artists/34.jpg', title: 'Kids', artist: 'MGMT', scene: ['👶', '🎈', '🎹', '🌈'], motion: 'bounce' },
  { file: '/six/35.m4a', image: '/six/artists/35.jpg', title: 'Viva La Vida', artist: 'Coldplay', scene: ['👑', '🔔', '⛪', '🏰'], motion: 'sway' },
  { file: '/six/36.m4a', image: '/six/artists/36.jpg', title: 'Just Dance', artist: "Lady Gaga, Colby O'Donis", scene: ['🪩', '💃', '🎉', '🕶️'], motion: 'spin' },
  { file: '/six/37.m4a', image: '/six/artists/37.jpg', title: 'Shut Up', artist: 'Stormzy', scene: ['🤫', '🎤', '🇬🇧', '🔥'], motion: 'shake' },
  { file: '/six/38.m4a', image: '/six/artists/38.jpg', title: 'Starboy', artist: 'The Weeknd, Daft Punk', scene: ['⭐', '🚗', '💎', '🌃'], motion: 'drive' },
  { file: '/six/39.m4a', image: '/six/artists/39.jpg', title: 'Wake Me Up', artist: 'Avicii', scene: ['⏰', '🌅', '🚶‍♂️', '🎻'], motion: 'rise' },
  { file: '/six/40.m4a', image: '/six/artists/40.jpg', title: 'Sexy Bitch', artist: 'David Guetta, Akon', scene: ['🏊', '🕶️', '🍹', '☀️'], motion: 'pulse' },
  { file: '/six/41.m4a', image: '/six/artists/41.jpg', title: 'Firework', artist: 'Katy Perry', scene: ['🎆', '🎇', '✨', '💥'], motion: 'rise' },
  { file: '/six/42.m4a', image: '/six/artists/42.jpg', title: 'Grenade', artist: 'Bruno Mars', scene: ['💣', '❤️', '💥', '🔥'], motion: 'shake' },
  { file: '/six/43.m4a', image: '/six/artists/43.jpg', title: 'Adore You', artist: 'Harry Styles', scene: ['🐟', '💙', '🌊', '💕'], motion: 'float' },
  { file: '/six/44.m4a', image: '/six/artists/44.jpg', title: "Ridin' Solo", artist: 'Jason Derulo', scene: ['🚗', '😎', '🎉', '🕺'], motion: 'drive' },
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
