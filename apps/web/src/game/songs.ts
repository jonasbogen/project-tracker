/**
 * The 6 minutter song quiz. Each clip is 20 seconds of audio lifted from the
 * host's Teams screen recordings (Spotify on a phone); the pictures are never
 * shown, only the sound. Files live in public/six/NN.m4a, numbered after the
 * recording they came from ("MicrosoftTeams-video (NN).mp4").
 */
export interface Song {
  file: string;
  title: string;
  artist: string;
  /** This one always opens the round; the rest are shuffled behind it. */
  first?: boolean;
}

export const SONG_SEC = 20;

export const SONGS: Song[] = [
  { file: '/six/07.m4a', title: 'Kygo Jo', artist: 'Kygo, Flow Kingz, JMK, Lyng', first: true },
  { file: '/six/05.m4a', title: 'Viva La Vida', artist: 'Soppgirobygget' },
  { file: '/six/06.m4a', title: 'Alt for Norge', artist: 'Drillos, Jørn Lande' },
  { file: '/six/08.m4a', title: 'Bender 2018', artist: 'Soppgirobygget' },
  { file: '/six/09.m4a', title: 'Mmm Yeah', artist: 'Austin Mahone, Pitbull' },
  { file: '/six/10.m4a', title: 'Tilbake i City', artist: 'Kamelen' },
  { file: '/six/11.m4a', title: 'Moves Like Jagger', artist: 'Maroon 5, Christina Aguilera' },
  { file: '/six/12.m4a', title: 'YMCA', artist: 'Village People' },
  { file: '/six/13.m4a', title: 'Mamma Mia', artist: 'ABBA' },
  { file: '/six/14.m4a', title: 'Gimme! Gimme! Gimme! (A Man After Midnight)', artist: 'ABBA' },
  { file: '/six/15.m4a', title: 'Runaway', artist: 'Bon Jovi' },
  { file: '/six/16.m4a', title: 'Bohemian Rhapsody', artist: 'Queen' },
  { file: '/six/17.m4a', title: 'I Gotta Feeling', artist: 'Black Eyed Peas' },
  { file: '/six/18.m4a', title: 'Womanizer', artist: 'Britney Spears' },
  { file: '/six/19.m4a', title: 'Nights Like These', artist: 'Benson Boone' },
  { file: '/six/20.m4a', title: "Don't Stop the Music", artist: 'Rihanna' },
  { file: '/six/21.m4a', title: 'Eye of the Tiger', artist: 'Survivor' },
  { file: '/six/22.m4a', title: 'On Top of the World', artist: 'Imagine Dragons' },
  { file: '/six/23.m4a', title: 'Afterski', artist: 'Broiler' },
  { file: '/six/24.m4a', title: 'Beat It', artist: 'Michael Jackson' },
  { file: '/six/25.m4a', title: 'Hotel California', artist: 'Eagles' },
  { file: '/six/26.m4a', title: 'You Make My Dreams (Come True)', artist: 'Daryl Hall & John Oates' },
  { file: '/six/27.m4a', title: 'Miracle', artist: 'Calvin Harris, Ellie Goulding' },
  { file: '/six/28.m4a', title: 'Sommer og skolefri', artist: 'Malin' },
  { file: '/six/29.m4a', title: 'E-Ore', artist: 'DJ Løv, Ravi' },
  { file: '/six/30.m4a', title: 'P.I.M.P.', artist: '50 Cent' },
  { file: '/six/31.m4a', title: 'Oops!... I Did It Again', artist: 'Britney Spears' },
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
