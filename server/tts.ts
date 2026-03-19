import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const DEFAULT_VOICE = 'en-US-AriaNeural';
const MAX_TEXT_LENGTH = 500;
const MAX_RETRIES = 2;

export type WordTiming = { text: string; offset: number };
export type SynthesisResult = { audio: Buffer; words: WordTiming[] };

const SYNTHESIS_TIMEOUT_MS = 15_000;

async function synthesizeOnce(
  trimmed: string,
  voice: string,
  wantWordBoundary: boolean,
): Promise<SynthesisResult> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
    wordBoundaryEnabled: wantWordBoundary,
  });

  const { audioStream, metadataStream } = tts.toStream(trimmed);

  const audioChunks: Buffer[] = [];
  const words: WordTiming[] = [];

  // Collect metadata eagerly (don't await its 'end' — it may never fire).
  if (metadataStream) {
    metadataStream.on('data', (chunk: Buffer) => {
      try {
        const event = JSON.parse(chunk.toString());
        if (event?.Metadata) {
          for (const m of event.Metadata) {
            if (m?.Type === 'WordBoundary') {
              const offsetTicks: number = m.Data?.Offset ?? 0;
              const wordText: string = m.Data?.text?.Text ?? '';
              if (wordText) {
                words.push({
                  text: wordText,
                  offset: Math.round(offsetTicks / 10000), // ticks → ms
                });
              }
            }
          }
        }
      } catch {
        // skip malformed metadata chunks
      }
    });
    metadataStream.on('error', () => {/* ignore metadata errors */ });
  }

  // Only await the audio stream — metadata arrives before/alongside audio.
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TTS synthesis timed out')), SYNTHESIS_TIMEOUT_MS);
    audioStream.on('data', (chunk: Buffer) => audioChunks.push(Buffer.from(chunk)));
    audioStream.on('end', () => { clearTimeout(timer); resolve(); });
    audioStream.on('error', (err) => { clearTimeout(timer); reject(err); });
  });

  return { audio: Buffer.concat(audioChunks), words };
}

export async function synthesize(
  text: string,
  voice?: string,
  realtime?: boolean,
): Promise<SynthesisResult> {
  const trimmed = (text ?? '').trim();
  if (!trimmed) throw new Error('Text is required.');
  if (trimmed.length > MAX_TEXT_LENGTH)
    throw new Error(`Text exceeds ${MAX_TEXT_LENGTH} characters.`);

  const selectedVoice = voice?.trim() || DEFAULT_VOICE;
  const wantWordBoundary = realtime === true;

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await synthesizeOnce(trimmed, selectedVoice, wantWordBoundary);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Premature close') || msg.includes('Connect Error')) {
        // Retry on transient WebSocket failures
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
