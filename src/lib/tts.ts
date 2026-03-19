const STORAGE_KEY = 'tts-muted';

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let onPlaybackEnd: (() => void) | null = null;
let wordTimers: ReturnType<typeof setTimeout>[] = [];

function isMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function getMuted(): boolean {
  return isMuted();
}

export function setMuted(muted: boolean): void {
  try {
    if (muted) {
      localStorage.setItem(STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable
  }
  if (muted) stopSpeaking();
}

export function stopSpeaking(): void {
  for (const t of wordTimers) clearTimeout(t);
  wordTimers = [];
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute('src');
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  if (onPlaybackEnd) {
    onPlaybackEnd();
    onPlaybackEnd = null;
  }
}

export type WordTiming = { text: string; offset: number };

/**
 * Speak text with subtitle-style word highlighting.
 * The full text shows immediately; `onHighlight` reports the current
 * word index so the UI can highlight it like subtitles/karaoke.
 */
export async function speakRealtime(
  text: string,
  callbacks?: {
    onStart?: () => void;
    onHighlight?: (wordIndex: number) => void;
    onEnd?: () => void;
  },
): Promise<void> {
  if (isMuted() || !text.trim()) return;

  stopSpeaking();

  callbacks?.onStart?.();

  let res: Response;
  try {
    res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, realtime: true }),
    });
  } catch {
    console.warn('[TTS] Network error — skipping playback');
    callbacks?.onEnd?.();
    return;
  }

  if (!res.ok) {
    console.warn('[TTS] Server error', res.status);
    callbacks?.onEnd?.();
    return;
  }

  let payload: { audio: string; words: WordTiming[] };
  try {
    payload = await res.json();
  } catch {
    console.warn('[TTS] Invalid response body');
    callbacks?.onEnd?.();
    return;
  }

  // Decode base64 audio → blob → object URL
  const raw = atob(payload.audio);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  currentObjectUrl = url;
  onPlaybackEnd = callbacks?.onEnd ?? null;

  // Schedule word highlight callbacks based on timing offsets
  const words = payload.words;
  if (words.length > 0 && callbacks?.onHighlight) {
    for (let i = 0; i < words.length; i++) {
      const cb = callbacks.onHighlight;
      const idx = i;
      const timer = setTimeout(() => cb(idx), words[i].offset);
      wordTimers.push(timer);
    }
  }

  const finish = () => {
    for (const t of wordTimers) clearTimeout(t);
    wordTimers = [];
    cleanup();
    callbacks?.onEnd?.();
  };

  audio.addEventListener('ended', finish);
  audio.addEventListener('error', () => {
    console.warn('[TTS] Audio playback error');
    finish();
  });

  try {
    await audio.play();
  } catch {
    console.warn('[TTS] Audio.play() rejected — browser may require user gesture');
    finish();
  }
}

/** Simple non-realtime speak (for replay button). */
export async function speak(
  text: string,
  callbacks?: { onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  if (isMuted() || !text.trim()) return;

  stopSpeaking();

  let res: Response;
  try {
    res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch {
    console.warn('[TTS] Network error — skipping playback');
    return;
  }

  if (!res.ok) {
    console.warn('[TTS] Server error', res.status);
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  currentObjectUrl = url;

  callbacks?.onStart?.();
  onPlaybackEnd = callbacks?.onEnd ?? null;

  audio.addEventListener('ended', () => {
    cleanup();
    callbacks?.onEnd?.();
  });
  audio.addEventListener('error', () => {
    console.warn('[TTS] Audio playback error');
    cleanup();
    callbacks?.onEnd?.();
  });

  try {
    await audio.play();
  } catch {
    console.warn('[TTS] Audio.play() rejected — browser may require user gesture');
    cleanup();
    callbacks?.onEnd?.();
  }
}

function cleanup() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  currentAudio = null;
  onPlaybackEnd = null;
}
