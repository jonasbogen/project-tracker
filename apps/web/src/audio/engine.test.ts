import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Minimal stand-ins for the DOM pieces the engine touches, so the backing-track
 * hold can be checked without a browser.
 */
class FakeAudio {
  src = '';
  loop = false;
  preload = '';
  volume = 1;
  muted = false;
  paused = true;
  style: Record<string, string> = {};
  setAttribute(): void {}
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  remove(): void {}
}

const created: FakeAudio[] = [];

beforeEach(() => {
  created.length = 0;
  vi.stubGlobal('document', {
    createElement: () => {
      const el = new FakeAudio();
      created.push(el);
      return el;
    },
    body: { appendChild: () => undefined },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
  vi.stubGlobal('window', { AudioContext: undefined });
  vi.resetModules();
});

async function engine() {
  return (await import('./engine')).audio;
}

describe('backing track hold during the staged network error', () => {
  it('starts the backing track on the first user gesture', async () => {
    const audio = await engine();
    audio.ensure();
    expect(created[0].paused).toBe(false);
  });

  it('stays silent across clicks while held, and comes back on resume', async () => {
    const audio = await engine();
    audio.ensure();
    const backing = created[0];

    audio.pauseBackground();
    expect(backing.paused).toBe(true);

    // Every click and keypress goes through ensure(); it must not restart the music.
    audio.ensure();
    audio.ensure();
    expect(backing.paused).toBe(true);

    audio.resumeBackground();
    expect(backing.paused).toBe(false);

    // After the prank, ordinary gestures behave as before.
    backing.pause();
    audio.ensure();
    expect(backing.paused).toBe(false);
  });

  it('does not resume the backing track while a one-off track is in charge', async () => {
    const audio = await engine();
    audio.ensure();
    const backing = created[0];
    audio.playTrack('/finale.m4a');
    expect(backing.paused).toBe(true);
    audio.ensure();
    expect(backing.paused).toBe(true);
    audio.stopTrack();
    expect(backing.paused).toBe(false);
  });
});
