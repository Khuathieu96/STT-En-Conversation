import type { VercelRequest, VercelResponse } from '@vercel/node';
import { synthesize } from '../server/tts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice, realtime } = req.body ?? {};
    const result = await synthesize(text, voice, realtime);

    if (realtime) {
      return res.status(200).json({
        audio: result.audio.toString('base64'),
        words: result.words,
      });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', result.audio.length);
    return res.status(200).send(result.audio);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS synthesis failed';
    return res.status(400).json({ error: message });
  }
}
